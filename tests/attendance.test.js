import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import crypto from 'node:crypto'
import SklandApi from '../model/sklandApi.js'
import SklandAttendance, { getEndfieldRoles, attendanceResult, formatAttendanceResults } from '../model/sklandAttendance.js'

const role = (id = '123', server = '1') => ({ roleId: id, serverId: server, nickname: '示例管理员', serverName: '示例服务器' })
const binding = (roles = [role()], defaultRole) => ({ code: 0, data: { list: [
    { appCode: 'arknights', bindingList: [{ uid: 'ak-only' }] },
    { appCode: 'endfield', bindingList: [{ uid: 'outer-account-not-role', roles, defaultRole }] }
] } })
const akSuccess = { code: 0, data: { awards: [{ resource: { name: '龙门币' }, count: 500 }] } }
const efSuccess = { code: 0, data: { awardIds: [{ id: 'item', count: 100 }], resourceInfoMap: { item: { name: '示例奖励', count: 200 } } } }
const response = (json, status = 200) => ({ ok: status < 400, status, json: async () => structuredClone(json), statusText: 'error' })

function requestHarness(fetcher) {
    const calls = [], cache = new Map([['ARKNIGHTS:SKL_TOKEN:test-cred', 'test-sign-key']])
    const context = vm.createContext({ crypto, URL, Date, AbortSignal, setTimeout, console,
        sklandApi: SklandApi, setting: { getConfig: () => ({ skland_device_id: 'existing-device' }) },
        logger: { debug() {}, error() {}, warn() {}, info() {} },
        redis: { get: async key => cache.get(key), set: async (key, value) => cache.set(key, value) },
        fetch: async (url, params) => { calls.push({ url, params }); return fetcher(url, params, calls.length) }
    })
    const source = readFileSync(new URL('../model/sklandReq.js', import.meta.url), 'utf8').replace(/^import .+$/gm, '')
        .replace('export default class SKLandRequest', 'globalThis.Request = class SKLandRequest')
    vm.runInContext(source, context)
    return { request: new context.Request('ak-only', 'test-cred'), calls }
}

function expectedSign(url, params) {
    const h = params.headers
    const signed = { platform: String(h.platform), timestamp: h.timestamp, dId: h.dId, vName: h.vName }
    const parsed = new URL(url), input = parsed.pathname + (params.body || parsed.search.slice(1)) + h.timestamp + JSON.stringify(signed)
    return crypto.createHash('md5').update(crypto.createHmac('sha256', h.token).update(input).digest('hex')).digest('hex')
}

test('终末地发送空体POST，签名使用独立协议；原有方舟POST和绑定GET保持一致', async () => {
    const { request, calls } = requestHarness(async () => response(efSuccess))
    await request.getData('endfield_attendance', { headers: { 'sk-game-role': '3_123_1' } })
    await request.getData('attendance')
    await request.getData('binding')
    const ef = calls[0], ak = calls[1], bind = calls[2]
    assert.equal(ef.url, 'https://zonai.skland.com/web/v1/game/endfield/attendance')
    assert.equal(ef.params.method, 'POST')
    assert.equal('body' in ef.params, false, '不能用空对象冒充空请求体')
    assert.equal(ef.params.headers['sk-game-role'], '3_123_1')
    assert.equal(ef.params.headers.platform, 3)
    assert.equal(ef.params.headers.vName, '1.0.0')
    assert.equal(ef.params.headers.dId, '')
    assert.equal(ak.params.method, 'POST')
    assert.deepEqual(JSON.parse(ak.params.body), { uid: 'ak-only', gameId: 1 })
    assert.equal(ak.params.headers.platform, 1)
    assert.equal(ak.params.headers.vName, '1.21.0')
    assert.equal(ak.params.headers.dId, 'existing-device')
    assert.equal(bind.params.method, 'GET')
    assert.equal('body' in bind.params, false)
    for (const call of calls) assert.equal(call.params.headers.sign, expectedSign(call.url, call.params))
    assert.equal(request.config.platform, 1, '不得污染其他接口的签名配置')
})

