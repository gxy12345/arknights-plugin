import fs from "fs";
import { rulePrefix, get_name_from_nickname, profession_eng_to_name } from '../utils/common.js'
import SKLandUser from '../model/sklandUser.js'
import { getAvatarUrl, getSkinAvatarUrl } from '../model/imgApi.js'
import runtimeRender from '../utils/runtimeRender.js'
import constant from "../components/constant.js";


const _path = process.cwd();

export class CharProfile extends plugin {
    constructor() {
        super({
            name: '[arknights-plugin]养成计算',
            dsc: '养成计算器',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^${rulePrefix}养成计算(.)*$`,
                    fnc: 'charCalculator'
                },
            ]
        })
        this.bindUser = {}
    }

    async charCalculator() {
        let sklUser = new SKLandUser(this.e.user_id)
        if (!await sklUser.getUser()) {
            return false
        }
        let res = await sklUser.getGamePlayerInfo()

        if (!res) {
            logger.mark(`user info失败，响应:${JSON.stringify(res)}`)
            await this.reply(`查询失败，请检查cred或稍后再试`)
            return true
        }

        let replaced_msg = this.e.msg.replace(/#|\/|方舟|明日方舟|arknights|方舟插件|~|～|养成计算/g, "").trim()
        let calculate_params = replaced_msg.split(' ')

        if (calculate_params.length < 9 && calculate_params.length != 3 && calculate_params.length != 6) {
            let msg = '养成计算命令规则如下:'
            msg += '\n1.前缀+养成计算 干员名称 精英阶段 等级 技能1 技能2 技能3 模组1 模组2 模组3'
            msg += '\n2.技能专精1-3，填写为8-10，技能/模组不存在也需要填写数字。支持只填写等级、只填写等级+技能。'
            msg += '\n3.仅支持当前持有的干员计算，支持输入别名'
            msg += '\n例：~养成计算 推王 2 60 7 10 7 3 3 0 / ~养成计算 推王 2 60 / ~养成计算 推王 2 60 10 10 10'
            await this.reply(msg)
            return false
        }
        if (calculate_params.length == 3) {
            calculate_params = [...calculate_params, 1, 1, 1, 0, 0, 0]
        }
        if (calculate_params.length == 6) {
            calculate_params = [...calculate_params, 0, 0, 0]
        }
        let char_name = get_name_from_nickname(calculate_params[0])
        let cal_meta_info = await sklUser.sklReq.getData('cal_info')

        let target_char_info
        if (char_name.includes('阿米娅')) {
            logger.mark(`阿米娅使用固定id: ${constant.charData.amiya_ids[char_name]}`)
            target_char_info = cal_meta_info.data.characters.filter(obj => obj.id === constant.charData.amiya_ids[char_name]);
        } else {
            target_char_info = cal_meta_info.data.characters.filter(obj => obj.name === char_name);
        }
        const skl_item_info = cal_meta_info.data.items
        if (target_char_info.length < 1) {
            await this.reply(`未找到干员【${char_name}】`)
            return false
        }
        let char_id = target_char_info[0].id
        let char_skin_id = res.data.chars[res.data.chars.findIndex(item => item.charId == char_id)].skinId
        let char_avatar_url = getSkinAvatarUrl(char_skin_id)

        let cal_player_res = await sklUser.sklReq.getData('cal_player')
        let player_item_data = cal_player_res.data.items
        let player_char_data = cal_player_res.data.characters
        let target_char_data = player_char_data.filter(obj => obj.id === char_id)[0]
        target_char_data.rarity = target_char_info[0].rarity
        target_char_data.name = target_char_info[0].name
        target_char_data.profession = profession_eng_to_name(target_char_info[0].profession)
        target_char_data.avatar_url = char_avatar_url
        let cal_char_info = await sklUser.sklReq.getData('cal_character', { characterId: char_id })

        let target = this.getTarget(calculate_params, target_char_data, cal_char_info.data)
        let cal_result = await this.calculateRequire(calculate_params, target_char_data, cal_char_info.data)

        // 报错
        if (cal_result.err) {
            await this.reply(cal_result.err)
            return true
        }

        // 用森空岛数据给item列表添加rarity，便于后续渲染图片
        this.addItemRarity(cal_result.evo_materials, skl_item_info)
        this.addItemRarity(cal_result.mod_materials, skl_item_info)
        this.addItemRarity(cal_result.skill_materials, skl_item_info)
        this.addItemRarity(cal_result.total_materials, skl_item_info)

        let lack_result = this.calculateLackItemList(cal_result.total_materials, cal_result.cash, cal_result.exp, player_item_data)
        // 用森空岛数据给item列表添加rarity，便于后续渲染图片
        this.addItemRarity(lack_result.materials, skl_item_info)

        await runtimeRender(this.e, 'calculate/calculate.html', {
            char_data: target_char_data,
            target: target,
            cal_result: cal_result,
            lack_result: lack_result,
        }, {
            scale: 1.0
        })
        return true
    }

    async calculateRequire(cal_params, char_data, cal_char_info) {
        let calculate_result = {
            exp: 0,
            cash: 0,
            total_materials: [],
            evo_materials: [],
            skill_materials: [],
            mod_materials: [],
            err: null,
        }
        let level_result = await this.calculate_level(char_data.rarity, char_data.evolvePhase, char_data.level, Number(cal_params[1]), Number(cal_params[2]), cal_char_info)

        if (level_result.err) {
            calculate_result.err = level_result.err
            return calculate_result
        }
        calculate_result.cash += level_result.cs
        calculate_result.exp += level_result.es

        if (level_result.materials.length > 0) {
            calculate_result.evo_materials = level_result.materials
            calculate_result.total_materials = await this.mergeMaterials(calculate_result.total_materials, level_result.materials)
        }

        let skill_mod_result = await this.calculate_skill_mod(cal_params, char_data, cal_char_info)
        if (skill_mod_result.err) {
            calculate_result.err = skill_mod_result.err
            return calculate_result
        }

        if (skill_mod_result.skill_materials.length > 0) {
            calculate_result.skill_materials = skill_mod_result.skill_materials
            calculate_result.total_materials = await this.mergeMaterials(calculate_result.total_materials, skill_mod_result.skill_materials)
        }
        if (skill_mod_result.mod_materials.length > 0) {
            calculate_result.mod_materials = skill_mod_result.mod_materials
            calculate_result.total_materials = await this.mergeMaterials(calculate_result.total_materials, skill_mod_result.mod_materials)
        }
        calculate_result.cash += skill_mod_result.cs

        return calculate_result

    }

    async calculate_level(rarity, current_evo, current_level, target_evo, target_level, char_info) {
        let result = {
            err: null,
            es: 0,
            cs: 0,
            materials: []
        }
        // 基础校验
        if (target_evo < 0 || target_evo > 2 || target_level < 0 || target_level > 90) {
            result.err = '等级或精英阶段设置错误'
            return result
        }

        if (current_evo >= target_evo && current_level >= target_level) {
            logger.debug('满足等级条件')
            return result
        }

        const json_data_path = `${_path}/plugins/arknights-plugin/resources/calculate/arklevel.json`
        let level_data = await fs.promises
            .readFile(json_data_path, 'utf8')
            .then((data) => {
                return JSON.parse(data)
            })
            .catch((err) => {
                logger.error(err)
                result.err = '读取level数据失败'
                return result
            })

        let maxLevel = level_data.maxLevel
        let maxEvolve = maxLevel[rarity].length - 1
        let charExpMap = level_data.characterExpMap
        let charUpCostMap = level_data.characterUpgradeCostMap
        let evolveGoldCost = level_data.evolveGoldCost

        if (target_evo > maxEvolve || target_level > maxLevel[rarity][target_evo]) {
            result.err = `等级或精英阶段设置错误，当前角色最大精英阶段为${maxEvolve}`
            if (maxLevel[rarity][target_evo]) {
                result.err += `，当前精英阶段最大等级为${maxLevel[rarity][target_evo]}`
            }
            return result
        }

        for (let i = current_evo, j = current_level; i <= target_evo; i++) {
            while (i < target_evo && j < maxLevel[rarity][i]) {
                result.es += charExpMap[i][j - 1];
                result.cs += charUpCostMap[i][j - 1];
                j++;
            }
            while (i === target_evo && j < target_level) {
                result.es += charExpMap[i][j - 1];
                result.cs += charUpCostMap[i][j - 1];
                j++;
            }
            j = 1;
        }

        const evolvePhaseCost = char_info.evolvePhaseCost

        for (let i = current_evo; i < target_evo; i++) {
            result.cs += evolveGoldCost[rarity][i];
            let new_materials = []
            if (evolvePhaseCost.length >= i + 1) {
                for (let item of evolvePhaseCost[i].items) {
                    if (item.id == '4001') continue
                    new_materials.push(item)
                }
            }
            result.materials = await this.mergeMaterials(result.materials, new_materials)
        }
        // await this.addItemInfo(result.materials)
        return result
    }

    async calculate_skill_mod(cal_params, char_data, char_info) {
        logger.debug(`[calculate_skill_mod]char_data:${JSON.stringify(char_data)}`)
        logger.debug(`[calculate_skill_mod]char_info:${JSON.stringify(char_info)}`)
        let result = {
            err: null,
            skill_materials: [],
            mod_materials: [],
            cs: 0
        }

        let skill_params = cal_params.slice(3, 6)
        let mod_params = cal_params.slice(6, 9)

        // 2星及以下没有技能模组
        if (char_data.rarity <= 1) {
            return result
        }

        // 基础校验
        if (!skill_params.every((num) => { return (num > 0 && num <= 10) })) {
            result.err = '技能等级设置错误'
            return result
        }
        if (!mod_params.every((num) => { return (num >= 0 && num <= 3) })) {
            result.err = '模组等级设置错误'
            return result
        }

        // 技能等级1-7
        let max_skill_level = Math.max(...skill_params)

        const mainSkillLevelCost = char_info.mainSkillLevelCost

        if (char_data.mainSkillLevel <= 7 && max_skill_level > char_data.mainSkillLevel) {
            let main_skill_materials = []
            logger.debug(`under LV7`)
            if (max_skill_level > 7) max_skill_level = 7
            for (let i = char_data.mainSkillLevel; i < max_skill_level; i++) {
                for (let item of mainSkillLevelCost[i - 1].items) {
                    main_skill_materials.push(item)
                }
            }
            result.skill_materials = await this.mergeMaterials(result.skill_materials, main_skill_materials)
        }

        // 技能专精
        const skillCost = char_info.skillCost
        let skill_specialize_materials = []

        for (let i = 0; i < skill_params.length; i++) {
            if (skill_params[i] <= 7) continue
            if (i >= skillCost.length) break
            const levelCost = skillCost[i].levelCost
            for (let j = char_data.skills[i].level; j < skill_params[i] - 7; j++) {
                for (let item of levelCost[j].items) {
                    skill_specialize_materials.push(item)
                }
            }
        }
        result.skill_materials = await this.mergeMaterials(result.skill_materials, skill_specialize_materials)

        // 模组
        const equipCost = char_info.equipCost
        let equip_materials = []

        for (let i = 0; i < mod_params.length; i++) {
            // 阿米娅的信息里面带有其他升变的模组，很怪
            // 奶兔没有模组，应该是鹰角的问题，暂时不处理了
            if (i >= equipCost.length || i >= char_data.equips.length) break
            const levelCost = equipCost[i].levelCost
            for (let j = char_data.equips[i].level; j < mod_params[i]; j++) {
                for (let item of levelCost[j].items) {
                    if (item.id == '4001') {
                        result.cs += item.count
                    } else {
                        equip_materials.push(item)
                    }
                }
            }
        }
        result.mod_materials = await this.mergeMaterials(result.mod_materials, equip_materials)

        return result
    }

    async mergeMaterials(arr1, arr2) {
        let mergedArray = JSON.parse(JSON.stringify(arr1))

        for (const obj2 of arr2) {
            const existingObj = mergedArray.find(obj1 => obj1.id == obj2.id);
            if (existingObj) {
                existingObj.count += obj2.count;
            } else {
                mergedArray.push(JSON.parse(JSON.stringify(obj2)));
            }
        }


        await this.addItemInfo(mergedArray)
        mergedArray.sort((a, b) => a.sortId - b.sortId)

        return mergedArray;
    }

    async addItemInfo(materials) {
        const json_data_path = `${_path}/plugins/arknights-plugin/resources/calculate/item_meta.json`
        let item_meta_data = await fs.promises
            .readFile(json_data_path, 'utf8')
            .then((data) => {
                return JSON.parse(data)
            })
            .catch((err) => {
                logger.error(err)
                return false
            })

        for (let item of materials) {
            if (item_meta_data.hasOwnProperty(item.id)) {
                item.name = item_meta_data[item.id].name
                item.sortId = item_meta_data[item.id].sortId
            } else {
                item.name = `未知材料${item.id}`
                item.sortId = 9999999
            }
        }
    }

    getTarget(cal_params, char_data, char_info) {
        logger.debug(`[getTarget]char_data:${JSON.stringify(char_data)}`)
        logger.debug(`[getTarget]char_info:${JSON.stringify(char_info)}`)
        let targetList = {}
        targetList['name'] = char_data.name
        targetList['evo'] = {
            current: char_data.evolvePhase,
            target: Math.max(char_data.evolvePhase, cal_params[1]),
            err: null,
        }
        targetList['level'] = {
            current: char_data.level,
            target: (char_data.evolvePhase < cal_params[1] || (char_data.evolvePhase == cal_params[1] && char_data.level < cal_params[2])) ?
                cal_params[2] : char_data.level,
            err: null,
        }

        for (let i = 1; i <= 3; i++) {
            if (char_data.skills.length >= i) {
                let current_level = char_data.mainSkillLevel + char_data.skills[i - 1].level
                targetList[`skill${i}`] = {
                    current: current_level,
                    target: Math.max(current_level, cal_params[i + 2]),
                    err: null,
                    name: char_info.skillCost[i - 1].name
                }
            } else {
                targetList[`skill${i}`] = {
                    current: 0,
                    target: 0,
                    err: "N/A",
                    name: null
                }
            }
        }

        for (let i = 1; i <= 3; i++) {
            if (char_data.equips.length >= i) {
                targetList[`equip${i}`] = {
                    current: char_data.equips[i - 1].level,
                    target: Math.max(char_data.equips[i - 1].level, cal_params[i + 5]),
                    err: null,
                    name: char_info.equipCost[i - 1].typeName.toUpperCase()
                }
            } else {
                targetList[`equip${i}`] = {
                    current: 0,
                    target: 0,
                    err: "N/A",
                }
            }
        }

        return targetList
    }

    addItemRarity(materials, skl_item_info) {
        const color_map = {
            0: 'blue-grey',
            1: 'green',
            2: 'blue',
            3: 'deep-purple',
            4: 'amber'
        }
        for (const item of materials) {
            const skl_item = skl_item_info.find(obj1 => obj1.id == item.id);
            if (skl_item) {
                item.rarity = skl_item.rarity;
            } else {
                item.rarity = 0
            }
            item.rarity_color = color_map[item.rarity]
        }
    }


    calculateLackItemList(target_materials, target_cash, target_exp, player_item_data) {
        let result = {
            cash: 0,
            exp: 0,
            materials: []
        }
        const exp_map = {
            '2001': 200,
            '2002': 400,
            '2003': 1000,
            '2004': 2000
        }

        let total_exp = 0;
        let total_cash = 0
        for (let obj of player_item_data) {
            if (Object.keys(exp_map).indexOf(obj.id) != -1) {
                total_exp += exp_map[obj.id] * Number(obj.count);
            }
            if (obj.id === '4001') {
                total_cash += Number(obj.count)
            }
        }
        if (target_cash > total_cash) result.cash = target_cash - total_cash
        if (target_exp > total_exp) result.exp = target_exp - total_exp

        for (let targetItem of target_materials) {
            const boxItem = player_item_data.find(obj => obj.id === targetItem.id);
            if (boxItem && Number(targetItem.count) > Number(boxItem.count)) {
                targetItem.lackCount = Number(targetItem.count) - Number(boxItem.count)
                result.materials.push(targetItem);
            }
        }
        return result;
    }

}