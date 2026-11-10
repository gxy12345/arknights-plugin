import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { buildProfileView, buildInfrastructureView, buildingResidents, playerAp, playerDrones, playerTime } from '../model/playerView.js'

const now = Date.UTC(2026, 10, 10, 8, 0) / 1000
const player = () => ({
    currentTs: now, status: { uid: '123', name: '示例博士', level: 120, storeTs: now, registerTs: now - 86400, mainStageProgress: 'main_1', avatar: { type: 'ICON', id: 'avatar_def_01' }, secretary: { charId: 'char_a', skinId: 'char_a#2' },
        ap: { current: 0, max: 100, lastApAddTime: now, completeRecoveryTime: now + 36000 } },
    stageInfoMap: { main_1: { code: '1-7' } },
    chars: [{ charId: 'char_a', skinId: 'char_a#2', skills: [{ id: 'skill_a', specializeLevel: 1 }] }, { charId: 'char_002_amiya' }, { charId: 'char_1001_amiya2' }, { charId: 'char_1037_amiya3' }],
    charInfoMap: { char_a: { name: '示例干员' } }, skins: [], medal: { total: 0 },
    assistChars: [{ charId: 'char_a', skinId: 'char_a#2', skillId: 'skill_a', mainSkillLvl: 7, specializeLevel: 1, evolvePhase: 2, level: 90 }],
    recruit: [{ state: 0 }, { state: 1 }, { state: 2, startTs: now - 3600, finishTs: now - 1 }, { state: 2, startTs: now, finishTs: now + 3600 }],
    routine: { daily: { current: 0, total: 10 }, weekly: { current: 2, total: 12 } }, campaign: { reward: { current: 0, total: 1800 } }, tower: { reward: { lowerItem: { current: 0, total: 60 }, higherItem: { current: 0, total: 24 } } },
    building: { furniture: { total: 0 }, labor: { value: 0, maxValue: 200, lastUpdateTime: now, remainSecs: 10000 },
        control: { level: 5, chars: [{ charId: 'char_a', index: 0, ap: 0 }] }, manufactures: [], tradings: [], powers: [], dormitories: [],
        hire: { level: 3, refreshCount: 0, chars: [] }, meeting: { level: 3, chars: [], clue: { own: 0, received: 0, board: [], sharing: false } },
        training: { level: 3, trainee: { charId: 'char_a', targetSkill: 0, ap: 8640000 }, remainSecs: 3600 }, tiredChars: [] }
})

test('便签保留真实零值，使用关卡代码、独立干员数量和当前助战技能', () => {
    const data = player(), before = JSON.stringify(data), view = buildProfileView(data, { now })
    assert.equal(view.user.mainStage, '1-7')
    assert.equal(view.user.days, 1)
    assert.deepEqual(view.assets.map(a => a.value), ['2', '0', '0', '0'])
    assert.equal(view.ap.text, '0')
    assert.equal(view.tasks[0].text, '0')
    assert.equal(view.assists[0].skillName, '技能1')
    assert.equal(view.assists[0].skillLevel, '专精1')
    assert.equal(JSON.stringify(data), before)
})

test('理智按秒恢复，超过上限保留；无恢复时间不冒充回满，零分母无NaN', () => {
    assert.equal(playerAp({ current: 2, max: 100, lastApAddTime: now - 721, completeRecoveryTime: now + 1000 }, now).current, 4)
    assert.equal(playerAp({ current: 120, max: 100 }, now).current, 120)
    assert.equal(playerAp({ current: 120, max: 100 }, now).percent, 100)
    assert.equal(playerAp({ current: 2, max: 100, completeRecoveryTime: -1 }, now).current, 2)
    assert.equal(playerAp({ current: 2, max: 100, completeRecoveryTime: now - 1 }, now).current, 100)
    assert.equal(playerAp({ current: 0, max: 0 }, now).percent, 0)
    assert.doesNotMatch(playerAp({ current: 0, max: 0 }, now).note, /全部恢复/)
    assert.equal(playerAp(undefined, now).known, false)
})