test('终末地鉴权失败最多刷新重试一次，重试保留空体POST和角色头', async () => {
    const { request, calls } = requestHarness(async url => url.endsWith('/auth/refresh')
        ? response({ code: 0, data: { token: 'new-sign-key' } }) : response({ code: 10002, message: 'invalid token' }, 403))
    assert.equal((await request.getData('endfield_attendance', { headers: { 'sk-game-role': '3_123_1' } })).code, 10002)
    assert.equal(calls.length, 3)
    assert.ok(calls[1].url.endsWith('/auth/refresh'))
    assert.equal(calls[1].params.method, 'GET')
    assert.equal(calls[2].params.method, 'POST')
    assert.equal(calls[2].params.headers['sk-game-role'], '3_123_1')
    assert.equal(calls[2].params.headers.token, 'new-sign-key')
    assert.equal(calls[2].params.headers.sign, expectedSign(calls[2].url, calls[2].params))
})

test('请求层保留签到业务错误供分游戏判断，HTTP故障不能冒充签到成功', async () => {
    const { request } = requestHarness(async () => response({ code: 10001, message: '角色无效' }, 403))
    assert.equal(attendanceResult(await request.getData('endfield_attendance'), 'endfield').status, 'failed')
    assert.equal(await request.getData('binding'), false)
    const broken = requestHarness(async () => response({ code: 0, data: {} }, 500))
    assert.equal(await broken.request.getData('endfield_attendance'), false)
})

test('角色从嵌套roles/defaultRole获取，按角色和服务器去重，保留大数字字符串', () => {
    const data = binding([role('90071992547409999'), role('123'), role('123', '2')], role('123'))
    const before = JSON.stringify(data), roles = getEndfieldRoles(data)
    assert.deepEqual(roles.map(r => [r.roleId, r.serverId]), [['90071992547409999', '1'], ['123', '1'], ['123', '2']])
    assert.equal(JSON.stringify(data), before)
    const fallback = binding(undefined, role('789')); delete fallback.data.list[1].bindingList[0].roles
    assert.equal(getEndfieldRoles(fallback)[0].roleId, '789')
    assert.ok(!JSON.stringify(roles).includes('outer-account-not-role'))
})

test('成功确认无终末地角色才跳过，网络失败和结构异常不视为无角色', () => {
    for (const data of [{ code: 0, data: { list: [] } }, binding([]), { code: 0, data: { list: [{ appCode: 'endfield', bindingList: [] }] } }]) {
        assert.deepEqual(getEndfieldRoles(data), [])
    }
    for (const data of [null, { code: 10002 }, { code: 0, data: {} }, { code: 0, data: { list: [null] } },
        { code: 0, data: { list: [{ appCode: 'endfield' }] } }, binding([{}]), binding([role('1', '')])]) assert.throws(() => getEndfieldRoles(data))
})

test('两游戏奖励独立解析，保留零数量；重复签到不吞掉无效角色错误', () => {
    assert.deepEqual(attendanceResult(akSuccess, 'arknights').awards, [{ name: '龙门币', count: 500 }])
    assert.deepEqual(attendanceResult(efSuccess, 'endfield').awards, [{ name: '示例奖励', count: 200 }])
    const fallback = structuredClone(efSuccess); delete fallback.data.resourceInfoMap.item.count; fallback.data.awardIds[0].count = 0
    assert.equal(attendanceResult(fallback, 'endfield').awards[0].count, 0)
    assert.equal(attendanceResult({ code: 10001, message: '角色无效' }, 'endfield').status, 'failed')
    assert.equal(attendanceResult({ code: 10001, message: '请勿重复签到！' }, 'endfield').status, 'signed')
    assert.equal(attendanceResult({ code: 0, data: { already_signed: true } }, 'endfield').status, 'signed')
    assert.equal(attendanceResult({ code: 10001 }, 'arknights').status, 'signed')
    for (const value of [null, {}, { code: null }, { code: false, data: {} }, { code: 0, data: [] }]) assert.equal(attendanceResult(value, 'endfield').status, 'failed')
})

