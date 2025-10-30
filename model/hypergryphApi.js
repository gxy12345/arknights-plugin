import { createDeviceId } from '../utils/common.js'

const BindAPI = {
    OAUTH_API: 'https://as.hypergryph.com/user/oauth2/v2/grant',
    CRED_API: 'https://zonai.skland.com/web/v1/user/auth/generate_cred_by_code',
    SCAN_LOGIN_API: 'https://as.hypergryph.com/general/v1/gen_scan/login',
    SCAN_STATUS_API: 'https://as.hypergryph.com/general/v1/scan_status',
    TOKEN_BY_SCAN_CODE_API: 'https://as.hypergryph.com/user/auth/v1/token_by_scan_code'
}

const APP_CODE = '4ca99fa6b56cc2ba'

let hypergryphAPI = {
    /**
     * 获取扫码登录的 scanId
     * @returns {Promise<string|null>} 返回 scanId 或 null
     */
    async getScanId() {
        let req_body = {
            appCode: APP_CODE
        }
        let param = {
            timeout: 25000,
            method: 'post',
            headers: {
                'Content-Type': 'application/json;charset=utf-8'
            },
            body: JSON.stringify(req_body)
        }

        let response = {}
        try {
            response = await fetch(BindAPI.SCAN_LOGIN_API, param)
        } catch (error) {
            logger.error(`[获取扫码ID]${error.toString()}`)
            return null
        }

        if (!response.ok) {
            logger.error(`[获取扫码ID]${response.status} ${response.statusText}`)
            return null
        }

        let res = await response.json()
        if (res?.status !== 0 || res?.msg !== 'OK') {
            logger.error(`[获取扫码ID]${JSON.stringify(res)}`)
            return null
        }

        let scanId = res.data.scanId
        logger.mark(`获取到扫码ID: ${scanId}`)
        return scanId
    },

    /**
     * 检查扫码状态
     * @param {string} scanId - 扫码ID
     * @returns {Promise<string|null>} 返回 scanCode 或 null（未扫码或超时）
     */
    async getScanStatus(scanId) {
        let param = {
            timeout: 25000,
            method: 'get'
        }

        let url = `${BindAPI.SCAN_STATUS_API}?scanId=${scanId}`
        
        let response = {}
        try {
            response = await fetch(url, param)
        } catch (error) {
            logger.debug(`[检查扫码状态]${error.toString()}`)
            return null
        }

        if (!response.ok) {
            logger.debug(`[检查扫码状态]${response.status} ${response.statusText}`)
            return null
        }

        let res = await response.json()
        if (res?.status !== 0) {
            // 未扫码时会返回非0状态，这是正常的
            return null
        }

        let scanCode = res.data.scanCode
        logger.mark(`获取到扫码Code: ${scanCode}`)
        return scanCode
    },

    /**
     * 通过 scanCode 获取 token
     * @param {string} scanCode - 扫码Code
     * @returns {Promise<string|null>} 返回 token 或 null
     */
    async getTokenByScanCode(scanCode) {
        let req_body = {
            scanCode: scanCode
        }
        let param = {
            timeout: 25000,
            method: 'post',
            headers: {
                'Content-Type': 'application/json;charset=utf-8'
            },
            body: JSON.stringify(req_body)
        }

        let response = {}
        try {
            response = await fetch(BindAPI.TOKEN_BY_SCAN_CODE_API, param)
        } catch (error) {
            logger.error(`[通过ScanCode获取Token]${error.toString()}`)
            return null
        }

        if (!response.ok) {
            logger.error(`[通过ScanCode获取Token]${response.status} ${response.statusText}`)
            return null
        }

        let res = await response.json()
        if (res?.status !== 0 || res?.msg !== 'OK') {
            logger.error(`[通过ScanCode获取Token]${JSON.stringify(res)}`)
            return null
        }

        let token = res.data.token
        logger.mark(`获取到Token: ${token}`)
        return token
    },

    async getCredByToken(token) {
        if (!token || token == '') {
            return null
        }
        let req_body = {
            appCode: "4ca99fa6b56cc2ba",
            type: 0,
            token: token
        }
        let param = {
            timeout: 25000,
            method: 'post',
            headers: {
                'User-Agent': 'Skland/1.21.0 (com.hypergryph.skland; build:102100065; iOS 17.6.0; ) Alamofire/5.7.1',
                'Content-Type': 'application/json;charset=utf-8'
            },
            body: JSON.stringify(req_body)
        }

        let response = {}

        try {
            response = await fetch(BindAPI.OAUTH_API, param)
        } catch (error) {
            logger.error(error.toString())
            return null
        }
        
        if (!response.ok) {
            logger.error(`[OAUTH API]${response.status} ${response.statusText}`)
            if (response.status == 400) {
                const error_res = await response.json()
                logger.mark(`[OAUTH API][参数错误] ${JSON.stringify(error_res)}`)
            }
            if (response.status == 405) {
                logger.mark(`[CRED API][405] 当前服务暂时无法使用token，请更换IP或使用cred`)
                return "405"
            }
            return false
        }
        let res = await response.json()

        if (res?.msg !== 'OK') {
            return null
        }
        let code = res.data.code
        logger.debug(`获取到OAUTH CODE:${code}`)

        req_body = {
            kind: 1,
            code: code
        }
        param.body = JSON.stringify(req_body)
        param.headers = {
            'content-type': 'application/json',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
            'referer': 'https://www.skland.com/',
            'origin': 'https://www.skland.com',
            'dId': await createDeviceId(),
            'platform': '3',
            'timestamp': `${Math.floor(Date.now() / 1000)}`,
            'vName': '1.0.0',
        }


        try {
            response = await fetch(BindAPI.CRED_API, param)
        } catch (error) {
            logger.error(error.toString())
            return null
        }

        if (!response.ok) {
            logger.error(`[CRED API]${response.status} ${response.statusText}`)
            if (response.status == 400) {
                const error_res = await response.json()
                logger.mark(`[CRED API][参数错误] ${JSON.stringify(error_res)}`)
            }
            if (response.status == 405) {
                logger.mark(`[CRED API][405] 当前服务暂时无法使用token，请更换IP或使用cred`)
                return "405"
            }
            return false
        }
        res = await response.json()

        if (res?.message !== 'OK' || !res?.data?.cred) {
            return null
        }
        let cred = res.data.cred
        logger.mark(`获取到cred:${cred}`)
        return cred
    }
}

export default hypergryphAPI