test('无人机使用本次响应的恢复区间，不假设固定恢复速度，未来时间和哨兵保留同步值', () => {
    const labor = { value: 10, maxValue: 210, lastUpdateTime: now - 500, remainSecs: 1000 }
    assert.equal(playerDrones(labor, now).current, 110)
    assert.equal(playerDrones(labor, now + 500).current, 210)
    assert.equal(playerDrones({ ...labor, lastUpdateTime: now + 500 }, now).current, 10)
    assert.equal(playerDrones({ ...labor, remainSecs: -1 }, now).current, 10)
    assert.equal(playerDrones({ ...labor, remainSecs: 0 }, now).current, 10)
    assert.equal(playerDrones({ value: 0, maxValue: 0 }, now).percent, 0)
})

test('招募完成比较秒与秒，区分未开放、空闲、可聘用和进行中', () => {
    const view = buildProfileView(player(), { now })
    assert.deepEqual(view.recruits.map(r => r.state), ['未开放', '空闲', '可聘用', '招募中'])
    assert.equal(view.recruitReady, 1)
    assert.equal(view.recruitTotal, 3)
    assert.equal(view.recruits[3].percent, 0)
})

test('训练区分未选技能、训练中、完成、未知及空闲；剩余时间只扣除响应之后的缓存时长', () => {
    const data = player()
    assert.equal(buildProfileView(data, { now: now + 60 }).training.note, '59分钟后完成')
    data.building.training.remainSecs = 0
    assert.equal(buildProfileView(data, { now }).training.state, '专精已完成')
    data.building.training.remainSecs = -1
    assert.equal(buildProfileView(data, { now }).training.state, '训练状态未知')
    data.building.training.trainee.targetSkill = -1
    assert.equal(buildProfileView(data, { now }).training.state, '未选择专精技能')
    delete data.building.training.trainee
    assert.equal(buildProfileView(data, { now }).training.state, '空闲中')
})

test('每日04:00、每周一及保全半月周期切换后不展示过期奖励进度', () => {
    const data = player()
    data.status.storeTs = Date.UTC(2026, 10, 8, 8) / 1000
    data.routine.daily.current = 10; data.routine.weekly.current = 12
    const view = buildProfileView(data, { now })
    assert.equal(view.tasks[0].text, '0')
    assert.equal(view.tasks[1].text, '0')
    data.status.storeTs = Date.UTC(2026, 9, 31, 8) / 1000
    data.tower.reward.lowerItem.current = 60
    assert.equal(buildProfileView(data, { now }).tasks[3].text, '0')
    assert.match(playerTime(now), /2026\/11\/10 16:00/)
})

test('基建心情零值不画满条，未知心情不当成零；空位不写回原始数组', () => {
    const data = player(), rows = [{ charId: 'char_a', index: 1, ap: 0 }, { charId: 'missing', index: 0, ap: null }], before = JSON.stringify(rows)
    const residents = buildingResidents(rows, data, 3)
    assert.equal(residents[0].mood, '—')
    assert.equal(residents[1].mood, '0.0')
    assert.equal(residents[1].percent, 0)
    assert.equal(residents[1].moodTone, 'exhausted')
    assert.equal(residents[2].empty, true)
    assert.equal(JSON.stringify(rows), before)
    assert.equal(buildingResidents([{ charId: 'char_a', ap: 8640000 }], data, 1)[0].mood, '24.0')
})

test('制造使用服务器配方和仓储重量，未知槽位保留；订单保留所有交付项，混合收益不错误求和', () => {
    const data = player(), items = [{ id: 'a', name: '新产品' }, { id: 'b', name: '材料B' }, { id: 'money', name: '龙门币' }, { id: 'diamond', name: '合成玉' }]
    data.manufactureFormulaInfoMap = { future: { id: 'future', itemId: 'a', weight: 5 } }
    data.building.manufactures = [{ slotId: 'new_slot', level: 3, formulaId: 'future', weight: 10, capacity: 20, complete: 2, speed: 2.5, chars: [] }]
    data.building.tradings = [{ slotId: 'slot_24', level: 3, strategy: 'NEW_STRATEGY', stockLimit: 10, chars: [], stock: [
        { delivery: [{ id: 'a', count: 2 }, { id: 'b', count: 3 }], gain: { id: 'money', count: 1000 } },
        { delivery: [{ id: 'a', count: 1 }], gain: { id: 'diamond', count: 1 } }
    ] }]
    const before = JSON.stringify(data), view = buildInfrastructureView(data, { now, items })
    assert.equal(view.production.length, 2)
    const manufacture = view.production.find(r => r.kind === 'manufacture'), trading = view.production.find(r => r.kind === 'trading')
    assert.equal(manufacture.product.name, '新产品')
    assert.equal(manufacture.stock.percent, 50)
    assert.equal(manufacture.metrics.find(m => m.label === '已完成').value, '2')
    assert.equal(trading.details[0].delivery, '新产品 ×2 + 材料B ×3')
    assert.equal(trading.metrics.find(m => m.label === '收益合计').value, '多种收益')
    assert.match(trading.product.name, /未知贸易策略/)
    assert.equal(JSON.stringify(data), before)
})

