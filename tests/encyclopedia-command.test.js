import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { findOperators, buildOperatorView } from '../model/operatorEncyclopedia.js'
import { calculateRecruit, parseRecruitTags } from '../model/sklandRecruit.js'

const prefix = '((#|/)(方舟|明日方舟|arknights|方舟插件)|~|～)'
const load = (file, name, injections) => {
    const context = vm.createContext({
        console, Date, rulePrefix: prefix, findOperators, buildOperatorView, calculateRecruit, parseRecruitTags,
        ...injections,
        plugin: class {
            constructor(config) { Object.assign(this, config) }
            async reply(value) { this.replies ||= []; this.replies.push(value) }
        }
    })
    vm.runInContext(readFileSync(new URL(file, import.meta.url), 'utf8').replace(/^import .+$/gm, '').replace(`export class ${name}`, `globalThis.${name} = class ${name}`), context)
    return new context[name]()
}
const detail = {
    id: 'char_new', name: '云端新干员', rarity: 5, profession: 'CASTER', phase: [{ level: 2, maxLevel: 90, maxLevelAttribute: { atk: 700 } }],
    skills: [{ id: 'skill', levels: Array.from({ length: 10 }, (_, i) => ({ description: `技能等级${i + 1}` })) }], equipments: []
}

test('三个图鉴命令使用公开数据且无需绑定，支持全部前缀、别名和技能等级分页', async () => {
    const renders = [], calls = []
    const app = load('../apps/encyclopedia.js', 'Encyclopedia', {
        get_name_from_nickname: name => name === '别名' ? '云端新干员' : name,
        sklandTools: { get: async (type, id) => { calls.push([type, id]); return { data: type === 'operators' ? { characters: [{ id: 'char_new', name: '云端新干员' }] } : detail, fetchedAt: 100, stale: false } } },
        runtimeRender: async (_event, path, data) => renders.push({ path, data })
    })
    for (const [message, view] of [['#方舟云端新干员图鉴', 'overview'], ['#方舟插件云端新干员图鉴', 'overview'], ['/方舟插件别名图鉴', 'overview'], ['~别名技能', 'skills'], ['～char_new模组', 'modules'], ['/明日方舟云端新干员技能 专3', 'skills']]) {
        app.e = { msg: message, user_id: 'unbound' }
        assert.ok(new RegExp(app.rule[0].reg).test(message))
        const before = renders.length
        await app.encyclopedia()
        assert.equal(renders.length, before + 1, message)
        assert.equal(renders.at(-1).path, 'encyclopedia/operator.html')
        assert.equal(renders.at(-1).data.operator.view, view)
        assert.equal(renders.at(-1).data.operator.name, '云端新干员')
    }
    assert.deepEqual(renders.at(-1).data.operator.skills[0].levels.map(l => l.label), ['专3'])
    app.e.msg = '~云端新干员技能 全等级'
    const count = renders.length
    await app.encyclopedia()
    assert.equal(renders.length - count, 3)
    assert.deepEqual(renders.slice(count).flatMap(r => r.data.operator.skills[0].levels.map(l => l.label)), ['1级', '2级', '3级', '4级', '5级', '6级', '7级', '专1', '专2', '专3'])
    assert.ok(calls.every(([type, id]) => type !== 'operator' || id === 'char_new'))
    for (const old of ['#方舟干员图鉴 云端新干员', '~干员技能 别名', '～干员模组 char_new']) assert.equal(new RegExp(app.rule[0].reg).test(old), false)
})

test('图鉴无名称、歧义、未知名称和接口失败时不渲染错误数据', async () => {
    let state = 'ambiguous', renders = 0
    const app = load('../apps/encyclopedia.js', 'Encyclopedia', {
        get_name_from_nickname: x => x,
        sklandTools: { get: async () => {
            if (state === 'error') throw new Error('private transport detail')
            return { data: { characters: [{ id: 'char_a', name: '示例甲' }, { id: 'char_b', name: '示例乙' }] } }
        } }, runtimeRender: async () => renders++
    })
    for (const [message, expected] of [['~图鉴', /请输入.*~维什戴尔图鉴/], ['~示例图鉴', /多个干员/], ['~不存在图鉴', /未找到/]]) {
        app.e = { msg: message }; await app.encyclopedia(); assert.match(app.replies.at(-1), expected)
    }
    state = 'error'; app.e.msg = '~示例图鉴'; await app.encyclopedia()
    assert.match(app.replies.at(-1), /查询失败/)
    assert.doesNotMatch(app.replies.at(-1), /private/)
    assert.equal(renders, 0)
})

test('多模组自动每图两套，所有模块均保留且不修改原始数据', async () => {
    const renders = [], raw = { ...detail, equipments: Array.from({ length: 5 }, (_, i) => ({ id: `module_${i}`, name: `模组${i}`, phases: [] })) }
    const before = JSON.stringify(raw)
    const app = load('../apps/encyclopedia.js', 'Encyclopedia', {
        get_name_from_nickname: x => x,
        sklandTools: { get: async type => ({ data: type === 'operators' ? { characters: [{ id: raw.id, name: raw.name }] } : raw }) },
        runtimeRender: async (_event, _path, data) => renders.push(data)
    })
    app.e = { msg: '~云端新干员模组' }
    await app.encyclopedia()
    assert.deepEqual(renders.map(r => r.operator.modules.length), [2, 2, 1])
    assert.deepEqual(renders.flatMap(r => r.operator.modules.map(m => m.name)), ['模组0', '模组1', '模组2', '模组3', '模组4'])
    assert.equal(JSON.stringify(raw), before)
})

const pool = {
    tags: [{ tagId: 14, tagName: '资深干员' }, { tagId: 1, tagName: '近卫' }],
    characters: [{ charId: 'char_five', name: '五星干员', rarity: 4, profession: 'WARRIOR', tagIds: [14, 1] }]
}
test('公招使用当前官方池，未绑定或持有资料异常仍可查询；渲染失败回退文本且不吞掉非法标签', async () => {
    const renders = []
    let userState = 'unbound', failRender = false
    class User {
        async getUser() { return userState !== 'unbound' }
        async getGamePlayerInfo() {
            if (userState === 'error') throw new Error('private error')
            return { code: 0, data: { chars: [{ charId: 'char_five', potentialRank: 5 }] } }
        }
    }
    const app = load('../apps/recruit.js', 'CharProfile', {
        SKLandUser: User, sklandTools: { get: async () => ({ data: pool, stale: true, fetchedAt: 100 }) },
        runtimeRender: async (_event, _path, data) => { if (failRender) throw new Error('render failed'); renders.push(data) }
    })
    app.e = { msg: '#方舟公招索引 资深+近卫干员', user_id: 'unbound' }
    assert.ok(new RegExp(app.rule[0].reg).test(app.e.msg))
    await app.recruit_calc()
    assert.equal(renders.at(-1).combinations[0].operators[0].level, 5)
    assert.equal(renders.at(-1).combinations[0].operators[0].specialTags.length, 0)
    assert.equal(renders.at(-1).source.stale, true)
    userState = 'bound'; await app.recruit_calc()
    assert.equal(renders.at(-1).combinations[0].operators[0].specialTags[0], '满')
    userState = 'error'; await app.recruit_calc()
    assert.equal(renders.at(-1).combinations[0].operators[0].specialTags.length, 0)
    failRender = true; await app.recruit_calc()
    assert.match(app.replies.at(-1), /五星干员\(5星\)/)
    app.e.msg = '~公招 资深 无效标签'; await app.recruit_calc()
    assert.match(app.replies.at(-1), /无法识别.*无效标签/)
})
