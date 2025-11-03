import lodash from 'lodash'
import fs from 'fs'
import QRCode from 'qrcode'
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
                    reg: `^${rulePrefix}扫码绑定$`,
                    fnc: 'scanQRBind'
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
        let sklReq = new SKLandRequest(0, sklUser.cred, sklUser.token)
        await sklReq.refreshToken()
        let res = await sklReq.getData('binding')
        logger.mark(`binding res: ${JSON.stringify(res)}`)
        if (res?.code == 0 && res?.message === 'OK') {
            let bindingList = res.data.list
            for (let bindingItem of bindingList) {
                if (bindingItem.appCode === 'arknights') {
                    let gameNickname = bindingItem.bindingList[0].nickName
                    let gameUid = bindingItem.bindingList[0].uid
                    let gameChannel = bindingItem.bindingList[0].channelName
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
                    if (!gameUid) {
                        gameUid = bindingItem.bindingList[0].uid
                    }
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
        if (cred === "405") {
            await this.reply(`当前服务无法使用token登录，请尝试使用cred`)
            return true
        }
        if (!cred) {
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
        let msg = `森空岛cred获取帮助：${this.help_setting.cred_help_doc}\n获取后请私聊bot，发送"/绑定"（或"~绑定"）完成绑定`
        await this.reply(msg)
    }

    /**
     * 扫码绑定森空岛账号
     */
    async scanQRBind() {
        // if (this.e.isGroup) {
        //     await this.reply('请私聊进行扫码绑定')
        //     return
        // }

        await this.reply('正在生成二维码，请稍候...')

        // 获取 scanId
        let scanId = await hypergryphAPI.getScanId()
        if (!scanId) {
            await this.reply('获取二维码失败，请稍后重试')
            return
        }

        // 生成二维码 URL
        let scanUrl = `hypergryph://scan_login?scanId=${scanId}`
        logger.mark(`扫码URL: ${scanUrl}`)

        try {
            // 生成二维码图片
            let qrCodeBuffer = await QRCode.toBuffer(scanUrl, {
                width: 300,
                margin: 2,
                errorCorrectionLevel: 'M'
            })

            // 发送二维码和提示信息
            let msg = [
                '请使用森空岛APP扫描二维码进行绑定,二维码有效时间为2分钟。\n⚠️ 请不要扫描他人的登录二维码！',
                segment.image(qrCodeBuffer)
            ]
            await this.reply(msg)

            // 轮询检查扫码状态（最多100秒，每2秒检查一次）
            let maxAttempts = 50
            let scanCode = null

            for (let i = 0; i < maxAttempts; i++) {
                // 等待2秒
                await this.sleep(2000)

                scanCode = await hypergryphAPI.getScanStatus(scanId)
                if (scanCode) {
                    logger.mark(`用户已扫码，scanCode: ${scanCode}`)
                    break
                }
            }

            if (!scanCode) {
                await this.reply('二维码已超时，请重新获取并扫码')
                return
            }

            // 通过 scanCode 获取 token
            await this.reply('检测到扫码，正在获取信息...')
            let token = await hypergryphAPI.getTokenByScanCode(scanCode)
            if (!token) {
                await this.reply('获取token失败，请重试')
                return
            }

            // 使用 token 获取 cred 并绑定
            let cred = await hypergryphAPI.getCredByToken(token)
            if (cred === "405") {
                await this.reply(`当前服务无法使用token登录，请尝试使用cred`)
                return
            }
            if (!cred) {
                await this.reply(`绑定失败，无法获取cred`)
                return
            }

            // 验证并保存绑定信息
            await this.checkCred(cred, token)

        } catch (error) {
            logger.error(`扫码绑定出错: ${error}`)
            await this.reply('扫码绑定过程出现错误，请稍后重试')
        }
    }

    /**
     * 休眠指定毫秒数
     * @param {number} ms - 毫秒数
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms))
    }


}