import lodash from 'lodash'
import fs from 'fs'
import { Cfg, Version, Common, Data } from '../components/index.js'
import { rulePrefix } from '../utils/common.js'
import SKLandRequest from '../model/sklandReq.js'
import SKLandUser from '../model/sklandUser.js'
import setting from '../utils/setting.js'


export class SKLandUid extends plugin {
    constructor() {
        super({
            name: '[arknights-plugin]绑定相关',
            dsc: '森空岛账号信息管理',
            event: 'message',
            priority: 100,
            rule: [
                {
                    reg: `^${rulePrefix}绑定$`,
                    fnc: 'bindSKland'
                },
                {
                    reg: `^${rulePrefix}信息$`,
                    fnc: 'getUserInfo'
                },
                {
                    reg: `^${rulePrefix}我的cred$`,
                    fnc: 'myCred'
                },
                {
                    reg: `^${rulePrefix}删除cred$`,
                    fnc: 'delCred'
                },
                {
                    reg: `^${rulePrefix}cred帮助$`,
                    fnc: 'credHelp'
                }
            ]
        })
        this.help_setting = setting.getConfig('help')
        this.bindUser = {}
    }

    async getUserInfo() {
        let sklUser = new SKLandUser(this.e.user_id)
        if (!await sklUser.getUser()) {
            await this.reply('未绑定森空岛cred，请先绑定后再使用功能。可发送 /cred帮助 查看获取方法')
            return true
        }
        await sklUser.updateUser()
        let res = await sklUser.sklReq.getData('user_info')
        if (res?.code === 0 && res?.message === 'OK') {
            let skl_user_info = res.data.user
            let game_user_info = res.data.gameStatus
            await this.reply(`森空岛昵称:${skl_user_info.nickname}\n游戏昵称:${game_user_info.name}\n游戏等级:${game_user_info.level}\n干员数量:${game_user_info.charCnt}\n家具数量:${game_user_info.furnitureCnt}\n皮肤数量:${game_user_info.skinCnt}`)
        } else {
            logger.mark(`user info失败，响应:${JSON.stringify(res)}`)
            await this.reply(`查询失败，请检查cred或稍后再试`)
        }
        return true
    }


    async bindSKland() {
        if (this.e.isGroup) {
            await this.reply('请私聊绑定')
            return
        }
        await this.reply(`请发送森空岛cred`)
        this.setContext('receiveCred')
    }

    async receiveCred() {
        if (this.e.isGroup) {
            return
        }
        logger.mark(JSON.stringify(this.e.message))
        let skl_cred = this.e.message[0].text
        await this.reply(`cred: ${skl_cred}，校验中...`)
        await this.checkCred(skl_cred)
        this.finish('receiveCred')
    }

    async checkCred(cred) {
        let sklReq = new SKLandRequest(0, cred)
        let res = await sklReq.getData('user_info')
        logger.mark(JSON.stringify(res))
        if (res?.code == 0 && res?.message === 'OK') {
            let skl_user_info = res.data.user
            let game_user_info = res.data.gameStatus
            let user = this.e.user_id
            let cached_info = {
                cred: cred,
                skl_name: skl_user_info.nickname,
                name: game_user_info.name,
                uid: game_user_info.uid
            }
            await redis.set(`ARKNIGHTS:USER:${user}`, JSON.stringify(cached_info))
            await this.reply(`获取信息成功!\n森空岛昵称:${skl_user_info.nickname}\n游戏昵称:${game_user_info.name}\n游戏等级:${game_user_info.level}`)
        } else {
            logger.mark(`绑定失败，响应:${JSON.stringify(res)}`)
            await this.reply(`绑定失败，请检查cred`)
        }
    }

    async myCred() {
        if (this.e.isGroup) {
            await this.reply('请私聊操作')
            return
        }

        let sklUser = new SKLandUser(this.e.user_id)
        if (!await sklUser.getUser()) {
            await this.reply('未绑定森空岛cred，请先绑定后再使用功能。可发送 /cred帮助 查看获取方法')
            return true
        }
        await this.reply(sklUser.cred)
    }

    async delCred() {
        if (this.e.isGroup) {
            await this.reply('请私聊操作')
            return
        }

        let sklUser = new SKLandUser(this.e.user_id)
        if (!await sklUser.getUser()) {
            await this.reply('未绑定森空岛cred，请先绑定后再使用功能。可发送 /cred帮助 查看获取方法')
            return true
        }
        await redis.del(`ARKNIGHTS:USER:${this.e.user_id}`)
        await this.reply('删除成功')
        return true
    }

    async credHelp() {
        if (!this.help_setting?.cred_help_doc) {
            logger.mark(`未配置cred帮助文档`)
        }
        let msg = `森空岛cred获取帮助：${this.help_setting.cred_help_doc}`
        await this.reply(msg)
    }


}