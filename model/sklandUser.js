import moment from "moment";
import sklandApi from "./sklandApi.js"
import SKLandRequest from "./sklandReq.js"
import hypergryphAPI from "./hypergryphApi.js"

export default class SKLandUser {
    constructor(user_id, option = {}) {
        this.user_id = user_id
        this.uid = 0
        this.cred = ''
        this.token = null
        this.name = ''
        this.level = 1
        this.sklReq = null

        this.option = {
            log: true,
            ...option
        }
    }

    async getUser() {
        const user_info_text = await redis.get(`ARKNIGHTS:USER:${this.user_id}`)
        if (!user_info_text) return false
        let user_info = JSON.parse(user_info_text)
        this.cred = user_info.cred
        this.name = user_info.name
        this.uid = user_info.uid
        this.token = user_info?.token || null
        this.sklReq = new SKLandRequest(this.uid, this.cred)

        if (this.token) {
            const is_used_today = await redis.get(`ARKNIGHTS:OAUTH_TOKEN_USED:${this.user_id}`)
            if (!is_used_today) {
                logger.mark(`账号已绑定token，使用token更新cred`)
                await this.updateCredByToken()
                // 当前时间
                let time = moment(Date.now())
                    .add(1, "days")
                    .format("YYYY-MM-DD 00:00:00");
                // 到明日零点的剩余秒数
                let exTime = Math.round(
                    (new Date(time).getTime() - new Date().getTime()) / 1000
                );
                await redis.set(`ARKNIGHTS:OAUTH_TOKEN_USED:${this.user_id}`, 'used', { EX: exTime})
            }
        }
        return true
    }

    async updateCredByToken() {
        if (!this.token || this.token == '') {
            return null
        }
        let new_cred = await hypergryphAPI.getCredByToken(this.token)
        if (new_cred) {
            logger.mark(`刷新cred成功`)
            this.cred = new_cred
            await this.saveUser()
            return true
        }
    }

    async updateUser() {
        if (this.token) {
            logger.mark(`账号已绑定token，使用token更新cred`)
            await this.updateCredByToken()
        }
        // let res = await this.sklReq.getData('user_info')
        let res = await sklReq.getData('binding')
        if (res?.code == 0 && res?.message === 'OK') {
            let bindingList = res.data.list
            for (let bindingItem of bindingList) {
                if (bindingItem.appCode === 'arknights') {
                    let gameNickname = bindingItem.bindingList[0].nickName
                    let gameUid = bindingItem.defaultUid
                    let gameChannel = bindingItem.bindingList[0].channelName
                    this.uid = gameUid
                    this.name = gameNickname
                    await this.saveUser()
                    return true
                }
            }
            logger.mark(`获取角色信息失败，列表未找到明日方舟信息`)
            return false
        } else {
            logger.mark(`cred已失效, uid:${this.uid}`)
            return false
        }
    }

    async saveUser() {
        let cached_info = {
            cred: this.cred,
            // skl_name: skl_user_info.nickname,
            name: this.name,
            uid: this.uid,
            token: this.token
        }
        await redis.set(`ARKNIGHTS:USER:${this.user_id}`, JSON.stringify(cached_info))
    }

    async getGamePlayerInfo() {
        const cached_game_info = await redis.get(`ARKNIGHTS:GAMEPLAYERINFO:${this.user_id}`)
        if (cached_game_info) {
            logger.mark(`[方舟插件][GameInfo]使用${this.user_id}的缓存数据`)
            return JSON.parse(cached_game_info)
        }
        let res = await this.sklReq.getData('game_player_info')
        if (res?.code == 0 && res?.message === 'OK') {
            await redis.set(`ARKNIGHTS:GAMEPLAYERINFO:${this.user_id}`, JSON.stringify(res), { EX: 300 })
            return res
        } else {
            return null
        }
    }
}