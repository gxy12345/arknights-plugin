import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

test('详情命令带空格或紧接序号都分发到正确详情，并兼容长名称、前缀和攻略ID', async () => {
    const cache = new Map(), renders = [], requested = []
    const resource = { versionInfo: { seasonId: 'season' }, seasons: [] }
    class User {
        constructor() { this.uid = 'test-uid' }
        async getUser() { return true }
    }
    class Service {
        async getResources() { return resource }
        async getGuides() { return { guides: [{ id: 'guide-123' }], resource } }
        async getGuide(id) { requested.push(id); return { guide: { id }, resource } }
        async getHistory() { return { records: [{ id: 'record-123' }], seasonId: 'season', resource } }
    }
    const context = vm.createContext({
        URL, Date,
        rulePrefix: '((#|/)(方舟|明日方舟|arknights|方舟插件)|~|～)',
        plugin: class { constructor(config) { Object.assign(this, config) } },
        SKLandUser: User, GarrisonService: Service,
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
    await run('~卫戍战绩')
    for (const prefix of ['~', '～', '#方舟插件', '/明日方舟']) {
        for (const name of ['卫戍', '卫戍协议']) {
            for (const separator of ['', ' ', '  ', '\t']) {
                assert.equal(await run(`${prefix}${name}攻略详情${separator}1`), 'guideDetail')
                assert.equal(renders.at(-1).path, 'garrison/guide.html')
                assert.equal(renders.at(-1).data.guide.id, 'guide-123')
                assert.equal(await run(`${prefix}${name}战绩详情${separator}1`), 'recordDetail')
                assert.equal(renders.at(-1).path, 'garrison/record.html')
                assert.equal(renders.at(-1).data.record.id, 'record-123')
            }
        }
    }
    await run('~卫戍攻略详情guide-abc_123')
    assert.equal(requested.at(-1), 'guide-abc_123')
    assert.equal(await run('~卫戍攻略 阿米娅'), 'guides')
    for (const msg of ['~卫戍攻略详情', '~卫戍战绩详情', '~卫戍战绩详情x', '~卫戍战绩详情1abc']) {
        assert.equal(app.rule.find(rule => new RegExp(rule.reg).test(msg)), undefined, msg)
    }
})
