import { rulePrefix } from '../utils/common.js'
import SKLandUser from '../model/sklandUser.js'
import MAAConf from '../model/maaConf.js'
import setting from '../utils/setting.js'
import common from '../../../lib/common/common.js'
import { task_type_map, get_task_name } from '../utils/maaConstant.js'


export class MAAControl extends plugin {
    constructor() {
        super({
            name: '[arknights-plugin]MAA远程控制',
            dsc: 'MAA远程控制',
            event: 'message',
            priority: 50,
            rule: [
                {
                    reg: `^${rulePrefix}(MAA|Maa|maa)帮助$`,
                    fnc: 'maa_help'
                },
                {
                    reg: `^${rulePrefix}(我的)?(MAA|Maa|maa)$`,
                    fnc: 'my_maa'
                },
                {
                    reg: `^${rulePrefix}(MAA|Maa|maa)绑定设备$`,
                    fnc: 'maa_bind_device'
                },
                {
                    reg: `^${rulePrefix}(MAA|Maa|maa)(查询任务|任务状态|运行状态)$`,
                    fnc: 'maa_get_task'
                },
                {
                    reg: `^${rulePrefix}(MAA|Maa|maa)清空任务$`,
                    fnc: 'maa_clear_task'
                },
                {
                    reg: `^${rulePrefix}(MAA|Maa|maa)设置关卡(.)+$`,
                    fnc: 'maa_set_stage'
                },
                {
                    reg: `^${rulePrefix}(MAA|Maa|maa)截图$`,
                    fnc: 'maa_capture'
                },
                {
                    reg: `^${rulePrefix}(MAA|Maa|maa)(抽卡|单抽|十连抽|十连)$`,
                    fnc: 'maa_gacha'
                },
                {
                    reg: `^${rulePrefix}(MAA|Maa|maa)(.)+$`,
                    fnc: 'maa_set_task'
                },

            ]
        })
        this.setting = setting.getConfig('maa')
        this.bindUser = {}
    }

    async check_skluser() {
        let sklUser = new SKLandUser(this.e.user_id)
        if (!await sklUser.getUser()) {
            await this.reply('未绑定森空岛cred，请先绑定后再使用功能。可发送 /cred帮助 查看获取方法')
            return false
        }
        return sklUser
    }

    async maa_help() {
        if (!this.setting.maa_control_toggle) {
            return false
        }
        let sklUser = await this.check_skluser()
        if (!sklUser) {
            return true
        }
        let msg = `1.启动MAA，进入设置-远程控制`
        msg += `\n2.获取任务端点填写：${this.setting.maa_api_host}/maa/get_task`
        msg += `\n3.汇报任务端点填写：${this.setting.maa_api_host}/maa/report_task`
        msg += `\n4.用户标识符填写：${sklUser.uid} (为唯一标识符，无法与其他人共用)`
        msg += `\n5.发送指令【/MAA绑定设备】`
        await this.reply(msg)
    }

    async my_maa() {
        if (!this.setting.maa_control_toggle) {
            return false
        }
        let sklUser = await this.check_skluser()
        if (!sklUser) {
            return true
        }
        let maaConf = new MAAConf(this.e.user_id)
        await maaConf.getConf()
        let msg = `MAA配置信息：\nuser: ${maaConf.user}`
        if (maaConf.device) msg += `\ndevice: ${maaConf.device}`
        if (maaConf.maa_api) {
            let check_res = await maaConf.maa_api.check_user()
            msg += `\n设备校验状态: ${check_res ? '通过' : '未通过'}`
        }
        await this.e.reply(msg)
        return true
    }

    async maa_bind_device() {
        if (!this.setting.maa_control_toggle) {
            return false
        }
        let sklUser = await this.check_skluser()
        if (!sklUser) {
            return true
        }
        let maaConf = new MAAConf(this.e.user_id)
        await maaConf.getConf()
        let device = await maaConf.maa_api.get_device()
        if (!device) {
            await this.e.reply(`绑定MAA设备失败`)
            return true
        }
        await maaConf.setDevice(device)
        await this.e.reply(`绑定MAA设备成功\ndevice:${device}`)
        let msg = `MAA模块指令如下：`
        msg += `\n【/MAA】查询当前绑定情况`
        msg += `\n【/MAA+任务名称】下发任务`
        msg += `\n【/MAA设置关卡+关卡名】设置刷理智关卡）`
        msg += `\n【/MAA查询任务】查询已下发任务的状态`
        msg += `\n【/MAA清空任务】清空任务列表（不会停止MAA当前执行的任务）`
        msg += `\n【/MAA截图】立即进行截图并显示`
        msg += `\n【/MAA单抽 /MAA十连抽】让MAA帮你抽卡（是真的抽卡！）`
        await this.e.reply(msg)
        return true
    }

