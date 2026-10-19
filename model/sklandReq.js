import sklandApi from "./sklandApi.js"
import crypto from "node:crypto"
import setting from "../utils/setting.js"

const refreshPromises = new Map()

function getLogger() {
  return globalThis.logger || console
}

function timeoutSignal(ms) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), ms).unref?.()
  return controller.signal
}

export default class SKLandRequest {
  constructor(uid, cred, token = '', option = {}) {
    this.uid = uid
    this.cred = cred
    this.token = token
    this.server = 'cn'
    this.sklandApi = new sklandApi(this.uid, this.server)
    this.timestamp = null

    const config = setting.getConfig('skland') || {}
    this.config = {
      apiVersion: config.skland_api_version || '2.2.0',
      build: config.skland_build || '200200057',
      platform: Number(config.skland_platform ?? 1),
      language: config.skland_language || 'zh-hans-CN',
      deviceId: config.skland_device_id || '',
      userAgent: config.skland_user_agent || '',
      timeoutMs: Number(config.skland_timeout_ms || 25000),
      tokenCacheSeconds: Number(config.skland_token_cache_seconds || 300),
      ...option
    }
    this.cacheCd = this.config.tokenCacheSeconds

    this.option = {
      log: true,
      debug: false,
      ...option
    }
  }

  static isSuccess(res) {
    return Boolean(res) && Number(res.code) === 0
  }

  isSuccess(res) {
    return SKLandRequest.isSuccess(res)
  }

  setCred(cred) {
    this.cred = cred
  }

  setUid(uid) {
    this.uid = uid
    this.sklandApi.uid = uid
  }

  getUrl(type, data = {}) {
    const requestData = { ...data }
    delete requestData.headers

    const urlMap = this.sklandApi.getUrlMap(requestData)
    if (!urlMap[type]) return false

    let { url, query = '', body = '' } = urlMap[type]
    const urlObj = new URL(url)
    const path = urlObj.pathname
    let queryOrBody = ''

    if (query) {
      url += `?${query}`
      queryOrBody = query
    }
    if (body) {
      body = JSON.stringify(body)
      queryOrBody = body
    }

    let headers = this.getHeaders(path, queryOrBody)
    if (data.headers) headers = { ...headers, ...data.headers }

    if (this.option?.debug) {
      getLogger().debug?.(`[森空岛接口][请求] ${type} ${url}`)
    }

    return { url, headers, body }
  }

  getTokenCacheSeconds(res = {}) {
    const expiresIn = Number(res?.data?.expiresIn || res?.data?.expireIn || res?.expiresIn)
    if (Number.isFinite(expiresIn) && expiresIn > 0) {
      return Math.max(30, Math.min(expiresIn - 15, 86400))
    }
    return this.cacheCd
  }

  async refreshToken() {
    if (!this.cred) return false
    if (refreshPromises.has(this.cred)) return refreshPromises.get(this.cred)

    const promise = (async () => {
      const res = await this.getData('refresh', {}, false, false)
      if (this.isSuccess(res) && res?.data?.token) {
        this.token = res.data.token
        this.timestamp = res?.timestamp || Math.floor(Date.now() / 1000)
        const cacheSeconds = this.getTokenCacheSeconds(res)
        await redis.set(`ARKNIGHTS:SKL_TOKEN:${this.cred}`, this.token, { EX: cacheSeconds })
        getLogger().debug?.(`[森空岛][Token] 刷新成功，缓存 ${cacheSeconds}s`)
        return this.token
      }

      getLogger().error?.(`[森空岛][Token] 刷新失败: ${res?.message || '未知错误'}`)
      return false
    })().finally(() => {
      refreshPromises.delete(this.cred)
    })

    refreshPromises.set(this.cred, promise)
    return promise
  }

