import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { formatGarrisonDuration, garrisonMetricRecord, garrisonStatisticsAssets } from '../model/garrisonView.js'
import { mergeMetricRecords } from '../model/garrisonStatisticsCore.js'

const { records, legacy, expected } = JSON.parse(readFileSync(new URL('./fixtures/garrison-statistics-v2.json', import.meta.url), 'utf8'))
const merge = (snapshot, raw, assets) => mergeMetricRecords('s', snapshot, raw.map(garrisonMetricRecord), assets)

test('the statistics contract matches the shared vector and is idempotent', () => {
    const fresh = merge(undefined, records)
    for (const [key, value] of Object.entries(expected)) assert.deepEqual(fresh.summary[key], value)
    const repeated = merge(fresh.snapshot, [...records, ...records])
    assert.equal(repeated.changed, false)
    assert.deepEqual(repeated.snapshot, fresh.snapshot)
    assert.deepEqual(merge(fresh.snapshot, []).summary, fresh.summary)
})

test('legacy matches backfill new metrics while keeping the old base and window history', () => {
    const migrated = merge(legacy, records.slice(0, 1))
    assert.equal(migrated.changed, true)
    assert.equal(migrated.summary.total, 2)
    assert.equal(migrated.summary.kills, 17)
    assert.equal(migrated.summary.coverage.bossReported, 1)
    const combined = merge(migrated.snapshot, records)
    assert.deepEqual([combined.summary.total, combined.summary.kills, combined.summary.wins, combined.summary.trophies], [4, 17, 1, 0])
    assert.equal(combined.summary.coverage.bossReported, 3)
    assert.throws(() => merge({ ...legacy, recordIds: ['r1', 'r1'] }, records))
    assert.throws(() => merge({ ...legacy, difficulties: [{ ...legacy.difficulties[0], total: 1 }] }, records))
    assert.throws(() => merge({ ...migrated.snapshot, records: [{ ...migrated.snapshot.records[0], durationSec: -1 }] }, []))
})

test('duplicate fields backfill and correct the same record without stale increments', () => {
    const original = merge(undefined, records)
    const corrected = merge(original.snapshot, [
        { id: 'r2', completeState: true, acBossInfo: [], gameStartTs: 123, gameEndTs: 123 },
        { id: 'r2', completeState: false, acBossInfo: [{ isKilled: true }], gameStartTs: 124, gameEndTs: 123,
            bondInfo: [{ bondId: 'x', activate: true, layer: 2 }], bandId: {} },
        { id: 'r3', bandId: 'b', gameStartTs: 123, gameEndTs: 124 },
        { id: 'r3', killCnt: null, bondInfo: [{ bondId: 'x', activate: null }], acBossInfo: null }
    ])
    const { total, strategies, bonds, boss, duration, coverage } = corrected.summary
    assert.equal(corrected.changed, true)
    assert.equal(total, 3)
    assert.equal(strategies[0].winRate, 50)
    assert.equal(bonds[0].maxLayer, 3)
    assert.deepEqual(boss, { total: 2, normal: 1, hidden: 1, reported: 3 })
    assert.deepEqual(duration, { totalSec: 1801, avgSec: 1801 / 3, minSec: 0, maxSec: 1800, reported: 3 })
    assert.equal(coverage.bondsReported, 3)
    assert.deepEqual(merge(corrected.snapshot, [{ id: 'r2', bondInfo: [] }]).summary.bonds[0].games, 1)
})

test('invalid values stay unknown and genuine zeros remain valid', () => {
    const bad = garrisonMetricRecord({
        id: {}, completeState: [], killCnt: false, trophyAfter: ' ', bandId: true,
        acBossInfo: [{ isKilled: '0' }, { isKilled: 'true', isHidden: true }],
        bondInfo: [{ bondId: 'x', activate: -1 }], gameStartTs: 1, gameEndTs: 1e12
    })
    for (const key of ['id', 'result', 'killCnt', 'trophyAfter', 'strategyId', 'bossKills', 'bonds', 'durationSec']) {
        assert.equal(bad[key], null, key)
    }
    const raw = { id: 'zero', acBossInfo: [{ isKilled: '0' }], gameStartTs: 1, gameEndTs: '1', killCnt: 0 }
    const empty = merge(undefined, [{ id: 'unknown' }]).summary
    assert.equal(empty.boss.total, null)
    assert.equal(empty.duration.totalSec, null)
    const zero = merge(undefined, [raw]).summary
    assert.equal(zero.boss.total, 0)
    assert.equal(zero.duration.totalSec, 0)
    assert.equal(zero.kills, 0)
    assert.equal(formatGarrisonDuration(0), '0秒')
    assert.equal(formatGarrisonDuration(null), '—')
    assert.equal(formatGarrisonDuration(59.6), '1分钟0秒')
    const unknownLayer = merge(undefined, [{ id: 'active', bondInfo: [{ bondId: 'x', activate: true, layer: ' ' }] }])
    assert.equal(unknownLayer.summary.bonds[0].maxLayer, null)
})

test('rankings use version-matched assets, then fall back to the most recent known metadata', () => {
    const current = {
        versionInfo: { seasonId: 's', versionId: 'v1' },
        strategies: [{ strategyId: 'a', name: 'old', iconUrl: 'https://example.test/a.png?token=short' }]
    }
    const facts = records.map(garrisonMetricRecord)
    const first = merge(undefined, records, garrisonStatisticsAssets('s', facts, current))
    assert.equal(first.summary.strategies[0].name, 'old')
    assert.equal(first.summary.strategies[0].iconUrl, 'https://example.test/a.png')
    const updated = {
        versionInfo: { seasonId: 's', versionId: 'v2' },
        strategies: [{ strategyId: 'a', name: 'new' }]
    }
    const second = merge(first.snapshot, records, garrisonStatisticsAssets('s', facts, updated))
    assert.equal(second.changed, true)
    assert.equal(second.summary.strategies[0].name, 'new')
    assert.equal(second.summary.strategies[1].name, 'b')
    assert.deepEqual(merge(undefined, [
        { id: '1', bandId: 'constructor' }, { id: '2', bandId: '__proto__' }, { id: '3', bandId: 'Z' }
    ]).summary.strategies.map(entry => entry.id), ['Z', '__proto__', 'constructor'])
})

test('the three fixed zero-layer bonds stay in records but are excluded from the ranking', () => {
    const bondInfo = ['suntShip', 'soloShip', 'emptyShip', 'maniShip', 'preciShip'].map(bondId => ({
        bondId, activate: true, layer: 0
    }))
    const saved = merge(undefined, [{ id: 'bond-rank', bondInfo }]).snapshot
    const { summary } = merge(saved, [])
    assert.equal(saved.records[0].bonds.length, 5)
    assert.equal(summary.coverage.bondsReported, 1)
    assert.deepEqual(summary.bonds.map(({ id, games, maxLayer }) => [id, games, maxLayer]), [
        ['maniShip', 1, 0], ['preciShip', 1, 0]
    ])
})
