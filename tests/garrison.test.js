import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import GarrisonService from '../model/garrisonService.js'
import { GarrisonStatisticsStore } from '../model/garrisonStatistics.js'
import SklandApi from '../model/sklandApi.js'
import { normalizeGarrisonGuide, normalizeGarrisonRecord, formatGarrisonDate, garrisonImageUrl, plainGarrisonText } from '../model/garrisonView.js'

const resource = {
    versionInfo: { seasonId: 'season', versionId: 'v1' }, seasons: [{ seasonId: 'season', name: '测试赛季' }],
    chars: [{ charId: 'char_a', name: '测试干员', avatarUrl: 'https://example.test/avatar.png', halfBodyUrl: 'https://example.test/portrait.png', shopLevel: 5,
        skills: [{ skillId: 'skill_other', iconUrl: 'https://example.test/other.png' }, { skillId: 'skill_a', name: '测试技能', iconUrl: 'https://example.test/skill.png' }],
        modules: [{ moduleId: 'module_a', name: '测试模组', icon: { type: 'https://example.test/module.png', shiningColor: 'https://example.test/shining.png' } }],
        traits: [{ mergeLevel: 0, evolvePhase: 1, level: 55 }, { mergeLevel: 1, evolvePhase: 2, level: 60 }]
    }],
    strategies: [{ strategyId: 'band_a', name: '测试小队' }],
    items: [{ itemId: 'item_a', name: '测试装备', effectDesc: '攻击力<@ba.vup>+15%</>' }],
    bonds: [{ bondId: 'bond_a', name: '测试盟约' }]
}
const record = {
    id: 'record_a', activityId: 'season', versionId: 'v1', completeState: 1,
    bandId: 'band_a', modeType: 'SINGLE', modeDifficulty: 'ABYSS', passRound: 24,
    gameEndTs: '1704067200', bondInfo: [{ bondId: 'bond_a', activate: 1, layer: 5 }],
    chessSquad: [{ charId: 'char_a', skillId: 'skill_a', moduleId: 'module_a', mergeLevel: 1, chessInfo: { chessLevel: 4 }, equips: [{ equipId: 'item_a' }] }]
}

async function statisticsStore(t) {
    const directory = await mkdtemp(join(tmpdir(), 'garrison-statistics-'))
    t.after(() => rm(directory, { recursive: true, force: true }))
    return new GarrisonStatisticsStore(directory)
}

test('统计跨接口窗口累计，区分模式与难度，去重并保留真实零值', async t => {
    const store = await statisticsStore(t)
    const base = { activityId: 'act3autochess', versionId: 'V3_1', modeType: 'MULTI', modeDifficulty: 'HARD' }
    const recent = { ...base, id: 'new', gameEndTs: '1704067201000', trophyAfter: 0, killCnt: 0, completeState: 1 }
    const old = { ...base, id: 'old', gameEndTs: '1704067200', trophyAfter: 8, completeState: 0 }
    const solo = { ...base, id: 'solo', modeType: 'SINGLE', gameEndTs: '1704067199', trophyAfter: 100, killCnt: 12, chessSquad: record.chessSquad }
    await store.sync('1234', base.activityId, [old, recent, recent])

    const reopened = new GarrisonStatisticsStore(store.directory)
    const history = await reopened.sync('1234', base.activityId, [recent, solo, { ...base, killCnt: 999 }])
    assert.deepEqual([history.total, history.wins, history.trophies, history.kills, history.killsReported], [3, 1, 0, 12, 2])
    assert.deepEqual(history.difficulties.map(row => [row.label, row.total, row.wins]), [['规程等级 9–14', 1, 0], ['绝境模拟', 2, 1]])
    assert.deepEqual(await reopened.sync('1234', base.activityId, []), history)
    const snapshot = JSON.parse(await readFile(join(store.directory, 'uid-1234', `${base.activityId}.json`), 'utf8'))
    assert.deepEqual(snapshot.recordIds, ['old', 'new', 'solo'])
    assert.doesNotMatch(JSON.stringify(snapshot), /chessSquad|char_a/)
})

