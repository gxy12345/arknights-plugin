import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeActivityProgress, findActivities } from '../model/activityView.js'
import SklandApi from '../model/sklandApi.js'

const metadata = (id, extra = {}) => ({ id, name: id, type: 'SIDESTORY', picUrl: 'https://bbs.hycdn.cn/test.png', ...extra })

test('活动筛选、倒序和跨区域进度遵循官方网页契约', () => {
    const data = {
        activity: [
            { actId: 'older', zones: [{ clearedStage: 12, totalStage: 12 }, { clearedStage: 3, totalStage: 8 }] },
            { actId: 'replica', zones: [] },
            { actId: 'other-mode', zones: [] },
            { actId: 'missing', zones: [] },
            { actId: 'newer', zones: [{ clearedStage: 5, totalStage: 5 }] }
        ],
        activityInfoMap: {
            older: metadata('older'), replica: metadata('replica', { isReplicate: true }),
            'other-mode': metadata('other-mode', { type: 'AUTOCHESS' }),
            newer: metadata('newer', { type: 'BRANCHLINE' })
        }
    }
    const result = normalizeActivityProgress(data)
    assert.deepEqual(result.map(item => item.id), ['newer', 'older'])
    assert.equal(result[0].completed, true)
    assert.equal(result[1].current, 15)
    assert.equal(result[1].total, 20)
    assert.equal(result[1].progress, 75)
    assert.equal(result[1].completed, false)
    assert.equal(data.activity[0].actId, 'older', '不得改变缓存中的原数组')
})

test('缺失计数、负数和超出总数均不能显示为已完成', () => {
    for (const zones of [undefined, [null], [{ clearedStage: -1, totalStage: 4 }], [{ clearedStage: 5, totalStage: 4 }]]) {
        const [item] = normalizeActivityProgress({ activity: [{ actId: 'a', zones }], activityInfoMap: { a: metadata('a') } })
        assert.equal(item.known, false)
        assert.equal(item.completed, false)
        assert.equal(item.current, null)
        assert.equal(item.status, '数据不完整')
    }
    const [empty] = normalizeActivityProgress({ activity: [{ actId: 'a', zones: [] }], activityInfoMap: { a: metadata('a') } })
    assert.equal(empty.completed, false)
    assert.equal(empty.status, '暂无关卡数据')
    assert.deepEqual(normalizeActivityProgress(null), [])
})

test('名称和ID精确匹配优先；模糊匹配保留歧义结果', () => {
    const list = [{ id: 'act1', name: '长夜临光' }, { id: 'act2', name: '长夜临光·复刻' }]
    assert.deepEqual(findActivities(list, ' 长夜 临光 '), [list[0]])
    assert.deepEqual(findActivities(list, 'ACT2'), [list[1]])
    assert.equal(findActivities(list, '长夜').length, 2)
    assert.deepEqual(findActivities(list, '不存在'), [])
})

test('清理后仅保留原有请求路由并安全编码查询参数', () => {
    const routes = new SklandApi('uid&other=1').getUrlMap({ characterId: 'char&foo=bar' })
    assert.equal(new URLSearchParams(routes.game_player_info.query).get('uid'), 'uid&other=1')
    assert.equal(new URLSearchParams(routes.cal_character.query).get('characterId'), 'char&foo=bar')
    for (const key of ['rogue_detail', 'user_teenager', 'game_player_statistic', 'game_friend_list']) assert.equal(routes[key], undefined)
})
