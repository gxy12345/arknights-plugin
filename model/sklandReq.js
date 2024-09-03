import { json } from "stream/consumers"
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
    logger.mark(`[森空岛接口][getUrl] url: ${url}  headers: ${JSON.stringify(headers)}`)
    return { url, headers, body }
  }

  async refreshToken() {
    let res = await this.getData('refresh')
    logger.mark(JSON.stringify(res))
    if (res?.code == 0 && res?.message === 'OK') {
      this.token = res.data.token
      this.timestamp = res?.timestamp
      await redis.set(`ARKNIGHTS:SKL_TOKEN:${this.cred}`, this.token, { EX: this.cacheCd })
      logger.mark(`[森空岛接口]刷新token成功`)
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
    // let token = Buffer.from(skl_token, 'utf-8')
    let header_ca = JSON.parse(JSON.stringify(header_for_sign));
    let header_ca_str = JSON.stringify(header_ca);
    let s = path + query_or_body + t + header_ca_str
    let hex_s = crypto.createHmac('SHA256', token).update(s, 'utf-8').digest('hex');
    let md5 = crypto.createHash('MD5').update(hex_s, 'utf-8').digest('hex');
    logger.debug(`sign md5: ${md5}`)
    return {sign: md5, timestamp: t.toString()}
  }

  getHeaders(path, query_or_body) {
    let did = crypto.randomUUID()
    let sign_obj = this.generateSign(this.token, path, query_or_body, did)
    logger.debug(`sign obj: ${JSON.stringify(sign_obj)}`)
    let skl_headers = {
      'User-Agent': 'Skland/1.21.0 (com.hypergryph.skland; build:102100065; iOS 17.6.0; ) Alamofire/5.7.1',
      'Accept-Encoding': 'gzip',
      'Connection': 'close',
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
      timeout: 10000
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
      logger.error(error.toString())
      return false
    }

    if (!response.ok) {
      logger.error(`[森空岛接口][${type}][${this.uid}] ${response.status} ${response.statusText}`)
      logger.error(`[森空岛接口][${type}][${this.uid}] ${body}`)

      // 已签到场景
      if (response.status == 403) {
        const error_res = await response.json()
        if (error_res.code == 10001) {
          logger.mark(`[森空岛接口][已签到][${this.uid}] ${JSON.stringify(error_res)}`)
          return error_res
        }
      }
      return false
    }
    if (this.option.log) {
      logger.mark(`[森空岛接口][${type}][${this.uid}] ${Date.now() - start}ms`)
    }
    const res = await response.json()

    if (!res) {
      logger.mark('森空岛接口没有返回')
      return false
    }

    if (res.code !== 0 && this.option.log) {
      logger.mark(`[森空岛接口][请求参数] ${url} ${JSON.stringify(param)}`)
    }

    res.api = type

    return res
  }

}