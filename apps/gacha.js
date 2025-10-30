import moment from 'moment'
import fs from 'fs'
import path from 'path'
import https from 'https'
import { rulePrefix } from '../utils/common.js'
import SKLandUser from '../model/sklandUser.js'
import hypergryphAPI from '../model/hypergryphApi.js'
import runtimeRender from '../utils/runtimeRender.js'
import GachaData from '../utils/gachaData.js'
import setting from '../utils/setting.js'

const _path = process.cwd()
const dataPath = path.join(_path, 'data', 'arknights', 'gacha')

export class Gacha extends plugin {
    constructor() {
        super({
            name: '[arknights-plugin]抽卡记录',
            dsc: '明日方舟抽卡记录查询',
            event: 'message',
            priority: 100,
            rule: [
                {
                    reg: `^${rulePrefix}(抽卡记录|寻访记录)$`,
                    fnc: 'gachaRecord'
                },
                {
                    reg: `^${rulePrefix}(抽卡分析|抽卡统计|寻访分析|寻访统计)$`,
                    fnc: 'gachaAnalysis'
                }
            ]
        })
    }

    async gachaRecord() {
        let uid = this.e.at || this.e.user_id
        let sklUser = new SKLandUser(uid)
        
        if (!await sklUser.getUser()) {
            await this.reply('未绑定森空岛cred，请先绑定后再使用功能。可发送 /cred帮助 查看获取方法')
            return true
        }

        // 检查是否有token（抽卡记录需要token）
        if (!sklUser.token) {
            await this.reply('抽卡记录功能需要绑定token，请发送 /绑定 并使用token进行绑定, 或是使用 /扫码绑定 进行绑定')
            return true
        }

        await this.reply('正在获取抽卡记录，请稍候...')

        try {
            // 获取grant_code
            const grantCode = await this.getGrantCode(sklUser.token)
            if (!grantCode) {
                await this.reply('获取授权码失败，请重新绑定token')
                return true
            }

            // 获取role_token
            const roleToken = await this.getRoleToken(sklUser.uid, grantCode)
            if (!roleToken) {
                await this.reply('获取角色令牌失败')
                return true
            }

            // 获取ak_cookie
            const akCookie = await this.getAkCookie(roleToken)
            if (!akCookie) {
                await this.reply('获取cookie失败')
                return true
            }

            // 获取卡池类别
            const categories = await this.getGachaCategories(sklUser.uid, roleToken, sklUser.token, akCookie)
            if (!categories || categories.length === 0) {
                await this.reply('获取卡池类别失败')
                return true
            }

            // 先读取本地记录，获取最新时间戳用于增量更新
            const gachaData = new GachaData()
            const localRecords = await gachaData.loadUserRecords(uid, sklUser.uid)
            let maxGachaTs = 0
            
            if (localRecords.length > 0) {
                maxGachaTs = Math.max(...localRecords.map(r => parseInt(r.gachaTs)))
                logger.mark(`[抽卡记录] 本地最新记录时间戳: ${maxGachaTs}, 将只获取此时间之后的新记录`)
            } else {
                logger.mark('[抽卡记录] 本地无记录，将获取全部历史记录')
            }

            // 获取所有抽卡记录（只获取比本地最新时间戳更新的）
            let allRecords = []
            for (const cate of categories) {
                const records = await this.getAllGachaRecords(sklUser.uid, cate.id, roleToken, sklUser.token, akCookie, maxGachaTs)
                allRecords = allRecords.concat(records)
            }

            if (allRecords.length === 0 && localRecords.length === 0) {
                await this.reply('未找到抽卡记录')
                return true
            }

            // 保存新获取的抽卡记录
            if (allRecords.length > 0) {
                await this.saveGachaRecords(uid, sklUser.uid, allRecords)
                logger.mark(`[抽卡记录] 从API获取到 ${allRecords.length} 条新记录`)
            } else {
                logger.mark('[抽卡记录] 没有新的抽卡记录，使用本地数据')
            }

            // 重新读取本地记录（包含刚保存的新记录）
            const records = await gachaData.loadUserRecords(uid, sklUser.uid)
            
            // 获取配置的天数范围
            const config = setting.getConfig('gacha')
            const daysRange = config?.gacha?.days_range || 180

            // 按时间范围过滤
            const cutoffTimestamp = moment().subtract(daysRange, 'days').valueOf() / 1000
            const filteredRecords = records.filter(r => r.gacha_ts >= cutoffTimestamp)

            if (filteredRecords.length === 0) {
                await this.reply(`最近${daysRange}天内没有抽卡记录`)
                return true
            }

            // 分组和统计
            const groupedData = await gachaData.groupRecords(filteredRecords)

            // 获取角色信息
            const game_res = await sklUser.getGamePlayerInfo()
            if (!game_res || game_res.code !== 0) {
                await this.reply('获取角色信息失败')
                return true
            }

            // 渲染图片
            await this.renderGachaCard(groupedData, game_res.data, sklUser, daysRange)

        } catch (error) {
            logger.error(`获取抽卡记录失败: ${error}`)
            await this.reply(`获取抽卡记录失败: ${error.message}`)
        }

        return true
    }

