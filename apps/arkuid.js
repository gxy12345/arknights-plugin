import lodash from 'lodash'
import fs from 'fs'
import { Cfg, Version, Common, Data } from '../components/index.js'
import { rulePrefix } from '../utils/common.js'
import hypergryphAPI from '../model/hypergryphApi.js'
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
                    reg: `^${rulePrefix}我的token$`,
                    fnc: 'myToken'
                },
                {
                    reg: `^${rulePrefix}删除(cred|token)$`,
                    fnc: 'delCred'
                },
                {
                    reg: `^${rulePrefix}刷新cred$`,
                    fnc: 'refreshCred'
                },
                {
                    reg: `^${rulePrefix}(token|cred|绑定)帮助$`,
                    fnc: 'credHelp'
                }
            ]
        })
        this.help_setting = setting.getConfig('help')
    }

    async getUserInfo() {
        let sklUser = new SKLandUser(this.e.user_id)
        if (!await sklUser.getUser()) {
            await this.reply('未绑定森空岛cred，请先绑定后再使用功能。可发送 /cred帮助 查看获取方法')
            return true
        }
        await sklUser.updateUser()
        let res = await sklReq.getData('binding')
        logger.mark(`binding res: ${JSON.stringify(res)}`)
        if (res?.code == 0 && res?.message === 'OK') {
            let bindingList = res.data.list
            for (let bindingItem of bindingList) {
                if (bindingItem.appCode === 'arknights') {
                    let gameNickname = bindingItem.bindingList[0].nickName
                    let gameUid = bindingItem.defaultUid
                    let gameChannel = bindingItem.bindingList[0].channelName
                    let cached_info = {
                        cred: cred,
                        name: gameNickname,
                        uid: gameUid
                    }
                    if (used_token) {
                        cached_info.token = used_token
                    }
                    await redis.set(`ARKNIGHTS:USER:${user}`, JSON.stringify(cached_info))
                    await this.reply(`游戏昵称:${gameNickname}\n服务器:${gameChannel}\nUID:${gameUid}`)
                    return true
                }
            }
            await this.reply(`未找到明日方舟的绑定信息`)
            return false

        } else {
            await this.reply(`查询信息失败，请检查cred`)
            return false
        }
    }


    async bindSKland() {
        if (this.e.isGroup) {
            await this.reply('请私聊绑定')
            return
        }
        await this.reply(`请发送森空岛cred(SK_OAUTH_CRED_KEY)或token`)
        this.setContext('receiveCred')
    }

    async receiveCred() {
        if (this.e.isGroup) {
            return
        }
        logger.debug(JSON.stringify(this.e.message))
        let received_msg = this.e.message[0].text
        // token
        if (received_msg.length == 24) {
            await this.reply(`token: ${received_msg}, 校验中...`)
            await this.checkToken(received_msg)
            this.finish('receiveCred')
        } else if (received_msg.length == 32) {
            await this.reply(`cred: ${received_msg}, 校验中...`)
            await this.checkCred(received_msg)
            this.finish('receiveCred')
        } else {
            await this.reply(`请发送有效的token或cred，获取方式可以发送【~cred帮助】查看`)
            this.finish('receiveCred')
        }
    }

    async checkCred(cred, used_token=null) {
        let sklReq = new SKLandRequest(0, cred, '')
        await sklReq.refreshToken()
        // let res = await sklReq.getData('user_info')
        let res = await sklReq.getData('binding')
        logger.debug(`binding res: ${JSON.stringify(res)}`)
        if (res?.code == 0 && res?.message === 'OK') {
            let bindingList = res.data.list
            let user = this.e.user_id
            for (let bindingItem of bindingList) {
                if (bindingItem.appCode === 'arknights') {
                    let gameNickname = bindingItem.bindingList[0].nickName
                    let gameUid = bindingItem.defaultUid
                    let gameChannel = bindingItem.bindingList[0].channelName
                    let cached_info = {
                        cred: cred,
                        name: gameNickname,
                        uid: gameUid
                    }
                    if (used_token) {
                        cached_info.token = used_token
                    }
                    await redis.set(`ARKNIGHTS:USER:${user}`, JSON.stringify(cached_info))
                    await this.reply(`获取信息成功!\n游戏昵称:${gameNickname}\n服务器:${gameChannel}\nUID:${gameUid}`)
                    return true
                }
            }
            await this.reply(`未找到明日方舟的绑定信息`)
            return false

        } else {
            logger.mark(`绑定失败，响应:${JSON.stringify(res)}`)
            await this.reply(`绑定失败，请检查cred`)
            return false
        }
    }

    async checkToken(token) {
        let cred = await hypergryphAPI.getCredByToken(token)
        if (!cred) {
            if (cred === "405") {
                await this.reply(`当前服务无法使用token登录，请尝试使用cred`)
                return true
            }
            logger.debug(`new cred：${cred}`)
            await this.reply(`绑定失败，请检查token`)
            return true
        }
        await this.checkCred(cred, token)
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

    async myToken() {
        if (this.e.isGroup) {
            await this.reply('请私聊操作')
            return
        }

        let sklUser = new SKLandUser(this.e.user_id)
        if (!await sklUser.getUser()) {
            await this.reply('未绑定森空岛cred，请先绑定后再使用功能。可发送 /cred帮助 查看获取方法')
            return true
        }
        if (sklUser.token){
            await this.reply(sklUser.token)
        }
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

    async refreshCred() {
        let sklUser = new SKLandUser(this.e.user_id)
        await sklUser.getUser()
        if (!sklUser.token) {
            await this.reply('未绑定token，无法使用此功能')
            return true
        }
        let refresh_result = await sklUser.updateUser()
        if (refresh_result) {
            await this.reply('刷新cred成功')
        } else {
            await this.reply('刷新cred失败')
        }
    }

    async credHelp() {
        if (!this.help_setting?.cred_help_doc) {
            logger.mark(`未配置cred帮助文档`)
        }
        let msg = `森空岛cred获取帮助：${this.help_setting.cred_help_doc}\n获取后请私聊bot，发送"/绑定（~绑定）完成绑定"`
        await this.reply(msg)
    }


}