import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { SklandTools } from '../model/sklandTools.js'
import { calculateRecruit, parseRecruitTags } from '../model/sklandRecruit.js'
import { plainGameText, findOperators, buildOperatorView } from '../model/operatorEncyclopedia.js'

const pool = {
    tags: [{ tagId: 11, tagName: '高级资深干员' }, { tagId: 14, tagName: '资深干员' }, { tagId: 1, tagName: '近卫' }, { tagId: 19, tagName: '输出' }, { tagId: 28, tagName: '支援机械' }, { tagId: 29, tagName: '元素' }],
    characters: [
        { charId: 'six', name: '六星', rarity: 5, profession: 'WARRIOR', tagIds: [11, 1, 19] },
        { charId: 'five', name: '五星', rarity: 4, profession: 'WARRIOR', tagIds: [14, 1, 19] },
        { charId: 'four', name: '四星', rarity: 3, profession: 'WARRIOR', tagIds: [1, 19] },
        { charId: 'three', name: '三星', rarity: 2, profession: 'WARRIOR', tagIds: [1, 19] },
        { charId: 'robot', name: '新机械', rarity: 0, profession: 'SUPPORT', tagIds: [28, 29] }
    ]
}
const response = data => ({ ok: true, json: async () => ({ code: 0, data }) })

test('公共工具缓存合并并发，重启可读磁盘；过期更新失败保留旧数据并限制重试频率', async t => {
    const cacheDir = await mkdtemp(path.join(tmpdir(), 'ark-tools-'))
    t.after(() => rm(cacheDir, { recursive: true, force: true }))
    let calls = 0, time = 100, fail = false
    const fetcher = async (url, options) => {
        calls++
        assert.equal(url, 'https://zonai.skland.com/h5/v1/game/recruit/character')
        assert.deepEqual(options.headers, { Accept: 'application/json' })
        if (fail) throw new Error('unavailable')
        return response(pool)
    }
    const service = new SklandTools({ cacheDir, fetcher, now: () => time, ttl: 100, retryMs: 10 })
    const values = await Promise.all([service.get('recruit'), service.get('recruit')])
    assert.equal(calls, 1)
    assert.equal(values[0].stale, false)
    const disk = JSON.parse(await readFile(path.join(cacheDir, 'recruit.json'), 'utf8'))
    assert.deepEqual(disk.data, pool)
    const restarted = new SklandTools({ cacheDir, fetcher, now: () => time, ttl: 100, retryMs: 10 })
    await restarted.get('recruit')
    assert.equal(calls, 1)
    time = 201; fail = true
    assert.equal((await restarted.get('recruit')).stale, true)
    assert.equal(calls, 2)
    assert.equal((await restarted.get('recruit')).fetchedAt, 100)
    assert.equal(calls, 2)
    time = 212; fail = false
    assert.equal((await restarted.get('recruit')).stale, false)
    assert.equal(calls, 3)
})

test('损坏缓存、接口错误及空池不覆盖成功缓存；无缓存失败时不生成假结果', async t => {
    const cacheDir = await mkdtemp(path.join(tmpdir(), 'ark-tools-bad-'))
    t.after(() => rm(cacheDir, { recursive: true, force: true }))
    await writeFile(path.join(cacheDir, 'operators.json'), 'not JSON')
    let data = { characters: [] }
    const service = new SklandTools({ cacheDir, fetcher: async () => response(data), retryMs: 0 })
    await assert.rejects(service.get('operators'), /获取失败/)
    data = { characters: [{ id: 'char_test', name: '云端新干员' }] }
    assert.equal((await service.get('operators')).data.characters[0].name, '云端新干员')
    await assert.rejects(service.get('operator', '../../secret'), /无效/)
    await assert.rejects(service.get('operator', 'char_test'), /获取失败/)
    const readOnly = new SklandTools({ cacheDir: path.join(cacheDir, 'operators.json', 'unwritable'), fetcher: async () => response(data) })
    assert.equal((await readOnly.get('operators')).stale, false)
})

test('公招以官方标签为准，资深只匹配五星；无高资不能出六星，机械和新标签自动出现', () => {
    const before = JSON.stringify(pool)
    const senior = calculateRecruit(pool, [14, 1, 19])
    assert.ok(senior.filter(c => c.tags.includes('资深干员')).every(c => c.characters.every(op => op.rarity === 5)))
    assert.ok(senior.every(c => c.characters.every(op => op.rarity !== 6)))
    const top = calculateRecruit(pool, [11, 1, 19])
    assert.ok(top.some(c => c.tags.includes('高级资深干员') && c.minRarity === 6))
    assert.ok(top.every(c => c.tags.length <= 3))
    assert.deepEqual(calculateRecruit(pool, [28, 29]).find(c => c.tags.length === 2).characters.map(c => c.name), ['新机械'])
    assert.equal(JSON.stringify(pool), before, '不能把API零基星级原地加一')
    assert.deepEqual(parseRecruitTags('高资+近卫干员，输出 输出', pool), { ids: [11, 1, 19], unknown: [] })
    assert.deepEqual(parseRecruitTags('资深 坏标签', pool).unknown, ['坏标签'])
})

