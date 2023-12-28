import moment from 'moment'
import fs from "fs";
import YAML from 'yaml'
import { rulePrefix } from '../utils/common.js'
import SKLandUser from '../model/sklandUser.js'
import { getSkinPortraitUrl, getSkillIconUrl, getEquipTypeIconUrl, getEquipIconUrl, getEquipTypeShiningUrl } from '../model/imgApi.js'
import runtimeRender from '../utils/runtimeRender.js'

const _path = process.cwd();

export class CharProfile extends plugin {
    constructor() {
        super({
            name: '[arknights-plugin]干员信息',
            dsc: '干员信息卡片',
            event: 'message',
            priority: 2000,
            rule: [
                {
                    reg: `^${rulePrefix}(.)+$`,
                    fnc: 'charProfile'
                },
            ]
        })
        this.bindUser = {}
    }

    async charProfile() {
        let char_name = this.e.msg.replace(/#|\/|方舟|明日方舟|arknights|方舟插件/g, "")
        if (char_name === "") {
            return false
        }
        let sklUser = new SKLandUser(this.e.user_id)
        if (!await sklUser.getUser()) {
            return false
        }
        // let res = await sklUser.sklReq.getData('game_player_info')
        let res = await sklUser.getGamePlayerInfo()

        if (!res) {
            logger.mark(`user info失败，响应:${JSON.stringify(res)}`)
            await this.reply(`查询失败，请检查cred或稍后再试`)
            return true
        }
        
        char_name = this.get_name_from_nickname(char_name)
        let meta_info_list = Object.values(res.data.charInfoMap)
        let char_info_list = res.data.chars
        let equip_map = res.data.equipmentInfoMap
        let meta_info
        let char_info

        if (char_name === '阿米娅（近卫）') {
            meta_info = meta_info_list[meta_info_list.findIndex(item => (item.name == '阿米娅' && item.profession == 'WARRIOR'))]
            try {
                char_info = char_info_list[char_info_list.findIndex(item => item.charId == meta_info.id)]
            } catch (e) {
                return false
            }
        } else {
            meta_info = meta_info_list[meta_info_list.findIndex(item => item.name == char_name)]
            try {
                char_info = char_info_list[char_info_list.findIndex(item => item.charId == meta_info.id)]
            } catch (e) {
                return false
            }
        }

        let basic_info = {}
        let skill_info = []
        let equip_info = {}

        basic_info.char_name = meta_info.name
        basic_info.rarity = meta_info.rarity
        basic_info.class = meta_info.profession
        basic_info.level = char_info.level
        basic_info.evolvePhase = char_info.evolvePhase
        basic_info.favorPercent = char_info.favorPercent
        basic_info.potentialRank = char_info.potentialRank
        basic_info.protrait = getSkinPortraitUrl(char_info.skinId)

        if (char_info.skills) {
            for (var i = 0; i < char_info.skills.length; i++) {
                let skill_info_item = {}
                skill_info_item.is_default = false
                skill_info_item.skill_icon = getSkillIconUrl(char_info.skills[i].id)
                if (char_info.skills[i].specializeLevel != 0) {
                    skill_info_item.level_text = `专精${char_info.skills[i].specializeLevel}`
                } else {
                    skill_info_item.level_text = `${char_info.mainSkillLvl}级`

                }
                if (char_info.defaultSkillId == char_info.skills[i].id) {
                    skill_info_item.is_default = true
                }
                skill_info.push(skill_info_item)
            }
        }



        equip_info.is_active = false
        if (char_info.equip.length > 1) {
            if (char_info.defaultEquipId != "" && char_info.defaultEquipId != char_info.equip[0].id) {
                equip_info.is_active = true
                let equip_data = char_info.equip[char_info.equip.findIndex(item => item.id == char_info.defaultEquipId)]
                equip_info.equip_icon = getEquipIconUrl(char_info.defaultEquipId)
                equip_info.type_icon = getEquipTypeIconUrl(equip_map[char_info.defaultEquipId].typeIcon)
                equip_info.shining_icon = getEquipTypeShiningUrl(equip_map[char_info.defaultEquipId].shiningColor)
                equip_info.level = equip_data.level
                equip_info.type_name = equip_map[char_info.defaultEquipId].typeIcon.toUpperCase()
                equip_info.name = equip_map[char_info.defaultEquipId].name

            }
        }

        await runtimeRender(this.e, 'charProfile/charProfile.html', {
            basic_info: basic_info,
            skill_info: skill_info,
            equip_info: equip_info
        }, {
            scale: 1.6
        })


        return true
    }

    get_char_info(char_name, char_info) {
        return char_info[char_info.findIndex(item => item.name == char_name)]
    }

    get_name_from_nickname(nickname) {
        let buffer = fs.readFileSync(`${_path}/plugins/arknights-plugin/resources/charProfile/nickname.yaml`, 'utf8');
        let nickname_data = YAML.parse(buffer)

        let find_key = (value, inNickname = (a, b) => a.includes(b)) => {
            return Object.keys(nickname_data).find(k => inNickname(nickname_data[k], value))
        }
        let full_name = find_key(nickname)
        if (Bot?.logger?.debug) {
            Bot.logger.debug(`别名匹配结果: ${full_name}`)
        } else {
            console.log(`别名匹配结果: ${full_name}`)
        }
        if (full_name === undefined) return nickname
        return full_name
    }


}