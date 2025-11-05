import fs from 'fs'
import path from 'path'
import { rulePrefix, get_name_from_nickname } from '../utils/common.js'
import runtimeRender from '../utils/runtimeRender.js'

const _path = process.cwd()

export class TrainingStat extends plugin {
    constructor() {
        super({
            name: '[arknights-plugin]养成统计',
            dsc: '干员养成统计查询',
            event: 'message',
            priority: 2000,
            rule: [
                {
                    reg: `^${rulePrefix}(.+)(养成)(统计|推荐)$`,
                    fnc: 'trainingStat'
                }
            ]
        })
    }

    async trainingStat() {
        try {
            // 提取干员名称
            let msg = this.e.msg.replace(/#|\/|方舟|明日方舟|arknights|方舟插件|插件|~|～/g, "")
            let char_name = msg.replace(/养成(统计|推荐)$/, '').trim()
            
            if (!char_name) {
                return false
            }

            // 通过别名获取干员真实名称
            char_name = get_name_from_nickname(char_name)

            // 从character_info.json获取干员ID
            const characterInfoPath = path.join(_path, 'plugins/arknights-plugin/resources/gameData/character/character_info.json')
            const characterInfoStr = fs.readFileSync(characterInfoPath, 'utf8')
            const characterInfo = JSON.parse(characterInfoStr)

            // 查找干员ID
            let charId = null
            for (const [key, value] of Object.entries(characterInfo.character_info)) {
                if (value.name === char_name) {
                    charId = key
                    break
                }
            }

            if (!charId) {
                await this.reply(`未找到干员 ${char_name}，请检查干员名称或别名`)
                return true
            }

            // 获取养成统计数据
            await this.reply('正在获取养成统计数据...')

            const cacheKey = 'ARKNIGHTS:TRAINING:STAT:DATA'
            let responseData = null

            // 尝试从Redis缓存获取
            try {
                const cachedData = await redis.get(cacheKey)
                if (cachedData) {
                    responseData = JSON.parse(cachedData)
                    logger.info('[养成统计] 使用缓存数据')
                }
            } catch (error) {
                logger.warn('[养成统计] 缓存读取失败，将从API获取:', error)
            }

            // 如果缓存中没有，则从API获取
            if (!responseData) {
                const response = await fetch('https://backend.yituliu.cn/survey/operator/result/v2')
                if (!response.ok) {
                    await this.reply('获取数据失败，请稍后再试')
                    return true
                }

                responseData = await response.json()
                
                // 保存到Redis缓存，设置过期时间为10分钟（600秒）
                try {
                    await redis.setex(cacheKey, 600, JSON.stringify(responseData))
                    logger.info('[养成统计] 数据已缓存')
                } catch (error) {
                    logger.warn('[养成统计] 缓存保存失败:', error)
                }
            }
            
            if (responseData.code !== 200 || !responseData.data) {
                await this.reply('获取数据失败，服务器返回异常')
                return true
            }

            // 查找对应干员的数据
            const operatorData = responseData.data.result.find(item => item.charId === charId)
            if (!operatorData) {
                await this.reply(`暂无 ${char_name} 的养成统计数据`)
                return true
            }

            // 处理数据
            const charInfo = characterInfo.character_info[charId]
            const statsData = this.processStatData(operatorData, charInfo, responseData.data.recordType)

            // 渲染图片
            const img = await runtimeRender(this.e, 'trainingStat/trainingStat', {
                data: statsData,
                updateTime: new Date(responseData.data.createTime).toLocaleString('zh-CN')
            }, { e: this.e })

            if (img) {
                await this.reply(img)
            } else {
                await this.reply('渲染失败，请稍后再试')
            }

            return true
        } catch (error) {
            logger.error('[养成统计] 错误:', error)
            await this.reply('处理请求时出错，请稍后再试')
            return true
        }
    }

    processStatData(operatorData, charInfo, recordType) {
        // 计算拥有率
        const ownRate = ((operatorData.own / operatorData.sampleSize) * 100).toFixed(2)

        // 处理精英统计
        const eliteData = this.processEliteData(operatorData.elite, operatorData.own)

        // 处理技能统计
        const skillData = {
            skill1: this.processSkillData(operatorData.skill1, operatorData.own),
            skill2: this.processSkillData(operatorData.skill2, operatorData.own),
            skill3: this.processSkillData(operatorData.skill3, operatorData.own)
        }

        // 处理模组统计
        const modData = {
            modA: this.processModData(operatorData.modA, operatorData.own),
            modX: this.processModData(operatorData.modX, operatorData.own),
            modY: this.processModData(operatorData.modY, operatorData.own),
            modD: this.processModData(operatorData.modD, operatorData.own)
        }

        return {
            charId: operatorData.charId,
            charName: charInfo.name,
            rarity: charInfo.rarity,
            profession: charInfo.prof,
            sampleSize: operatorData.sampleSize,
            own: operatorData.own,
            ownRate: ownRate,
            elite: eliteData,
            skill: skillData,
            mod: modData
        }
    }

    processEliteData(eliteObj, total) {
        const result = {}
        for (let i = 0; i <= 2; i++) {
            const count = eliteObj[i] || 0
            if (count === 0) {
                result[i] = 'N/A'
            } else {
                result[i] = ((count / total) * 100).toFixed(2) + '%'
            }
        }
        return result
    }

    processSkillData(skillObj, total) {
        // 检查是否只有0级
        const keys = Object.keys(skillObj)
        if (keys.length === 1 && keys[0] === '0') {
            return 'N/A'
        }

        const result = {}
        for (let i = 0; i <= 3; i++) {
            const count = skillObj[i] || 0
            result[i] = ((count / total) * 100).toFixed(2) + '%'
        }
        return result
    }

    processModData(modObj, total) {
        // 检查是否只有0级
        const keys = Object.keys(modObj)
        if (keys.length === 1 && keys[0] === '0') {
            return 'N/A'
        }

        const result = {}
        for (let i = 0; i <= 3; i++) {
            const count = modObj[i] || 0
            result[i] = ((count / total) * 100).toFixed(2) + '%'
        }
        return result
    }
}
