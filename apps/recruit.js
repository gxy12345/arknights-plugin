import { rulePrefix } from '../utils/common.js'
import SKLandUser from '../model/sklandUser.js'
import constant from "../components/constant.js";
import prtsRecruitData from '../model/prtsRecruitData.js'
import setting from '../utils/setting.js'
import runtimeRender from '../utils/runtimeRender.js'


const _path = process.cwd();

export class CharProfile extends plugin {
    constructor() {
        super({
            name: '[arknights-plugin]公招计算',
            dsc: '计算公招tag结果',
            event: 'message',
            priority: 500,
            rule: [
                {
                    reg: `^${rulePrefix}公招(计算|查询)?(.)*$`,
                    fnc: 'recruit_calc'
                },
            ]
        })
        this.bindUser = {}
    }

    async recruit_calc() {
        let tags = this.get_tags(this.e.msg)
        
        if (tags.length === 0) {
            await this.reply('请输入公招标签，例如：#方舟公招 近战 输出 生存')
            return
        }
        
        logger.mark(`[方舟插件][公招查询]公招tag: ${tags.join(', ')}`)
        
        // 处理计算逻辑
        await this.calculateAndReply(tags)
    }

    /**
     * 计算公招结果并回复
     */
    async calculateAndReply(tags) {
        logger.mark(`[方舟插件][公招查询]公招tag: ${tags.join(', ')}`)
        let result = await this.operatorsFilter(tags)
        
        if (!result) {
            await this.reply('公招数据加载失败，请稍后重试')
            return
        }
        
        // 获取用户信息用于标记NEW和满潜
        let charInfoList = null
        let metaInfoList = null
        let sklUser = new SKLandUser(this.e.user_id)
        if (await sklUser.getUser()) {
            let res = await sklUser.getGamePlayerInfo()
            if (res?.code === 0 && res?.message === 'OK') {
                metaInfoList = Object.values(res.data.charInfoMap)
                charInfoList = res.data.chars
            }
        }
        
        // 将结果转换为渲染数据
        const renderData = await this.convertResultToRenderData(result, charInfoList, metaInfoList)
        
        // 检查是否有有效组合
        if (renderData.combinations.length === 0) {
            await this.reply(`当前tag组合为三星tag`)
            return
        }
        
        // 渲染图片
        try {
            const img = await runtimeRender(this.e, 'recruit/recruit', renderData, {
                scale: 1.4,
                timeout: 120000
            })
            
            if (img) {
                await this.reply(img)
            } else {
                // 降级到文本模式
                const textMsg = this.resultToStrWithCred(result, charInfoList, metaInfoList) || 
                               this.resultToStr(result)
                await this.reply(textMsg || '当前tag组合为三星tag')
            }
        } catch (error) {
            logger.error('[方舟插件][公招查询]图片渲染失败:', error)
            // 降级到文本模式
            const textMsg = this.resultToStrWithCred(result, charInfoList, metaInfoList) || 
                           this.resultToStr(result)
            await this.reply(textMsg || '当前tag组合为三星tag')
        }
    }
    
    /**
     * 将计算结果转换为渲染数据
     */
    async convertResultToRenderData(result, charInfoList, metaInfoList) {
        const combinations = []
        
        // 获取干员数据用于查询charId和职业
        const recruitData = await prtsRecruitData.getData()
        const allOperators = { ...recruitData.normal, ...recruitData.top }
        
        // 按星级顺序处理：6星 > 5星 > 4星 > 1星
        for (const starKey of ['6', '5', '4', '1']) {
            const starResult = result[starKey]
            if (!starResult || Object.keys(starResult).length === 0) continue
            
            for (const tagKey in starResult) {
                const operatorNames = starResult[tagKey]
                
                // 解析tag组合
                const tagsArray = tagKey.split('+')
                
                // 构建干员列表
                const operators = []
                for (const operatorName of operatorNames) {
                    const operatorData = allOperators[operatorName]
                    if (!operatorData) {
                        logger.warn(`[方舟插件][公招查询]找不到干员数据: ${operatorName}`)
                        continue
                    }
                    
                    // 提取职业信息
                    const professionTag = operatorData.tags.find(tag => tag.endsWith('干员'))
                    const profession = professionTag ? professionTag.replace('干员', '') : '未知'
                    
                    // 检查特殊标签（NEW 或 满）
                    const specialTags = []
                    if (charInfoList && metaInfoList) {
                        try {
                            const metaInfo = metaInfoList.find(item => item.name === operatorName)
                            if (metaInfo) {
                                const charInfo = charInfoList.find(item => item.charId === metaInfo.id)
                                if (charInfo) {
                                    if (charInfo.potentialRank === 5) {
                                        specialTags.push('满')
                                    }
                                } else {
                                    specialTags.push('NEW')
                                }
                            } else {
                                specialTags.push('NEW')
                            }
                        } catch (e) {
                            specialTags.push('NEW')
                        }
                    }
                    
                    operators.push({
                        name: operatorName,
                        level: operatorData.level,
                        profession: profession,
                        charId: operatorData.charId || '',
                        specialTags: specialTags
                    })
                }
                
                combinations.push({
                    tags: tagsArray,
                    operators: operators
                })
            }
        }
        
        return {
            combinations: combinations
        }
    }

    /**
     * 读取配置文件
     */
    getConfig() {
        return setting.getConfig('game_info')
    }

