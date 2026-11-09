import test from 'node:test'
import assert from 'node:assert/strict'
import GarrisonService from '../model/garrisonService.js'
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

test('逐局战绩映射技能、模组、装备和盟约；时间按上海时区展示', () => {
    const result = normalizeGarrisonRecord(record, resource)
    assert.equal(result.resourceUnavailable, false)
    assert.equal(result.operators[0].skillName, '测试技能')
    assert.equal(result.operators[0].moduleName, '测试模组')
    assert.equal(result.operators[0].tier, 4)
    assert.equal(result.items[0].description, '攻击力+15%')
    assert.equal(result.bonds[0].layer, 5)
    assert.equal(result.bonds[0].active, true)
    assert.equal(result.difficulty, '险境')
    assert.match(result.date, /08:00/)
    assert.equal(formatGarrisonDate('not-a-date'), '时间未知')
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

test('服务合并资料请求，逐次附加角色头并保留同赛季所有版本战绩', async () => {
    const calls = []
    const user = { uid: '1234', sklReq: { getData: async (type, params) => {
        calls.push({ type, params })
        if (type === 'garrison_resource') return { code: 0, data: resource }
        if (type === 'garrison_history') return { code: 0, data: { records: [{ ...record, id: 'older', versionId: 'v0', gameEndTs: '1704067100' }, record, { ...record, id: 'other', activityId: 'other-season' }] } }
        throw Error('unexpected request')
    } } }
    const service = new GarrisonService(user)
    await Promise.all([service.getResources(), service.getResources()])
    assert.equal(calls.length, 1)
    const result = await service.getHistory()
    assert.deepEqual(result.records.map(item => item.id), ['record_a', 'older'])
    assert.equal(result.records[1].resourceUnavailable, true)
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
