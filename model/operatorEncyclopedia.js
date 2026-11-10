import { professionNames } from './sklandRecruit.js'

const list = value => Array.isArray(value) ? value : []
const encode = value => encodeURIComponent(String(value || '')).replace(/'/g, '%27')
const asset = (category, id) => `https://web.hycdn.cn/arknights/game/assets/${category}/${encode(id)}.png`
const labels = { maxHp: '生命上限', max_hp: '生命上限', atk: '攻击', def: '防御', magicResistance: '法术抗性', magic_resistance: '法术抗性', cost: '部署费用', blockCnt: '阻挡数', block_cnt: '阻挡数', respawnTime: '再部署', baseAttackTime: '攻击间隔', base_attack_time: '攻击间隔', attack_speed: '攻击速度', respawn_time: '再部署', attack: '攻击' }
const numberText = value => Number.isFinite(Number(value)) ? String(Number(Number(value).toFixed(4))) : String(value ?? '—')
const masteryLabel = index => index < 7 ? `${index + 1}级` : `专${index - 6}`
export function plainGameText(value, blackboard = []) {
    const values = new Map(list(blackboard).map(item => [String(item.key).toLowerCase(), item.value]))
    return String(value || '').replace(/\{([^{}]+)\}/g, (original, expression) => {
        const [rawKey, format = ''] = expression.split(':')
        const negative = rawKey.startsWith('-'), key = (negative ? rawKey.slice(1) : rawKey).toLowerCase()
        if (!values.has(key)) return original
        const n = Number(values.get(key)) * (negative ? -1 : 1)
        if (!Number.isFinite(n)) return original
        if (format === '0%' || format === '0.0%') return `${Math.round(n * 100)}%`
        const decimals = format.match(/\.(0+|\d+)(?:f|%)?$/)
        const digits = decimals ? (/^0+$/.test(decimals[1]) ? decimals[1].length : Math.min(6, Number(decimals[1]))) : null
        const formatted = format.includes('%') ? n * 100 : n
        return (digits === null ? numberText(formatted) : formatted.toFixed(digits)) + (format.includes('%') ? '%' : '')
    }).replace(/\\n/g, '\n').replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

export function findOperators(characters, query) {
    const key = query.trim().replace(/（/g, '(').replace(/）/g, ')')
    const amiya = { '阿米娅(近卫)': 'char_1001_amiya2', '阿米娅(医疗)': 'char_1037_amiya3', '阿米娅(术师)': 'char_002_amiya', '阿米娅': 'char_002_amiya' }
    if (Object.hasOwn(amiya, key)) return characters.filter(c => c.id === amiya[key])
    const exact = characters.filter(c => c.id === key || c.name === key || c.appellation?.toLowerCase() === key.toLowerCase())
    return exact.length ? exact : characters.filter(c => c.name.includes(key) || c.id === key)
}

function attackRange(range) {
    const grids = list(range?.grids)
    if (!grids.length) return []
    const rows = grids.map(g => g.row).concat(0), cols = grids.map(g => g.col).concat(0)
    const minRow = Math.min(...rows), maxRow = Math.max(...rows), minCol = Math.min(...cols), maxCol = Math.max(...cols)
    if (maxRow - minRow > 14 || maxCol - minCol > 14) return []
    return Array.from({ length: maxRow - minRow + 1 }, (_, r) => Array.from({ length: maxCol - minCol + 1 }, (_, c) => {
        const row = minRow + r, col = minCol + c
        return row === 0 && col === 0 ? 'origin' : grids.some(g => g.row === row && g.col === col) ? 'hit' : 'blank'
    }))
}

export function buildOperatorView(data, { view = 'overview', fetchedAt, stale = false, skillLevel = null } = {}) {
    const phases = list(data.phase), finalPhase = phases.at(-1) || {}, favour = data.maxFavourAttribute || {}
    const stats = Object.entries(labels).filter(([key]) => Object.hasOwn(finalPhase.maxLevelAttribute || {}, key)).map(([key, label]) => ({
        label, value: numberText(Number(finalPhase.maxLevelAttribute[key]) + Number(favour[key] || 0)),
        unit: ['baseAttackTime', 'respawnTime'].includes(key) ? '秒' : ''
    }))
    const conditions = candidate => `精${candidate.unlockCondition?.phase ?? 0} Lv.${candidate.unlockCondition?.level ?? 1} · 潜${Number(candidate.requiredPotentialRank || 0) + 1}`
    const latestPhase = candidates => {
        const phase = Math.max(0, ...list(candidates).map(c => Number(c.unlockCondition?.phase || 0)))
        return list(candidates).filter(c => Number(c.unlockCondition?.phase || 0) === phase)
    }
    const talents = list(data.talents).map(t => ({ candidates: latestPhase(t.candidates).map(c => ({ name: c.name || '天赋', condition: conditions(c), description: plainGameText(c.description, c.blackboard) })) }))
    const skills = list(data.skills).map((s, index) => {
        const levels = list(s.levels).map((l, i) => ({
            label: masteryLabel(i), description: plainGameText(l.description, l.blackboard),
            initSp: l.spData?.initSp ?? '—', spCost: l.spData?.spCost ?? '—',
            duration: Number(l.duration) < 0 ? '无限' : l.duration == null ? '—' : `${numberText(l.duration)}秒`,
            range: attackRange(l.range)
        }))
        // Level 7 and each mastery are the compact default; any 1–10 level is queryable.
        const selectedLevels = skillLevel === null ? levels.filter((_, i) => i >= Math.min(6, levels.length - 1)) : levels.filter((_, i) => Array.isArray(skillLevel) ? skillLevel.includes(i + 1) : i === skillLevel - 1)
        const commonRange = selectedLevels.length && selectedLevels.every(l => JSON.stringify(l.range) === JSON.stringify(selectedLevels[0].range)) ? selectedLevels[0].range : []
        return { id: s.id, name: s.name || `技能${index + 1}`, index: index + 1, icon: asset('char_skill', s.id),
            recovery: ({ 1: '自动回复', 2: '攻击回复', 4: '受击回复', 8: '被动' })[s.spType] || `回复类型 ${s.spType}`,
            trigger: ({ 0: '被动', 1: '手动触发', 2: '自动触发' })[s.skillType] || `触发类型 ${s.skillType}`,
            levels: selectedLevels, summary: levels.at(-1) || {}, totalLevels: levels.length, commonRange
        }
    })
    const modules = list(data.equipments).map(m => ({
        name: m.name || m.id, type: String(m.typeName || '').toUpperCase(), icon: asset('uniequip', m.id),
        unlock: `精${m.unlockEvolvePhase ?? 2} Lv.${m.unlockLevel ?? '—'}`, missions: list(m.missionList).map(t => plainGameText(t.desc)),
        phases: list(m.phases).map(p => ({
            level: p.level, favour: p.favorPercent,
            attributes: Object.entries(p.attribute || {}).map(([key, value]) => `${labels[key] || key} ${Number(value) > 0 ? '+' : ''}${numberText(value)}`).join(' / '),
            trait: plainGameText(p.trait?.overrideDesc || p.trait?.additionalDesc, p.trait?.blackboard),
            traitType: p.trait?.overrideDesc ? '特性替换' : '特性追加',
            range: attackRange(p.trait?.range),
            talentName: p.talent?.name || '', talent: plainGameText(p.talent?.upgradeDesc, p.talent?.blackboard)
        }))
    }))
    const textSources = view === 'modules' ? list(data.equipments).flatMap(m => list(m.phases).flatMap(p => [p.trait?.overrideDesc, p.trait?.additionalDesc, p.talent?.upgradeDesc])) : list(data.skills).flatMap(s => list(s.levels).map(l => l.description))
    const terms = [...new Set(textSources.flatMap(s => [...String(s || '').matchAll(/<\$([^>]+)>/g)].map(m => m[1])))].flatMap(key => {
        const term = data.termDescriptionDict?.[key]
        return term ? [{ name: term.termName, description: plainGameText(term.description) }] : []
    })
    const name = data.name === '阿米娅' ? `阿米娅（${professionNames[data.profession] || data.profession}）` : data.name
    return {
        id: data.id, name, appellation: data.appellation || '', stars: Number(data.rarity) + 1,
        rarityStars: Array.from({ length: Math.min(6, Math.max(1, Number(data.rarity) + 1 || 1)) }, (_, i) => i + 1),
        profession: professionNames[data.profession] || data.profession, subProfession: data.subProfessionName || '',
        professionIcon: `profession-${data.profession}.png`, tags: list(data.tagList), position: data.position === 'MELEE' ? '近战位' : data.position === 'RANGED' ? '远程位' : '',
        illustration: `https://bbs.hycdn.cn/skland-fe-static/assets/arknights/char_illustration/${encode(data.id)}.png`, fallbackIllustration: asset('char/portrait', data.id),
        view, viewName: ({ overview: '干员图鉴', skills: '干员技能', modules: '干员模组' })[view],
        statLabel: `精${finalPhase.level ?? phases.length - 1} Lv.${finalPhase.maxLevel ?? '—'} · 满信赖 · 潜能1 · 无模组`,
        trait: plainGameText(data.description, data.blackboard), stats, range: attackRange(finalPhase.range), talents, skills, modules, terms,
        potentials: list(data.potentialRanks).map((p, i) => ({ rank: i + 2, description: plainGameText(p.description), talents: latestPhase(p.talent).map(t => plainGameText(t.description, t.blackboard)) })),
        phaseStats: phases.map(p => ({ label: `精${p.level} Lv.${p.maxLevel}`, values: ['maxHp', 'atk', 'def', 'magicResistance'].map(key => numberText(p.maxLevelAttribute?.[key])) })),
        fetchedAt: Number.isFinite(fetchedAt) ? new Date(fetchedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '', stale
    }
}