    async gachaAnalysis() {
        let uid = this.e.at || this.e.user_id
        let sklUser = new SKLandUser(uid)
        
        if (!await sklUser.getUser()) {
            await this.reply('未绑定森空岛cred，请先绑定后再使用功能。可发送 /cred帮助 查看获取方法')
            return true
        }

        // 检查是否有token（抽卡分析需要token）
        if (!sklUser.token) {
            await this.reply('抽卡记录功能需要绑定token，请发送 /绑定 并使用token进行绑定, 或是使用 /扫码绑定 进行绑定')
            return true
        }

        try {
            await this.reply('正在获取抽卡分析数据...')

            // 获取授权码
            const grantCode = await this.getGrantCode(sklUser.token)
            if (!grantCode) {
                await this.reply('获取授权码失败')
                return true
            }

            // 获取roleToken
            const roleToken = await this.getRoleToken(sklUser.uid, grantCode)
            if (!roleToken) {
                await this.reply('获取角色令牌失败')
                return true
            }

            // 获取ak_cookie
            const akCookie = await this.getAkCookie(roleToken)
            if (!akCookie) {
                await this.reply('获取cookie失败')
                return true
            }

            // 获取卡池类别
            const categories = await this.getGachaCategories(sklUser.uid, roleToken, sklUser.token, akCookie)
            if (!categories || categories.length === 0) {
                await this.reply('获取卡池类别失败')
                return true
            }

            // 先读取本地记录，获取最新时间戳用于增量更新
            const gachaData = new GachaData()
            const localRecords = await gachaData.loadUserRecords(uid, sklUser.uid)
            let maxGachaTs = 0
            
            if (localRecords.length > 0) {
                maxGachaTs = Math.max(...localRecords.map(r => parseInt(r.gachaTs)))
                logger.mark(`[抽卡分析] 本地最新记录时间戳: ${maxGachaTs}, 将只获取此时间之后的新记录`)
            } else {
                logger.mark('[抽卡分析] 本地无记录，将获取全部历史记录')
            }

            // 获取所有抽卡记录（只获取比本地最新时间戳更新的）
            let allRecords = []
            for (const cate of categories) {
                const records = await this.getAllGachaRecords(sklUser.uid, cate.id, roleToken, sklUser.token, akCookie, maxGachaTs)
                allRecords = allRecords.concat(records)
            }

            if (allRecords.length === 0 && localRecords.length === 0) {
                await this.reply('未找到抽卡记录')
                return true
            }

            // 保存新获取的抽卡记录
            if (allRecords.length > 0) {
                await this.saveGachaRecords(uid, sklUser.uid, allRecords)
                logger.mark(`[抽卡分析] 从API获取到 ${allRecords.length} 条新记录`)
            } else {
                logger.mark('[抽卡分析] 没有新的抽卡记录，使用本地数据')
            }

            // 重新读取本地记录（包含刚保存的新记录）
            const records = await gachaData.loadUserRecords(uid, sklUser.uid)

            if (records.length === 0) {
                await this.reply('未找到抽卡记录')
                return true
            }

            // 分析统计（不限制时间范围）
            const analysisData = await gachaData.analyzeAllRecords(records)

            // 获取角色信息
            const game_res = await sklUser.getGamePlayerInfo()
            if (!game_res || game_res.code !== 0) {
                await this.reply('获取角色信息失败')
                return true
            }

            // 渲染图片
            await this.renderGachaAnalysis(analysisData, game_res.data, sklUser)

        } catch (error) {
            logger.error(`获取抽卡分析失败: ${error}`)
            await this.reply(`获取抽卡分析失败: ${error.message}`)
        }

        return true
    }

