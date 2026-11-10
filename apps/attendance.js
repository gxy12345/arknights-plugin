import { rulePrefix } from '../utils/common.js'
import SKLandUser from '../model/sklandUser.js'
import SklandAttendance, { formatAttendanceResults } from '../model/sklandAttendance.js'
import setting from '../utils/setting.js'
import common from '../../../lib/common/common.js'

export class SKLandAttendance extends plugin {
    constructor() {
        super({ name: '[arknights-plugin]签到', dsc: '森空岛签到', event: 'message', priority: 50,
            rule: [
                { reg: `^${rulePrefix}签到$`, fnc: 'attendance' },
                { reg: `^${rulePrefix}(全部签到|签到任务)$`, permission: 'master', fnc: 'attendance_task' }
            ] })
        this.task = { cron: setting.getConfig('sign')?.auto_sign_cron || '0 2 0 * * ?',
            name: '森空岛签到任务', fnc: () => this.attendance_task(true) }
        this.taskRunning = false
    }

    async signUser(userId, includeEndfield) {
        const user = new SKLandUser(userId)
        if (!await user.getUser()) return null
        return new SklandAttendance(user, { sleep: ms => common.sleep(ms) }).run({ includeEndfield })
    }

    async attendance() {
        try {
            const results = await this.signUser(this.e.user_id, true)
            await this.reply(results ? formatAttendanceResults(results) : '未绑定森空岛账号，请先发送“绑定”或“扫码绑定”（需添加插件前缀）。')
        } catch {
            logger.error('[方舟插件][签到]读取绑定或签到失败')
            await this.reply('签到失败，请检查绑定或稍后重试。')
        }
        return true
    }

    async attendance_task(scheduled = false) {
        const manual = scheduled !== true && Boolean(this.e?.msg)
        if (manual && !this.e.isMaster) return false
        const config = setting.getConfig('sign') || {}
        if (!manual && config.auto_sign === false) return true
        if (this.taskRunning) {
            if (manual) await this.reply('签到任务正在执行，请稍后查看结果。')
            return true
        }
        this.taskRunning = true
        const includeEndfield = config.auto_sign_endfield !== false
        const stats = Object.fromEntries(['arknights', 'endfield'].map(game => [game, { success: 0, signed: 0, failed: 0, skipped: 0 }]))
        let accountFailures = 0
        try {
            const keys = await redis.keys('ARKNIGHTS:USER:*')
            if (manual) await this.reply('森空岛签到任务开始')
            logger.mark('[方舟插件][签到任务]签到任务开始')
            for (const key of keys) {
                await common.sleep(2000)
                try {
                    const results = await this.signUser(key.slice('ARKNIGHTS:USER:'.length), includeEndfield)
                    if (!results) { accountFailures++; continue }
                    for (const result of results) stats[result.game][result.status]++
                } catch { accountFailures++ }
            }
            const summary = (name, value) => `${name}：成功 ${value.success}，已签 ${value.signed}，失败 ${value.failed}，跳过 ${value.skipped}`
            const message = [`森空岛签到任务完成：处理账号 ${keys.length} 个`, summary('明日方舟', stats.arknights),
                includeEndfield ? summary('终末地', stats.endfield) : '终末地：已关闭自动签到',
                `账号读取失败：${accountFailures} 个`].join('\n')
            logger.mark(`[方舟插件][签到任务]${message}`)
            if (manual) await this.reply(message)
        } catch {
            logger.error('[方舟插件][签到任务]读取账号列表或执行任务失败')
            if (manual) await this.reply('签到任务执行失败，请稍后重试。')
        } finally { this.taskRunning = false }
        return true
    }
}
