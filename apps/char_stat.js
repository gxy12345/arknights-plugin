import { rulePrefix } from '../utils/common.js'
import SKLandUser from '../model/sklandUser.js'
import constant from "../components/constant.js";
import setting from '../utils/setting.js';
import runtimeRender from '../utils/runtimeRender.js'

const _path = process.cwd();

export class CharProfile extends plugin {
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
            ]
        })
        this.bindUser = {}
        this.setting = setting.getConfig('game_info')
    }

    async charStat() {
        let sklUser = new SKLandUser(this.e.user_id)
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
        let update_time = new Date(Number(res.timestamp)*1000)
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

    getSortedCharList(data, profession_filter = null, rarity_filter = null, page_num = 1, page_size=30) {
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
                let { name, profession, rarity, ...map_rest } = char_map[charId];
                if (name === '阿米娅') {
                    if (profession==='CASTER') name = '阿米娅(术师)'
                    if (profession==='WARRIOR') name = '阿米娅(近卫)'
                    if (profession==='MEDIC') name = '阿米娅(医疗)'
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
                    return { charId, name, rarity, profession, defaultEquipId, skills, typeIcon, equip_text, skill_text, ...rest, ...map_rest };
                }
                return { charId, name, rarity, profession, defaultEquipId, equip_text, skills, skill_text, ...rest, ...map_rest };
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

        try {
            sortedArray = this.paginateArray(sortedArray, page_num, page_size)
        } catch (error) {
            logger.mark(`[方舟插件][练度统计]分页失败，msg:${error}`)
            return [];
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

}