test('方舟或单个终末地角色失败不阻断其他角色，结果不含凭据且不改变方舟UID', async () => {
    const calls = [], user = { uid: 'ak-only', cred: 'private-cred', token: 'private-token', sklReq: { getData: async (type, params) => {
        calls.push({ type, params })
        if (type === 'attendance') throw new Error('private-token')
        if (type === 'binding') return binding([role('123'), role('456')])
        if (params.headers['sk-game-role'] === '3_123_1') throw new Error('private-cred')
        return efSuccess
    } } }
    const result = await new SklandAttendance(user, { sleep: async () => {} }).run()
    assert.deepEqual(result.map(r => r.status), ['failed', 'failed', 'success'])
    assert.deepEqual(calls.map(c => c.type), ['attendance', 'binding', 'endfield_attendance', 'endfield_attendance'])
    assert.equal(user.uid, 'ak-only')
    assert.doesNotMatch(JSON.stringify(result) + formatAttendanceResults(result), /private-cred|private-token/)
    assert.match(formatAttendanceResults(result), /明日方舟.*签到失败/)
    assert.match(formatAttendanceResults(result), /终末地.*示例管理员.*签到完成/)
})

test('无角色、查询失败和关闭附加签到各有明确结果，均不发送终末地签到请求', async () => {
    for (const [bound, enabled, expected] of [[binding([]), true, 'skipped'], [null, true, 'failed'], [binding(), false, undefined]]) {
        const calls = [], service = new SklandAttendance({ sklReq: { getData: async type => {
            calls.push(type); return type === 'attendance' ? akSuccess : bound
        } } })
        const results = await service.run({ includeEndfield: enabled })
        assert.equal(results[1]?.status, expected)
        assert.deepEqual(calls, enabled ? ['attendance', 'binding'] : ['attendance'])
    }
})

function appHarness(config = {}, getData = async type => type === 'attendance' ? akSuccess : type === 'binding' ? binding() : efSuccess) {
    const calls = [], logs = [], keys = ['ARKNIGHTS:USER:user']
    const context = vm.createContext({ console, SklandAttendance, formatAttendanceResults, rulePrefix: '((#|/)(方舟|明日方舟)|~|～)',
        plugin: class { constructor(options) { Object.assign(this, options) } async reply(msg) { this.replies ||= []; this.replies.push(msg) } },
        setting: { getConfig: () => config }, common: { sleep: async () => {} },
        logger: { mark: value => logs.push(value), error: value => logs.push(value) },
        redis: { keys: async () => { calls.push('keys'); return keys } },
        SKLandUser: class {
            constructor(id) { this.id = id; this.sklReq = { getData: async (type, params) => { calls.push(type); return getData(type, params, id) } } }
            async getUser() { if (this.id === 'bad') throw new Error('private-cred'); return this.id !== 'unbound' }
        }
    })
    vm.runInContext(readFileSync(new URL('../apps/attendance.js', import.meta.url), 'utf8').replace(/^import .+$/gm, '')
        .replace('export class SKLandAttendance', 'globalThis.App = class SKLandAttendance'), context)
    const app = new context.App(); app.e = { user_id: 'user', msg: '#方舟签到', isMaster: true }
    return { app, calls, config, logs, keys }
}

test('手动签到始终发现终末地角色，多前缀匹配；未绑定账号不发送请求', async () => {
    const { app, calls } = appHarness({ auto_sign: false, auto_sign_endfield: false })
    for (const msg of ['#方舟签到', '~签到', '～签到', '/明日方舟签到']) assert.ok(new RegExp(app.rule[0].reg).test(msg))
    await app.attendance()
    assert.deepEqual(calls, ['attendance', 'binding', 'endfield_attendance'])
    assert.match(app.replies[0], /明日方舟/); assert.match(app.replies[0], /终末地/)
    calls.length = 0; app.e.user_id = 'unbound'; await app.attendance()
    assert.match(app.replies.at(-1), /未绑定/); assert.deepEqual(calls, [])
})

