import { garrisonRecordLabels, garrisonStatisticsIcon } from './garrisonView.js'

const compareIds = (a, b) => a < b ? -1 : Number(a > b)
const count = value => Number.isSafeInteger(value) && value >= 0
const id = value => typeof value === 'string' && value.trim().length > 0
const text = value => typeof value === 'string'
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const nullable = (value, valid) => value === null || valid(value)
const keyOfGroup = ({ modeCode, difficultyCode }) => JSON.stringify([modeCode, difficultyCode])
const keyOfAsset = ({ kind, id, versionId }) => JSON.stringify([kind, id, versionId])
const difficultyOrder = ['training', 'standard', 'risk', 'extreme', 'ultimate', 'neutral']
const excludedBondIds = new Set(['suntShip', 'soloShip', 'emptyShip']) // 绝技、独行、协防干员
const assert = condition => {
    if (!condition) throw new Error('Invalid garrison statistics snapshot')
}

function unique(items, key) {
    return new Set(items.map(key)).size === items.length
}

export function validateBaseline(data) {
    assert(object(data) && Array.isArray(data.recordIds) && data.recordIds.every(id) &&
        unique(data.recordIds, value => value) && Array.isArray(data.difficulties) &&
        count(data.kills) && count(data.killsReported) && data.killsReported <= data.recordIds.length &&
        (data.killsReported > 0 || data.kills === 0))
    const { recordIds, difficulties, kills, killsReported, latestTrophy } = data
    assert(difficulties.every(row => object(row) && text(row.modeCode) && text(row.difficultyCode) &&
        count(row.total) && count(row.wins) && row.wins <= row.total) &&
        unique(difficulties, keyOfGroup) && difficulties.reduce((sum, row) => sum + row.total, 0) === recordIds.length)
    assert(nullable(latestTrophy, trophy => object(trophy) && count(trophy.timeMs) && trophy.timeMs > 0 && count(trophy.value)))
    return {
        recordIds: [...recordIds].sort(compareIds),
        difficulties: difficulties.map(({ modeCode, difficultyCode, total, wins }) => ({ modeCode, difficultyCode, total, wins })),
        kills, killsReported,
        latestTrophy: latestTrophy && { timeMs: latestTrophy.timeMs, value: latestTrophy.value }
    }
}

const fields = {
    versionId: text, modeCode: text, difficultyCode: text,
    result: value => nullable(value, item => typeof item === 'boolean'),
    endTimeMs: value => nullable(value, item => count(item) && item > 0),
    killCnt: value => nullable(value, count),
    trophyAfter: value => nullable(value, count),
    strategyId: value => nullable(value, id),
    bonds: value => nullable(value, items => Array.isArray(items) &&
        items.every(item => object(item) && id(item.id) && nullable(item.layer, count)) && unique(items, item => item.id)),
    bossKills: value => nullable(value, item => object(item) && count(item.normal) && count(item.hidden) && count(item.normal + item.hidden)),
    durationSec: value => nullable(value, item => count(item) && item < 1e12)
}

function canonicalRecord(record) {
    assert(object(record) && id(record.id))
    const result = { id: record.id }
    for (const [field, valid] of Object.entries(fields)) {
        assert(valid(record[field]))
        result[field] = record[field]
    }
    if (result.bonds) {
        result.bonds = result.bonds.map(({ id, layer }) => ({ id, layer })).sort((a, b) => compareIds(a.id, b.id))
    }
    if (result.bossKills) {
        const { normal, hidden } = result.bossKills
        result.bossKills = { normal, hidden }
    }
    return result
}

function canonicalAsset(asset) {
    assert(object(asset) && ['strategy', 'bond'].includes(asset.kind) && id(asset.id) && id(asset.versionId) &&
        text(asset.name) && text(asset.iconUrl) && (asset.name || asset.iconUrl) &&
        (!asset.iconUrl || garrisonStatisticsIcon(asset.iconUrl) === asset.iconUrl))
    const { kind, id: assetId, versionId, name, iconUrl } = asset
    return { kind, id: assetId, versionId, name, iconUrl }
}

export function migrateSnapshot(data) {
    if (data === undefined) return { version: 2, legacyV1: null, records: [], assets: [] }
    if (data?.version === 1) return { ...migrateSnapshot(), legacyV1: validateBaseline(data) }
    assert(data?.version === 2 && Array.isArray(data.records) && Array.isArray(data.assets))
    const records = data.records.map(canonicalRecord).sort((a, b) => compareIds(a.id, b.id))
    const assets = data.assets.map(canonicalAsset).sort((a, b) => compareIds(keyOfAsset(a), keyOfAsset(b)))
    assert(unique(records, record => record.id) && unique(assets, keyOfAsset))
    return { version: 2, legacyV1: data.legacyV1 === null ? null : validateBaseline(data.legacyV1), records, assets }
}

export function mergeMetricRecords(seasonId, snapshot, incoming = [], incomingAssets = []) {
    const base = migrateSnapshot(snapshot)
    const records = new Map(base.records.map(record => [record.id, record]))
    const assets = new Map(base.assets.map(asset => [keyOfAsset(asset), asset]))
    for (const incomingRecord of incoming) {
        if (!incomingRecord?.id) continue
        const record = canonicalRecord(incomingRecord)
        const previous = records.get(record.id)
        if (previous) {
            if (record.bonds && previous.bonds) {
                const previousLayers = new Map(previous.bonds.map(({ id, layer }) => [id, layer]))
                record.bonds = record.bonds.map(({ id, layer }) => ({ id, layer: layer ?? previousLayers.get(id) ?? null }))
            }
            for (const field of Object.keys(fields)) {
                if (record[field] === null || record[field] === '') record[field] = previous[field]
            }
        }
        records.set(record.id, record)
    }
    for (const incomingAsset of incomingAssets) {
        const asset = canonicalAsset(incomingAsset)
        const key = keyOfAsset(asset)
        const previous = assets.get(key)
        asset.name ||= previous?.name ?? ''
        asset.iconUrl ||= previous?.iconUrl ?? ''
        assets.set(key, asset)
    }
    const merged = {
        ...base,
        records: [...records.values()].sort((a, b) => compareIds(a.id, b.id)),
        assets: [...assets.values()].sort((a, b) => compareIds(keyOfAsset(a), keyOfAsset(b)))
    }
    return {
        snapshot: merged,
        summary: buildStatisticsSummary(seasonId, merged),
        changed: snapshot?.version === 1 || JSON.stringify(merged) !== JSON.stringify(base)
    }
}

