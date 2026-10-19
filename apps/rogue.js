import { rulePrefix } from '../utils/common.js'
import SKLandUser from '../model/sklandUser.js'
import runtimeRender from '../utils/runtimeRender.js'

const labelMap = {
    bank: '投资系统',
    relicCnt: '解锁藏品',
    clearTime: '通关次数',
    bpLevel: '奖励等级',
    medal: '奖章进度',
    score: '分数',
    point: '积分',
    level: '等级',
    exp: '经验',
    ending: '结局',
    stage: '关卡',
    record: '记录',
    relic: '藏品',
    collection: '收藏',
    squad: '队伍',
    history: '历史记录',
    reward: '奖励',
}

const displayLabel = (key) => {
    const text = String(key).split('.').pop()
    return labelMap[text] || text
}

const displayValue = (value) => {
    if (value === null || value === undefined || value === '') return '-'
    if (typeof value === 'boolean') return value ? '是' : '否'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
}

function getRogueData(data = {}) {
    return data.rogue || data
}

function getRogueTopics(data = {}) {
    const rogue = getRogueData(data)
    const records = Array.isArray(rogue.records) ? rogue.records : []
    const infoMap = data.rogueInfoMap || rogue.rogueInfoMap || {}

    return records.map(record => {
        const info = infoMap[record.rogueId] || {}
        return {
            ...record,
            rogueId: record.rogueId,
            name: info.name || record.name || record.rogueId || '未知主题',
            picUrl: info.picUrl || record.picUrl || '',
            sort: info.sort || 0,
        }
    }).sort((a, b) => a.sort - b.sort)
}

function getPrimitiveRows(value, prefix = '', rows = [], depth = 0) {
    if (value === null || value === undefined || depth > 3) return rows

    if (typeof value !== 'object') {
        rows.push({ label: displayLabel(prefix), value: displayValue(value) })
        return rows
    }

    if (Array.isArray(value)) {
        if (value.every(item => item === null || typeof item !== 'object')) {
            rows.push({ label: displayLabel(prefix), value: value.map(displayValue).join('、') || '-' })
        }
        return rows
    }

    for (const [key, child] of Object.entries(value)) {
        const path = prefix ? `${prefix}.${key}` : key
        if (child === null || child === undefined) continue
        if (typeof child !== 'object') {
            rows.push({ label: displayLabel(path), value: displayValue(child) })
        } else if (!Array.isArray(child)) {
            getPrimitiveRows(child, path, rows, depth + 1)
        }
        if (rows.length >= 80) break
    }
    return rows
}

function getListSections(value, sections = [], prefix = '', depth = 0) {
    if (!value || typeof value !== 'object' || depth > 2) return sections

    for (const [key, child] of Object.entries(value)) {
        const path = prefix ? `${prefix}.${key}` : key
        if (Array.isArray(child) && child.length && child.some(item => item && typeof item === 'object')) {
            const items = child.slice(0, 24).map(item => ({
                rows: getPrimitiveRows(item, '', [], 0).slice(0, 16)
            })).filter(item => item.rows.length)
            if (items.length) sections.push({ title: displayLabel(path), items })
        } else if (child && typeof child === 'object' && !Array.isArray(child)) {
            getListSections(child, sections, path, depth + 1)
        }
        if (sections.length >= 12) break
    }
    return sections
}

function normalizeRogueDetail(data = {}, topic = {}) {
    const detail = data.data || data
    const rows = getPrimitiveRows(detail).slice(0, 80)
    const listSections = getListSections(detail)

    return {
        topic,
        summaryRows: [
            { label: '投资系统', value: displayValue(topic.bank?.current ?? topic.bank) },
            { label: '解锁藏品', value: displayValue(topic.relicCnt) },
            { label: '通关次数', value: displayValue(topic.clearTime) },
            { label: '奖励等级', value: displayValue(topic.bpLevel) },
        ].filter(item => item.value !== '-'),
        detailSections: [
            { title: '主题详情', items: [{ rows }] },
            ...listSections,
        ].filter(section => section.items.some(item => item.rows.length)),
    }
}

