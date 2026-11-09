import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { createMaterialCatalog, calculateMissingMaterials } from '../model/cultivateMaterials.js'

const catalogOptions = { findLocalIcon: () => '' }

test('材料使用官方名称、返回顺序、零基稀有度和按ID生成的素材，完整资料不读取本地表', () => {
    let reads = 0
    const catalog = createMaterialCatalog([
        { id: 'new_id', name: '新材料', rarity: 5 }, { id: '30115', name: '官方名称', rarity: 0 }
    ], { ...catalogOptions, loadFallback: () => { reads++; return {} } })
    const rows = catalog.decorate([{ id: '30115', count: 2 }, { id: 'new_id', count: 3 }])
    assert.deepEqual(rows.map(item => item.name), ['新材料', '官方名称'])
    assert.equal(rows[0].displayRarity, 6)
    assert.equal(rows[1].displayRarity, 1)
    assert.equal(rows[0].count, 3)
    assert.equal(reads, 0)
    assert.equal(rows[0].iconUrl, 'https://web.hycdn.cn/arknights/game/assets/item/new_id.png')
    assert.match(rows[1].backgroundUrl, /8ef86355600794e0740cb9c16fed08ce\.png$/)
})

test('官方材料缺失时按需读取一次本地表，缺少稀有度不猜测；未知材料保留ID', () => {
    let reads = 0
    const catalog = createMaterialCatalog([], {
        ...catalogOptions,
        loadFallback: () => { reads++; return { '30115': { name: '聚合剂', sortId: 2, icon: 'not-the-official-id.png' } } }
    })
    assert.equal(catalog.resolve('30115').name, '聚合剂')
    assert.match(catalog.resolve('30115').iconUrl, /\/30115\.png$/)
    assert.equal(catalog.resolve('30115').displayRarity, null)
    assert.equal(catalog.resolve('new').name, '未知材料 new')
    assert.equal(catalog.resolve('constructor').name, '未知材料 constructor')
    assert.equal(reads, 1)
    const unavailable = createMaterialCatalog([], { ...catalogOptions, loadFallback: () => { throw new Error('missing file') } })
    assert.equal(unavailable.resolve('new').source, 'unknown')
})

test('素材URL编码完整ID，本地图标仅作为加载失败兜底；资料不被修改', () => {
    const input = [{ id: "new/#@'<>?", name: '本地有图', rarity: 3 }]
    const catalog = createMaterialCatalog(input, { ...catalogOptions, findLocalIcon: () => 'gameData/material/test.png' })
    const result = catalog.resolve(input[0].id)
    assert.match(result.iconUrl, /new%2F%23%40%27%3C%3E%3F\.png$/)
    assert.equal(result.fallbackIcon, 'gameData/material/test.png')
    assert.equal(input[0].index, undefined)
})

test('缺料统计包含零库存与未返回的材料，使用官方经验值，不污染消耗明细', () => {
    const catalog = createMaterialCatalog([{ id: '2004', name: '作战记录', rarity: 4, type: 'CARD_EXP', exp: 2500 }], catalogOptions)
    const required = [{ id: 'a', count: 5 }, { id: 'b', count: 8 }, { id: 'c', count: 2 }, { id: 'd', count: 1 }]
    const result = calculateMissingMaterials(required, 10000, 10000, [
        { id: 'a', count: 0 }, { id: 'b', count: '3' }, { id: 'c', count: 5 },
        { id: '4001', count: 1000 }, { id: '2004', count: 2 }
    ], catalog)
    assert.equal(result.cash, 9000)
    assert.equal(result.exp, 5000)
    assert.deepEqual(result.materials.map(item => [item.id, item.lackCount]), [['a', 5], ['b', 5], ['d', 1]])
    assert.equal(required[0].lackCount, undefined)
})

const loadCalculator = (User, renders) => {
    const context = vm.createContext({
        console, process, createMaterialCatalog, calculateMissingMaterials,
        SKLandUser: User, rulePrefix: '(~|～)', constant: { charData: { amiya_ids: {} } },
        get_name_from_nickname: value => value, profession_eng_to_name: () => '近卫',
        getSkinAvatarUrl: id => 'https://example.com/' + id, getAvatarUrl: id => 'https://example.com/' + id,
        runtimeRender: async (_event, path, data) => renders.push({ path, data }),
        logger: { mark() {}, debug() {}, error() {} },
        plugin: class { constructor(config) { Object.assign(this, config) } async reply(message) { this.replies ||= []; this.replies.push(message) } }
    })
    const source = readFileSync(new URL('../apps/calculate.js', import.meta.url), 'utf8').replace(/^import .+$/gm, '')
        .replace('export class CharProfile', 'globalThis.CharProfile = class CharProfile')
    vm.runInContext(source, context)
    return new context.CharProfile()
}

test('养成命令把官方材料映射传给模板，库存缺行仍显示缺料；合并数字字符串不拼接', async () => {
    const renders = []
    class User {
        async getUser() { return true }
        async getGamePlayerInfo() { return { data: { chars: [{ charId: 'test', skinId: 'test#2' }] } } }
        sklReq = { getData: async type => ({ data: type === 'cal_info' ? {
            characters: [{ id: 'test', name: '示例', rarity: 5 }], items: [{ id: 'new', name: '官方新材料', rarity: 3 }, { id: '4001', name: '龙门币', rarity: 4 }]
        } : type === 'cal_player' ? { characters: [{ id: 'test', skills: [], equips: [] }], items: [] } : {} }) }
    }
    const app = loadCalculator(User, renders)
    app.e = { msg: '~养成计算 示例 2 60', user_id: 'user' }
    app.getTarget = () => ({})
    app.calculateRequire = async () => ({ exp: 200, cash: 100, evo_materials: [{ id: 'new', count: 3 }], skill_materials: [], mod_materials: [], total_materials: [{ id: 'new', count: 3 }] })
    await app.charCalculator()
    assert.equal(renders[0].path, 'calculate/calculate.html')
    assert.equal(renders[0].data.cal_result.evo_materials[0].name, '官方新材料')
    assert.equal(renders[0].data.lack_materials.find(item => item.id === 'new').count, 3)
    const merged = await app.mergeMaterials([{ id: 'new', count: '2' }], [{ id: 'new', count: '3' }])
    assert.equal(merged[0].count, 5)
})

test('养成元数据请求失败时明确提示，不渲染错误数据', async () => {
    class User {
        async getUser() { return true }
        async getGamePlayerInfo() { return { data: { chars: [] } } }
        sklReq = { getData: async () => false }
    }
    const renders = [], app = loadCalculator(User, renders)
    app.e = { msg: '~养成计算 示例 2 60', user_id: 'user' }
    await app.charCalculator()
    assert.equal(renders.length, 0)
    assert.match(app.replies[0], /未能获取养成资料/)
})
