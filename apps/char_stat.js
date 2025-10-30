import { rulePrefix } from '../utils/common.js'
import SKLandUser from '../model/sklandUser.js'
import constant from "../components/constant.js";
import setting from '../utils/setting.js';
import runtimeRender from '../utils/runtimeRender.js'
import { getAvatarUrl, getSkinAvatarUrl, getEquipTypeIconUrl } from '../model/imgApi.js'

const _path = process.cwd();

export class CharStat extends plugin {
    constructor() {
        super({
            name: '[arknights-plugin]干员练度统计',
            dsc: '干员练度统计',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^${rulePrefix}(${constant.charData.rarity_keywords.join('|')})?(${constant.charData.profession_list.join('|')})?练度(列表|统计|查询)([0-9]*)$`,
                    fnc: 'charStat'
                },
                {
                    reg: `^${rulePrefix}(${constant.charData.rarity_keywords.join('|')})?(${constant.charData.profession_list.join('|')})?练度(面板|卡片)([0-9]*)$`,
                    fnc: 'charStatCard'
                },
                {
                    reg: `^${rulePrefix}?(练度|阵容|角色|BOX|Box|box)(分析|总结|报告)$`,
                    fnc: 'charAnalysis'
                },
            ]
        })
        this.bindUser = {}
        this.setting = setting.getConfig('game_info')
    }

    async charStat() {
        let uid = this.e.at || this.e.user_id
        let sklUser = new SKLandUser(uid)
        if (!await sklUser.getUser()) {
            return false
        }
        await this.reply(`开始获取练度信息，请稍等`)
        let reg = new RegExp(`^${rulePrefix}(${constant.charData.rarity_keywords.join('|')})?(${constant.charData.profession_list.join('|')})?练度(列表|统计|查询)([0-9]*)$`)
        let match = reg.exec(this.e.msg)
        let filter_info = {
            profession_filter: null,
            profession_name: "",
            rarity_filter: null,
            rarity_name: ""
        }

        if (match[4]) {
            filter_info.rarity_filter = constant.charData.rarity_keywords_map[match[4]]
            filter_info.rarity_name = match[4]
        }
        if (match[5]) {
            filter_info.profession_filter = constant.charData.profession_map[match[5]]
            filter_info.profession_name = match[5]
        }
        let page_num = match[7] || 1
        // logger.mark(`[方舟插件][练度统计]profession_filter: ${profession_filter}`)
        // logger.mark(`[方舟插件][练度统计]page_num: ${page_num}`)
        let page_size = this.setting?.char_stat_page_size || 30


        // let res = await sklUser.sklReq.getData('game_player_info')
        let res = await sklUser.getGamePlayerInfo()

        if (!res) {
            logger.mark(`user info失败，响应:${JSON.stringify(res)}`)
            await this.reply(`查询失败，请检查cred或稍后再试`)
            return true
        }
        let res_data = res.data
        let update_time = new Date(Number(res.timestamp) * 1000)
        let sorted_result = this.getSortedCharList(res_data, filter_info.profession_filter, filter_info.rarity_filter, page_num, page_size)
        let sorted_char_list = sorted_result.chars
        if (sorted_result.total == 0) {
            await this.reply(`查询结果为空，请检查命令`)
            return true
        }

        await runtimeRender(this.e, 'charStat/charStat.html', {
            sorted_char_list: sorted_char_list,
            total_num: sorted_result.total,
            update_time_str: update_time.toLocaleString(),
            page_num: page_num,
            page_size, page_size,
            filter_info: filter_info,
            user_info: sklUser,
        }, {
            scale: 1.6
        })
        return true
    }

    async charStatCard() {
        let uid = this.e.at || this.e.user_id
        let sklUser = new SKLandUser(uid)
        if (!await sklUser.getUser()) {
            return false
        }
        await this.reply(`开始获取练度信息，请稍等`)
        let reg = new RegExp(`^${rulePrefix}(${constant.charData.rarity_keywords.join('|')})?(${constant.charData.profession_list.join('|')})?练度(面板|卡片)([0-9]*)$`)
        let match = reg.exec(this.e.msg)
        let filter_info = {
            profession_filter: null,
            profession_name: "",
            rarity_filter: null,
            rarity_name: ""
        }

        if (match[4]) {
            filter_info.rarity_filter = constant.charData.rarity_keywords_map[match[4]]
            filter_info.rarity_name = match[4]
        }
        if (match[5]) {
            filter_info.profession_filter = constant.charData.profession_map[match[5]]
            filter_info.profession_name = match[5]
        }
        let page_num = match[7] || 1
        let page_size = this.setting?.char_stat_card_page_size || 35 // 每行5个，最多7行

        let res = await sklUser.getGamePlayerInfo()

        if (!res) {
            logger.mark(`user info失败，响应:${JSON.stringify(res)}`)
            await this.reply(`查询失败，请检查cred或稍后再试`)
            return true
        }
        let res_data = res.data
        let update_time = new Date(Number(res.timestamp) * 1000)
        let sorted_result = this.getSortedCharListForCard(res_data, filter_info.profession_filter, filter_info.rarity_filter, page_num, page_size)
        let sorted_char_list = sorted_result.chars
        if (sorted_result.total == 0) {
            await this.reply(`查询结果为空，请检查命令`)
            return true
        }

        await runtimeRender(this.e, 'charStat/charStatCard.html', {
            sorted_char_list: sorted_char_list,
            total_num: sorted_result.total,
            update_time_str: update_time.toLocaleString(),
            page_num: page_num,
            page_size: page_size,
            filter_info: filter_info,
            user_info: sklUser,
        }, {
            scale: 1.3
        })
        return true
    }

    async charAnalysis() {
        let uid = this.e.at || this.e.user_id
        let sklUser = new SKLandUser(uid)
        if (!await sklUser.getUser()) {
            return false
        }
        await this.reply(`开始获取练度信息，请稍等`)
        let res = await sklUser.getGamePlayerInfo()

        if (!res) {
            logger.mark(`user info失败，响应:${JSON.stringify(res)}`)
            await this.reply(`查询失败，请检查cred或稍后再试`)
            return true
        }
        let res_data = res.data
        let update_time = new Date(Number(res.timestamp) * 1000)

        let user_info = {}

        // 用户信息
        let avatar_type = res_data.status.avatar.type
        let avatar_id = res_data.status.avatar.id
        if (avatar_type && avatar_id) {
            user_info.avatar_url = avatar_type == "ICON" ? getAvatarUrl(res_data.status.avatar.id) : getSkinAvatarUrl(res_data.status.avatar.id)
        } else {
            user_info.avatar_url = `../../../../../plugins/arknights-plugin/resources/profileCard/img/default_avatar.png`
        }
        user_info.name = res_data.status.name
        user_info.level = res_data.status.level
        user_info.uid = res_data.status.uid

        let analysis_result = this.analyze(res_data)

        await runtimeRender(this.e, 'charStat/charAnalysis.html', {
            player_analysis_result: analysis_result.player_score_data,
            max_data: analysis_result.max_score_data,
            user_info: user_info,
            score_content: analysis_result.score_content,
            rank_content: analysis_result.rank_content,
            tag_list: analysis_result.tag_list,
        }, {
            scale: 1.0
        })
        return true

    }

    getSortedCharList(data, profession_filter = null, rarity_filter = null, page_num = 1, page_size = 30) {
        let char_map = data.charInfoMap
        let char_data = data.chars
        let equip_map = data.equipmentInfoMap
        // logger.mark(`[方舟插件][练度统计]getSortedCharList-profession_filter: ${profession_filter}`)
        // logger.mark(`[方舟插件][练度统计]getSortedCharList- page_num: ${page_num}`)

        let combinedArray = char_data.map(char => {
            let { charId, defaultEquipId, skills, mainSkillLvl, ...rest } = char;
            let equip_text = '-'
            let skill_text = [
                {
                    text: '-',
                    tag: 'normal'
                },
                {
                    text: '-',
                    tag: 'normal'
                },
                {
                    text: '-',
                    tag: 'normal'
                },
            ]
            if (char_map.hasOwnProperty(charId)) {
                let { name, profession, ...map_rest } = char_map[charId];
                if (name === '阿米娅') {
                    if (profession === 'CASTER') name = '阿米娅(术师)'
                    if (profession === 'WARRIOR') name = '阿米娅(近卫)'
                    if (profession === 'MEDIC') name = '阿米娅(医疗)'
                }
                for (var i = 0; i < skills.length; i++) {
                    if (skills[i].specializeLevel > 0) {
                        skill_text[i].text = `专精${skills[i].specializeLevel}`
                        skill_text[i].tag = `m${skills[i].specializeLevel}`
                    } else {
                        skill_text[i].text = `LV.${mainSkillLvl}`
                        skill_text[i].tag = `normal`
                    }
                }
                if (equip_map.hasOwnProperty(defaultEquipId)) {
                    const typeIcon = equip_map[defaultEquipId]['typeIcon'].toUpperCase();
                    if (typeIcon !== 'ORIGINAL') {
                        let equip_level = char.equip[char.equip.findIndex(item => item.id == char.defaultEquipId)].level
                        equip_text = `${typeIcon} LV.${equip_level}`
                    }
                    return { charId, name, profession, defaultEquipId, skills, typeIcon, equip_text, skill_text, mainSkillLvl, ...rest, ...map_rest };
                }
                return { charId, name, profession, defaultEquipId, equip_text, skills, skill_text, ...rest, mainSkillLvl, ...map_rest };
            }

            return char;
        });

        if (rarity_filter != null) {
            combinedArray = combinedArray.filter(char => char.rarity === rarity_filter)
        }

        if (profession_filter != null) {
            combinedArray = combinedArray.filter(char => char.profession === profession_filter)
        }
        let sortedArray = combinedArray.sort(this.sortCharList);
        let length = sortedArray.length

        // 用于分析时，分页参数均为0
        if (page_num != 0 && page_size != 0) {
            try {
                sortedArray = this.paginateArray(sortedArray, page_num, page_size)
            } catch (error) {
                logger.mark(`[方舟插件][练度统计]分页失败，msg:${error}`)
                return [];
            }
        }

        return {
            total: length,
            chars: sortedArray
        };
    }

    sortCharList(a, b) {
        if (b.evolvePhase !== a.evolvePhase) {
            return b.evolvePhase - a.evolvePhase;
        }
        if (b.level !== a.level) {
            return b.level - a.level;
        }
        if (b.rarity !== a.rarity) {
            return b.rarity - a.rarity;
        }
        let specialize_level_a = a.skills.reduce((sum, e) => sum + Number(e.specializeLevel || 0), 0)
        let specialize_level_b = b.skills.reduce((sum, e) => sum + Number(e.specializeLevel || 0), 0)
        if (specialize_level_a !== specialize_level_b) {
            return specialize_level_b - specialize_level_a;
        }
        if (b.mainSkillLvl !== a.mainSkillLvl) {
            return b.mainSkillLvl - a.mainSkillLvl;
        }
        if (b.potentialRank !== a.potentialRank) {
            return b.potentialRank - a.potentialRank;
        }
        if (b.favorPercent !== a.favorPercent) {
            return b.favorPercent - a.favorPercent;
        }
        return a.name.localeCompare(b.name);
    }

    paginateArray(array, page_num, page_size) {
        if (page_num <= 0 || page_size <= 0) {
            return []
        }
        const start = (page_num - 1) * page_size;
        const end = start + page_size;
        const paginatedArray = array.slice(start, end);
        return paginatedArray;
    }

    analyze(data) {
        let analysis_result = {
            max_score_data: null
        }
        let max_score_data = this.getMaxScore(data)

        let player_score_data = {
            general: null,
            profession: [],
            rarity: [],
        }
        let tag_list = []

        // general
        let player_char_data = this.getSortedCharList(data, null, null, 0, 0).chars
        player_score_data.general = this.analyisisCharList(player_char_data, 'general')
        logger.mark(`general: ${JSON.stringify(player_score_data.general)}`)

        let top_tag_list = []
        if (player_score_data.general.top_tag_list.length > 3) {
            top_tag_list = this.randomTags(player_score_data.general.top_tag_list, 3)
        } else {
            top_tag_list = player_score_data.general.top_tag_list
        }
        if (top_tag_list.length > 0) {
            tag_list = [...tag_list, ...top_tag_list]
        }

        // profession
        for (let pro_name in constant.charData.profession_map) {
            let pro_eng_name = constant.charData.profession_map[pro_name]
            let filterd_char_data = player_char_data.filter(char => char.profession === pro_eng_name)
            player_score_data.profession.push(this.analyisisCharList(filterd_char_data, pro_name))
        }
        logger.mark(`profession: ${JSON.stringify(player_score_data.profession)}`)

        // rarity
        const rarity_lst = [3, 4, 5]
        for (let index in rarity_lst) {
            let filterd_char_data = player_char_data.filter(char => char.rarity === rarity_lst[index])
            player_score_data.rarity.push(this.analyisisCharList(filterd_char_data, `${rarity_lst[index] + 1}星`))
        }
        logger.mark(`rarity: ${JSON.stringify(player_score_data.rarity)}`)

        let player_rank = 'D'

        for (let rank in constant.gameData.analysis_rank) {
            if (player_score_data.general.score >= constant.gameData.analysis_rank[rank]) {
                player_rank = rank
            } else {
                break
            }
        }
        let score_content = `<div class="rating ${player_rank}">${player_score_data.general.score.toFixed()}</div>`
        let rank_content = `<div class="rating ${player_rank}">${player_rank}</div>`

        // 特殊tag相关
        if (player_rank == 'MAX') { tag_list.push('方舟领域大神') }
        if (player_rank == 'ACE') { tag_list.push('肝败吓疯') }
        if (player_rank == 'SSS' || player_rank == 'SS') { tag_list.push('黄金大队') }
        if (player_rank == 'S' || player_rank == 'A') { tag_list.push('阵容齐整') }
        if (player_rank == 'B') { tag_list.push('有待提升') }
        if (player_rank == 'C' || player_rank == 'D') { tag_list.push('新鲜的小萌新') }

        if (player_score_data.general.count >= 320) { tag_list.push('图鉴大佬') }
        else if (player_score_data.general.specialize_count >= 290) { tag_list.push('图鉴收集者') }

        if (player_score_data.general.specialize_count >= 150) { tag_list.push('专精大师') }
        else if (player_score_data.general.specialize_count >= 100) { tag_list.push('专精高手') }
        else if (player_score_data.general.specialize_count >= 75) { tag_list.push('专精熟手') }

        if (player_score_data.general.top_count >= 100) { tag_list.push('统统拉满') }
        else if (player_score_data.general.top_count >= 50) { tag_list.push('满级阵容') }
        else if (player_score_data.general.top_count >= 25) { tag_list.push('为爱拉满') }

        if (player_score_data.general.top_count >= 320) { tag_list.push('万人迷刀客塔') }
        else if (player_score_data.general.top_count >= 240) { tag_list.push('好感大师') }

        if (player_score_data.general.evo2_count >= 240) { tag_list.push('打开全是精二') }
        else if (player_score_data.general.evo2_count >= 150) { tag_list.push('精二起步') }
        else if (player_score_data.general.evo2_count >= 70) { tag_list.push('常用精二') }

        logger.mark(`tag_list: ${tag_list}`)

        return {
            max_score_data: max_score_data,
            player_score_data: player_score_data,
            player_rank: player_rank,
            tag_list: tag_list,
            score_content: score_content,
            rank_content: rank_content,
        }
    }

    analyisisCharList(char_data_list, analysis_name) {
        let [count, evo2_count, score, specialize_count, top_count, top_favor] = [0, 0, 0, 0, 0, 0]
        let top_tag_list = []
        for (let char_data of char_data_list) {
            count += 1
            score += this.calculateScore(char_data)
            if (char_data.favorPercent == 200) {
                top_favor += 1
            }

            // 三星及以下无精2
            if (char_data.rarity <= 2) continue

            if (char_data.evolvePhase == 2) {
                evo2_count += 1
                switch (char_data.rarity) {
                    case 3:
                        if (char_data.level == 70) top_count += 1
                        break
                    case 4:
                        if (char_data.level == 80) top_count += 1
                        break
                    case 5:
                        if (char_data.level == 90) top_count += 1
                        break

                }
            }

            let current_skill_specialize_cnt = 0
            for (let skill of char_data.skills) {
                if (skill.specializeLevel == 3) {
                    current_skill_specialize_cnt += 1
                    specialize_count += 1
                }
            }

            // 顶尖tag
            if (char_data.level == 90 && char_data.potentialRank == 5 && current_skill_specialize_cnt == 3) {
                top_tag_list.push(`顶尖${char_data.name}`)
            } else if (current_skill_specialize_cnt == 3)(
                top_tag_list.push(`专九${char_data.name}`)
            )
        }
        return {
            analysis_name: analysis_name,
            count: count,
            evo2_count: evo2_count,
            specialize_count: specialize_count,
            top_count: top_count,
            top_favor: top_favor,
            score: score,
            top_tag_list: top_tag_list
        }
    }

    calculateScore(char_data) {
        let score = 0
        // 计算等级分
        if (char_data.evolvePhase == 1) {
            score += constant.gameData.analysis_rule[char_data.rarity].level_evo0
            score += char_data.level * 0.5
        }
        else if (char_data.evolvePhase == 2) {
            score += constant.gameData.analysis_rule[char_data.rarity].level_evo1
            score += char_data.level * 1
        } else {
            score += char_data.level * 0.2
        }
        // 技能
        score += char_data.mainSkillLvl

        // 好感
        score += Math.floor(char_data.favorPercent * 0.05)

        for (let skill of char_data.skills) {
            score += constant.gameData.analysis_rule[char_data.rarity].specialize[skill.specializeLevel]
        }

        // 潜能
        score += char_data.potentialRank * constant.gameData.analysis_rule[char_data.rarity].potential

        // 模组
        for (let equip of char_data.equip) {
            if (equip.locked) {
                continue
            }
            score += constant.gameData.analysis_rule[char_data.rarity].equip[equip.level - 1]
        }

        return score
    }

    getMaxScore(data) {
        let max_score_data = {
            score: 0,
            WARRIOR: 0,
            TANK: 0,
            SUPPORT: 0,
            SNIPER: 0,
            PIONEER: 0,
            CASTER: 0,
            SPECIAL: 0,
            MEDIC: 0,
            rarity: [0, 0, 0, 0, 0, 0]
        }
        for (let key in data.charInfoMap) {
            max_score_data.score += constant.gameData.analysis_rule[data.charInfoMap[key].rarity].max_score
            max_score_data[data.charInfoMap[key].profession] += 1
            max_score_data.rarity[data.charInfoMap[key].rarity] += 1
        }
        return max_score_data
    }

    randomTags(tag_list, length) {
        var result_list = []
        for (var i = 0; i < length; i++) {
            var index = Math.floor(Math.random() * tag_list.length);
            var item = tag_list[index];
            result_list.push(item)
            tag_list.splice(index, 1)
        }
        return result_list.reverse()
    }

    getSortedCharListForCard(data, profession_filter = null, rarity_filter = null, page_num = 1, page_size = 60) {
        let char_map = data.charInfoMap
        let char_data = data.chars
        let equip_map = data.equipmentInfoMap

        let combinedArray = char_data.map(char => {
            let { charId, defaultEquipId, skills, mainSkillLvl, skinId, ...rest } = char;
            
            // 获取角色头像
            let avatar_url = getSkinAvatarUrl(skinId)
            
            // 技能信息处理
            let skill_list = [
                { level: 0, text: '-', color_class: 'skill-none' },
                { level: 0, text: '-', color_class: 'skill-none' },
                { level: 0, text: '-', color_class: 'skill-none' }
            ]
            
            // 模组信息
            let equip_info = {
                has_equip: false,
                type_icon_url: '',
                equip_text: '-'
            }

            if (char_map.hasOwnProperty(charId)) {
                let { name, profession, ...map_rest } = char_map[charId];
                
                // 处理阿米娅特殊情况
                if (name === '阿米娅') {
                    if (profession === 'CASTER') name = '阿米娅(术师)'
                    if (profession === 'WARRIOR') name = '阿米娅(近卫)'
                    if (profession === 'MEDIC') name = '阿米娅(医疗)'
                }
                
                // 处理技能信息
                for (var i = 0; i < skills.length; i++) {
                    if (skills[i].specializeLevel > 0) {
                        skill_list[i].level = skills[i].specializeLevel
                        skill_list[i].text = `专精${skills[i].specializeLevel}`
                        skill_list[i].color_class = `skill-m${skills[i].specializeLevel}`
                    } else {
                        skill_list[i].level = mainSkillLvl
                        skill_list[i].text = `LV.${mainSkillLvl}`
                        // 根据等级设置颜色
                        if (mainSkillLvl == 1) {
                            skill_list[i].color_class = 'skill-lv1'
                        } else if (mainSkillLvl >= 2 && mainSkillLvl <= 4) {
                            skill_list[i].color_class = 'skill-lv2-4'
                        } else if (mainSkillLvl >= 5 && mainSkillLvl <= 7) {
                            skill_list[i].color_class = 'skill-lv5-7'
                        }
                    }
                }
                
                // 处理模组信息
                if (equip_map.hasOwnProperty(defaultEquipId)) {
                    const typeIcon = equip_map[defaultEquipId]['typeIcon'].toUpperCase();
                    if (typeIcon !== 'ORIGINAL') {
                        let equip_level = char.equip[char.equip.findIndex(item => item.id == char.defaultEquipId)].level
                        equip_info.has_equip = true
                        equip_info.type_icon_url = getEquipTypeIconUrl(equip_map[defaultEquipId]['typeIcon'])
                        equip_info.equip_text = `${typeIcon} LV.${equip_level}`
                    }
                }
                
                return { 
                    charId, 
                    name, 
                    profession, 
                    avatar_url,
                    skill_list,
                    equip_info,
                    skills,
                    mainSkillLvl, 
                    ...rest, 
                    ...map_rest 
                };
            }

            // 如果找不到角色信息，返回基本结构
            return {
                ...char,
                avatar_url,
                skill_list,
                equip_info,
                skills,
                mainSkillLvl
            };
        });

        // 应用筛选条件
        if (rarity_filter != null) {
            combinedArray = combinedArray.filter(char => char.rarity === rarity_filter)
        }

        if (profession_filter != null) {
            combinedArray = combinedArray.filter(char => char.profession === profession_filter)
        }
        
        // 排序
        let sortedArray = combinedArray.sort(this.sortCharList);
        let length = sortedArray.length

        // 分页处理
        if (page_num != 0 && page_size != 0) {
            try {
                sortedArray = this.paginateArray(sortedArray, page_num, page_size)
            } catch (error) {
                logger.mark(`[方舟插件][练度统计卡片]分页失败，msg:${error}`)
                return { total: 0, chars: [] };
            }
        }

        return {
            total: length,
            chars: sortedArray
        };
    }
}