    async operatorsFilter(tags) {
        let topOperatorsList;
        let operatorsList;
        try {
            // 使用新的数据源（优先级：Redis缓存 > PRTS API > 本地数据）
            const recruitData = await prtsRecruitData.getData()
            if (!recruitData) {
                logger.error('[方舟插件][公招查询]无法获取干员数据')
                return null
            }
            
            topOperatorsList = recruitData.top || {}
            operatorsList = recruitData.normal || {}

        } catch (error) {
            logger.error(`[方舟插件][公招查询]读取干员数据失败，msg:${error}`)
            return null;
        }

        const sixStarLimited = {};
        const fiveStarLimited = {};
        const fourStarLimited = {};
        const oneStarLimited = {};
        const normal = {};

        if (tags.includes('高级资深干员')) {
            tags = tags.filter(tag => tag !== '高级资深干员');

            for (let tagNum = 2; tagNum >= 0; tagNum--) {
                for (let selectedTag of this.combinations(tags, tagNum)) {
                    const operators = [];

                    for (let operator in topOperatorsList) {
                        if (this.isSubset(selectedTag, topOperatorsList[operator]['tags'])) {
                            operators.push(operator);
                        }
                    }

                    if (operators.length > 0) {
                        sixStarLimited[this.selectedTagToStr(['高级资深干员', ...selectedTag])] = operators;
                    }
                }
            }
        }

        for (let tagNum = 3; tagNum > 0; tagNum--) {
            for (let selectedTag of this.combinations(tags, tagNum)) {
                const operators = [];

                for (let operator in operatorsList) {
                    if (this.isSubset(selectedTag, operatorsList[operator]['tags'])) {
                        operators.push(operator);
                    }
                }

                if (operators.length > 0) {
                    operators.sort((a, b) => operatorsList[b]['level'] - operatorsList[a]['level']);

                    const levels = operators.map(operator => operatorsList[operator]['level']);

                    if (levels.includes(2) || levels.includes(3)) {
                        normal[this.selectedTagToStr(selectedTag)] = operators;
                    } else {
                        const minLevel = operatorsList[operators[operators.length - 1]]['level'];

                        if (minLevel === 1) {
                            oneStarLimited[this.selectedTagToStr(selectedTag)] = operators;
                        } else if (minLevel === 4) {
                            fourStarLimited[this.selectedTagToStr(selectedTag)] = operators;
                        } else {
                            fiveStarLimited[this.selectedTagToStr(selectedTag)] = operators;
                        }
                    }
                }
            }
        }

        const result = {};
        result['6'] = sixStarLimited;
        result['5'] = fiveStarLimited;
        result['4'] = fourStarLimited;
        result['1'] = oneStarLimited;
        // result['normal'] = normal;

        return result;
    }

    * combinations(arr, n) {
        if (n === 0) {
            yield [];
        } else {
            for (let i = 0; i < arr.length; i++) {
                const rest = arr.slice(i + 1);
                for (let combination of this.combinations(rest, n - 1)) {
                    yield [arr[i], ...combination];
                }
            }
        }
    }

    selectedTagToStr(arr) {
        return arr.join('+');
    }

    resultToStr(result_obj) {
        let msg = ""
        for (let star_key in result_obj) {
            if (Object.keys(result_obj[star_key]).length !== 0) {
                msg += `\n${star_key}⭐️`
                let temp_msg
                for (let tag_key in result_obj[star_key]) {
                    if (result_obj[star_key].hasOwnProperty(tag_key)) {
                        temp_msg = '\n' + tag_key + ': ' + result_obj[star_key][tag_key].join(', ');
                        msg += temp_msg
                    }
                }
            }
        }
        if (msg !== "") {
            msg = msg.slice(1)
        }
        return msg
    }

    resultToStrWithCred(result_obj, char_info_list, meta_info_list) {
        let msg = ""
        for (let star_key in result_obj) {
            if (Object.keys(result_obj[star_key]).length !== 0) {
                msg += `\n${star_key}⭐️`
                let temp_msg
                for (let tag_key in result_obj[star_key]) {
                    if (result_obj[star_key].hasOwnProperty(tag_key)) {
                        let char_list = result_obj[star_key][tag_key]
                        let tagged_char_list = []
                        for (let char_name of char_list) {
                            let meta_info = meta_info_list[meta_info_list.findIndex(item => item.name == char_name)]
                            let char_info
                            try {
                                char_info = char_info_list[char_info_list.findIndex(item => item.charId == meta_info.id)]
                                if (char_info.potentialRank == 5) {
                                    tagged_char_list.push(`${char_name}[满]`)
                                } else {
                                    tagged_char_list.push(`${char_name}`)
                                }
                            } catch (e) {
                                tagged_char_list.push(`${char_name}[New]`)
                            }
                        }

                        temp_msg = '\n' + tag_key + ': ' + tagged_char_list.join(', ');
                        msg += temp_msg
                    }
                }
            }
        }
        if (msg !== "") {
            msg = msg.slice(1)
            msg += `\n[New]:当前未持有的干员  [满]:已经满潜的干员`
        }
        return msg
    }


    get_tags(inputString) {
        const keywords = inputString.split(/[ ,，]+/);
        const replaced_keyword = keywords.map(str => {
            if (constant.charData.replace_tag_keywords.hasOwnProperty(str)) {
              return constant.charData.replace_tag_keywords[str];
            }
            return str;
          });
        const tags = replaced_keyword.filter(keyword => constant.charData.valid_tags.includes(keyword));
        return tags;
    }

    isSubset(subset, superset) {
        return subset.every((element) => superset.includes(element));
    }

}