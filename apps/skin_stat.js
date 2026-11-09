import { rulePrefix } from '../utils/common.js'
import SKLandUser from '../model/sklandUser.js'
import setting from '../utils/setting.js'
import runtimeRender from '../utils/runtimeRender.js'
import { normalizeSkinAssets } from '../model/skinAssets.js'

export class SkinStat extends plugin {
    constructor() {
        super({
            name: '[arknights-plugin]时装统计', dsc: '森空岛时装资产与最近获得时装',
            event: 'message', priority: 1000,
            rule: [{ reg: `^${rulePrefix}时装统计$`, fnc: 'skinStat' }]
        })
    }

    async skinStat() {
        const user = new SKLandUser(this.e.at || this.e.user_id)
        if (!await user.getUser()) { await this.reply('未绑定森空岛账号，请先绑定后查询。'); return true }
        try {
            const response = await user.getGamePlayerInfo()
            if (!response?.data || !Array.isArray(response.data.skins)) {
                await this.reply('未能获取时装资产，请检查森空岛绑定状态或稍后重试。')
                return true
            }
            const assets = normalizeSkinAssets(response.data, setting.getConfig('game_info').skin_stat_count)
            const updated = new Date(Number(response.timestamp) * 1000)
            await runtimeRender(this.e, 'skinStat/skinStat.html', {
                ...assets, user_info: { name: response.data.status?.name || user.name, uid: user.uid },
                updated_at: Number.isFinite(updated.getTime()) ? updated.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '时间未知'
            }, { scale: 1.0 })
        } catch {
            logger.error('[方舟插件][时装统计]查询或渲染失败')
            await this.reply('时装统计查询失败，请稍后重试。')
        }
        return true
    }
}