export class RogueInfo extends plugin {
    constructor() {
        super({
            name: '[arknights-plugin]肉鸽战绩查询',
            dsc: '森空岛肉鸽战绩查询',
            event: 'message',
            priority: 100,
            rule: [
                {
                    reg: `^${rulePrefix}(肉鸽|集成战略)(?:\\s+(.+))?$`,
                    fnc: 'rogueCommand'
                },
                {
                    reg: `^${rulePrefix}(肉鸽详情|集成战略详情)\\s+(.+)$`,
                    fnc: 'rogueDetail'
                }
            ]
        })
    }

    async getUser() {
        const uid = this.e.at || this.e.user_id
        const sklUser = new SKLandUser(uid)
        if (!await sklUser.getUser()) {
            await this.reply('未绑定森空岛cred，请先绑定后再使用功能。可发送 /cred帮助 查看获取方法')
            return null
        }
        return sklUser
    }

    async rogueCommand() {
        const match = this.e.msg.match(new RegExp(`^${rulePrefix}(?:肉鸽|集成战略)(?:\\s+(.+))?$`))
        const topicQuery = match?.[1]?.trim()
        return topicQuery ? this.rogueDetail(topicQuery) : this.rogueInfo()
    }

    async rogueInfo() {
        const sklUser = await this.getUser()
        if (!sklUser) return true

        await this.reply('开始获取集成战略汇总，请稍等')
        const res = await sklUser.getGamePlayerInfo()
        if (res?.code === 0) {
            const rogueData = getRogueData(res.data || {})
            const rogueList = getRogueTopics(res.data || {})
            if (!rogueList.length) {
                await this.reply('暂无集成战略战绩数据')
                return true
            }

            const updateTime = new Date(Number(res.timestamp) * 1000)
            await runtimeRender(this.e, 'rogue/rogue.html', {
                rogueList,
                user_info: {
                    name: res.data?.status?.name || sklUser.name,
                    uid: res.data?.status?.uid || sklUser.uid
                },
                update_time_str: updateTime.toLocaleString(),
                total_topics: rogueData.records?.length || rogueList.length,
            }, { scale: 1.0 })
        } else {
            logger.mark(`肉鸽战绩查询失败，响应:${JSON.stringify(res)}`)
            await this.reply('查询失败，请检查cred或稍后再试')
        }
        return true
    }

    async rogueDetail(topicQuery = '') {
        const sklUser = await this.getUser()
        if (!sklUser) return true

        const infoRes = await sklUser.getGamePlayerInfo()
        if (infoRes?.code !== 0) {
            await this.reply('获取集成战略主题列表失败，请检查cred或稍后再试')
            return true
        }

        const topics = getRogueTopics(infoRes.data || {})
        const query = String(topicQuery).trim().toLowerCase()
        const topic = topics.find(item => String(item.rogueId).toLowerCase() === query)
            || topics.find(item => String(item.name).toLowerCase().includes(query))

        if (!topic) {
            const names = topics.map(item => `${item.name}(${item.rogueId})`).join('、')
            await this.reply(`未找到主题：${topicQuery}\n可用主题：${names}`)
            return true
        }

        await this.reply(`正在获取「${topic.name}」详细战绩，请稍等`)
        const detailRes = await sklUser.getRogueDetail(topic.rogueId)
        if (detailRes?.code !== 0) {
            logger.mark(`集成战略详情查询失败，响应:${JSON.stringify(detailRes)}`)
            await this.reply('集成战略详情查询失败，当前账号可能暂不支持该主题详情')
            return true
        }

        const updateTime = new Date(Number(detailRes.timestamp || infoRes.timestamp) * 1000)
        const detail = normalizeRogueDetail(detailRes.data || {}, topic)
        await runtimeRender(this.e, 'rogue/rogue-detail.html', {
            user_info: {
                name: infoRes.data?.status?.name || sklUser.name,
                uid: infoRes.data?.status?.uid || sklUser.uid
            },
            update_time_str: updateTime.toLocaleString(),
            ...detail,
        }, { scale: 1.0 })
        return true
    }
}
