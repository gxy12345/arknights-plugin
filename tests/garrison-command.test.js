import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { formatGarrisonDuration, garrisonRecordLabels } from '../model/garrisonView.js'

test('详情命令带空格或紧接序号都分发到正确详情，并兼容长名称、前缀和攻略ID', async () => {
    const cache = new Map(), renders = [], requested = []
    const resource = { versionInfo: { seasonId: 'season' }, seasons: [] }
    class User {
        constructor() { this.uid = 'test-uid' }
        async getUser() { return true }
    }
    class Service {
        async getResources() { return resource }
        async getDoctor() { return { name: '测试博士', uid: 'test-uid', level: '120' } }
        async getGuides() { return { guides: [{ id: 'guide-123' }], resource } }
        async getGuide(id) { requested.push(id); return { guide: { id }, resource } }
        async getHistory() {
            return { records: [{ id: 'record-123', modeCode: 'MULTI', difficultyCode: 'HARD',
                bossKills: { normal: 1, hidden: 0 }, durationSec: 0 }], seasonId: 'season', resource }
        }
        async getStatistics(seasonId) {
            requested.push(seasonId)
            const strategies = Array.from({ length: 6 }, (_, index) => ({ id: String(index), winRate: index === 0 ? null : 50 }))
            return { history: {
                total: 1, strategies, bonds: [{ maxLayer: 0 }], coverage: { bondsReported: 1 },
                duration: { totalSec: 60, avgSec: 60, minSec: 60, maxSec: 60 }
            }, seasonId, resource }
        }
    }
    const context = vm.createContext({
        URL, Date,
        rulePrefix: '((#|/)(方舟|明日方舟|arknights|方舟插件)|~|～)',
        plugin: class { constructor(config) { Object.assign(this, config) } },
        SKLandUser: User, GarrisonService: Service, garrisonRecordLabels, formatGarrisonDuration,
        redis: { get: async key => cache.get(key), set: async (key, value) => cache.set(key, value) },
        runtimeRender: async (_event, path, data) => renders.push({ path, data })
    })
    // Stub host imports while executing the actual plugin's rules and handlers.
    const source = readFileSync(new URL('../apps/garrison.js', import.meta.url), 'utf8')
        .replace(/^import .+$/gm, '').replace('export class Garrison', 'globalThis.Garrison = class Garrison')
    vm.runInContext(source, context)
    const app = new context.Garrison()
    async function run(msg) {
        app.e = { msg, user_id: 'requester' }
        const rule = app.rule.find(rule => new RegExp(rule.reg).test(msg))
        assert.ok(rule, `命令应匹配：${msg}`)
        await app[rule.fnc]()
        return rule.fnc
    }
    await run('~卫戍攻略')
    assert.equal(renders.at(-1).data.doctor.level, '120')
    await run('~卫戍战绩')
    assert.equal(renders.at(-1).data.doctor.uid, 'test-uid')
    for (const prefix of ['~', '～', '#方舟插件', '/明日方舟']) {
        for (const name of ['卫戍', '卫戍协议']) {
            for (const separator of ['', ' ', '  ', '\t']) {
                assert.equal(await run(`${prefix}${name}攻略详情${separator}1`), 'guideDetail')
                assert.equal(renders.at(-1).path, 'garrison/guide.html')
                assert.equal(renders.at(-1).data.guide.id, 'guide-123')
                assert.equal(await run(`${prefix}${name}战绩详情${separator}1`), 'recordDetail')
                assert.equal(renders.at(-1).path, 'garrison/record.html')
                assert.equal(renders.at(-1).data.record.id, 'record-123')
                assert.equal(renders.at(-1).data.record.difficulty, '绝境模拟')
                assert.equal(renders.at(-1).data.record.bossKills.normal, 1)
                assert.equal(renders.at(-1).data.record.durationText, '0秒')
            }
        }
    }
    await run('~卫戍攻略详情guide-abc_123')
    assert.equal(requested.at(-1), 'guide-abc_123')
    assert.equal(await run('~卫戍攻略 阿米娅'), 'guides')
    assert.equal(await run('/明日方舟卫戍协议统计 act3autochess'), 'statistics')
    assert.equal(requested.at(-1), 'act3autochess')
    assert.equal(renders.at(-1).path, 'garrison/statistics.html')
    assert.equal(renders.at(-1).data.history.total, 1)
    assert.equal(renders.at(-1).data.duration.average, '1分钟0秒')
    assert.equal(renders.at(-1).data.rankings[0].entries.length, 5)
    assert.equal(renders.at(-1).data.rankings[0].entries[0].metric, '—')
    assert.equal(renders.at(-1).data.rankings[1].entries[0].metric, 0)
    assert.equal(renders.at(-1).data.doctor.uid, 'test-uid')
    for (const msg of ['~卫戍攻略详情', '~卫戍战绩详情', '~卫戍战绩详情x', '~卫戍战绩详情1abc']) {
        assert.equal(app.rule.find(rule => new RegExp(rule.reg).test(msg)), undefined, msg)
    }
})
