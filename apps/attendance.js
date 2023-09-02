import { rulePrefix } from '../utils/common.js'
import SKLandUser from '../model/sklandUser.js'

export class SKLandAttendance extends plugin {
	constructor() {
		super({
			name: '[arknights-plugin]签到',
			dsc: '森空岛签到',
			event: 'message',
			priority: 100,
			rule: [
				{
					reg: `^${rulePrefix}签到$`,
					fnc: 'attendance'
				}
			]
		})
        this.bindUser = {}
	}

    async attendance() {
        let sklUser = new SKLandUser(this.e.user_id)
        if(!await sklUser.getUser()) {
            await this.reply('未绑定森空岛cred，请先绑定后再使用功能')
            return true
        }

        let res = await sklUser.sklReq.getData('attendance')
        if (res?.code === 0) {
            logger.mark(JSON.stringify(res))
            let awards = res.data.awards
            let reply_msg = `签到完成！此次签到获得了:`
            for (let resource of awards) {
                reply_msg += `\n${resource.resource.name} * ${resource.count}`
            }
            await this.reply(reply_msg)
        } else if (res?.code === 10001) {
            await this.reply(`今天已经签到过了`)
        } else {
            logger.mark(`请求失败，响应:${JSON.stringify(res)}`)
            await this.reply(`请求失败，请检查森空岛cred或稍后再试`)
        }
        return true
    }
}