test('缺少字段明确显示未知，空房间和零容量不崩溃、不产生NaN或虚构完成', () => {
    const view = buildProfileView({ status: {}, building: {} }, { now })
    assert.ok(view.assets.every(a => a.value === '—'))
    assert.equal(view.user.mainStage, '暂无进度')
    assert.equal(view.user.days, null)
    assert.equal(view.training.state, '暂无训练数据')
    const data = player(); data.building.manufactures = [{ level: 1, chars: [], capacity: 0, weight: 0 }]
    const base = buildInfrastructureView(data, { now })
    assert.equal(base.production[0].stock.percent, 0)
    assert.equal(base.production[0].status, '未设置生产')
    assert.doesNotMatch(JSON.stringify(base), /NaN|Infinity/)
})

function commandApp(User, renders) {
    const context = vm.createContext({ Date, console, buildProfileView, buildInfrastructureView, rulePrefix: '((#|/)(方舟|明日方舟|arknights|方舟插件)|~|～)',
        SKLandUser: User, runtimeRender: async (_event, file, data) => renders.push({ file, data }),
        plugin: class { constructor(config) { Object.assign(this, config) } async reply(value) { this.replies ||= []; this.replies.push(value) } } })
    vm.runInContext(readFileSync(new URL('../apps/profile.js', import.meta.url), 'utf8').replace(/^import .+$/gm, '').replace('export class Profile', 'globalThis.Profile = class Profile'), context)
    return new context.Profile()
}

test('便签、卡片和基建命令复用绑定，支持@查询，不依赖cards接口，渲染数据不含凭据', async () => {
    const renders = [], ids = []
    class User {
        constructor(id) { ids.push(id); this.cred = 'must-not-render'; this.token = 'must-not-render' }
        async getUser() { return true }
        async getGamePlayerInfo() { return { code: 0, data: player() } }
    }
    const app = commandApp(User, renders)
    for (const [msg, method, file] of [['#方舟便签', 'profileCard', 'profileCard/profileCard.html'], ['~博士卡片', 'profileCard', 'profileCard/profileCard.html'], ['～基建', 'infrastructure', 'profileCard/infrastructure.html'], ['/明日方舟基建查询', 'infrastructure', 'profileCard/infrastructure.html']]) {
        app.e = { msg, user_id: 'requester', at: 'target' }
        assert.ok(app.rule.some(r => new RegExp(r.reg).test(msg)))
        await app[method]()
        assert.equal(renders.at(-1).file, file)
        assert.doesNotMatch(JSON.stringify(renders.at(-1).data), /must-not-render/)
    }
    assert.deepEqual(ids, ['target', 'target', 'target', 'target'])
})

test('未绑定、接口失败和基建数据缺失时明确提示，不生成错误图片', async () => {
    let state = 'unbound'
    class User {
        async getUser() { return state !== 'unbound' }
        async getGamePlayerInfo() { if (state === 'error') throw new Error('private backend details'); return state === 'missing' ? { code: 0, data: { status: {} } } : null }
    }
    const renders = [], app = commandApp(User, renders); app.e = { user_id: 'test' }
    for (const [value, expected] of [['unbound', /尚未绑定/], ['failed', /未能获取游戏资料/], ['missing', /未能获取基建资料/], ['error', /查询失败/]]) {
        state = value; await app.infrastructure(); assert.match(app.replies.at(-1), expected)
        assert.doesNotMatch(app.replies.at(-1), /private/)
    }
    assert.equal(renders.length, 0)
})
