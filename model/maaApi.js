import setting from '../utils/setting.js'

export default class MAAControlAPI {
    constructor(user, device, option = {}) {
        this.user = user
        this.setting = setting.getConfig('maa')
        this.device = device
        this.maa_api_host = this.setting.maa_api_host

        this.option = {
            log: true,
            ...option
        }
    }

    async request_maa_api(url, method, body = {}, query = '') {
        let req_url = url
        let param = {
            timeout: 25000,
            method: method,
        }
        if (body && method == 'post') {
            param.body = JSON.stringify(body)
            param.headers = { 'Content-Type': 'application/json' }

        } else {
            req_url += `?${query}`
        }
        let response = {}
        logger.mark(`[MAA API]请求接口-${method}:${req_url}`)
        try {
            response = await fetch(req_url, param)
        } catch (error) {
            logger.error(error.toString())
            return false
        }
        if (!response.ok) {
            logger.error(`[MAA API][${this.user}] ${response.status} ${response.statusText}`)
            if (response.status == 422) {
                const error_res = await response.json()
                logger.mark(`[MAA API][参数错误][${this.user}] ${JSON.stringify(error_res)}`)
            }
            return false
        }
        const res = await response.json()
        logger.mark(`[MAA API]请求接口响应:${JSON.stringify(res)}`)
        return res
    }

    async check_user() {
        if (!this.maa_api_host) {
            logger.mark(`未获取到配置:maa_api_host`)
            return false
        }
        let query = `user=${this.user}&device=${this.device}`
        let res = await this.request_maa_api(this.maa_api_host + '/maa/check_user', 'get', null, query)
        if (res && res.result) {
            return true
        }
        return false
    }

    async get_device() {
        if (!this.maa_api_host) {
            logger.mark(`未获取到配置:maa_api_host`)
            return false
        }
        let query = `user=${this.user}`
        let res = await this.request_maa_api(this.maa_api_host + '/maa/get_device', 'get', null, query)
        if (res && res.result) {
            return res.result
        }
        return false
    }

    async set_task(task_list) {
        if (!this.maa_api_host) {
            logger.mark(`未获取到配置:maa_api_host`)
            return false
        }
        let body = {
            user: this.user,
            device: this.device,
            tasks: task_list
        }
        logger.mark(JSON.stringify(body))
        let res = await this.request_maa_api(this.maa_api_host + '/maa/set_task', 'post', body, null)
        if (res) {
            return res.tasks
        }
        return false
    }

    async get_task(tasks) {
        if (!this.maa_api_host) {
            logger.mark(`未获取到配置:maa_api_host`)
            return false
        }
        let body = {
            user: this.user,
            device: this.device,
        }
        let res = await this.request_maa_api(this.maa_api_host + '/maa/get_task', 'post', body, null)
        if (res) {
            return res.tasks
        }
        return false
    }



}