test('定时任务明确区别旧消息上下文；总开关关闭时零请求，终末地开关下次任务即时生效', async () => {
    const { app, calls, config } = appHarness({ auto_sign: false })
    await app.task.fnc()
    assert.deepEqual(calls, []); assert.equal(app.replies, undefined)
    config.auto_sign = true; config.auto_sign_endfield = false
    await app.task.fnc()
    assert.deepEqual(calls, ['keys', 'attendance']); assert.equal(app.replies, undefined)
    calls.length = 0; config.auto_sign_endfield = true
    await app.task.fnc()
    assert.deepEqual(calls, ['keys', 'attendance', 'binding', 'endfield_attendance'])
    assert.equal(app.replies, undefined)
})

test('批量签到按游戏统计，坏绑定不中断后续账号；主人权限和重入保护生效', async () => {
    const { app, keys, calls } = appHarness({}, async (type, _params, id) => type === 'attendance' ? { code: 10001 }
        : type === 'binding' ? binding(id === 'no-role' ? [] : [role()]) : efSuccess)
    keys.splice(0, 1, 'ARKNIGHTS:USER:bad', 'ARKNIGHTS:USER:unbound', 'ARKNIGHTS:USER:no-role', 'ARKNIGHTS:USER:user')
    app.e.isMaster = false; assert.equal(await app.attendance_task(), false); assert.deepEqual(calls, [])
    app.e.isMaster = true; await app.attendance_task()
    const report = app.replies.at(-1)
    assert.match(report, /明日方舟：成功 0，已签 2，失败 0，跳过 0/)
    assert.match(report, /终末地：成功 1，已签 0，失败 0，跳过 1/)
    assert.match(report, /账号读取失败：2 个/)
    assert.doesNotMatch(report, /private-cred/)
    assert.equal(app.taskRunning, false)
    app.taskRunning = true; calls.length = 0; await app.attendance_task()
    assert.deepEqual(calls, []); assert.match(app.replies.at(-1), /正在执行/)
})

test('Guoba提供默认开启的自动签到终末地开关，保留原有总开关和定时项', () => {
    const source = readFileSync(new URL('../guoba.support.js', import.meta.url), 'utf8').replace(/^import .+$/gm, '').replace('export function supportGuoba', 'function supportGuoba')
    let saved = { sign: { auto_sign: false, auto_sign_endfield: true, auto_sign_cron: 'custom-cron' }, common: { prefix_mode: 3 } }
    const context = vm.createContext({ Bot: { gl: new Map() }, path: { join: (...args) => args.join('/') }, pluginResources: 'resources',
        setting: { merge: () => structuredClone(saved), analysis: value => { saved = value } },
        lodash: {
            set: (obj, key, value) => { const [section, field] = key.split('.'); (obj[section] ||= {})[field] = value },
            merge: (_target, previous, changed) => ({ ...previous, sign: { ...previous.sign, ...changed.sign } })
        }
    })
    vm.runInContext(source + ';globalThis.support = supportGuoba;', context)
    const schemas = context.support().configInfo.schemas
    const option = schemas.find(x => x.field === 'sign.auto_sign_endfield')
    assert.equal(option.component, 'Switch'); assert.equal(option.label, '自动签到终末地')
    assert.ok(schemas.some(x => x.field === 'sign.auto_sign'))
    assert.ok(schemas.some(x => x.field === 'sign.auto_sign_cron'))
    assert.match(readFileSync(new URL('../defSet/sign.yaml', import.meta.url), 'utf8'), /^auto_sign_endfield: true$/m)
    const config = context.support().configInfo
    config.setConfigData({ 'sign.auto_sign_endfield': false }, { Result: { ok: () => 'ok' } })
    assert.equal(config.getConfigData().sign.auto_sign_endfield, false)
    assert.equal(saved.sign.auto_sign, false)
    assert.equal(saved.sign.auto_sign_cron, 'custom-cron')
    assert.equal(saved.common.prefix_mode, 3)
})
