// Read-only presentation adapters for Skland's operator assets.
const list = value => Array.isArray(value) ? value : []
const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback
const bounded = (value, min, max) => Math.min(max, Math.max(min, Math.trunc(num(value, min))))
const asset = (category, id) => id ? `https://web.hycdn.cn/arknights/game/assets/${category}/${encodeURIComponent(String(id)).replace(/'/g, '%27')}.png` : ''
const professions = { WARRIOR: '近卫', TANK: '重装', SUPPORT: '辅助', SNIPER: '狙击', PIONEER: '先锋', CASTER: '术师', SPECIAL: '特种', MEDIC: '医疗' }

export function operatorSkill(skill = {}, mainSkillLvl, defaultSkillId, index = 0) {
    const mastery = bounded(skill.specializeLevel, 0, 3)
    const level = Number.isInteger(Number(mainSkillLvl)) && num(mainSkillLvl) >= 1 && num(mainSkillLvl) <= 7 ? num(mainSkillLvl) : null
    return {
        id: String(skill.id || ''), name: String(skill.name || `技能${index + 1}`),
        icon_url: asset('char_skill', skill.id), selected: Boolean(skill.id && skill.id === defaultSkillId),
        locked: skill.locked === true, mastery, level,
        mastery_icon: mastery ? `mastery-${mastery}.svg` : '',
        label: skill.locked ? '未解锁' : mastery ? `专精${mastery}` : level === null ? '等级未知' : `${level}级`
    }
}

export function normalizeOperatorAssets(data = {}) {
    const metadata = data.charInfoMap || {}, equipment = data.equipmentInfoMap || {}
    return list(data.chars).filter(char => char && typeof char === 'object').map(char => {
        const info = metadata[char.charId] || {}
        const profession = info.profession || char.profession || ''
        let name = info.name || char.name || char.charId || '未知干员'
        if (name === '阿米娅' && professions[profession]) name += `(${professions[profession]})`
        const equips = list(char.equip).filter(equip => equip && typeof equip === 'object')
        const skillData = list(char.skills).filter(skill => skill && typeof skill === 'object')
        const modules = equips.flatMap(equip => {
            const meta = equipment[equip.id] || {}, type = String(meta.typeIcon || '')
            if (type.toUpperCase() === 'ORIGINAL' || String(equip.id || '').startsWith('uniequip_001_')) return []
            return [{
                id: equip.id, name: meta.name || equip.id || '未知模组', level: num(equip.level),
                locked: equip.locked === true, selected: equip.id === char.defaultEquipId,
                type_icon_url: asset('uniequip/type/icon', type), type: type.toUpperCase()
            }]
        })
        const selected = modules.find(equip => equip.selected && !equip.locked)
        return {
            ...info, ...char, name, profession, profession_name: professions[profession] || '未知职业',
            profession_icon: professions[profession] ? `profession-${profession}.png` : '',
            rarity: bounded(info.rarity ?? char.rarity, 0, 5), evolvePhase: bounded(char.evolvePhase, 0, 2),
            potentialRank: bounded(char.potentialRank, 0, 5), level: num(char.level), favorPercent: num(char.favorPercent),
            mainSkillLvl: num(char.mainSkillLvl), skills: skillData, equip: equips,
            avatar_url: asset(char.skinId ? 'char_skin/avatar' : 'char/avatar', char.skinId || char.charId),
            portrait_url: asset(char.skinId ? 'char_skin/portrait' : 'char/portrait', char.skinId || char.charId),
            fallback_avatar_url: asset('char/avatar', char.charId), fallback_portrait_url: asset('char/portrait', char.charId),
            skill_list: skillData.map((skill, index) => operatorSkill(skill, char.mainSkillLvl, char.defaultSkillId, index)),
            modules, equip_info: {
                has_equip: Boolean(selected), type_icon_url: selected?.type_icon_url || '',
                equip_text: selected ? `${selected.type || selected.name} ${selected.level}` : '未装备模组'
            }
        }
    })
}

export function sortOperatorAssets(a, b) {
    for (const key of ['evolvePhase', 'level', 'rarity']) if (b[key] !== a[key]) return b[key] - a[key]
    const mastery = operator => list(operator.skills).reduce((sum, skill) => sum + num(skill.specializeLevel), 0)
    if (mastery(b) !== mastery(a)) return mastery(b) - mastery(a)
    for (const key of ['mainSkillLvl', 'potentialRank', 'favorPercent']) if (b[key] !== a[key]) return b[key] - a[key]
    return a.name.localeCompare(b.name, 'zh-CN')
}

export function getOperatorAssets(data, profession = null, rarity = null, page = 1, pageSize = 30) {
    const operators = normalizeOperatorAssets(data).filter(char =>
        (profession === null || char.profession === profession) && (rarity === null || char.rarity === rarity)
    ).sort(sortOperatorAssets)
    const total = operators.length
    if (Number(page) === 0 && Number(pageSize) === 0) return { total, chars: operators }
    page = Number(page); pageSize = Number(pageSize)
    const valid = Number.isSafeInteger(page) && page > 0 && Number.isSafeInteger(pageSize) && pageSize > 0
    return { total, chars: valid ? operators.slice((page - 1) * pageSize, page * pageSize) : [] }
}

export function parseOperatorAssetCommand(message, prefix, rarityKeywords, professionNames) {
    const pattern = `^${prefix}(?<rarity>${rarityKeywords.join('|')})?(?<profession>${professionNames.join('|')})?练度(?<view>列表|统计|查询|面板|卡片)(?<page>\\d*)$`
    const match = new RegExp(pattern).exec(message)
    return match ? { ...match.groups, page: match.groups.page ? Number(match.groups.page) : 1 } : null
}
