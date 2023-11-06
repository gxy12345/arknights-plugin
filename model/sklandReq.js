import sklandApi from "./sklandApi.js"

export default class SKLandRequest {
  constructor(uid, cred, option = {}) {
    this.uid = uid
    this.cred = cred
    this.server = 'cn'
    this.sklandApi = new sklandApi(this.uid, this.server)
    /** 5分钟缓存 */
    this.cacheCd = 300

    this.option = {
      log: true,
      ...option
    }
  }

  getUrl(type, data = {}) {
    let urlMap = this.sklandApi.getUrlMap({ ...data })
    if (!urlMap[type]) return false

    let { url, query = '', body = '', sign = '' } = urlMap[type]

    if (query) url += `?${query}`
    if (body) body = JSON.stringify(body)

    let headers = this.getHeaders()

    return { url, headers, body }
  }

  getHeaders() {
    const skl_headers = {
      os: `iOS`,
      platform: 2,
      'Accept-Language': 'zh-Hans-CN;q=1.0',
      'User-Agent': `Skland/1.0.1 (com.hypergryph.skland; build:100001018; iOS 16.3.0) Alamofire/5.7.1`,
      'Content-Type': 'application/json',
      vName: '1.0.1',
      language: 'zh-hans-CN'
    }
    return skl_headers
  }

  async getData(type, data = {}, cached = false) {
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
      // logger.error(`[森空岛接口][${type}][${this.uid}] ${body}`)
      // logger.error(`[森空岛接口][${type}][${this.uid}] ${JSON.stringify(await response.json())}`)
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