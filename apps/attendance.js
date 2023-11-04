import { rulePrefix } from '../utils/common.js'
import SKLandUser from '../model/sklandUser.js'
import setting from '../utils/setting.js'
import common from '../../../lib/common/common.js'


export class SKLandAttendance extends plugin {
	constructor() {
		super({
			name: '[arknights-plugin]签到',
			dsc: '森空岛签到',
			event: 'message',
			priority: 50,
			rule: [
				{
					reg: `^${rulePrefix}签到$`,
					fnc: 'attendance'
				},
                {
                    reg: `^${rulePrefix}(全部签到|签到任务)$`,
                    permission: 'master',
                    fnc: 'attendance_task'
                },
			]
		})
        this.setting = setting.getConfig('sign')

        this.task = {
            cron: this.setting.auto_sign_cron,
            name: '森空岛签到任务',
            fnc: () => this.attendance_task()
          }
        this.bindUser = {}
	}

    async attendance() {
        let sklUser = new SKLandUser(this.e.user_id)
        if(!await sklUser.getUser()) {
            await this.reply('未绑定森空岛cred，请先绑定后再使用功能。可发送 #cred帮助 查看获取方法')
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

    async attendance_task() {
        let is_manual = !!this?.e?.msg
        let keys = await redis.keys(`ARKNIGHTS:USER:*`)
        let success_count = 0
        let signed_count = 0
        let fail_count = 0

        logger.mark(`[方舟插件][签到任务]签到任务开始`)
        if (is_manual){
            await this.e.reply('签到任务开始')

        }

        for (let key of keys) {
            let user_id = key.replace(/ARKNIGHTS:USER:/g, '');
            let sklUser = new SKLandUser(user_id)
            await common.sleep(2000)
            if(!await sklUser.getUser()) {
                logger.mark(`[方舟插件][签到任务]${user_id} cred校验失效`)
                fail_count += 1
                continue
            }

            let res = await sklUser.sklReq.getData('attendance')
            if (res?.code === 0) {
                logger.mark(`[方舟插件][签到任务]${user_id} 签到成功`)
                success_count += 1
            } else if (res?.code === 10001) {
                logger.mark(`[方舟插件][签到任务]${user_id} 该用户已签到`)
                signed_count += 1
                continue
            } else {
                logger.mark(`[方舟插件][签到任务]${user_id} 签到失败`)
                fail_count += 1
                continue
            }
        }
        logger.mark(`[方舟插件][签到任务]任务完成：${keys.length}个\n已签：${signed_count}个\n成功：${success_count}个\n失败：${fail_count}个`)
        if (is_manual){
            let msg = `森空岛签到任务完成：${keys.length}个\n已签：${signed_count}个\n成功：${success_count}个\n失败：${fail_count}个`
            await this.e.reply(msg)

        }
        return true
    }
}