import { rulePrefix } from '../utils/common.js'
import SKLandUser from '../model/sklandUser.js'
import constant from "../components/constant.js";
import setting from '../utils/setting.js';
import runtimeRender from '../utils/runtimeRender.js'
import { getAvatarUrl, getSkinAvatarUrl } from '../model/imgApi.js'

import { getOperatorAssets, sortOperatorAssets, parseOperatorAssetCommand } from '../model/operatorAssets.js'

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
    }

    async charStat() {
        return this.showAssets('list')
    }

    async charStatCard() {
        return this.showAssets('card')
    }

    async showAssets(view) {
        const parsed = parseOperatorAssetCommand(this.e.msg, rulePrefix, constant.charData.rarity_keywords, constant.charData.profession_list)
        if (!parsed || !Number.isSafeInteger(parsed.page) || parsed.page < 1) {
            await this.reply('请输入有效页码，例如「练度统计2」。')
            return true
        }
        const user = new SKLandUser(this.e.at || this.e.user_id)
        if (!await user.getUser()) return false
        await this.reply('开始获取练度信息，请稍等')
        const response = await user.getGamePlayerInfo()
        if (!response?.data) { await this.reply('查询失败，请检查cred或稍后再试'); return true }
        const config = setting.getConfig('game_info')
        const configuredSize = Number(view === 'card' ? config.char_stat_card_page_size : config.char_stat_page_size)
        const pageSize = Number.isSafeInteger(configuredSize) && configuredSize > 0 ? Math.min(200, configuredSize) : view === 'card' ? 35 : 30
        const filter = {
            rarity_name: parsed.rarity || '', profession_name: parsed.profession || '',
            rarity_filter: parsed.rarity ? constant.charData.rarity_keywords_map[parsed.rarity] : null,
            profession_filter: parsed.profession ? constant.charData.profession_map[parsed.profession] : null
        }
        const result = getOperatorAssets(response.data, filter.profession_filter, filter.rarity_filter, parsed.page, pageSize)
        if (!result.total) { await this.reply('查询结果为空，请检查命令'); return true }
        const pages = Math.ceil(result.total / pageSize)
        if (parsed.page > pages) { await this.reply(`干员资产共 ${pages} 页，请输入有效页码。`); return true }
        const updateTime = new Date(Number(response.timestamp) * 1000)
        await runtimeRender(this.e, view === 'card' ? 'charStat/charStatCard.html' : 'charStat/charStat.html', {
            sorted_char_list: result.chars, total_num: result.total, page_num: parsed.page, pages, page_size: pageSize,
            update_time_str: Number.isFinite(updateTime.getTime()) ? updateTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '时间未知',
            filter_info: filter, user_info: { name: response.data.status?.name || user.name, uid: user.uid }
        }, { scale: 1.0 })
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
        return getOperatorAssets(data, profession_filter, rarity_filter, page_num, page_size)
    }

    sortCharList(a, b) {
        return sortOperatorAssets(a, b)
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

    getSortedCharListForCard(data, profession_filter = null, rarity_filter = null, page_num = 1, page_size = 35) {
        return getOperatorAssets(data, profession_filter, rarity_filter, page_num, page_size)
    }
}
