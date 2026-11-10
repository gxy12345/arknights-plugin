import { rulePrefix } from '../utils/common.js'
import SKLandUser from '../model/sklandUser.js'
import sklandTools from '../model/sklandTools.js'
import { parseRecruitTags, calculateRecruit } from '../model/sklandRecruit.js'
import runtimeRender from '../utils/runtimeRender.js'

export class CharProfile extends plugin {
    constructor() {
        super({ name: '[arknights-plugin]公招计算', dsc: '使用森空岛当前公招池计算标签组合', event: 'message', priority: 500,
            rule: [{ reg: `^${rulePrefix}公招(计算|查询|索引)?(.*)$`, fnc: 'recruit_calc' }] })
    }

    async recruit_calc() {
        const input = this.e.msg.replace(new RegExp(`^${rulePrefix}公招(计算|查询|索引)?`), '').trim()
        if (!input) { await this.reply('请输入1–5个公招标签，例如：#方舟公招 近战 输出 生存'); return true }
        try {
            const snapshot = await sklandTools.get('recruit')
            const { ids, unknown } = parseRecruitTags(input, snapshot.data)
            if (unknown.length) { await this.reply(`无法识别公招标签：${unknown.join('、')}。请用空格分隔标签。`); return true }
            if (!ids.length || ids.length > 5) { await this.reply('每次请输入1–5个不同的公招标签。'); return true }
            const all = calculateRecruit(snapshot.data, ids)
            const combinations = all.filter(c => c.minRarity >= 4 || c.characters.some(op => op.rarity === 1))
            if (!combinations.length) {
                await this.reply(`${all.length ? '当前标签没有保底四星及以上或支援机械组合。' : '当前标签没有可匹配的公招组合。'}${snapshot.stale ? '\n当前使用上次成功获取的森空岛缓存。' : ''}`)
                return true
            }
            const owned = await this.getOwnedOperators()
            const rendered = combinations.map(c => ({ tags: c.tags,
                note: c.characters.some(op => op.rarity === 1) ? '含支援机械：需使用3:50及以下招募时间；短时招募候选可能变化，不代表保底一星。' : `标签保留时最低 ${c.minRarity} 星`,
                operators: c.characters.map(op => ({ name: op.name, charId: op.charId, level: op.rarity, profession: op.profession_name,
                    specialTags: owned ? !owned.has(op.charId) ? ['NEW'] : owned.get(op.charId) >= 5 ? ['满'] : [] : [] })) }))
            const source = { stale: snapshot.stale, fetchedAt: new Date(snapshot.fetchedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) }
            try {
                for (let offset = 0; offset < rendered.length; offset += 8) {
                    await runtimeRender(this.e, 'recruit/recruit', { combinations: rendered.slice(offset, offset + 8), source,
                        page: Math.floor(offset / 8) + 1, pages: Math.ceil(rendered.length / 8) }, { scale: 1.4, timeout: 120000 })
                }
            } catch {
                await this.reply(rendered.map(c => `${c.tags.join('+')}：${c.operators.map(op => `${op.name}(${op.level}星)${op.specialTags.join('')}`).join('、')}\n${c.note}`).join('\n\n') + `\n森空岛公招池 · ${source.fetchedAt}${source.stale ? '（离线缓存）' : ''}`)
            }
        } catch {
            await this.reply('森空岛公招数据获取失败，请稍后重试；首次成功查询后会自动保留本地缓存。')
        }
        return true
    }

    async getOwnedOperators() {
        try {
            const user = new SKLandUser(this.e.user_id)
            if (!await user.getUser()) return null
            const response = await user.getGamePlayerInfo()
            if (response?.code !== 0 || !Array.isArray(response.data?.chars)) return null
            return new Map(response.data.chars.map(c => [c.charId, c.potentialRank]))
        } catch { return null }
    }
}
