import { rulePrefix, get_name_from_nickname } from '../utils/common.js'
import sklandTools from '../model/sklandTools.js'
import { findOperators, buildOperatorView } from '../model/operatorEncyclopedia.js'
import runtimeRender from '../utils/runtimeRender.js'

export class Encyclopedia extends plugin {
    constructor() {
        super({ name: '[arknights-plugin]干员图鉴', dsc: '森空岛公开干员资料', event: 'message', priority: 450,
            rule: [{ reg: `^${rulePrefix}.*(?:图鉴|模组|技能(?:\\s+(?:全等级|10|[1-9]|专[123]))?)\\s*$`, fnc: 'encyclopedia' }] })
    }

    async encyclopedia() {
        // Match the longest configured prefix: “#方舟插件” also starts with “#方舟”.
        const prefixPattern = new RegExp(`^${rulePrefix}$`)
        let prefix = ''
        for (let end = 1; end <= this.e.msg.length; end++) {
            const candidate = this.e.msg.slice(0, end)
            if (prefixPattern.test(candidate)) prefix = candidate
        }
        if (!prefix) return false
        const command = this.e.msg.slice(prefix.length).match(/^(?<query>.*?)\s*(?<view>图鉴|技能|模组)(?:\s+(?<level>全等级|10|[1-9]|专[123]))?\s*$/)
        if (!command) return false
        const { query: name, view: kind, level } = command.groups
        const view = ({ 图鉴: 'overview', 技能: 'skills', 模组: 'modules' })[kind]
        if (level && view !== 'skills') return false
        const query = name.trim(), allLevels = level === '全等级'
        const skillLevel = !level || allLevels ? null : level.startsWith('专') ? Number(level.slice(1)) + 7 : Number(level)
        if (!query) {
            await this.reply(`请输入干员名称或别名，例如：${prefix}维什戴尔${kind}${view === 'skills' ? '\n默认显示7级与专1–3；可追加 1–10、专1–3 或 全等级' : ''}`)
            return true
        }
        try {
            const catalog = await sklandTools.get('operators')
            let matches = findOperators(catalog.data.characters, query)
            if (!matches.length) matches = findOperators(catalog.data.characters, get_name_from_nickname(query))
            if (!matches.length) { await this.reply(`未找到干员「${query}」，请检查名称或使用干员ID。`); return true }
            if (matches.length > 1) {
                await this.reply(`找到多个干员，请输入完整名称或ID：\n${matches.slice(0, 15).map(c => `${c.name} (${c.id})`).join('\n')}`)
                return true
            }
            const detail = await sklandTools.get('operator', matches[0].id)
            const groups = allLevels ? [[1, 2, 3, 4], [5, 6, 7], [8, 9, 10]] : [skillLevel]
            for (const [index, levels] of groups.entries()) {
                const operator = buildOperatorView(detail.data, { view, fetchedAt: detail.fetchedAt, stale: detail.stale, skillLevel: levels })
                if (allLevels && !operator.skills.some(s => s.levels.length)) continue
                const modulePages = view === 'modules' ? Math.max(1, Math.ceil(operator.modules.length / 2)) : 1
                for (let page = 0; page < modulePages; page++) {
                    const display = { ...operator,
                        modules: view === 'modules' ? operator.modules.slice(page * 2, page * 2 + 2) : operator.modules,
                        pageLabel: allLevels ? `全等级 ${index + 1}/${groups.length}` : modulePages > 1 ? `模组 ${page + 1}/${modulePages}` : '' }
                    await runtimeRender(this.e, 'encyclopedia/operator.html', { operator: display }, { scale: 1, timeout: 120000 })
                }
            }
        } catch {
            globalThis.logger?.error?.('[方舟插件][干员图鉴]查询或渲染失败')
            await this.reply('干员图鉴查询失败，请稍后重试。首次查询需要连接森空岛，已有缓存可在接口异常时继续使用。')
        }
        return true
    }
}
