import SKLandUser from "./sklandUser.js"
import MAAControlAPI from "./maaApi.js"

export default class MAAConf{
    constructor (user_id) {
        this.user_id = user_id
        this.user = null
        this.device = null
        this.maa_api = null
    }

    async getConf() {
        const conf_text = await redis.get(`ARKNIGHTS:MAACONF:${this.user_id}`)
        if (!conf_text) {
            let sklUser = new SKLandUser(this.user_id)
            if (await sklUser.getUser()) {
                this.user = sklUser.uid
            }
            await this.updateConf()
            return false
        }
        let conf = JSON.parse(conf_text)
        this.user = conf.device
        this.device = conf.name
        if (this.user && this.device) {
            this.maa_api = new MAAControlAPI(this.user, this.device)
        }
        return true
    }

    async updateConf() {
        let cached_info = {
            user: this.user,
            davice: this.device
        }
        await redis.set(`ARKNIGHTS:MAACONF:${this.user_id}`, JSON.stringify(cached_info))
    }

    async setDevice(device) {
        this.device = device
        await this.updateConf()
    }
}