// Pure adapters for the official stronghold-guide SDK's raw API data.
const list = value => Array.isArray(value) ? value : []
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {}
const string = value => value == null ? '' : String(value)
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0
const optionalNumber = value => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value)
const modeLabels = new Map([
    ['LOCAL', ['教学模式', 'tutorial']],
    ['SINGLE', ['单人模拟', 'solo']],
    ['MULTI', ['协同模拟', 'team']]
])
// The game configuration reuses these difficulty codes for several solo levels.
const difficulties = new Map([
    ['TRAINING', ['入门协议', 'training']],
    ['FUNNY', ['标准模拟', 'standard', '1–4']],
    ['NORMAL', ['险境模拟', 'risk', '5–8']],
    ['HARD', ['绝境模拟', 'extreme', '9–14']],
    ['ABYSS', ['终极模拟', 'ultimate', '15–20']],
    ['FAST', ['极速模拟', 'risk']]
])
export function garrisonRecordLabels({ modeCode, difficultyCode, seasonId }) {
    const [mode, modeTone] = modeLabels.get(modeCode) || [modeCode || '未知模式', 'neutral']
    const code = modeCode === 'LOCAL' ? 'TRAINING' : difficultyCode
    const [label, difficultyTone, soloRange] = difficulties.get(code) || [code || '未知难度', 'neutral']
    const difficulty = modeCode === 'SINGLE' && seasonId === 'act3autochess' && soloRange
        ? `规程等级 ${soloRange}` : label
    return { mode, modeTone, difficulty, difficultyTone }
}

export function plainGarrisonText(value) {
    if (value && typeof value === 'object') return ''
    return string(value).replace(/\\n/g, '\n')
        .replace(/<[@$][^<>]*>|<\/>/g, '')
        .replace(/<\/?[a-zA-Z][a-zA-Z0-9:-]*(?:\s[^<>]*)?\/?>/g, '')
        .trim()
}

