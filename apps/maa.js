import { rulePrefix } from '../utils/common.js'
import SKLandUser from '../model/sklandUser.js'
import MAAConf from '../model/maaConf.js'
import setting from '../utils/setting.js'
import common from '../../../lib/common/common.js'


export class MAAControl extends plugin {
	constructor() {
		super({
			name: '[arknights-plugin]MAA远程控制',
			dsc: 'MAA远程控制',
			event: 'message',
			priority: 50,
			rule: [
				{
					reg: `^${rulePrefix}MAA帮助$`,
					fnc: 'maa_help'
				},
                {
					reg: `^${rulePrefix}我的MAA$`,
					fnc: 'my_maa'
				},
                {
					reg: `^${rulePrefix}MAA绑定设备(.+)$`,
					fnc: 'maa_bind_device'
				},
                {
					reg: `^${rulePrefix}MAA发布任务$`,
					fnc: 'maa_set_task'
				},
                {
					reg: `^${rulePrefix}MAA查询任务$`,
					fnc: 'maa_get_task'
				},
                {
					reg: `^${rulePrefix}MAA清空任务$`,
					fnc: 'maa_clear_task'
				},

			]
		})
        this.setting = setting.getConfig('maa')
        this.bindUser = {}
	}

    async check_skluser() {
        let sklUser = new SKLandUser(this.e.user_id)
        if(!await sklUser.getUser()) {
            await this.reply('未绑定森空岛cred，请先绑定后再使用功能。可发送 #cred帮助 查看获取方法')
            return false
        }
        return sklUser
    }

    async maa_help() {
        let sklUser = await this.check_skluser()
        if (!sklUser) {
            return true
        }
    }

    async my_maa() {
        let sklUser = await this.check_skluser()
        if (!sklUser) {
            return true
        }
        let maaConf = new MAAConf(this.e.user_id)
        await maaConf.getConf()
        let msg = `MAA配置信息：\nuser: ${maaConf.user}`
        if (maaConf.device) msg += `\ndevice: ${maaConf.device}`
        if (maaConf.maa_api) {
            let check_res = maaConf.maa_api.check_user()
            msg += `\n校验状态: ${check_res ? '通过': '未通过'}`
        }
        await this.reply(msg)
        return true
    }

    async maa_bind_device() {
        let sklUser = await this.check_skluser()
        if (!sklUser) {
            return true
        }
        let received_msg = this.e.msg
        let match = `^${rulePrefix}MAA绑定设备(.+)$`.exec(received_msg)
        if (match) {
            logger.mark(`match: ${match[1]}`)
            let maaConf = new MAAConf(this.e.user_id)
            await maaConf.setDevice(match[1])
            await this.e.reply(`绑定MAA设备成功，设备:${match[1]}`)
            return true
        }
        await this.e.reply(`绑定MAA设备失败`)
        return true
    }

    async maa_set_task() {
        let sklUser = await this.check_skluser()
        if (!sklUser) {
            return true
        }
    }

    async maa_get_task() {
        let sklUser = await this.check_skluser()
        if (!sklUser) {
            return true
        }
    }

    async maa_clear_task() {
        let sklUser = await this.check_skluser()
        if (!sklUser) {
            return true
        }
    }

}

