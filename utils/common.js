import fs from "fs";
import YAML from 'yaml'
import setting from "./setting.js"
import constant from "../components/constant.js";


const _path = process.cwd();


function getPrefix() {
    let common_setting = setting.getConfig('common')
    switch(common_setting.prefix_mode) {
        case 1:
            return '((#|/)?(方舟|明日方舟|arknights|方舟插件)|\/|\\\/|/|~|～)'
        case 2:
            return '((#|/)?(方舟插件|明日方舟|arknights)|\/|\\\/|/|~|～)'
        // 因为有bug，暂时移除
        // case 3:
        //     return '((#|/)?|\/|\\\/|/|~|～)'
        default:
            return '((#|/)?(方舟|明日方舟|arknights|方舟插件)|\/|\\\/|/|~|～)'
    }
}


export const rulePrefix = getPrefix()

export function get_name_from_nickname(nickname) {
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

export function profession_eng_to_name(eng_name) {
    function findKey (value, compare = (a, b) => a === b) {
        return Object.keys(constant.charData.profession_map).find(k => compare(constant.charData.profession_map[k], value))
    }
    return findKey(eng_name)
}

