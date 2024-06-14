import fs from "fs";
import { rulePrefix, get_name_from_nickname } from '../utils/common.js'
import SKLandUser from '../model/sklandUser.js'
import { getSkinPortraitUrl, getSkillIconUrl, getEquipTypeIconUrl, getEquipIconUrl, getEquipTypeShiningUrl } from '../model/imgApi.js'
import runtimeRender from '../utils/runtimeRender.js'

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
                    reg: `^${rulePrefix}养成计算 (.)+$`,
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
        logger.mark(`计算参数: ${calculate_params}`)

        if (calculate_params.length < 9) {
            let msg = '计算参数有误，命令规则如下:'
            msg += '\n前缀+养成计算 干员名称 精英阶段 等级 技能1等级 技能2等级 技能3等级 模组1等级 模组2等级 模组3等级'
            msg += '\n注：技能专精1-3，填写为8-10，技能/模组不存在也需要填写数字，不能跳过不填写'
            msg += '例：~养成计算 推王 2 60 7 10 7 3 3 0'
            await this.reply(msg)
            return false
        }
        let char_name = get_name_from_nickname(calculate_params[0])
        let cal_meta_info = await sklUser.sklReq.getData('cal_info')
        const target_char_info = cal_meta_info.data.characters.filter(obj => obj.name === char_name);
        const skl_item_info = cal_meta_info.data.items
        if (target_char_info.length < 1) {
            await this.reply(`未找到干员【${char_name}】`)
            return false
        }
        let char_id = target_char_info[0].id
        let cal_player_res = await sklUser.sklReq.getData('cal_player')
        let player_item_data = cal_player_res.data.items
        let player_char_data = cal_player_res.data.characters
        let target_char_data = player_char_data.filter(obj => obj.id === char_id)[0]
        target_char_data.rarity = target_char_info[0].rarity
        let cal_char_info = await sklUser.sklReq.getData('cal_character', { characterId: char_id })

        let cal_result = await this.calculateRequire(calculate_params, target_char_data, cal_char_info.data)

        // 用森空岛数据给item列表添加rarity，便于后续渲染图片
        this.addItemRarity(cal_result.evo_materials, skl_item_info)
        this.addItemRarity(cal_result.mod_materials, skl_item_info)
        this.addItemRarity(cal_result.skill_materials, skl_item_info)
        this.addItemRarity(cal_result.total_materials, skl_item_info)

        if (!cal_result) return false

        // 回复消息 TODO：使用图片渲染
        let msg = `【养成计算结果】`
        if (cal_result.total_materials.length == 0 && cal_result.exp == 0 && cal_result.cash == 0) {
            msg += `已完成养成目标！`
            await this.reply(msg)
            return true
        }

        if (cal_result.exp > 0 || cal_result.cash > 0) {
            msg += `\n基础资源消耗:`
            msg += `\n经验值: ${cal_result.exp}`
            msg += `\n龙门币: ${cal_result.cash}`
        }

        if (cal_result.evo_materials.length > 0) {
            logger.mark(`cal_result.evo_materials: ${JSON.stringify(cal_result.evo_materials)}`)
            msg += `\n精英化材料:\n`
            for (let item of cal_result.evo_materials) {
                msg += `${item.name}×${item.count}; `
            }
        }

        if (cal_result.skill_materials.length > 0) {
            msg += `\n\n技能养成材料:\n `
            for (let item of cal_result.skill_materials) {
                msg += `${item.name}×${item.count}; `
            }
        }

        if (cal_result.mod_materials.length > 0) {
            msg += `\n\n模组养成材料:\n `
            for (let item of cal_result.mod_materials) {
                msg += `${item.name}×${item.count}; `
            }
        }

        await this.reply(msg)

        let lack_result = this.calculateLackItemList(cal_result.total_materials, cal_result.cash, cal_result.exp, player_item_data)
        // 用森空岛数据给item列表添加rarity，便于后续渲染图片
        this.addItemRarity(lack_result.materials, skl_item_info)

        if (lack_result.materials.length > 0 || lack_result.exp > 0 || lack_result.cash > 0) {
            let lackMsg = '【当前缺少资源】\n'

            if (lack_result.exp > 0) {
                lackMsg += `高级作战记录×${Math.ceil(lack_result.exp / 2000)}\n`
            }
            if (lack_result.cash > 0) {
                lackMsg += `龙门币×${lack_result.cash}\n`
            }
            if (lack_result.materials.length > 0) {
                lackMsg += `材料：\n`
                for (let item of lack_result.materials) {
                    lackMsg += `${item.name}×${item.count}; `
                }
            }
            await this.reply(lackMsg)
        }

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
        }
        let level_result = await this.calculate_level(char_data.rarity, char_data.evolvePhase, char_data.level, Number(cal_params[1]), Number(cal_params[2]), cal_char_info)

        if (level_result.err) {
            await this.reply(level_result.err)
            return false
        }
        calculate_result.cash += level_result.cs
        calculate_result.exp += level_result.es

        // let msg = `养成计算结果`

        if (level_result.materials.length > 0) {
            calculate_result.evo_materials = level_result.materials
            calculate_result.total_materials = await this.mergeMaterials(calculate_result.total_materials, level_result.materials)
            logger.mark(`evo_materials: ${JSON.stringify(calculate_result.evo_materials)}`)
            // msg += `\n精英化材料:\n`
            // for (let item of level_result.materials) {
            //     msg += `${item.name}×${item.count}; `
            // }
        }

        let skill_mod_result = await this.calculate_skill_mod(cal_params, char_data, cal_char_info)
        if (skill_mod_result.err) {
            await this.reply(skill_mod_result.err)
            return false
        }

        if (skill_mod_result.skill_materials.length > 0) {
            calculate_result.skill_materials = skill_mod_result.skill_materials
            calculate_result.total_materials = await this.mergeMaterials(calculate_result.total_materials, skill_mod_result.skill_materials)
            // msg += `\n\n技能养成材料:\n `
            // for (let item of skill_mod_result.skill_materials) {
            //     msg += `${item.name}×${item.count}; `
            // }
        }
        if (skill_mod_result.mod_materials.length > 0) {
            calculate_result.mod_materials = skill_mod_result.mod_materials
            calculate_result.total_materials = await this.mergeMaterials(calculate_result.total_materials, skill_mod_result.mod_materials)
            // msg += `\n\n模组养成材料:\n`
            // for (let item of skill_mod_result.mod_materials) {
            //     msg += `${item.name}×${item.count}; `
            // }
        }
        calculate_result.cash += skill_mod_result.cs

        // msg += `\n\n基础资源消耗:`
        // msg += `\n经验值: ${calculate_result.exp}`
        // msg += `\n龙门币: ${calculate_result.cash}`

        // await this.reply(msg)
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
            logger.mark('满足等级条件')
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
            result.err = '等级或精英阶段设置错误'
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
        let result = {
            err: null,
            skill_materials: [],
            mod_materials: [],
            cs: 0
        }

        let skill_params = cal_params.slice(3, 6)
        let mod_params = cal_params.slice(6, 9)

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
            logger.mark(`under LV7`)
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
            if (i >= equipCost.length) break
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

        // await this.addItemInfo(result.skill_materials)
        // await this.addItemInfo(result.mod_materials)

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

    addItemRarity(materials, skl_item_info) {
        for (const item of materials) {
            const skl_item = skl_item_info.find(obj1 => obj1.id == item.id);
            if (skl_item) {
                item.rarity = skl_item.rarity;
            } else {
                item.rarity = 0
            }
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