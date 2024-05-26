import setting from "./setting.js"


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