    async maa_set_task() {
        if (!this.setting.maa_control_toggle) {
            return false
        }
        let sklUser = await this.check_skluser()
        if (!sklUser) {
            return true
        }
        let maaConf = new MAAConf(this.e.user_id)
        await maaConf.getConf()
        if (!maaConf.device && maaConf.maa_api) {
            await this.e.reply(`未绑定设备，请使用 /MAA绑定设备 绑定后再使用`)
            return true
        }
        if (!await maaConf.maa_api.check_user()) {
            await this.e.reply(`device已失效，请重新绑定`)
            return true
        }
        let match = this.e.msg.match(/(一键长草|自动公招|刷理智|获取信用|基建换班|领取奖励|自动肉鸽|停止任务|开始唤醒)/g)
        logger.mark(`[MAA]匹配任务列表: ${match}`)
        if (!match) {
            return false
        }
        let tasks = []
        // 停止任务优先级大于其他，且互斥
        if (match.includes("停止任务")) {
            let task_item = { type: task_type_map["停止任务"] }
            tasks.push(task_item)
            // 一键长草为其他任务的全集，故跳过其他
        } else if (match.includes("一键长草")) {
            let task_item = { type: task_type_map["一键长草"] }
            tasks.push(task_item)
            // 其他任务
        } else {
            for (let task_name of match) {
                let task_item = { type: task_type_map[task_name] }
                tasks.push(task_item)
            }
        }
        let res_tasks = await maaConf.maa_api.set_task(tasks)
        if (res_tasks) {
            await this.e.reply(`MAA任务下发成功`)
            return true
        }
        await this.e.reply(`MAA任务下发失败，请检查日志`)
        return true

    }

