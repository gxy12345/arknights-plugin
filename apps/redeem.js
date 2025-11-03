import { rulePrefix } from '../utils/common.js'
import SKLandUser from '../model/sklandUser.js'
import hypergryphAPI from '../model/hypergryphApi.js'

export class Redeem extends plugin {
    constructor() {
        super({
            name: '[arknights-plugin]兑换码',
            dsc: '明日方舟兑换码兑换',
            event: 'message',
            priority: 100,
            rule: [
                {
                    reg: `^${rulePrefix}(?:兑换码|CDK|cdk)(?:使用)?\\s*(.+)$`,
                    fnc: 'redeemGiftCode'
                }
            ]
        })
    }

    async redeemGiftCode() {
        let uid = this.e.user_id
        let sklUser = new SKLandUser(uid)
        
        if (!await sklUser.getUser()) {
            await this.reply('未绑定森空岛cred，请先绑定后再使用功能。可发送 /cred帮助 查看获取方法')
            return true
        }

        // 检查是否有token（兑换码功能需要token）
        if (!sklUser.token) {
            await this.reply('兑换码功能需要绑定token，请发送 /绑定 并使用token进行绑定, 或是使用 /扫码绑定 进行绑定')
            return true
        }

        // 提取兑换码 - 从原始消息中直接提取，避免 rulePrefix 中的捕获组影响索引
        const msg = this.e.msg.trim()
        
        // 移除前缀部分（兑换码|CDK|cdk）和可选的"使用"字，获取剩余部分
        const giftCodeMatch = msg.match(/(?:兑换码|CDK|cdk)(?:使用)?\s*(.+)$/i)
        if (!giftCodeMatch || !giftCodeMatch[1]) {
            await this.reply('请提供兑换码，格式: /兑换码 ABCD12345678ABCD')
            return true
        }

        // 去除兑换码中的所有空格
        let giftCode = giftCodeMatch[1].trim().replace(/\s+/g, '')

        // 验证兑换码长度
        if (giftCode.length !== 16) {
            await this.reply(`兑换码长度应为16位，您输入的长度为${giftCode.length}位`)
            return true
        }

        // 验证兑换码格式（只允许字母和数字）
        if (!/^[A-Za-z0-9]+$/.test(giftCode)) {
            await this.reply('兑换码格式错误，只能包含字母和数字')
            return true
        }

        await this.reply('正在兑换兑换码，请稍候...')

        try {
            // 获取grant_code
            const grantCode = await hypergryphAPI.getGrantCode(sklUser.token)
            if (!grantCode) {
                await this.reply('获取授权码失败，请重新绑定token')
                return true
            }

            // 获取role_token
            const roleToken = await hypergryphAPI.getRoleToken(sklUser.uid, grantCode)
            if (!roleToken) {
                await this.reply('获取角色令牌失败')
                return true
            }

            // 获取ak_cookie
            const akCookie = await hypergryphAPI.getAkCookie(roleToken)
            if (!akCookie) {
                await this.reply('获取cookie失败')
                return true
            }

            // 兑换礼包码
            const result = await hypergryphAPI.exchangeGiftCode(giftCode, sklUser.token, roleToken, akCookie)
            
            if (result.success) {
                await this.reply(`兑换结果:${result.msg}`)
            } else {
                await this.reply(`兑换失败,${result.msg}`)
            }

        } catch (error) {
            logger.error(`兑换码兑换失败: ${error}`)
            await this.reply(`兑换失败: ${error.message}`)
        }

        return true
    }
}

