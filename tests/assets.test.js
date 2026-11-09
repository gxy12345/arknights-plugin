import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeOperatorAssets, operatorSkill, getOperatorAssets, parseOperatorAssetCommand } from '../model/operatorAssets.js'
import { normalizeSkinAssets, skinDisplayCount } from '../model/skinAssets.js'

const chars = {
    charInfoMap: { char_a: { name: '阿米娅', profession: 'MEDIC', rarity: 5 }, char_b: { name: '测试干员', profession: 'WARRIOR', rarity: 4 } },
    equipmentInfoMap: { original: { typeIcon: 'original' }, mod: { typeIcon: 'cen-x', name: '测试模组' } },
    chars: [{ charId: 'char_a', skinId: 'char_a@skin#1', level: 90, evolvePhase: 2, mainSkillLvl: 7, defaultSkillId: 's3', defaultEquipId: 'mod',
        skills: [{ id: 's1' }, { id: 's2', specializeLevel: 1 }, { id: 's3', specializeLevel: 2 }, { id: 's4', specializeLevel: 3 }],
        equip: [{ id: 'original' }, { id: 'mod', level: 3 }]
    }, { charId: 'char_b', level: 50, evolvePhase: 1, mainSkillLvl: 4, skills: [{ id: 'skcom_atk_up[2]', locked: true }] }]
}

test('全部技能分别展示普通等级和专精图标，保留选中与锁定状态', () => {
    const data = normalizeOperatorAssets(chars)
    assert.equal(data[0].name, '阿米娅(医疗)')
    assert.equal(data[0].skill_list.length, 4)
    assert.deepEqual(data[0].skill_list.map(s => s.mastery_icon), ['', 'mastery-1.svg', 'mastery-2.svg', 'mastery-3.svg'])
    assert.equal(data[0].skill_list[0].level, 7)
    assert.equal(data[0].skill_list[2].selected, true)
    assert.equal(data[1].skill_list[0].locked, true)
    assert.match(data[1].skill_list[0].icon_url, /%5B2%5D/)
    for (let level = 1; level <= 7; level++) assert.equal(operatorSkill({}, level).label, `${level}级`)
    assert.equal(operatorSkill({}, 10).level, null)
    assert.equal(data[0].modules.length, 1)
    assert.equal(data[0].equip_info.has_equip, true)
    assert.match(data[0].portrait_url, /char_a%40skin%231/)
})

test('列表与卡片共用练度排序和筛选，分析调用可获取不分页数据；缺资料不崩溃', () => {
    assert.equal(getOperatorAssets(chars, null, null, 1, 1).chars[0].charId, 'char_a')
    assert.equal(getOperatorAssets(chars, null, null, 2, 1).chars[0].charId, 'char_b')
    assert.equal(getOperatorAssets(chars, 'MEDIC', 5).total, 1)
    assert.equal(getOperatorAssets(chars, null, null, 0, 0).chars.length, 2)
    assert.equal(getOperatorAssets(chars, null, null, 999, 1).chars.length, 0)
    assert.equal(getOperatorAssets(chars, null, null, -1, 1).chars.length, 0)
    assert.equal(normalizeOperatorAssets({ chars: [null, { charId: 'missing', equip: [null, { id: 'unknown', locked: true }] }] })[0].name, 'missing')
    assert.equal(normalizeOperatorAssets({}).length, 0)
    assert.equal(normalizeOperatorAssets({ ...chars, chars: [{ ...chars.chars[0], equip: [] }] })[0].equip_info.has_equip, false)
})

test('练度命令解析不依赖前缀内部的捕获组数量', () => {
    for (const prefix of ['(~|～)', '((#|/)(方舟|明日方舟|arknights|方舟插件)|~|～)']) {
        for (const word of ['统计', '卡片', '面板']) {
            const match = parseOperatorAssetCommand(`~六星近卫练度${word}2`, prefix, ['六星'], ['近卫'])
            assert.equal(match.rarity, '六星'); assert.equal(match.profession, '近卫'); assert.equal(match.page, 2)
        }
    }
})

const skins = {
    charInfoMap: { char_a: { name: '测试干员' } },
    skinInfoMap: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`skin${i}`, { name: `时装${i}`, charId: 'char_a', brandId: i % 2 ? 'epoque' : 'boc' }])),
    skins: Array.from({ length: 20 }, (_, i) => ({ id: `skin${i}`, ts: 1700000000 + i * 1000 }))
}

test('时装按实际获得时间倒序，去重后全部计数，展示上限不影响系列统计', () => {
    assert.equal(normalizeSkinAssets(skins).skins.length, 8)
    assert.equal(normalizeSkinAssets(skins, 5).skins.length, 8)
    for (const count of [4, 8, 12, 16]) {
        const result = normalizeSkinAssets({ ...skins, skins: [...skins.skins, { id: 'skin19', ts: 0 }] }, count)
        assert.equal(result.total, 20)
        assert.equal(result.skins.length, count)
        assert.equal(result.skins[0].id, 'skin19')
        assert.deepEqual(result.series.map(x => x.count), [10, 10])
        assert.equal(result.series.reduce((sum, x) => sum + x.count, 0), result.total)
        assert.ok(result.series.some(x => x.name === '时代'))
    }
})

test('缺失时装元数据和获得时间时仍保留总数，毫秒时间可识别，非法配置回落8', () => {
    for (const value of [undefined, null, 0, 5, 999, 'bad']) assert.equal(skinDisplayCount(value), 8)
    assert.equal(skinDisplayCount('8'), 8)
    const result = normalizeSkinAssets({ skins: [{ id: 'char_unknown@skin#1' }, { id: 'recent', ts: 1700000000000 }, null, {}] })
    assert.equal(result.total, 2)
    assert.equal(result.unknownTimeCount, 1)
    assert.equal(result.skins[0].id, 'recent')
    assert.equal(result.series[0].name, '未识别系列')
    assert.match(result.skins[1].portraitUrl, /%40skin%231/)
    assert.equal(normalizeSkinAssets({}).total, 0)
})
