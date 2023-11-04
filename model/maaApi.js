import setting from '../utils/setting.js'

export default class MAAControlAPI{
    constructor(user, device) {
        this.user = user
        this.setting = setting.getConfig('maa')
        this.device = device
        this.maa_get_task_api = this.setting.maa_get_task_api
        this.maa_set_task_api = this.setting.maa_set_task_api
        this.maa_check_user_api = this.setting.maa_check_user_api
    }

    async request_maa_api(url, method, body={}, query='') {
        let req_url = url
        let param = {
            headers,
            timeout: 10000,
            method: method
        }
        if (body) {
            param.body = body
        } else {
            req_url +=`?${query}`
        }
        try {
            response = await fetch(url, param)
        } catch (error) {
            logger.error(error.toString())
            return false
        }
        if (!response.ok) {
            logger.error(`[MAA API][${this.user}] ${response.status} ${response.statusText}`)
            return false
        }
        const res = await response.json()
        return res
    }

    async check_user() {
        if (!this.maa_check_user_api) {
            logger.mark(`未获取到配置：maa_check_user_api`)
            return false
        }
        let query = `user=${this.user}&device=${this.device}`
        let res = await this.request_maa_api(this.maa_check_user_api, 'get', query=query)
        if (res && res.result) {
            return true
        }
        return false
    }


}