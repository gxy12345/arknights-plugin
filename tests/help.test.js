import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import * as defaults from '../config/system/help_system.js'

test('帮助包含新增资产、活动、卫戍命令，使用当前前缀并按主人权限显示管理命令', async () => {
    const renders = []
    const snapshot = JSON.stringify(defaults.helpList)
    const context = vm.createContext({
        rulePrefix: '(~|～)', plugin: class {},
        lodash: { isArray: Array.isArray, defaults: (...values) => Object.assign({}, ...values.reverse()), forEach: (list, fn) => list.forEach(fn) },
        Data: { importCfg: async () => ({ diyCfg: {}, sysCfg: defaults }) },
        HelpTheme: { getThemeData: async () => ({}) },
        runtimeRender: async (_event, _path, data) => renders.push(data)
    })
    vm.runInContext(readFileSync(new URL('../apps/help.js', import.meta.url), 'utf8').replace(/^import .+$/gm, '').replace('export class help', 'globalThis.Help = class help'), context)
    const app = new context.Help()
    for (const [prefix, master] of [['~', false], ['#方舟', true], ['～', false]]) {
        await app.help({ msg: prefix + '帮助', isMaster: master })
        const groups = renders.at(-1).helpGroup
        const titles = groups.flatMap(group => group.list.map(item => item.title)).join('\n')
        for (const command of ['时装统计', '练度卡片', '活动列表', '活动日历', '卫戍攻略', '卫戍攻略下一页', '卫戍攻略详情1', '卫戍战绩', '卫戍战绩详情1', '卫戍赛季']) assert.ok(titles.includes(prefix + command), command)
        assert.equal(titles.includes(prefix + '开启活动推送'), master)
        assert.equal(titles.includes(prefix + '更新活动数据'), master)
        if (prefix !== '#方舟') assert.equal(titles.includes('#方舟'), false)
    }
    assert.equal(JSON.stringify(defaults.helpList), snapshot, '渲染不得修改共享帮助配置')
})
