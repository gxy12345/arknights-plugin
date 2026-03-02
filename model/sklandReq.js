import sklandApi from "./sklandApi.js"
import crypto from "node:crypto"

export default class SKLandRequest {
  constructor(uid, cred, token = '', option = {}) {
    this.uid = uid
    this.cred = cred
    this.token = token
    this.server = 'cn'
    this.sklandApi = new sklandApi(this.uid, this.server)
    this.timestamp = null
    this.cacheCd = 3

    this.option = {
      log: true,
      debug: false,
      ...option
    }
  }

  getUrl(type, data = {}) {
    let urlMap = this.sklandApi.getUrlMap({ ...data })
    if (!urlMap[type]) return false

    let { url, query = '', body = '', sign = '' } = urlMap[type]

    let url_obj = new URL(url)
    let path = url_obj.pathname
    let query_or_body = ''

    if (query) {
      url += `?${query}`
      query_or_body = query
    }
    if (body) {
      body = JSON.stringify(body)
      query_or_body = body
    }
    let headers = this.getHeaders(path, query_or_body)
    
    // 简化日志输出 - 只记录URL，不记录完整的headers
    if (this.option?.debug) {
      logger.debug(`[森空岛接口][请求] ${type} ${url}`)
    }
    
    return { url, headers, body }
  }

  async refreshToken() {
    let res = await this.getData('refresh')
    
    if (res?.code == 0 && res?.message === 'OK') {
      this.token = res.data.token
      this.timestamp = res?.timestamp
      await redis.set(`ARKNIGHTS:SKL_TOKEN:${this.cred}`, this.token, { EX: this.cacheCd })
      logger.debug(`[森空岛][Token] 刷新成功`)
    } else {
      logger.error(`[森空岛][Token] 刷新失败: ${res?.message || '未知错误'}`)
    }
  }

  generateSign(token, path, query_or_body, did) {
    let t
    if (this.timestamp) {
      t = this.timestamp
    } else {
      t = Math.floor(Date.now() / 1000)
    }
    let header_for_sign = {
      'platform': '1',
      'timestamp': t.toString(),
      'dId': '',
      'vName': '1.21.0'
    }
    let header_ca = JSON.parse(JSON.stringify(header_for_sign));
    let header_ca_str = JSON.stringify(header_ca);
    let s = path + query_or_body + t + header_ca_str
    let hex_s = crypto.createHmac('SHA256', token).update(s, 'utf-8').digest('hex');
    let md5 = crypto.createHash('MD5').update(hex_s, 'utf-8').digest('hex');
    
    if (this.option?.debug) {
      logger.debug(`[森空岛][签名] md5: ${md5}`)
    }
    
    return {sign: md5, timestamp: t.toString()}
  }

  getHeaders(path, query_or_body) {
    let did = crypto.randomUUID()
    let sign_obj = this.generateSign(this.token, path, query_or_body, did)
    
    if (this.option?.debug) {
      logger.debug(`[森空岛][签名] 对象: ${JSON.stringify(sign_obj)}`)
    }
    
    let skl_headers = {
      'User-Agent': 'Skland/1.21.0 (com.hypergryph.skland; build:102100065; iOS 17.6.0; ) Alamofire/5.7.1',
      'Accept-Encoding': 'gzip',
      'Content-Type': 'application/json',
      platform: 1,
      'Accept-Language': 'zh-Hans-CN;q=1.0',
      'dId': '',
      vName: '1.21.0',
      language: 'zh-hans-CN',
      sign: sign_obj.sign,
      timestamp: sign_obj.timestamp
    }
    return skl_headers
  }

  async getData(type, data = {}, cached = false) {
    if (type !== 'refresh') {
      let cached_token = await redis.get(`ARKNIGHTS:SKL_TOKEN:${this.cred}`)
      if (cached_token) {
        this.token = cached_token
        logger.debug(`[森空岛][Token] 使用缓存`)
      } else {
        await this.refreshToken()
      }
    }

    let { url, headers, body } = this.getUrl(type, data)
    if (!url) return false

    headers.cred = this.cred

    if (data.headers) {
      headers = { ...headers, ...data.headers }
      delete data.headers
    }

    let param = {
      headers,
      timeout: 25000
    }
    if (body) {
      param.method = 'post'
      param.body = body
    } else {
      param.method = 'get'
    }
    
    let response = {}
    let start = Date.now()
    
    try {
      response = await fetch(url, param)
    } catch (error) {
      logger.error(`[森空岛接口][${type}] 请求失败: ${error.message}`)
      return false
    }

    // 处理响应状态
    if (!response.ok) {
      try {
        const error_res = await response.json()
        
        if (response.status == 403 && error_res.code == 10001) {
          logger.info(`[森空岛][已签到] 用户 ${this.uid}`)
          return error_res
        }
        
        logger.error(`[森空岛接口][${type}] ${response.status}: ${error_res.message || response.statusText}`)
      } catch {
        logger.error(`[森空岛接口][${type}] ${response.status} ${response.statusText}`)
      }
      
      return false
    }

    // 记录响应时间
    if (this.option.log) {
      logger.debug(`[森空岛接口][${type}] ${Date.now() - start}ms`)
    }

    const res = await response.json()

    if (!res) {
      logger.warn(`[森空岛接口][${type}] 响应为空`)
      return false
    }

    // 对refresh类型不输出完整响应
    if (type === 'refresh') {
      if (res.code === 0) {
        logger.debug(`[森空岛][Token] 刷新成功 (${Date.now() - start}ms)`)
      } else {
        logger.error(`[森空岛][Token] 刷新失败: ${res.message}`)
      }
    } else if (res.code !== 0 && this.option.log) {
      logger.debug(`[森空岛接口][${type}] 请求异常`)
    }

    res.api = type
    return res
  }
}