export function garrisonImageUrl(value) {
    try {
        const url = new URL(string(value))
        if (!['http:', 'https:'].includes(url.protocol)) return ''
        return url.href.replace(/["'()\\]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
    } catch {
        return ''
    }
}

export function formatGarrisonDate(value) {
    const timestamp = Number(value)
    if (!Number.isFinite(timestamp) || timestamp <= 0) return '时间未知'
    const date = new Date(timestamp < 1e12 ? timestamp * 1000 : timestamp)
    if (!Number.isFinite(date.getTime())) return '时间未知'
    return new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).format(date)
}

function indexResources(value, key) {
    if (Array.isArray(value)) return Object.fromEntries(value.filter(item => item?.[key]).map(item => [string(item[key]), item]))
    return value && typeof value === 'object' ? value : {}
}

/** Never use current-season metadata to interpret a different season/version. */
export function selectGarrisonResource(resource = {}, seasonId = '', versionId = '', seasonResourceMap = {}) {
    resource = object(resource)
    const embedded = seasonResourceMap?.[seasonId]?.versionResourceMap?.[versionId]
    const info = resource?.versionInfo || {}
    const matching = Boolean(seasonId && versionId && string(info.seasonId) === string(seasonId) && string(info.versionId) === string(versionId))
    const selected = embedded || (matching ? resource : {})
    return {
        chars: indexResources(selected.chars, 'charId'),
        items: indexResources(selected.items, 'itemId'),
        strategies: indexResources(selected.strategies, 'strategyId'),
        bonds: indexResources(selected.bonds, 'bondId'),
        available: Boolean(embedded || matching)
    }
}

function namedAsset(id, map) {
    const item = map[string(id)] || {}
    return { id: string(id), name: string(item.name) || string(id) || '未知', iconUrl: garrisonImageUrl(item.iconUrl) }
}

function normalizeItem(item, resources) {
    const id = string(typeof item === 'object' ? item?.itemId ?? item?.equipId : item)
    const data = resources.items[id] || {}
    return { ...namedAsset(id, resources.items), description: plainGarrisonText(data.effectDesc) }
}

function normalizeOperator(item = {}, resources) {
    item = object(item)
    const id = string(item.charId)
    const data = resources.chars[id] || {}
    const skillId = string(item.skillId), moduleId = string(item.moduleId)
    const skill = list(data.skills).find(skill => string(skill?.skillId) === skillId) || {}
    const module = list(data.modules).find(module => string(module?.moduleId) === moduleId) || {}
    const mergeLevel = number(item.mergeLevel)
    // The official card derives promotion and level from the selected merge tier's trait.
    let trait = list(data.traits).find(trait => trait && number(trait.mergeLevel) === mergeLevel)
    if (!trait && data.isDiyChar && !list(data.traits).length && [0, 1].includes(mergeLevel)) {
        trait = { evolvePhase: 2, level: mergeLevel === 0 ? 1 : 60 }
    }
    const evolvePhase = optionalNumber(trait?.evolvePhase)
    const tier = optionalNumber(item.chessInfo?.chessLevel ?? data.shopLevel)
    const halfBodyUrl = garrisonImageUrl(data.halfBodyUrl)
    return {
        id, name: string(data.name) || id || '未知干员', avatarUrl: garrisonImageUrl(data.avatarUrl),
        portraitUrl: halfBodyUrl || garrisonImageUrl(data.avatarUrl), portraitIsAvatar: !halfBodyUrl,
        mergeLevel, skillId, moduleId,
        skillName: string(skill.name) || skillId, skillIconUrl: garrisonImageUrl(skill.iconUrl),
        moduleName: string(module.name) || moduleId,
        moduleIconUrl: garrisonImageUrl(module.icon?.type), moduleShiningUrl: garrisonImageUrl(module.icon?.shiningColor),
        tier, tierIcon: Number.isInteger(tier) && tier >= 1 && tier <= 6 ? `tier-${tier}.svg` : '',
        evolvePhase, level: optionalNumber(trait?.level),
        eliteIcon: evolvePhase !== null && [0, 1, 2].includes(evolvePhase)
            ? mergeLevel >= 1 ? 'elite-merged.png' : `elite-${evolvePhase}.png` : '',
        equips: list(item.equips).map(equip => normalizeItem(equip, resources))
    }
}

function seasonName(resource, id) {
    const season = list(resource?.seasons).find(season => string(season.seasonId) === id)
    return string(season?.name) || id || '未知赛季'
}

export function normalizeGarrisonGuide(raw = {}, resource = {}, seasonResourceMap = {}) {
    raw = object(raw)
    const guide = raw.guide || {}
    const seasonId = string(guide.seasonId)
    const versionId = string(guide.versionId)
    const resources = selectGarrisonResource(resource, seasonId, versionId, seasonResourceMap)
    return {
        id: string(guide.guideId), title: string(guide.title) || '未命名攻略',
        author: string(raw.poster?.nickname) || '未知作者', authorId: string(raw.poster?.uid),
        authorAvatarUrl: garrisonImageUrl(raw.poster?.avatar),
        publishedAt: formatGarrisonDate(guide.publishAtTs),
        seasonId, versionId, seasonName: string(raw.seasonTag?.name) || seasonName(resource, seasonId),
        phaseName: string(raw.seasonTag?.phaseName), invalid: Number(raw.invalid) === 1,
        stats: { viewed: number(raw.rts?.viewed), liked: number(raw.rts?.liked), collected: number(raw.rts?.collected) },
        scopeLabel: plainGarrisonText(guide.applicableScope),
        strategies: list(guide.strategyIds).map(id => namedAsset(id, resources.strategies)),
        resourceUnavailable: !resources.available,
        tabs: list(guide.tabs).map(tab => {
            tab = object(tab)
            const round = Number(tab.tabType) === 2
            const from = number(tab.startRound), to = number(tab.endRound)
            const roundLabel = from === to ? `第 ${from} 回合` : `第 ${from}–${to} 回合`
            const bondIds = [...list(tab.activeBonds?.seasonBondIds), ...list(tab.activeBonds?.regularBondIds)]
            return {
                title: round ? roundLabel : '成型阵容', roundLabel: round ? roundLabel : '',
                operators: list(tab.recChars).map(item => normalizeOperator(item, resources)),
                items: list(tab.recItems).map(item => normalizeItem(item, resources)),
                bonds: [...new Set(bondIds)].map(id => namedAsset(id, resources.bonds)),
                operationIdea: plainGarrisonText(tab.operationIdea)
            }
        })
    }
}

const metricNumber = value => {
    if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
}
const metricCount = value => {
    const parsed = metricNumber(value)
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null
}
const metricId = value => typeof value === 'string' && value.trim() ? value.trim()
    : Number.isSafeInteger(value) && value >= 0 ? String(value) : null

function activation(value) {
    if (typeof value === 'boolean') return value
    const parsed = metricNumber(value)
    return parsed === null || parsed < 0 ? null : parsed > 0
}

function readBonds(value) {
    if (!Array.isArray(value)) return null
    const bonds = new Map()
    for (const entry of value) {
        const id = metricId(entry?.bondId)
        const active = activation(entry?.activate)
        if (id === null || active === null) return null
        if (!active) continue
        const layer = metricCount(entry.layer)
        const previous = bonds.get(id)
        if (previous == null || (layer !== null && layer > previous)) bonds.set(id, layer)
    }
    return [...bonds].map(([id, layer]) => ({ id, layer }))
}

function readBossEntries(value) {
    if (Array.isArray(value)) return value
    if (Object.hasOwn(object(value), 'isKilled')) return [value]
    return null
}

function bossFlag(value) {
    if (value === true || value === 1 || value === '1') return true
    if (value === false || value === 0 || value === '0') return false
    return null
}

function readBossKills(value) {
    const entries = readBossEntries(value)
    if (!entries) return null
    const kills = { normal: 0, hidden: 0 }
    for (const entry of entries) {
        const killed = bossFlag(entry?.isKilled)
        if (killed === null) return null
        if (!killed) continue
        const hidden = bossFlag(entry.isHidden)
        if (hidden === null) return null
        kills[hidden ? 'hidden' : 'normal']++
    }
    return kills
}

function timestampMs(value) {
    const time = metricNumber(value)
    if (time === null || time <= 0) return null
    const milliseconds = time < 1e12 ? time * 1000 : time
    return Number.isSafeInteger(milliseconds) ? milliseconds : null
}

function durationSeconds(start, end) {
    start = metricCount(start)
    end = metricCount(end)
    return start > 0 && end !== null && end >= start && end < 1e12 ? end - start : null
}

export function formatGarrisonDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '—'
    const rounded = Math.round(seconds)
    const hours = Math.floor(rounded / 3600)
    const minutes = Math.floor(rounded / 60) % 60
    return [hours && hours + '小时', (hours || minutes) && minutes + '分钟', (rounded % 60) + '秒'].filter(Boolean).join('')
}