  generateSign(token, path, queryOrBody, did) {
    const timestamp = this.timestamp || Math.floor(Date.now() / 1000)
    const headerForSign = {
      platform: String(this.config.platform),
      timestamp: String(timestamp),
      dId: this.config.deviceId || '',
      vName: this.config.apiVersion
    }
    const signSource = path + queryOrBody + timestamp + JSON.stringify(headerForSign)
    const hex = crypto.createHmac('SHA256', token || '').update(signSource, 'utf-8').digest('hex')
    const sign = crypto.createHash('MD5').update(hex, 'utf-8').digest('hex')
    return { sign, timestamp: String(timestamp) }
  }

  getHeaders(path, queryOrBody) {
    const signObj = this.generateSign(this.token, path, queryOrBody, this.config.deviceId)
    const userAgent = this.config.userAgent || `Skland/${this.config.apiVersion} (com.hypergryph.skland; build:${this.config.build}; Android; )`

    return {
      'User-Agent': userAgent,
      'Accept-Encoding': 'gzip',
      'Content-Type': 'application/json',
      platform: this.config.platform,
      'Accept-Language': 'zh-Hans-CN;q=1.0',
      dId: this.config.deviceId || '',
      vName: this.config.apiVersion,
      language: this.config.language,
      sign: signObj.sign,
      timestamp: signObj.timestamp
    }
  }

  isAuthFailure(status, errorRes) {
    if (status === 401) return true
    if (status !== 403) return false
    if (Number(errorRes?.code) === 10001) return false
    return [10002, 10003, 10004, 10005].includes(Number(errorRes?.code))
  }

  async getData(type, data = {}, cached = false, retryAuth = true) {
    if (type !== 'refresh') {
      let cachedToken = await redis.get(`ARKNIGHTS:SKL_TOKEN:${this.cred}`)
      if (cachedToken) {
        this.token = cachedToken
        getLogger().debug?.(`[森空岛][Token] 使用缓存`)
      } else {
        const refreshedToken = await this.refreshToken()
        if (!refreshedToken) return false
        this.token = typeof refreshedToken === 'string'
          ? refreshedToken
          : await redis.get(`ARKNIGHTS:SKL_TOKEN:${this.cred}`)
      }
    }

    const request = this.getUrl(type, data)
    if (!request) return false

    const headers = { ...request.headers, cred: this.cred }
    const param = {
      method: request.body ? 'POST' : 'GET',
      headers,
      signal: timeoutSignal(this.config.timeoutMs)
    }
    if (request.body) param.body = request.body

    const start = Date.now()
    let response
    try {
      response = await fetch(request.url, param)
    } catch (error) {
      getLogger().error?.(`[森空岛接口][${type}] 请求失败: ${error.message}`)
      return false
    }

    let responseJson = null
    try {
      responseJson = await response.json()
    } catch {
      responseJson = null
    }

    if (!response.ok) {
      if (retryAuth && type !== 'refresh' && this.isAuthFailure(response.status, responseJson)) {
        getLogger().debug?.(`[森空岛接口][${type}] token失效，刷新后重试一次`)
        if (await this.refreshToken()) return this.getData(type, data, cached, false)
      }

      if (response.status === 403 && Number(responseJson?.code) === 10001) {
        getLogger().info?.(`[森空岛][已签到] 用户 ${this.uid}`)
        return responseJson
      }

      getLogger().error?.(`[森空岛接口][${type}] ${response.status}: ${responseJson?.message || response.statusText}`)
      return false
    }

    if (this.option.log) {
      getLogger().debug?.(`[森空岛接口][${type}] ${Date.now() - start}ms`)
    }

    if (!responseJson) {
      getLogger().warn?.(`[森空岛接口][${type}] 响应为空`)
      return false
    }

    if (type === 'refresh') {
      if (this.isSuccess(responseJson)) getLogger().debug?.(`[森空岛][Token] 刷新响应成功`)
      else getLogger().error?.(`[森空岛][Token] 刷新失败: ${responseJson.message || '未知错误'}`)
    } else if (!this.isSuccess(responseJson) && this.option.log) {
      getLogger().debug?.(`[森空岛接口][${type}] 请求异常 code=${responseJson.code}`)
    }

    responseJson.api = type
    return responseJson
  }
}
