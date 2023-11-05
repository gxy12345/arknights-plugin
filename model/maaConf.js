import SKLandUser from "./sklandUser.js"
import MAAControlAPI from "./maaApi.js"

export default class MAAConf {
    constructor(user_id, option = {}) {
        this.user_id = user_id
        this.user = null
        this.device = null
        this.maa_api = null

        this.option = {
            log: true,
            ...option
        }
    }

    async getConf() {
        const conf_text = await redis.get(`ARKNIGHTS:MAACONF:${this.user_id}`)

        if (!conf_text) {
            logger.mark(`新增MAA conf`)
            let sklUser = new SKLandUser(this.user_id)
            await sklUser.getUser()
            this.user = sklUser.uid
            this.maa_api = new MAAControlAPI(this.user, this.device)
            await this.updateConf()
            return false
        }
        logger.mark(`现有MAA conf ${conf_text}`)
        let conf = JSON.parse(conf_text)
        this.user = conf.user
        this.device = conf.device
        if (this.user) {
            this.maa_api = new MAAControlAPI(this.user, this.device)
        }
        await this.updateConf()
        return true
    }

    async updateConf() {
        let cached_info = {
            user: this.user,
            device: this.device
        }
        await redis.set(`ARKNIGHTS:MAACONF:${this.user_id}`, JSON.stringify(cached_info))
    }

    async setDevice(device) {
        this.device = device
        this.maa_api = new MAAControlAPI(this.user, this.device)
        await this.updateConf()
    }
}