test('同账号同赛季并发同步合并更新，其他账号和赛季独立累计', async t => {
    const store = await statisticsStore(t)
    const another = new GarrisonStatisticsStore(store.directory)
    await Promise.all([
        store.sync('1234', 'season', [record, { ...record, id: 'first' }]),
        another.sync('1234', 'season', [record, { ...record, id: 'second' }]),
        store.sync('2345', 'season', [record]),
        store.sync('1234', 'next-season', [{ ...record, activityId: 'next-season' }])
    ])
    assert.equal((await store.sync('1234', 'season', [])).total, 3)
    assert.equal((await store.sync('2345', 'season', [])).total, 1)
    assert.equal((await store.sync('1234', 'next-season', [])).total, 1)
})

test('本地统计文件读取失败时保留原文件', async t => {
    const store = await statisticsStore(t)
    await store.sync('1234', 'season', [record])
    const file = join(store.directory, 'uid-1234', 'season.json')
    await writeFile(file, '{', 'utf8')
    await assert.rejects(store.sync('1234', 'season', [record]), { code: 'GARRISON_STATISTICS_STORAGE' })
    assert.equal(await readFile(file, 'utf8'), '{')
})

test('卫戍统计只读取赛季资料与战绩，博士资料缺失时可继续出图', async t => {
    const calls = []
    const user = { name: '测试博士', uid: '1234', getGamePlayerInfo: async () => { throw Error('profile offline') }, sklReq: {
        getData: async type => {
            calls.push(type)
            if (type === 'garrison_resource') return { code: 0, data: resource }
            if (type === 'garrison_history') return { code: 0, data: { records: [record] } }
            throw Error('unexpected request')
        }
    } }
    const service = new GarrisonService(user, await statisticsStore(t))
    const stats = await service.getStatistics()
    assert.equal(stats.history.total, 1)
    assert.deepEqual(calls, ['garrison_resource', 'garrison_history'])
    assert.deepEqual(await service.getDoctor(), { name: '测试博士', uid: '1234', level: '—', avatar: '', registered: '' })
    user.getGamePlayerInfo = async () => ({ code: 0, data: { status: { name: '测试博士', level: 120, avatar: { type: 'ICON', id: 'test-avatar' } } } })
    const doctor = await service.getDoctor()
    assert.equal(doctor.uid, '1234')
    assert.equal(doctor.level, '120')
    assert.match(doctor.avatar, /\/avatar\/test-avatar\.png$/)
})

test('逐局战绩映射技能、模组、装备和盟约；时间按上海时区展示', () => {
    const result = normalizeGarrisonRecord(record, resource)
    assert.equal(result.resourceUnavailable, false)
    assert.equal(result.operators[0].skillName, '测试技能')
    assert.equal(result.operators[0].moduleName, '测试模组')
    assert.equal(result.operators[0].tier, 4)
    assert.equal(result.items[0].description, '攻击力+15%')
    assert.equal(result.bonds[0].layer, 5)
    assert.equal(result.bonds[0].active, true)
    assert.equal(result.difficulty, '终极模拟')
    assert.match(result.date, /08:00/)
    assert.equal(formatGarrisonDate('not-a-date'), '时间未知')
})

test('按规程赛季的模式分别解释难度枚举', () => {
    const season = { activityId: 'act3autochess' }
    const tiers = [
        ['TRAINING', '入门协议', 'training', '入门协议'],
        ['FUNNY', '标准模拟', 'standard', '规程等级 1–4'],
        ['NORMAL', '险境模拟', 'risk', '规程等级 5–8'],
        ['HARD', '绝境模拟', 'extreme', '规程等级 9–14'],
        ['ABYSS', '终极模拟', 'ultimate', '规程等级 15–20']
    ]
    for (const [code, label, tone, soloLabel] of tiers) {
        const team = normalizeGarrisonRecord({ ...season, modeType: 'MULTI', modeDifficulty: code })
        assert.deepEqual([team.mode, team.modeTone, team.difficulty, team.difficultyTone], ['协同模拟', 'team', label, tone])
        const solo = normalizeGarrisonRecord({ ...season, modeType: 'SINGLE', modeDifficulty: code })
        assert.deepEqual([solo.mode, solo.modeTone, solo.difficulty, solo.difficultyTone], ['单人模拟', 'solo', soloLabel, tone])
    }
    assert.equal(normalizeGarrisonRecord({ modeType: 'LOCAL' }).difficulty, '入门协议')
    assert.equal(normalizeGarrisonRecord({ ...season, modeType: 'SINGLE', modeDifficulty: 'FAST' }).difficulty, '极速模拟')
    assert.equal(normalizeGarrisonRecord({ modeType: 'MULTI', modeDifficulty: 'UNRECOGNIZED' }).difficultyTone, 'neutral')
})