    async maa_set_stage() {
        if (!this.setting.maa_control_toggle) {
            return false
        }
        let sklUser = await this.check_skluser()
        if (!sklUser) {
            return true
        }
        let maaConf = new MAAConf(this.e.user_id)
        await maaConf.getConf()
        if (!maaConf.device && maaConf.maa_api) {
            await this.e.reply(`未绑定设备，请使用 /MAA绑定设备 绑定后再使用`)
            return true
        }
        if (!await maaConf.maa_api.check_user()) {
            await this.e.reply(`device已失效，请重新绑定`)
            return true
        }
        let changed_msg = this.e.msg.replace(/#|\/|方舟|明日方舟|arknights|方舟插件|~|～|MAA|Maa|maa|设置关卡/g, "")
        changed_msg = changed_msg.replace(/^\s+|\s+$/g, "")
        if (changed_msg === "") {
            return false
        }
        let stage_name = changed_msg
        let tasks = []
        let task_item = {
            type: "Settings-Stage1",
            params: stage_name
        }
        tasks.push(task_item)

        let res_tasks = await maaConf.maa_api.set_task(tasks)
        if (res_tasks) {
            await this.e.reply(`MAA设置指令下发成功`)
            return true
        }
        await this.e.reply(`MAA设置指令下发失败，请检查日志`)
        return true

    }

    async maa_get_task() {
        if (!this.setting.maa_control_toggle) {
            return false
        }
        let sklUser = await this.check_skluser()
        if (!sklUser) {
            return true
        }
        let maaConf = new MAAConf(this.e.user_id)
        await maaConf.getConf()
        if (!maaConf.device && maaConf.maa_api) {
            await this.e.reply(`未绑定设备，请使用 /MAA绑定设备 绑定后再使用`)
            return true
        }
        if (!await maaConf.maa_api.check_user()) {
            await this.e.reply(`device已失效，请重新绑定`)
            return true
        }
        let res_tasks = await maaConf.maa_api.get_task()
        if (!res_tasks || res_tasks.length == 0) {
            await this.e.reply(`未获取到当前设备的任务信息`)
            return true
        }
        let msg = "当前运行任务："
        logger.debug(`任务响应 ${JSON.stringify(res_tasks)}`)
        for (let task_item of res_tasks) {
            let task_name = get_task_name(task_item.type)
            let task_status = task_item.status == "SUCCESS" ? "已完成" : "未完成"
            msg += `\n${task_name} - ${task_status}`
        }
        await this.e.reply(msg)
        return true
    }

    async maa_clear_task() {
        if (!this.setting.maa_control_toggle) {
            return false
        }
        let sklUser = await this.check_skluser()
        if (!sklUser) {
            return true
        }
        let maaConf = new MAAConf(this.e.user_id)
        await maaConf.getConf()
        if (!maaConf.device && maaConf.maa_api) {
            await this.e.reply(`未绑定设备，请使用 /MAA绑定设备 绑定后再使用`)
            return true
        }
        if (!await maaConf.maa_api.check_user()) {
            await this.e.reply(`device已失效，请重新绑定`)
            return true
        }
        let res_tasks = await maaConf.maa_api.set_task([])
        if (res_tasks && res_tasks.length == 0) {
            await this.e.reply(`MAA任务清空成功`)
            return true
        }
        await this.e.reply(`MAA任务清空失败，请检查日志`)
        return true
    }

    async maa_capture() {
        if (!this.setting.maa_control_toggle) {
            return false
        }
        let sklUser = await this.check_skluser()
        if (!sklUser) {
            return true
        }
        let maaConf = new MAAConf(this.e.user_id)
        await maaConf.getConf()
        if (!maaConf.device && maaConf.maa_api) {
            await this.e.reply(`未绑定设备，请使用 /MAA绑定设备 绑定后再使用`)
            return true
        }
        if (!await maaConf.maa_api.check_user()) {
            await this.e.reply(`device已失效，请重新绑定`)
            return true
        }
        let tasks = []
        let task_item = { type: task_type_map["截图"] }
        tasks.push(task_item)
        let res_tasks = await maaConf.maa_api.set_task(tasks)
        if (res_tasks) {
            await this.e.reply(`MAA任务下发成功`)
        } else {
            await this.e.reply(`MAA任务下发失败，请检查日志`)
            return true
        }
        let retries = 0;
        return new Promise(() => {
            const intervalId = setInterval(async () => {
                let result = await this.get_capture();

                if (result !== false) {
                    clearInterval(intervalId);
                    let msg = segment.image('base64://' + result)
                    await this.e.reply(msg)
                    await maaConf.maa_api.set_task([])
                    return true
                } else if (retries >= 6) {
                    clearInterval(intervalId);
                    await this.e.reply(`获取截图超时`)
                    return true
                }

                retries++;
            }, 5000);
        });
    }

    async maa_gacha() {
        if (!this.setting.maa_control_toggle) {
            return false
        }
        let sklUser = await this.check_skluser()
        if (!sklUser) {
            return true
        }
        let maaConf = new MAAConf(this.e.user_id)
        await maaConf.getConf()
        if (!maaConf.device && maaConf.maa_api) {
            await this.e.reply(`未绑定设备，请使用 /MAA绑定设备 绑定后再使用`)
            return true
        }
        if (!await maaConf.maa_api.check_user()) {
            await this.e.reply(`device已失效，请重新绑定`)
            return true
        }
        let tasks = []
        if (this.e.msg.includes('单抽') || this.e.msg.includes('抽卡')) {
            tasks.push({ type: task_type_map["单抽"] })
        }
        if (this.e.msg.includes('十连抽') || this.e.msg.includes('十连')) {
            logger.mark('MAA发布十连抽')
            tasks.push({ type: task_type_map["十连抽"] })
        }
        tasks.push({ type: 'CaptureImage' })

        let res_tasks = await maaConf.maa_api.set_task(tasks)
        if (res_tasks) {
            await this.e.reply(`MAA任务下发成功`)
        } else {
            await this.e.reply(`MAA任务下发失败，请检查日志`)
            return true
        }
        let retries = 0;
        return new Promise(() => {
            const intervalId = setInterval(async () => {
                let result = await this.get_capture();

                if (result !== false) {
                    clearInterval(intervalId);
                    let msg = segment.image('base64://' + result)
                    await this.e.reply(msg)
                    await maaConf.maa_api.set_task([])
                    return true
                } else if (retries >= 6) {
                    clearInterval(intervalId);
                    await this.e.reply(`获取截图超时`)
                    return true
                }

                retries++;
            }, 5000);
        });
    }

    async get_capture() {
        let sklUser = await this.check_skluser()
        if (!sklUser) {
            return false
        }
        let maaConf = new MAAConf(this.e.user_id)
        await maaConf.getConf()
        let res_tasks = await maaConf.maa_api.get_task()
        if (!res_tasks || res_tasks.length == 0) {
            return false
        }
        // logger.debug(`任务响应 ${JSON.stringify(res_tasks)}`)
        for (let task_item of res_tasks) {
            if ((task_item.type === 'CaptureImageNow' || task_item.type === 'CaptureImage') && task_item.status === "SUCCESS" && task_item.result) {
                return task_item.result
            }
        }
        return false
    }

}