export function garrisonMetricRecord(raw) {
    raw = object(raw)
    const result = typeof raw.completeState === 'boolean' ? raw.completeState : metricNumber(raw.completeState)
    return {
        id: metricId(raw.id), versionId: metricId(raw.versionId) ?? '',
        modeCode: metricId(raw.modeType) ?? '', difficultyCode: metricId(raw.modeDifficulty) ?? '',
        result: result === null ? null : Boolean(result),
        endTimeMs: timestampMs(raw.gameEndTs), killCnt: metricCount(raw.killCnt), trophyAfter: metricCount(raw.trophyAfter),
        strategyId: metricId(raw.bandId), bonds: readBonds(raw.bondInfo),
        bossKills: readBossKills(raw.acBossInfo), durationSec: durationSeconds(raw.gameStartTs, raw.gameEndTs)
    }
}

export function garrisonStatisticsIcon(value) {
    const safe = garrisonImageUrl(value)
    if (!safe) return ''
    const url = new URL(safe)
    if (url.username || url.password) return ''
    url.search = ''
    url.hash = ''
    return url.href
}

export function garrisonStatisticsAssets(seasonId, records, resource, versionResources) {
    const assets = new Map()
    const resourcesByVersion = new Map()
    for (const record of records) {
        const { id, versionId, strategyId, bonds } = record
        if (!id || !versionId || (!strategyId && !bonds?.length)) continue
        if (!resourcesByVersion.has(versionId)) {
            resourcesByVersion.set(versionId, selectGarrisonResource(resource, seasonId, versionId, versionResources))
        }
        const sources = resourcesByVersion.get(versionId)
        if (strategyId) addAsset('strategy', strategyId, versionId, sources.strategies)
        for (const { id } of bonds || []) addAsset('bond', id, versionId, sources.bonds)
    }
    return [...assets.values()]

    function addAsset(kind, id, versionId, source) {
        if (!Object.hasOwn(source, id)) return
        const entry = source[id]
        const name = plainGarrisonText(entry?.name)
        const iconUrl = garrisonStatisticsIcon(entry?.iconUrl)
        if (name || iconUrl) assets.set(JSON.stringify([kind, id, versionId]), { kind, id, versionId, name, iconUrl })
    }
}

export function garrisonRecordStatistics(raw) {
    const { id, modeCode, difficultyCode, result, killCnt, trophyAfter, bossKills, durationSec } = garrisonMetricRecord(raw)
    return {
        id: id ?? '', modeCode, difficultyCode, success: result === true, statusUnknown: result === null,
        resultLabel: result === null ? '结果未知' : result ? '模拟成功' : '模拟中断',
        timestamp: string(raw?.gameEndTs), killCnt, trophyAfter, bossKills, durationSec
    }
}

export function normalizeGarrisonRecord(raw = {}, resource = {}, seasonResourceMap = {}) {
    raw = object(raw)
    const seasonId = string(raw.activityId)
    const versionId = string(raw.versionId)
    const resources = selectGarrisonResource(resource, seasonId, versionId, seasonResourceMap)
    const operators = list(raw.chessSquad).map(item => normalizeOperator(item, resources))
    const itemIds = [...new Set(operators.flatMap(operator => operator.equips.map(item => item.id)).filter(Boolean))]
    const stats = garrisonRecordStatistics(raw)
    return {
        ...stats, ...garrisonRecordLabels({ ...stats, seasonId }),
        passRound: number(raw.passRound), date: formatGarrisonDate(raw.gameEndTs),
        seasonId, seasonName: seasonName(resource, seasonId), versionId,
        strategy: namedAsset(raw.bandId, resources.strategies), operators,
        items: itemIds.map(id => normalizeItem(id, resources)),
        bonds: list(raw.bondInfo).map(bond => ({
            ...namedAsset(bond?.bondId, resources.bonds), layer: number(bond?.layer),
            active: activation(bond?.activate)
        })),
        trophyBefore: optionalNumber(raw.trophyBefore),
        coinCost: optionalNumber(raw.coinCost), syncCnt: optionalNumber(raw.syncCnt),
        resourceUnavailable: !resources.available
    }
}