    async getGrantCode(token) {
        try {
            const response = await fetch('https://as.hypergryph.com/user/oauth2/v2/grant', {
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
    }

    async getRoleToken(uid, grantCode) {
        try {
            const response = await fetch('https://binding-api-account-prod.hypergryph.com/account/binding/v1/u8_token_by_uid', {
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
    }

    async getAkCookie(roleToken) {
        try {
            // 方案1: 先尝试使用fetch
            const response = await fetch('https://ak.hypergryph.com/user/api/role/login', {
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
                logger.error(`[抽卡记录] getAkCookie请求失败: ${response.status} ${response.statusText}`)
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
                        logger.error(`[抽卡记录] 未能从Set-Cookie中匹配到ak-user-center`)
                    }
                } else {
                    logger.warn(`[抽卡记录] fetch方式未能获取到Set-Cookie，尝试使用原生https模块`)
                    // 方案2: 使用原生https模块作为备选
                    return await this.getAkCookieByHttps(roleToken)
                }
            } else {
                logger.error(`[抽卡记录] API返回错误状态: code=${res.code}, msg: ${res.msg}`)
            }
            return null
        } catch (error) {
            logger.error(`[抽卡记录] 获取ak_cookie失败: ${error}`)
            logger.error(error.stack)
            return null
        }
    }

    async getAkCookieByHttps(roleToken) {
        return new Promise((resolve, reject) => {
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
                            logger.error(`[抽卡记录] https方式未能找到ak-user-center cookie`)
                            resolve(null)
                        } else {
                            logger.error(`[抽卡记录] https方式API返回错误: code=${response.code}, msg=${response.msg}`)
                            resolve(null)
                        }
                    } catch (error) {
                        logger.error(`[抽卡记录] https方式解析响应失败: ${error}`)
                        resolve(null)
                    }
                })
            })

            req.on('error', (error) => {
                logger.error(`[抽卡记录] https请求失败: ${error}`)
                resolve(null)
            })

            req.write(postData)
            req.end()
        })
    }

    async getGachaCategories(uid, roleToken, token, akCookie) {
        try {
            const response = await fetch(`https://ak.hypergryph.com/user/api/inquiry/gacha/cate?uid=${uid}`, {
                method: 'GET',
                headers: {
                    'X-Account-Token': token,
                    'X-Role-Token': roleToken,
                    'Cookie': `ak-user-center=${akCookie}`
                }
            })

            if (!response.ok) {
                return null
            }

            const res = await response.json()
            if (res.code === 0) {
                return res.data || []
            }
            return null
        } catch (error) {
            logger.error(`获取卡池类别失败: ${error}`)
            return null
        }
    }

    async getGachaHistory(uid, category, roleToken, token, akCookie, gachaTs = null, pos = null) {
        try {
            let url = `https://ak.hypergryph.com/user/api/inquiry/gacha/history?uid=${uid}&category=${category}&size=100`
            if (gachaTs && pos !== null) {
                url += `&gachaTs=${gachaTs}&pos=${pos}`
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-Account-Token': token,
                    'X-Role-Token': roleToken,
                    'Cookie': `ak-user-center=${akCookie}`
                }
            })

            if (!response.ok) {
                return null
            }

            const res = await response.json()
            if (res.code === 0) {
                return res.data
            }
            return null
        } catch (error) {
            logger.error(`获取抽卡记录失败: ${error}`)
            return null
        }
    }

    async getAllGachaRecords(uid, category, roleToken, token, akCookie, maxGachaTs = 0) {
        let allRecords = []
        let page = await this.getGachaHistory(uid, category, roleToken, token, akCookie)
        
        let prevTs = null
        let prevPos = null

        while (page && page.list && page.list.length > 0) {
            // 过滤出比 maxGachaTs 更新的记录
            let newRecords = []
            for (const record of page.list) {
                const recordTs = parseInt(record.gachaTs)
                if (recordTs > maxGachaTs) {
                    newRecords.push(record)
                } else {
                    // 遇到旧记录，说明后面都是旧的，停止获取
                    return allRecords.concat(newRecords)
                }
            }
            
            allRecords = allRecords.concat(newRecords)
            
            // 如果没有更多数据或者本页记录被完全过滤了，停止
            if (!page.hasMore || newRecords.length === 0) {
                break
            }

            const lastRecord = page.list[page.list.length - 1]
            const nextTs = lastRecord.gachaTs
            const nextPos = lastRecord.pos

            // 防止无限循环
            if (nextTs === prevTs && nextPos === prevPos) {
                break
            }

            prevTs = nextTs
            prevPos = nextPos

            page = await this.getGachaHistory(uid, category, roleToken, token, akCookie, nextTs, nextPos)
        }

        return allRecords
    }

    async saveGachaRecords(userId, uid, records) {
        // 确保目录存在
        if (!fs.existsSync(dataPath)) {
            fs.mkdirSync(dataPath, { recursive: true })
        }

        const filePath = path.join(dataPath, `${userId}_${uid}.json`)
        
        // 读取现有记录
        let existingRecords = []
        if (fs.existsSync(filePath)) {
            try {
                const data = fs.readFileSync(filePath, 'utf-8')
                existingRecords = JSON.parse(data)
            } catch (error) {
                logger.error(`读取现有抽卡记录失败: ${error}`)
            }
        }

        // 直接添加新记录（已在API获取阶段过滤）
        for (const record of records) {
            existingRecords.push({
                poolId: record.poolId,
                poolName: record.poolName,
                charId: record.charId,
                charName: record.charName,
                rarity: record.rarity,
                isNew: record.isNew,
                gachaTs: record.gachaTs,
                gacha_ts: parseInt(record.gachaTs) / 1000, // 转换为秒级时间戳
                pos: record.pos
            })
        }

        // 保存到文件
        fs.writeFileSync(filePath, JSON.stringify(existingRecords, null, 2), 'utf-8')
        logger.mark(`[抽卡记录] 新增 ${records.length} 条记录，总计 ${existingRecords.length} 条`)
    }

    async renderGachaCard(groupedData, gameData, sklUser, daysRange) {
        await runtimeRender(this.e, 'gacha/gacha.html', {
            record: groupedData,
            character: {
                nickname: sklUser.name,
                uid: sklUser.uid,
                channel_master_id: '1' // 默认官服
            },
            status: gameData.status,
            days_range: daysRange
        }, {
            scale: 1.5
        })
    }

    async renderGachaAnalysis(analysisData, gameData, sklUser) {
        await runtimeRender(this.e, 'gacha/gachaAnalysis.html', {
            analysis: analysisData,
            character: {
                nickname: sklUser.name,
                uid: sklUser.uid,
                channel_master_id: '1' // 默认官服
            },
            status: gameData.status
        }, {
            scale: 1.5
        })
    }
}


