import fs from "fs";
import YAML from 'yaml'
import setting from "./setting.js"
import constant from "../components/constant.js";
import { JSDOM } from 'jsdom'
import { Script } from 'node:vm'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const _path = process.cwd();
const SKLAND_SM_CONFIG = {
    organization: 'UWXspnCCJN4sfYlNfqps',
    appId: 'default',
    publicKey: 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCmxMNr7n8ZeT0tE1R9j/mPixoinPkeM+k4VGIn/s0k7N5rJAfnZ0eMER+QhwFvshzo0LNmeUkpR8uIlU/GEVr8mN28sKmwd2gpygqj0ePnBmOW4v0ZVwbSYK+izkhVFk2V/doLoMbWy6b+UnA8mkjvg0iYWRByfRsK2gdl7llqCwIDAQAB',
    protocol: 'https',
    apiHost: 'fp-it.portal101.cn',
    apiPath: '/deviceprofile/v4',
}

function getPrefix() {
    let common_setting = setting.getConfig('common')
    switch (common_setting.prefix_mode) {
        case 1:
            return '((#|/)?(方舟|明日方舟|arknights|方舟插件)|\/|\\\/|/|~|～)'
        case 2:
            return '((#|/)?(方舟插件|明日方舟|arknights)|\/|\\\/|/|~|～)'
        case 3:
            return '((#|/)?(方舟插件|明日方舟|arknights)|\/|\\\/|/)'
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
    function findKey(value, compare = (a, b) => a === b) {
        return Object.keys(constant.charData.profession_map).find(k => compare(constant.charData.profession_map[k], value))
    }
    return findKey(eng_name)
}

export function createDeviceId() {
    // @ts-expect-error ignore
    const sdkJsPath = path.resolve(_path, './plugins/arknights-plugin/utils/sm.sdk.js')
    return new Promise((resolve) => {
        const dom = new JSDOM(
            '',
            {
                runScripts: 'outside-only',
                beforeParse(window) {
                    window._smReadyFuncs = [
                        () => {
                            resolve(window.SMSdk.getDeviceId())
                        },
                    ]
                    window._smConf = SKLAND_SM_CONFIG
                },
            },
        )

        const script = new Script(readFileSync(sdkJsPath, 'utf-8'))
        const vmContext = dom.getInternalVMContext()
        script.runInNewContext(vmContext)
    })
}


