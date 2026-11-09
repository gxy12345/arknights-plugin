import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import constant from '../components/constant.js'
import * as operator from '../model/operatorAssets.js'
import { normalizeSkinAssets } from '../model/skinAssets.js'

const load = (filename, className, injected) => {
    const context = vm.createContext({
        console, Date, ...injected,
        plugin: class { constructor(config) { Object.assign(this, config) } async reply(message) { this.replies ||= []; this.replies.push(message) } }
    })
    const source = readFileSync(new URL(filename, import.meta.url), 'utf8').replace(/^import .+$/gm, '')
        .replace(`export class ${className}`, `globalThis.${className} = class ${className}`)
    vm.runInContext(source, context)
    return new context[className]()
}

test('练度列表/卡片复用宿主绑定和动态配置，支持多前缀筛选和越界页码', async () => {
    const config = { char_stat_page_size: 1, char_stat_card_page_size: 2 }, renders = []
    class User {
        constructor(id) { this.userId = id; this.name = '示例'; this.uid = '123'; this.cred = 'must-not-render' }
        async getUser() { return true }
        async getGamePlayerInfo() { return { timestamp: 1700000000, data: { charInfoMap: { a: { name: '干员A', profession: 'WARRIOR', rarity: 5 }, b: { name: '干员B', profession: 'MEDIC', rarity: 4 } }, chars: [{ charId: 'a', level: 90 }, { charId: 'b', level: 80 }] } } }
    }
    const app = load('../apps/char_stat.js', 'CharStat', {
        rulePrefix: '((#|/)(方舟|明日方舟|arknights|方舟插件)|~|～)', constant,
        SKLandUser: User, setting: { getConfig: () => config }, ...operator,
        runtimeRender: async (_e, path, data) => renders.push({ path, data })
    })
    for (const [msg, method, expected] of [['~练度统计2', 'charStat', 'charStat/charStat.html'], ['#方舟六星近卫练度卡片', 'charStatCard', 'charStat/charStatCard.html'], ['～练度面板', 'charStatCard', 'charStat/charStatCard.html']]) {
        app.e = { msg, user_id: 'requester', at: 'target' }
        assert.ok(app.rule.some(rule => new RegExp(rule.reg).test(msg)))
        await app[method]()
        assert.equal(renders.at(-1).path, expected)
        assert.equal(renders.at(-1).data.user_info.cred, undefined)
    }
    assert.equal(renders.at(-1).data.sorted_char_list.length, 2)
    config.char_stat_card_page_size = 1
    app.e.msg = '~练度卡片'; await app.charStatCard()
    assert.equal(renders.at(-1).data.sorted_char_list.length, 1)
    const count = renders.length
    app.e.msg = '~练度统计999'; await app.charStat()
    app.e.msg = '~练度统计0'; await app.charStat()
    assert.equal(renders.length, count)
    assert.match(app.replies.at(-1), /有效页码/)
})

test('时装统计展示数量热更新，统计总数与实际卡片数量分离', async () => {
    const config = { skin_stat_count: 4 }, renders = []
    let userId
    class User {
        constructor(id) { userId = id; this.uid = '123'; this.name = '示例' }
        async getUser() { return true }
        async getGamePlayerInfo() { return { timestamp: 1700000000, data: { skins: Array.from({ length: 20 }, (_, i) => ({ id: `skin${i}`, ts: 1700000000 + i })) } } }
    }
    const app = load('../apps/skin_stat.js', 'SkinStat', {
        rulePrefix: '(~|～)', SKLandUser: User, normalizeSkinAssets,
        setting: { getConfig: () => config }, runtimeRender: async (_e, path, data) => renders.push({ path, data }), logger: { error() {} }
    })
    app.e = { msg: '~时装统计', user_id: 'requester', at: 'target' }
    assert.ok(new RegExp(app.rule[0].reg).test(app.e.msg))
    for (const value of [4, 8, 12, 16, 5]) {
        config.skin_stat_count = value; await app.skinStat()
        assert.equal(renders.at(-1).data.skins.length, value === 5 ? 8 : value)
        assert.equal(renders.at(-1).data.total, 20)
        assert.equal(renders.at(-1).path, 'skinStat/skinStat.html')
    }
    assert.equal(userId, 'target')
})

test('Guoba 时装配置提供4/8/12/16四档数值，默认配置为8', () => {
    const source = readFileSync(new URL('../guoba.support.js', import.meta.url), 'utf8').replace(/^import .+$/gm, '').replace('export function supportGuoba', 'function supportGuoba')
    const context = vm.createContext({ Bot: { gl: new Map() }, path: { join: (...parts) => parts.join('/') }, pluginResources: 'resources' })
    vm.runInContext(source + ';globalThis.support = supportGuoba;', context)
    const schema = context.support().configInfo.schemas.find(x => x.field === 'game_info.skin_stat_count')
    assert.equal(schema.component, 'Select')
    assert.deepEqual(Array.from(schema.componentProps.options, x => x.value), [4, 8, 12, 16])
    assert.match(readFileSync(new URL('../defSet/game_info.yaml', import.meta.url), 'utf8'), /skin_stat_count: 8/)
})

test('时装未绑定、资料缺失和请求失败时明确提示，只有真实空数组渲染零资产', async () => {
    let state = 'unbound', renders = 0
    class User {
        async getUser() { return state !== 'unbound' }
        async getGamePlayerInfo() {
            if (state === 'error') throw new Error('private backend detail')
            return { data: state === 'empty' ? { skins: [] } : {} }
        }
    }
    const app = load('../apps/skin_stat.js', 'SkinStat', {
        rulePrefix: '~', SKLandUser: User, normalizeSkinAssets, setting: { getConfig: () => ({}) },
        runtimeRender: async (_e, _path, data) => { renders++; assert.equal(data.total, 0) }, logger: { error(message) { assert.doesNotMatch(message, /private/) } }
    })
    app.e = { user_id: 'test' }
    for (const [value, expected] of [['unbound', /未绑定/], ['missing', /未能获取/], ['error', /查询失败/]]) {
        state = value; await app.skinStat(); assert.match(app.replies.at(-1), expected)
        assert.equal(renders, 0)
    }
    state = 'empty'; await app.skinStat(); assert.equal(renders, 1)
})