test('业务失败、HTTP失败与结构不完整的更新均不得覆盖磁盘上的公招池', async t => {
    const cacheDir = await mkdtemp(path.join(tmpdir(), 'ark-tools-refresh-'))
    t.after(() => rm(cacheDir, { recursive: true, force: true }))
    let time = 100, current = response(pool)
    const service = new SklandTools({ cacheDir, fetcher: async () => current, now: () => time, ttl: 1, retryMs: 0 })
    await service.get('recruit')
    const filename = path.join(cacheDir, 'recruit.json'), original = await readFile(filename, 'utf8')
    for (const invalid of [{ ok: false, status: 503 }, { ok: true, json: async () => ({ code: 10002, message: 'login required' }) }, response({ tags: [], characters: [] }), response({ ...pool, characters: [{ charId: 'bad', name: 'broken', rarity: 4, tagIds: [999] }] })]) {
        current = invalid; time++
        const result = await service.get('recruit')
        assert.equal(result.stale, true)
        assert.equal(result.data.characters.length, pool.characters.length)
        assert.equal(await readFile(filename, 'utf8'), original)
    }
})

test('五标签最多产生25个唯一组合，结果必须同时满足所选标签且保留真实最低星级', () => {
    const ids = [11, 14, 1, 19, 28]
    const combos = calculateRecruit(pool, ids)
    assert.ok(combos.length <= 25)
    assert.equal(new Set(combos.map(c => c.tags.join('+'))).size, combos.length)
    for (const c of combos) {
        const selected = c.tags.map(name => pool.tags.find(t => t.tagName === name).tagId)
        assert.equal(c.minRarity, Math.min(...c.characters.map(op => op.rarity)))
        assert.ok(c.characters.every(op => selected.every(id => op.tagIds.includes(id))))
    }
})

test('富文本替换数值、百分比、负号及换行，不输出可执行HTML；未知占位明确保留', () => {
    assert.equal(plainGameText('攻击<@ba.vup>+{atk:0%}</>，{-cost}\\n<$ba.stun>晕眩</> {missing}', [{ key: 'ATK', value: .3 }, { key: 'cost', value: 2 }]), '攻击+30%，-2\n晕眩 {missing}')
    assert.equal(plainGameText('<img src=x onerror=alert(1)>文本'), '文本')
    assert.equal(plainGameText('{scale:0.0%}', [{ key: 'scale', value: .125 }]), '13%')
})

test('图鉴消除阿米娅职业歧义，真实新干员无需更新本地名单', () => {
    const chars = [{ id: 'char_002_amiya', name: '阿米娅' }, { id: 'char_1001_amiya2', name: '阿米娅', profession: 'WARRIOR' }, { id: 'char_future', name: '云端未来干员', appellation: 'Future' }]
    assert.equal(findOperators(chars, '阿米娅（近卫）')[0].id, 'char_1001_amiya2')
    assert.equal(findOperators(chars, '阿米娅')[0].id, 'char_002_amiya')
    assert.equal(findOperators(chars, '阿米娅').length, 1)
    assert.equal(findOperators(chars, 'future')[0].id, 'char_future')
    assert.equal(findOperators(chars, '未来')[0].id, 'char_future')
})

test('图鉴满级属性只加信赖，潜能、天赋条件、技能和所有模组级别分别展示', () => {
    const raw = { id: 'char_new', name: '新干员', rarity: 5, profession: 'WARRIOR', phase: [{ level: 2, maxLevel: 90, maxLevelAttribute: { maxHp: 1000, atk: 500 } }], maxFavourAttribute: { maxHp: 100, atk: 40 },
        talents: [{ candidates: [{ name: '天赋', description: '攻击+{atk:0%}', blackboard: [{ key: 'atk', value: .1 }], unlockCondition: { phase: 2, level: 1 }, requiredPotentialRank: 4 }] }],
        potentialRanks: [{ description: '攻击力+20', talent: [] }],
        skills: [{ id: 'skill#[]', name: '技能', skillType: 2, spType: 2, levels: Array.from({ length: 10 }, (_, i) => ({ description: '攻击+{atk:0%}', blackboard: [{ key: 'atk', value: i / 10 }], duration: -1, spData: { initSp: 0, spCost: 5 } })) }],
        equipments: [{ id: 'equip', name: '模组', phases: [{ level: 1, attribute: { atk: 10 }, trait: { additionalDesc: '额外{sp}点', blackboard: [{ key: 'sp', value: 1 }] } }, { level: 2, attribute: { atk: 15 }, talent: { name: '天赋', upgradeDesc: '升级' } }, { level: 3, attribute: { atk: 20 } }] }] }
    const before = JSON.stringify(raw), view = buildOperatorView(raw)
    assert.equal(view.stars, 6)
    assert.deepEqual(view.stats.map(s => s.value), ['1100', '540'])
    assert.match(view.talents[0].candidates[0].condition, /精2.*潜5/)
    assert.deepEqual(view.skills[0].levels.map(l => l.label), ['7级', '专1', '专2', '专3'])
    assert.equal(view.skills[0].summary.duration, '无限')
    assert.equal(view.modules[0].phases[0].trait, '额外1点')
    assert.equal(view.modules[0].phases[2].attributes, '攻击 +20')
    assert.deepEqual(buildOperatorView(raw, { skillLevel: [1, 2, 3] }).skills[0].levels.map(l => l.label), ['1级', '2级', '3级'])
    assert.equal(JSON.stringify(raw), before)
})
