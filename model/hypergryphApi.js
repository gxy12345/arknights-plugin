const BindAPI = {
    OAUTH_API: 'https://as.hypergryph.com/user/oauth2/v2/grant',
    CRED_API: 'https://zonai.skland.com/api/v1/user/auth/generate_cred_by_code'
}


let hypergryphAPI = {
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
            timeout: 10000,
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