test('不同版本不借用当前元数据；可从对应版本资料恢复名称', () => {
    const old = { ...record, versionId: 'v0' }
    const missing = normalizeGarrisonRecord(old, resource)
    assert.equal(missing.resourceUnavailable, true)
    assert.equal(missing.operators[0].name, 'char_a')
    assert.equal(missing.operators[0].skillName, 'skill_a')
    const embedded = { season: { versionResourceMap: { v0: { ...resource, versionInfo: { seasonId: 'season', versionId: 'v0' } } } } }
    assert.equal(normalizeGarrisonRecord(old, resource, embedded).operators[0].name, '测试干员')
})

test('攻略回合与文本正确映射，不把对象或危险图片当作展示内容', () => {
    const result = normalizeGarrisonGuide({ guide: { guideId: 'guide', seasonId: 'season', versionId: 'v1', applicableScope: {}, tabs: [{ tabType: 2, startRound: 4, endRound: 8, recChars: [record.chessSquad[0]], recItems: [{ itemId: 'item_a' }], operationIdea: '<b>先升级</b>\\n再购买', activeBonds: { seasonBondIds: ['bond_a'], regularBondIds: ['bond_a'] } }] } }, resource)
    assert.equal(result.scopeLabel, '')
    assert.equal(result.tabs[0].title, '第 4–8 回合')
    assert.equal(result.tabs[0].operationIdea, '先升级\n再购买')
    assert.equal(result.tabs[0].bonds.length, 1)
    assert.equal(garrisonImageUrl('javascript:alert(1)'), '')
    assert.equal(garrisonImageUrl('file:///etc/passwd'), '')
    assert.doesNotMatch(garrisonImageUrl("https://example.test/it's(a).png"), /['()]/)
})

test('缺失对局结果不会误标失败，非零状态遵循SDK布尔规则', () => {
    assert.equal(normalizeGarrisonRecord({}).statusUnknown, true)
    assert.equal(normalizeGarrisonRecord({ completeState: 'unknown' }).resultLabel, '结果未知')
    assert.equal(normalizeGarrisonRecord({ completeState: 0 }).success, false)
    assert.equal(normalizeGarrisonRecord({ completeState: 2 }).success, true)
    assert.doesNotThrow(() => normalizeGarrisonRecord({ chessSquad: [null] }))
    assert.equal(normalizeGarrisonRecord({}).killCnt, null)
})

test('官方颜色和状态标记可移除，作者尖括号条件正文保留', () => {
    assert.equal(plainGarrisonText('<条件> 时先升级'), '<条件> 时先升级')
    assert.equal(plainGarrisonText('<在场<@autochess.dgreen>6</>名不同干员>战斗开始时'), '<在场6名不同干员>战斗开始时')
    assert.equal(plainGarrisonText('<$ba.stun>眩晕</> <b>升级</b>'), '眩晕 升级')
})

test('服务合并资料请求，逐次附加角色头并累计同赛季所有版本战绩', async t => {
    const calls = []
    let records = [{ ...record, id: 'older', versionId: 'v0', gameEndTs: '1704067100' }, record, { ...record, id: 'other', activityId: 'other-season' }]
    const user = { uid: '1234', sklReq: { getData: async (type, params) => {
        calls.push({ type, params })
        if (type === 'garrison_resource') return { code: 0, data: resource }
        if (type === 'garrison_history') return { code: 0, data: { records } }
        throw Error('unexpected request')
    } } }
    const service = new GarrisonService(user, await statisticsStore(t))
    await Promise.all([service.getResources(), service.getResources()])
    assert.equal(calls.length, 1)
    const result = await service.getHistory()
    assert.deepEqual(result.records.map(item => item.id), ['record_a', 'older'])
    assert.equal(result.records[1].resourceUnavailable, true)
    records = []
    assert.equal((await service.getStatistics()).history.total, 2)
    assert.ok(calls.every(call => call.params.headers['sk-game-role'] === '1_1234_0'))
})

test('攻略游标、关键词正确编码；服务错误不会泄漏后端响应', async () => {
    const api = new SklandApi('1234')
    const query = api.getUrlMap({ pageToken: 'cursor+/=&', titleKeyword: '炎 & 装备' }).garrison_index.query
    assert.equal(new URLSearchParams(query).get('source'), 'COMMUNITY')
    assert.equal(new URLSearchParams(query).get('pageToken'), 'cursor+/=&')
    assert.equal(new URLSearchParams(query).get('titleKeyword'), '炎 & 装备')
    const service = new GarrisonService({ uid: '1234', sklReq: { getData: async () => { throw Error('backend private response') } } })
    await assert.rejects(service.getResources(), error => !error.message.includes('private') && error.message.includes('资料失败'))
})


test('干员卡片按选中技能、模组和合并等级映射官方图标与实际等级', () => {
    const operator = normalizeGarrisonRecord(record, resource).operators[0]
    assert.equal(operator.portraitUrl, 'https://example.test/portrait.png')
    assert.equal(operator.portraitIsAvatar, false)
    assert.equal(operator.skillIconUrl, 'https://example.test/skill.png')
    assert.equal(operator.moduleIconUrl, 'https://example.test/module.png')
    assert.equal(operator.moduleShiningUrl, 'https://example.test/shining.png')
    assert.equal(operator.tierIcon, 'tier-4.svg')
    assert.equal(operator.evolvePhase, 2)
    assert.equal(operator.level, 60)
    assert.equal(operator.eliteIcon, 'elite-merged.png')
    const guide = normalizeGarrisonGuide({ guide: { seasonId: 'season', versionId: 'v1', tabs: [{ recChars: [{ ...record.chessSquad[0], mergeLevel: 0, chessInfo: undefined }] }] } }, resource)
    const recommended = guide.tabs[0].operators[0]
    assert.equal(recommended.tierIcon, 'tier-5.svg')
    assert.equal(recommended.level, 55)
    assert.equal(recommended.evolvePhase, 1)
    assert.equal(recommended.eliteIcon, 'elite-1.png')
})

test('半身像、图标和对应合并特质缺失时保留文本，不猜测实际等级', () => {
    const changed = { ...record, chessSquad: [{ ...record.chessSquad[0], mergeLevel: 8, skillId: 'unknown', moduleId: 'unknown' }] }
    const metadata = { ...resource, chars: [{ ...resource.chars[0], halfBodyUrl: 'file:///bad.png' }] }
    const operator = normalizeGarrisonRecord(changed, metadata).operators[0]
    assert.equal(operator.portraitUrl, 'https://example.test/avatar.png')
    assert.equal(operator.portraitIsAvatar, true)
    assert.equal(operator.skillIconUrl, '')
    assert.equal(operator.moduleIconUrl, '')
    assert.equal(operator.moduleName, 'unknown')
    assert.equal(operator.level, null)
    assert.equal(operator.eliteIcon, '')
    const unavailable = normalizeGarrisonRecord({ ...record, versionId: 'old' }, resource).operators[0]
    assert.equal(unavailable.portraitUrl, '')
    assert.equal(unavailable.level, null)
    assert.equal(unavailable.skillIconUrl, '')
})

test('自定义干员无特质时遵循官方 1/60 级补充规则；图标地址仍过滤协议', () => {
    const metadata = { ...resource, chars: [{ ...resource.chars[0], isDiyChar: true, traits: [],
        skills: [{ skillId: 'skill_a', iconUrl: 'javascript:bad' }],
        modules: [{ moduleId: 'module_a', icon: { type: 'file:///bad', shiningColor: 'data:image/png;base64,bad' } }]
    }] }
    const merged = normalizeGarrisonRecord(record, metadata).operators[0]
    assert.equal(merged.level, 60)
    assert.equal(merged.skillIconUrl, '')
    assert.equal(merged.moduleIconUrl, '')
    assert.equal(merged.moduleShiningUrl, '')
    const unmerged = normalizeGarrisonRecord({ ...record, chessSquad: [{ ...record.chessSquad[0], mergeLevel: 0 }] }, metadata).operators[0]
    assert.equal(unmerged.level, 1)
    assert.equal(unmerged.eliteIcon, 'elite-2.png')
})
