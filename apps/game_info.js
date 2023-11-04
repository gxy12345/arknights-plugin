import moment from 'moment'
import { rulePrefix } from '../utils/common.js'
import SKLandUser from '../model/sklandUser.js'

export class SKLandGameInfo extends plugin {
	constructor() {
		super({
			name: '[arknights-plugin]游戏信息查询',
			dsc: '森空岛游戏信息查询',
			event: 'message',
			priority: 100,
			rule: [
				{
					reg: `^${rulePrefix}理智$`,
					fnc: 'ap'
				},
                // {
				// 	reg: `^${rulePrefix}基建$`,
				// 	fnc: 'building'
				// },
                // {
				// 	reg: `^${rulePrefix}公招$`,
				// 	fnc: 'recruit'
				// },
                {
					reg: `^${rulePrefix}剿灭$`,
					fnc: 'campaign'
				},
                {
					reg: `^${rulePrefix}(日常|周常)$`,
					fnc: 'routine'
				},
			]
		})
        this.bindUser = {}
	}

    async ap() {
        let sklUser = new SKLandUser(this.e.user_id)
        if(!await sklUser.getUser()) {
            await this.reply('未绑定森空岛cred，请先绑定后再使用功能。可发送 #cred帮助 查看获取方法')
            return true
        }

        let res = await sklUser.sklReq.getData('game_player_info')
        if (res?.code === 0 && res?.message === 'OK') {
            let ap_status = res.data.status.ap
            let revovery_time = ap_status.completeRecoveryTime > 0 ?  moment.unix(ap_status.completeRecoveryTime).format('YYYY-MM-DD HH:mm') : '-'
            
            await this.reply(`理智: ${ap_status.current}/${ap_status.max}\n预计恢复时间: ${revovery_time}`)
        } else {
            logger.mark(`user info失败，响应:${JSON.stringify(res)}`)
            await this.reply(`查询失败，请检查cred或稍后再试`)
        }
        return true

    }

    async building() {
        let sklUser = new SKLandUser(this.e.user_id)
        if(!await sklUser.getUser()) {
            await this.reply('未绑定森空岛cred，请先绑定后再使用功能。可发送 #cred帮助 查看获取方法')
            return true
        }

    }

    async recruit() {
        let sklUser = new SKLandUser(this.e.user_id)
        if(!await sklUser.getUser()) {
            await this.reply('未绑定森空岛cred，请先绑定后再使用功能。可发送 #cred帮助 查看获取方法')
            return true
        }

    }

    async campaign() {
        let sklUser = new SKLandUser(this.e.user_id)
        if(!await sklUser.getUser()) {
            await this.reply('未绑定森空岛cred，请先绑定后再使用功能。可发送 #cred帮助 查看获取方法')
            return true
        }

        let res = await sklUser.sklReq.getData('game_player_info')
        if (res?.code === 0 && res?.message === 'OK') {
            let campaign_status = res.data.campaign
            
            await this.reply(`本周剿灭合成玉: ${campaign_status.reward.current}/${campaign_status.reward.total}`)
        } else {
            logger.mark(`user info失败，响应:${JSON.stringify(res)}`)
            await this.reply(`查询失败，请检查cred或稍后再试`)
        }
        return true
    }

    async routine() {
        let sklUser = new SKLandUser(this.e.user_id)
        if(!await sklUser.getUser()) {
            await this.reply('未绑定森空岛cred，请先绑定后再使用功能。可发送 #cred帮助 查看获取方法')
            return true
        }

        let res = await sklUser.sklReq.getData('game_player_info')
        if (res?.code === 0 && res?.message === 'OK') {
            let routine_status = res.data.routine
            
            await this.reply(`日常/周常完成情况:\n每日任务：${routine_status.daily.current}/${routine_status.daily.total}\n每周任务：${routine_status.weekly.current}/${routine_status.weekly.total}\n`)
        } else {
            logger.mark(`user info失败，响应:${JSON.stringify(res)}`)
            await this.reply(`查询失败，请检查cred或稍后再试`)
        }
        return true

    }
}