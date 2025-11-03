import https from 'https'
import { createDeviceId } from '../utils/common.js'

const BindAPI = {
    OAUTH_API: 'https://as.hypergryph.com/user/oauth2/v2/grant',
    CRED_API: 'https://zonai.skland.com/web/v1/user/auth/generate_cred_by_code',
    SCAN_LOGIN_API: 'https://as.hypergryph.com/general/v1/gen_scan/login',
    SCAN_STATUS_API: 'https://as.hypergryph.com/general/v1/scan_status',
    TOKEN_BY_SCAN_CODE_API: 'https://as.hypergryph.com/user/auth/v1/token_by_scan_code',
    GRANT_CODE_API: 'https://as.hypergryph.com/user/oauth2/v2/grant',
    ROLE_TOKEN_API: 'https://binding-api-account-prod.hypergryph.com/account/binding/v1/u8_token_by_uid',
    AK_LOGIN_API: 'https://ak.hypergryph.com/user/api/role/login',
    GIFT_EXCHANGE_API: 'https://ak.hypergryph.com/user/api/gift/exchange'
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
    },

    /**
     * 获取 grant_code (用于明日方舟官网API鉴权)
     * @param {string} token - 森空岛token
     * @returns {Promise<string|null>} 返回 grant_code 或 null
     */
    async getGrantCode(token) {
        try {
            const response = await fetch(BindAPI.GRANT_CODE_API, {
                method: 'POST',
                headers: {
                    'User-Agent': 'Skland/1.21.0 (com.hypergryph.skland; build:102100065; iOS 17.6.0; ) Alamofire/5.7.1',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    appCode: "be36d44aa36bfb5b",
                    token: token,
                    type: 1
                })
            })

            if (!response.ok) {
                return null
            }

            const res = await response.json()
            if (res.status === 0) {
                return res.data.token
            }
            return null
        } catch (error) {
            logger.error(`获取grant_code失败: ${error}`)
            return null
        }
    },

    /**
     * 获取 role_token
     * @param {string} uid - 森空岛uid
     * @param {string} grantCode - grant_code
     * @returns {Promise<string|null>} 返回 role_token 或 null
     */
    async getRoleToken(uid, grantCode) {
        try {
            const response = await fetch(BindAPI.ROLE_TOKEN_API, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    uid: uid,
                    token: grantCode
                })
            })

            if (!response.ok) {
                return null
            }

            const res = await response.json()
            if (res.status === 0) {
                return res.data.token
            }
            return null
        } catch (error) {
            logger.error(`获取role_token失败: ${error}`)
            return null
        }
    },

    /**
     * 获取 ak_cookie (使用fetch方式)
     * @param {string} roleToken - role_token
     * @returns {Promise<string|null>} 返回 ak_cookie 值或 null
     */
    async getAkCookie(roleToken) {
        try {
            // 方案1: 先尝试使用fetch
            const response = await fetch(BindAPI.AK_LOGIN_API, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    token: roleToken
                })
            })

            if (!response.ok) {
                logger.error(`[获取AkCookie] 请求失败: ${response.status} ${response.statusText}`)
                return null
            }

            const res = await response.json()
            // 注意：这个API返回的字段是 code 而不是 status
            if (res.code === 0) {
                // 尝试多种方式获取cookie
                let setCookieHeader = null
                
                // 方法1: 使用 getSetCookie() (Node.js 19.7.0+)
                if (typeof response.headers.getSetCookie === 'function') {
                    const setCookies = response.headers.getSetCookie()
                    if (setCookies && setCookies.length > 0) {
                        setCookieHeader = setCookies.join('; ')
                    }
                }
                
                // 方法2: 直接获取 set-cookie 头（可能返回null）
                if (!setCookieHeader) {
                    setCookieHeader = response.headers.get('set-cookie')
                }
                
                // 方法3: 尝试获取所有相关的cookie头
                if (!setCookieHeader) {
                    const allHeaders = []
                    for (const [key, value] of response.headers.entries()) {
                        if (key.toLowerCase() === 'set-cookie') {
                            allHeaders.push(value)
                        }
                    }
                    if (allHeaders.length > 0) {
                        setCookieHeader = allHeaders.join('; ')
                    }
                }
                
                if (setCookieHeader) {
                    const match = setCookieHeader.match(/ak-user-center=([^;]+)/)
                    if (match) {
                        return match[1]
                    } else {
                        logger.error(`[获取AkCookie] 未能从Set-Cookie中匹配到ak-user-center`)
                    }
                } else {
                    logger.warn(`[获取AkCookie] fetch方式未能获取到Set-Cookie，尝试使用原生https模块`)
                    // 方案2: 使用原生https模块作为备选
                    return await this.getAkCookieByHttps(roleToken)
                }
            } else {
                logger.error(`[获取AkCookie] API返回错误状态: code=${res.code}, msg: ${res.msg}`)
            }
            return null
        } catch (error) {
            logger.error(`[获取AkCookie] 获取ak_cookie失败: ${error}`)
            logger.error(error.stack)
            return null
        }
    },

    /**
     * 获取 ak_cookie (使用原生https模块)
     * @param {string} roleToken - role_token
     * @returns {Promise<string|null>} 返回 ak_cookie 值或 null
     */
    async getAkCookieByHttps(roleToken) {
        return new Promise((resolve) => {
            const postData = JSON.stringify({ token: roleToken })
            
            const options = {
                hostname: 'ak.hypergryph.com',
                port: 443,
                path: '/user/api/role/login',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            }

            const req = https.request(options, (res) => {
                let data = ''

                res.on('data', (chunk) => {
                    data += chunk
                })

                res.on('end', () => {
                    try {
                        const response = JSON.parse(data)
                        
                        // 注意：这个API返回的字段是 code 而不是 status
                        if (response.code === 0) {
                            // 从响应头中获取 set-cookie
                            const setCookieHeaders = res.headers['set-cookie']
                            
                            if (setCookieHeaders && setCookieHeaders.length > 0) {
                                for (const cookie of setCookieHeaders) {
                                    const match = cookie.match(/ak-user-center=([^;]+)/)
                                    if (match) {
                                        resolve(match[1])
                                        return
                                    }
                                }
                            }
                            logger.error(`[获取AkCookie] https方式未能找到ak-user-center cookie`)
                            resolve(null)
                        } else {
                            logger.error(`[获取AkCookie] https方式API返回错误: code=${response.code}, msg=${response.msg}`)
                            resolve(null)
                        }
                    } catch (error) {
                        logger.error(`[获取AkCookie] https方式解析响应失败: ${error}`)
                        resolve(null)
                    }
                })
            })

            req.on('error', (error) => {
                logger.error(`[获取AkCookie] https请求失败: ${error}`)
                resolve(null)
            })

            req.write(postData)
            req.end()
        })
    },

    /**
     * 兑换礼包码
     * @param {string} giftCode - 兑换码（16位）
     * @param {string} token - 森空岛token
     * @param {string} roleToken - role_token
     * @param {string} akCookie - ak_cookie
     * @returns {Promise<Object>} 返回兑换结果 {success: boolean, msg: string, code: number}
     */
    async exchangeGiftCode(giftCode, token, roleToken, akCookie) {
        try {
            const response = await fetch(BindAPI.GIFT_EXCHANGE_API, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Account-Token': token,
                    'X-Role-Token': roleToken,
                    'Cookie': `ak-user-center=${akCookie}`
                },
                body: JSON.stringify({
                    giftCode: giftCode
                })
            })

            if (!response.ok) {
                logger.error(`[兑换码] 请求失败: ${response.status} ${response.statusText}`)
                return {
                    success: false,
                    msg: `请求失败: ${response.status} ${response.statusText}`,
                    code: response.status
                }
            }

            const res = await response.json()
            return {
                success: res.code === 0,
                msg: res.msg || '未知错误',
                code: res.code
            }
        } catch (error) {
            logger.error(`[兑换码] 兑换失败: ${error}`)
            return {
                success: false,
                msg: `兑换失败: ${error.message}`,
                code: -1
            }
        }
    }
}

export default hypergryphAPI

