import { rulePrefix } from '../utils/common.js'
import constant from "../components/constant.js";
import setting from '../utils/setting.js';
import runtimeRender from '../utils/runtimeRender.js'

const _path = process.cwd();
const cache_key = 'ARKNIGHTS:WEB_DATA:MATERIAL'
const ytl_api = 'https://backend.yituliu.cn/stage/result?expCoefficient=0.633&sampleSize=300'

export class Material extends plugin {
    constructor() {
        super({
            name: '[arknights-plugin]刷图材料查询',
            dsc: '刷图推荐',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^${rulePrefix}(刷图推荐|刷图掉落|刷图材料|材料掉落|材料掉率|素材掉落|素材掉率})$`,
                    fnc: 'materialRcmd'
                },
            ]
        })
        this.bindUser = {}
        this.setting = setting.getConfig('game_info')
    }

    async materialRcmd() {
        let ytl_data = await this.getYTLData()
        let rcmd_list = ytl_data.recommendedStageList
        let update_time = ytl_data.updateTime

        if (!rcmd_list) {
            await this.reply('获取掉落信息失败')
            return false
        }

        let rcmd_result_list = []

        for (let rcmd_item of rcmd_list) {
            let stage_list = rcmd_item.stageResultList
            let sorted_stage_list = stage_list.sort(this.sortStageList)
            if (sorted_stage_list.length > 3) {
                sorted_stage_list = sorted_stage_list.slice(0, 3)
            }
            rcmd_result_list.push(
                {
                    itemType: rcmd_item.itemType,
                    stageResultList: sorted_stage_list,
                }
            )
        }

        await runtimeRender(this.e, 'material/material.html', {
            rcmd_result_list: rcmd_result_list,
            updateTime: update_time
        }, {
            scale: 1.6
        })
        return true


    }

    async getYTLData() {
        let cacheData = await redis.get(cache_key)
        if (cacheData) {
            return JSON.parse(cacheData)
        }
        let param = {
            timeout: 10000,
            method: 'get',
        }
        let response = {}
        try {
            response = await fetch(ytl_api, param)
        } catch (error) {
            Bot.logger.error(error.toString())
            return null
        }
        if (!response.ok) {
            Bot.logger.error(`[arknights-plugin] 一图流接口错误,${response.status} ${response.statusText}`)
            return null
        }
        const res = await response.json()
        if (!res || res?.code != 200) {
            Bot.logger.mark('一图流接口错误')
            return null
        }

        let result = {
            recommendedStageList: res.data.recommendedStageList,
            updateTime: res.data.updateTime
        }
        await redis.set(cache_key, JSON.stringify(result), { EX: 900 });
        return result
    }

    sortStageList(a, b) {
        if (b.stageEfficiency !== a.stageEfficiency) {
            return b.stageEfficiency - a.stageEfficiency;
        }
        if (b.sampleConfidence !== a.sampleConfidence) {
            return b.sampleConfidence - a.sampleConfidence;
        }
        if (b.knockRating !== a.knockRating) {
            return b.knockRating - a.knockRating;
        }
        if (b.spm !== a.spm) {
            return b.spm - a.spm;
        }
        return b.apExpect - a.apExpect
    }
}