import { rulePrefix } from '../utils/common.js'
import SKLandUser from '../model/sklandUser.js'
import GarrisonService from '../model/garrisonService.js'
import { formatGarrisonDuration, garrisonRecordLabels } from '../model/garrisonView.js'
import runtimeRender from '../utils/runtimeRender.js'

const pageSize = 10
const cacheSeconds = 300
const nowText = () => new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
const argument = (event, command) => event.msg.replace(new RegExp(`^${rulePrefix}(?:卫戍协议|卫戍)${command}`), '').trim()
const safeImage = value => {
    try {
        const url = new URL(value)
        return ['http:', 'https:'].includes(url.protocol) ? url.href.replace(/['"()\\]/g, encodeURIComponent) : ''
    } catch { return '' }
}

export class Garrison extends plugin {
    constructor() {
        super({
            name: '[arknights-plugin]卫戍协议',
            dsc: '卫戍协议攻略与历史战绩查询',
            event: 'message',
            priority: 100,
            rule: [
                { reg: `^${rulePrefix}(?:卫戍协议|卫戍)(?:帮助)?$`, fnc: 'help' },
                { reg: `^${rulePrefix}(?:卫戍协议|卫戍)攻略(?:\\s+.*)?$`, fnc: 'guides' },
                { reg: `^${rulePrefix}(?:卫戍协议|卫戍)攻略下一页$`, fnc: 'nextGuides' },
                { reg: `^${rulePrefix}(?:卫戍协议|卫戍)攻略详情\\s*\\S+$`, fnc: 'guideDetail' },
                { reg: `^${rulePrefix}(?:卫戍协议|卫戍)(?:历史)?战绩(?:\\s+.*)?$`, fnc: 'history' },
                { reg: `^${rulePrefix}(?:卫戍协议|卫戍)战绩详情\\s*\\d+$`, fnc: 'recordDetail' },
                { reg: `^${rulePrefix}(?:卫戍协议|卫戍)统计(?:\\s+[\\w-]{1,100})?$`, fnc: 'statistics' },
                { reg: `^${rulePrefix}(?:卫戍协议|卫戍)赛季$`, fnc: 'seasons' }
            ]
        })
    }

    async help() {
        await this.reply([
            '卫戍协议查询（需绑定森空岛账号）',
            '卫戍攻略 [关键词]：查询官方社区攻略',
            '卫戍攻略下一页：继续当前搜索',
            '卫戍攻略详情 序号或ID：查看阵容、盟约、装备和思路',
            '卫戍战绩 [页码] [赛季ID]：查看历史对局',
            '卫戍战绩详情 序号：查看上次战绩列表中的对局',
            '卫戍统计 [赛季ID]：查看本地累计战绩、常用策略与盟约、Boss 击杀和耗时',
            '卫戍赛季：查看官方可查询赛季',
            '以上命令均需添加当前插件前缀，例如「~卫戍战绩」。'
        ].join('\n'))
        return true
    }

    async withService(work) {
        try {
            const user = new SKLandUser(this.e.at || this.e.user_id)
            if (!await user.getUser()) {
                await this.reply('未绑定森空岛账号，请先绑定 cred 后查询。')
                return true
            }
            return await work(new GarrisonService(user), user)
        } catch (error) {
            logger.error('[方舟插件][卫戍协议]查询或渲染失败')
            await this.reply(error?.code === 'GARRISON_STATISTICS_STORAGE'
                ? '卫戍统计本地存储读取或写入失败，请检查云崽数据目录。'
                : '卫戍协议查询失败，请检查森空岛绑定状态或稍后重试。')
            return true
        }
    }

    cacheKey(kind, user) {
        return `ARKNIGHTS:GARRISON:${kind}:${this.e.user_id}:${user.uid}`
    }

    async readState(kind, user) {
        const value = await redis.get(this.cacheKey(kind, user))
        if (!value) return null
        try { return JSON.parse(value) } catch { return null }
    }

    async saveState(kind, user, value) {
        await redis.set(this.cacheKey(kind, user), JSON.stringify(value), { EX: cacheSeconds })
    }

    presentation(resource = {}, seasonId = '') {
        const id = seasonId || resource.versionInfo?.seasonId || ''
        const season = (resource.seasons || []).find(item => item.seasonId === id)
        const image = (resource.image || []).find(item => item.seasonId === id)
        return { seasonName: season?.name || id || '当前赛季', backgroundUrl: safeImage(image?.backgroundPc || image?.backgroundMobile), updated_at: nowText() }
    }

    async renderPage(service, path, data, resource, seasonId) {
        const doctor = await service.getDoctor()
        await runtimeRender(this.e, path, { ...data, doctor, ...this.presentation(resource, seasonId) }, { scale: 1.0 })
        return true
    }

    async guides() {
        const keyword = argument(this.e, '攻略')
        if (keyword.length > 100) { await this.reply('攻略关键词请控制在 100 字以内。'); return true }
        return this.showGuides({ keyword, page: 1 })
    }

    async nextGuides() {
        return this.withService(async (service, user) => {
            const state = await this.readState('GUIDES', user)
            if (!state) { await this.reply('请先查询「卫戍攻略」，再查看下一页。'); return true }
            if (!state.hasMore || !state.pageToken) { await this.reply('当前攻略搜索已到最后一页。'); return true }
            return this.showGuides({ keyword: state.keyword, pageToken: state.pageToken, page: state.page + 1 }, service, user)
        })
    }

    async showGuides(options, existingService, existingUser) {
        const run = async (service, user) => {
            const result = await service.getGuides(options)
            const guides = result.guides.map((guide, index) => ({ ...guide, index: index + 1 }))
            await this.saveState('GUIDES', user, { keyword: options.keyword || '', page: options.page, pageToken: result.pageToken, hasMore: result.hasMore, ids: guides.map(guide => guide.id) })
            return this.renderPage(service, 'garrison/list.html', {
                guides, page: options.page, hasMore: result.hasMore,
                keyword: options.keyword || ''
            }, result.resource)
        }
        return existingService ? run(existingService, existingUser) : this.withService(run)
    }

    async guideDetail() {
        const value = argument(this.e, '攻略详情')
        if (!/^[\w-]{1,100}$/.test(value)) { await this.reply('请提供攻略列表中的序号或攻略 ID。'); return true }
        return this.withService(async (service, user) => {
            const state = await this.readState('GUIDES', user)
            const id = /^\d{1,2}$/.test(value) && state?.ids?.[Number(value) - 1] ? state.ids[Number(value) - 1] : value
            const result = await service.getGuide(id)
            return this.renderPage(service, 'garrison/guide.html', { guide: result.guide }, result.resource, result.guide.seasonId)
        })
    }

    async history() {
        const args = argument(this.e, '(?:历史)?战绩').split(/\s+/).filter(Boolean)
        const page = args.length && /^\d+$/.test(args[0]) ? Number(args.shift()) : 1
        const seasonId = args.shift() || ''
        if (!Number.isSafeInteger(page) || page < 1 || args.length || (seasonId && !/^[\w-]{1,100}$/.test(seasonId))) {
            await this.reply('用法：卫戍战绩 [页码] [赛季ID]，例如「卫戍战绩 2」。')
            return true
        }
        return this.withService(async (service, user) => {
            const result = await service.getHistory(seasonId)
            const records = result.records.map((record, index) => ({ ...record, index: index + 1 }))
            const pages = Math.max(1, Math.ceil(records.length / pageSize))
            if (page > pages) { await this.reply(`战绩共 ${pages} 页，请输入有效页码。`); return true }
            await this.saveState('HISTORY', user, { records, seasonId: result.seasonId })
            return this.renderPage(service, 'garrison/history.html', {
                records: records.slice((page - 1) * pageSize, page * pageSize),
                page, pages, hasMore: page < pages, total: records.length, seasonId: result.seasonId
            }, result.resource, result.seasonId)
        })
    }

    async recordDetail() {
        const index = Number(argument(this.e, '战绩详情'))
        return this.withService(async (service, user) => {
            const state = await this.readState('HISTORY', user)
            const record = Number.isSafeInteger(index) && index > 0 ? state?.records?.[index - 1] : null
            if (!record) { await this.reply('请先查询「卫戍战绩」，再使用列表中的序号查看详情。列表保留 5 分钟。'); return true }
            const resource = await service.getResources(state.seasonId)
            return this.renderPage(service, 'garrison/record.html', {
                record: { ...record, ...garrisonRecordLabels(record), durationText: formatGarrisonDuration(record.durationSec) }
            }, resource, state.seasonId)
        })
    }

    async statistics() {
        return this.withService(async service => {
            const result = await service.getStatistics(argument(this.e, '统计'))
            const { history } = result
            const { totalSec, avgSec, minSec, maxSec } = history.duration
            return this.renderPage(service, 'garrison/statistics.html', {
                history,
                duration: {
                    total: formatGarrisonDuration(totalSec), average: formatGarrisonDuration(avgSec),
                    shortest: formatGarrisonDuration(minSec), longest: formatGarrisonDuration(maxSec)
                },
                rankings: [
                    { kind: 'strategy', title: '常用策略', metricLabel: '胜率',
                        entries: history.strategies.slice(0, 5).map(row => ({ ...row, metric: row.winRate === null ? '—' : row.winRate + '%' })) },
                    { kind: 'bond', title: '常用盟约', metricLabel: '最高',
                        emptyLabel: history.coverage.bondsReported ? '激活场次 0' : '暂无数据',
                        entries: history.bonds.slice(0, 5).map(row => ({ ...row, metric: row.maxLayer ?? '—' })) }
                ]
            }, result.resource, result.seasonId)
        })
    }

    async seasons() {
        return this.withService(async service => {
            const resource = await service.getResources()
            const seasons = (resource.seasons || []).map(item => `${item.name || item.seasonId}：${item.seasonId}`)
            await this.reply(seasons.length ? `官方可查询的卫戍赛季：\n${seasons.join('\n')}\n用法：卫戍战绩 1 赛季ID` : '官方暂未提供可查询赛季。')
            return true
        })
    }
}
