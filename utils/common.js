import setting from "./setting.js"


function getPrefix() {
    let common_setting = setting.getConfig('common')
    switch(common_setting.prefix_mode) {
        case 1:
            return '((#|/)?(方舟|明日方舟|arknights|方舟插件)|\/|\\\/|/|~|～)'
        case 2:
            return '((#|/)?(方舟|明日方舟|arknights)|\/|\\\/|/|~|～)'
        case 3:
            return '((#|/)?|\/|\\\/|/|~|～)'
    }
}


export const rulePrefix = getPrefix()