export function buildStatisticsSummary(seasonId, snapshot) {
    const legacy = snapshot.legacyV1
    const legacyIds = new Set(legacy?.recordIds)
    const groups = new Map((legacy?.difficulties || []).map(row => [keyOfGroup(row), { ...row }]))
    const assets = new Map(snapshot.assets.map(asset => [keyOfAsset(asset), asset]))
    const strategies = new Map(), bonds = new Map()
    const boss = { total: null, normal: null, hidden: null, reported: 0 }
    const duration = { totalSec: null, avgSec: null, minSec: null, maxSec: null, reported: 0 }
    const coverage = { total: legacyIds.size, strategyReported: 0, bondsReported: 0, bossReported: 0, durationReported: 0 }
    let kills = legacy?.kills ?? 0, killsReported = legacy?.killsReported ?? 0, latestTrophy = legacy?.latestTrophy

    function rankEntry(ranking, kind, id, record, values) {
        if (!ranking.has(id)) ranking.set(id, { id, name: id, iconUrl: '', games: 0, assetTime: -Infinity, ...values })
        const entry = ranking.get(id)
        entry.games++
        const asset = assets.get(keyOfAsset({ kind, id, versionId: record.versionId }))
        const time = record.endTimeMs ?? 0
        if (asset && time > entry.assetTime) {
            entry.name = asset.name || id
            entry.iconUrl = asset.iconUrl
            entry.assetTime = time
        }
        return entry
    }

    for (const record of snapshot.records) {
        if (!legacyIds.has(record.id)) {
            coverage.total++
            const { modeCode } = record
            const difficultyCode = modeCode === 'LOCAL' ? 'TRAINING' : record.difficultyCode
            const key = keyOfGroup({ modeCode, difficultyCode })
            if (!groups.has(key)) groups.set(key, { modeCode, difficultyCode, total: 0, wins: 0 })
            const row = groups.get(key)
            row.total++
            if (record.result === true) row.wins++
            if (record.killCnt !== null) {
                kills += record.killCnt
                killsReported++
            }
            if (record.trophyAfter !== null && record.endTimeMs > (latestTrophy?.timeMs ?? 0)) {
                latestTrophy = { timeMs: record.endTimeMs, value: record.trophyAfter }
            }
        }
        if (record.strategyId !== null) {
            coverage.strategyReported++
            const entry = rankEntry(strategies, 'strategy', record.strategyId, record, { wins: 0, resultKnown: 0 })
            if (record.result !== null) entry.resultKnown++
            if (record.result === true) entry.wins++
        }
        if (record.bonds !== null) {
            coverage.bondsReported++
            for (const { id, layer } of record.bonds) {
                if (excludedBondIds.has(id)) continue
                const entry = rankEntry(bonds, 'bond', id, record, { maxLayer: null })
                if (layer !== null) entry.maxLayer = Math.max(entry.maxLayer ?? 0, layer)
            }
        }
        if (record.bossKills !== null) {
            boss.reported++
            boss.normal = (boss.normal ?? 0) + record.bossKills.normal
            boss.hidden = (boss.hidden ?? 0) + record.bossKills.hidden
            boss.total = boss.normal + boss.hidden
        }
        if (record.durationSec !== null) {
            const seconds = record.durationSec
            duration.reported++
            duration.totalSec = (duration.totalSec ?? 0) + seconds
            duration.minSec = Math.min(duration.minSec ?? seconds, seconds)
            duration.maxSec = Math.max(duration.maxSec ?? seconds, seconds)
        }
    }
    coverage.bossReported = boss.reported
    coverage.durationReported = duration.reported
    if (duration.reported) duration.avgSec = duration.totalSec / duration.reported

    const difficulties = [...groups.values()].map(({ modeCode, difficultyCode, total, wins }) => {
        const { mode, modeTone, difficulty, difficultyTone } = garrisonRecordLabels({ modeCode, difficultyCode, seasonId })
        return { mode, modeTone, label: difficulty, tone: difficultyTone, total, wins }
    }).sort((a, b) => compareIds(a.modeTone, b.modeTone) || difficultyOrder.indexOf(a.tone) - difficultyOrder.indexOf(b.tone))
    const byUsage = (a, b) => b.games - a.games || compareIds(a.id, b.id)
    return {
        total: coverage.total, wins: difficulties.reduce((sum, row) => sum + row.wins, 0),
        trophies: latestTrophy?.value ?? null, kills: killsReported ? kills : null, killsReported, difficulties,
        strategies: [...strategies.values()].map(({ id, name, iconUrl, games, wins, resultKnown }) => ({
            id, name, iconUrl, games, wins, resultKnown, winRate: resultKnown ? Math.round(wins * 100 / resultKnown) : null
        })).sort(byUsage),
        bonds: [...bonds.values()].map(({ id, name, iconUrl, games, maxLayer }) => ({
            id, name, iconUrl, games, maxLayer
        })).sort(byUsage),
        boss, duration, coverage
    }
}
