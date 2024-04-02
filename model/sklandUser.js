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
            logger.mark(`账号已绑定token，使用token更新cred`)
            await this.updateCredByToken()
        }
        return true
    }

    async updateCredByToken() {
        if (!this.token || this.token == '') {
            return null
        }
        let new_cred = await hypergryphAPI.getCredByToken(this.token)
        if (new_cred) {
            this.cred = new_cred
        }
        return true
    }

    async updateUser() {
        if (this.token) {
            logger.mark(`账号已绑定token，使用token更新cred`)
            await this.updateCredByToken()
        }
        let res = await this.sklReq.getData('user_info')
        if (res?.code == 0 && res?.message === 'OK') {
            let skl_user_info = res.data.user
            let game_user_info = res.data.gameStatus
            this.uid = game_user_info.uid
            this.name = game_user_info.name

            let cached_info = {
                cred: this.cred,
                skl_name: skl_user_info.nickname,
                name: this.name,
                uid: this.uid,
                token: this.token
            }
            await redis.set(`ARKNIGHTS:USER:${this.user_id}`, JSON.stringify(cached_info))
        } else {
            logger.mark(`cred已失效, uid:${this.uid}`)
        }
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