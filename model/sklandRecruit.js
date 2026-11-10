export const professionNames = { PIONEER: '先锋', WARRIOR: '近卫', TANK: '重装', SNIPER: '狙击', CASTER: '术师', MEDIC: '医疗', SUPPORT: '辅助', SPECIAL: '特种' }
const aliases = { 近战: '近战位', 远程: '远程位', 高资: '高级资深干员', 资深: '资深干员', 机械: '支援机械', 机器人: '支援机械', 回费: '费用回复', 快活: '快速复活', 高级资深: '高级资深干员', 术士: '术师' }
const professionOrder = Object.keys(professionNames)
export function parseRecruitTags(input, data) {
    const names = new Map(data.tags.map(t => [t.tagName, t.tagId]))
    const tokens = input.trim().split(/[\s,，+＋、]+/).filter(Boolean)
    const unknown = [], ids = []
    for (const token of tokens) {
        const name = aliases[token] || (token.endsWith('干员') && names.has(token.slice(0, -2)) ? token.slice(0, -2) : token)
        if (!names.has(name)) unknown.push(token)
        else if (!ids.includes(names.get(name))) ids.push(names.get(name))
    }
    return { ids, unknown }
}

/** Official calculator: subsets of up to 3 tags; six stars require 高级资深干员.
 * The server supplies the current pool and tagIds, not a combination-result API.
 */
export function calculateRecruit(data, selectedIds) {
    const ids = data.tags.filter(t => selectedIds.includes(t.tagId)).map(t => t.tagId)
    const tags = new Map(data.tags.map(t => [t.tagId, t.tagName]))
    const result = []
    const visit = (start, selected) => {
        if (selected.length) {
            const names = selected.map(id => tags.get(id))
            const characters = data.characters.filter(c => selected.every(id => c.tagIds.includes(id)) && (c.rarity !== 5 || names.includes('高级资深干员')))
                .map(c => ({ ...c, rarity: c.rarity + 1, profession_name: professionNames[c.profession] || c.profession }))
                .sort((a, b) => b.rarity - a.rarity || professionOrder.indexOf(a.profession) - professionOrder.indexOf(b.profession) || a.charId.localeCompare(b.charId))
            if (characters.length) result.push({ tags: names, characters, minRarity: Math.min(...characters.map(c => c.rarity)) })
        }
        if (selected.length === 3) return
        for (let i = start; i < ids.length; i++) visit(i + 1, [...selected, ids[i]])
    }
    visit(0, [])
    return result.sort((a, b) => Number(a.characters.some(c => c.rarity === 3)) - Number(b.characters.some(c => c.rarity === 3)) || b.characters[0].rarity - a.characters[0].rarity || b.minRarity - a.minRarity || a.characters.length - b.characters.length || professionOrder.indexOf(a.characters[0].profession) - professionOrder.indexOf(b.characters[0].profession) || a.characters[0].charId.localeCompare(b.characters[0].charId) || a.tags.length - b.tags.length)
}
