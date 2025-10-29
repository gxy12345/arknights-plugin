import fs from 'fs'
import path from 'path'
import moment from 'moment'

const _path = process.cwd()
const dataPath = path.join(_path, 'data', 'arknights', 'gacha')
const gameDataPath = path.join(_path, 'plugins', 'arknights-plugin', 'resources', 'gacha')

// 卡池表URL
const GACHA_TABLE_URL = 'https://weedy.prts.wiki/gacha_table.json'
const GACHA_TABLE_CACHE_KEY = 'ARKNIGHTS:GACHA_TABLE_DATA'
const CACHE_EXPIRE_TIME = 1800 // 30分钟

// 卡池类型分类
const GACHA_RULE_TYPES = {
    limit: [1, 2, 3, 8],     // 限定池
    norm: [0, 5, 9],         // 常驻池
    doub: [4, 6, 7, 10]      // 中坚池
}

export default class GachaData {
    constructor() {
        // 初始化时不加载，改为异步加载
        this.gachaTableData = null
    }

    async loadGachaTable() {
        try {
            // 先尝试从redis缓存获取
            const cachedData = await redis.get(GACHA_TABLE_CACHE_KEY)
            if (cachedData) {
                const data = JSON.parse(cachedData)
                return data
            }

            // 缓存不存在，从网络获取
            logger.mark('[抽卡记录] 从网络获取卡池表数据')
            const response = await fetch(GACHA_TABLE_URL, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            })

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }

            const data = await response.json()
            logger.mark(`[抽卡记录] 从网络成功获取卡池表数据`)
            
            // 缓存到redis，30分钟过期
            await redis.set(GACHA_TABLE_CACHE_KEY, JSON.stringify(data), { EX: CACHE_EXPIRE_TIME })

            return data
        } catch (error) {
            logger.error(`[抽卡记录] 从网络获取卡池表数据失败: ${error.message}`)
            logger.error('[抽卡记录] 请检查网络连接或稍后重试')
            
            // 返回空数据结构
            return { gachaPoolClient: [], recruitDetail: {} }
        }
    }

    async ensureGachaTableLoaded() {
        if (!this.gachaTableData) {
            this.gachaTableData = await this.loadGachaTable()
        }
        return this.gachaTableData
    }

    async loadUserRecords(userId, uid) {
        const filePath = path.join(dataPath, `${userId}_${uid}.json`)
        
        if (!fs.existsSync(filePath)) {
            return []
        }

        try {
            const data = fs.readFileSync(filePath, 'utf-8')
            return JSON.parse(data)
        } catch (error) {
            logger.error(`读取抽卡记录失败: ${error}`)
            return []
        }
    }

    async getPoolInfo(poolId) {
        const gachaTableData = await this.ensureGachaTableLoaded()
        
        const poolInfo = gachaTableData.gachaPoolClient?.find(p => p.gachaPoolId === poolId)
        if (poolInfo) {
            return {
                gachaPoolId: poolInfo.gachaPoolId,
                gachaPoolName: poolInfo.gachaPoolName,
                openTime: poolInfo.openTime,
                endTime: poolInfo.endTime,
                gachaRuleType: poolInfo.gachaRuleType
            }
        }
        
        logger.warn(`[抽卡记录] 未找到卡池 ${poolId} 的信息，使用默认类型`)
        return null
    }

    async getUpChars(poolId) {
        const upFiveChars = []
        const upSixChars = []

        const gachaTableData = await this.ensureGachaTableLoaded()
        const poolInfo = gachaTableData.gachaPoolClient?.find(p => p.gachaPoolId === poolId)
        
        if (poolInfo && poolInfo.gachaPoolDetail?.detailInfo?.upCharInfo) {
            const upCharInfo = poolInfo.gachaPoolDetail.detailInfo.upCharInfo
            if (upCharInfo.perCharList) {
                for (const charGroup of upCharInfo.perCharList) {
                    if (charGroup.rarityRank === 4) {
                        upFiveChars.push(...charGroup.charIdList)
                    } else if (charGroup.rarityRank === 5) {
                        upSixChars.push(...charGroup.charIdList)
                    }
                }
            }
        }

        return { upFiveChars, upSixChars }
    }

    async groupRecords(records) {
        // 确保卡池表数据已加载
        await this.ensureGachaTableLoaded()
        
        // 按卡池分组
        const poolGroups = {}
        
        for (const record of records) {
            if (!poolGroups[record.poolId]) {
                const poolInfo = await this.getPoolInfo(record.poolId)
                const { upFiveChars, upSixChars } = await this.getUpChars(record.poolId)
                
                const openTime = poolInfo?.openTime || 0
                const endTime = poolInfo?.endTime || 0
                let gachaRuleType = poolInfo?.gachaRuleType
                
                // 如果找不到卡池信息，根据 poolId 推测类型
                if (gachaRuleType === undefined || gachaRuleType === null) {
                    const poolId = record.poolId || ''
                    const poolIdUpper = poolId.toUpperCase()
                    
                    if (poolIdUpper.includes('LINKAGE') || poolIdUpper.includes('LIMITED')) {
                        gachaRuleType = 1 // 限定池
                    } else if (poolIdUpper.includes('CLASSIC')) {
                        gachaRuleType = 4 // 中坚池
                    } else {
                        gachaRuleType = 0 // 常驻池
                    }
                }
                
                poolGroups[record.poolId] = {
                    gachaPoolId: record.poolId,
                    gachaPoolName: record.poolName,
                    gachaRuleType: gachaRuleType,
                    up_five_chars: upFiveChars,
                    up_six_chars: upSixChars,
                    records: []
                }
            }

            // 按时间戳分组（同一次十连）
            const tsGroups = poolGroups[record.poolId].records
            let tsGroup = tsGroups.find(g => g.gacha_ts === record.gacha_ts)
            
            if (!tsGroup) {
                tsGroup = {
                    gacha_ts: record.gacha_ts,
                    gacha_ts_str: moment.unix(record.gacha_ts).format('MM-DD'),
                    pulls: []
                }
                tsGroups.push(tsGroup)
            }

            // 判断六星是否为歪（非UP角色）
            const currentPool = poolGroups[record.poolId]
            const isOffBanner = record.rarity === 5 && 
                               currentPool.up_six_chars.length > 0 && 
                               !currentPool.up_six_chars.includes(record.charId)

            tsGroup.pulls.push({
                pool_name: record.poolName,
                char_id: record.charId,
                char_name: record.charName,
                rarity: record.rarity,
                is_new: record.isNew,
                pos: record.pos,
                is_off_banner: isOffBanner
            })
        }

        // 对每个卡池的记录按时间排序，对每组的pulls按pos排序
        const pools = Object.values(poolGroups).map(pool => {
            pool.records.sort((a, b) => b.gacha_ts - a.gacha_ts)
            pool.records.forEach(record => {
                record.pulls.sort((a, b) => b.pos - a.pos)
            })
            
            // 预处理：计算每个六星之前的五星列表和保底数
            this.preprocessPityData(pool)
            
            // 计算该卡池的总抽数
            pool.poolTotalPulls = pool.records.reduce((sum, rec) => sum + rec.pulls.length, 0)
            
            return pool
        })

        // 按开放时间排序（最新的在前）
        pools.sort((a, b) => b.openTime - a.openTime)

        // 计算统计数据
        const stats = this.calculateStats(pools)

        return {
            pools: pools,
            ...stats
        }
    }

    preprocessPityData(pool) {
        // 为每个六星记录预计算保底数和五星列表
        let pityCount = 0
        let fiveStarsList = []
        
        // 需要倒序遍历（从最早到最晚）
        const allPulls = []
        for (let i = pool.records.length - 1; i >= 0; i--) {
            const record = pool.records[i]
            for (let j = record.pulls.length - 1; j >= 0; j--) {
                const pull = record.pulls[j]
                allPulls.push({ record, pull })
            }
        }
        
        // 现在按时间顺序处理
        for (const { record, pull } of allPulls) {
            pityCount++
            
            if (pull.rarity === 4) {
                fiveStarsList.push(pull.char_id)
            }
            
            if (pull.rarity === 5) {
                // 保存到这个pull上
                pull.pity_count = pityCount
                pull.five_stars_list = [...fiveStarsList]
                
                // 重置计数
                pityCount = 0
                fiveStarsList = []
            }
        }
    }

    calculateStats(pools) {
        const stats = {
            limit_total_pulls: 0,
            norm_total_pulls: 0,
            doub_total_pulls: 0,
            limit_total_six: 0,
            norm_total_six: 0,
            doub_total_six: 0,
            limit_six_spook: 0,
            norm_six_spook: 0,
            doub_six_spook: 0,
            limit_six_avg: 0,
            norm_six_avg: 0,
            doub_six_avg: 0,
            limit_pity: 0,
            norm_pity: 0,
            doub_pity: 0
        }

        // 分别计算三种池子的统计
        for (const type of ['limit', 'norm', 'doub']) {
            const typePools = pools.filter(p => GACHA_RULE_TYPES[type].includes(p.gachaRuleType))
            
            let totalPulls = 0
            let totalSix = 0
            let totalSixSpook = 0
            let totalConsume = 0

            for (const pool of typePools) {
                for (const record of pool.records) {
                    totalPulls += record.pulls.length
                    
                    for (const pull of record.pulls) {
                        if (pull.rarity === 5) {
                            totalSix++
                            if (!pool.up_six_chars.includes(pull.char_id)) {
                                totalSixSpook++
                            }
                        }
                    }
                }

                // 计算净消耗（从最早到最后一个六星的距离）
                const allPullsChronological = []
                for (const record of [...pool.records].reverse()) {
                    for (const pull of [...record.pulls].reverse()) {
                        allPullsChronological.push(pull)
                    }
                }

                let lastSixIndex = -1
                for (let i = allPullsChronological.length - 1; i >= 0; i--) {
                    if (allPullsChronological[i].rarity === 5) {
                        lastSixIndex = i
                        break
                    }
                }

                if (lastSixIndex >= 0) {
                    totalConsume += lastSixIndex + 1
                }
            }

            stats[`${type}_total_pulls`] = totalPulls
            stats[`${type}_total_six`] = totalSix
            stats[`${type}_six_spook`] = totalSixSpook
            stats[`${type}_six_avg`] = totalSix > 0 ? (totalConsume / totalSix).toFixed(1) : 0

            // 计算保底（从最新的抽卡开始，到遇到第一个六星为止）
            let pityCount = 0
            const typePullsReverse = []
            for (const pool of typePools) {
                for (const record of pool.records) {
                    for (const pull of record.pulls) {
                        typePullsReverse.push(pull)
                    }
                }
            }

            for (const pull of typePullsReverse) {
                if (pull.rarity === 5) {
                    break
                }
                pityCount++
            }

            stats[`${type}_pity`] = Math.min(pityCount, 99)
        }

        return stats
    }

    async analyzeAllRecords(records) {
        // 统计所有六星角色（不限时间）
        const sixStarRecords = records.filter(r => r.rarity === 5)
        
        // 按角色ID分组统计数量
        const charCounts = {}
        for (const record of sixStarRecords) {
            charCounts[record.charId] = (charCounts[record.charId] || 0) + 1
        }

        // 转换为数组并排序
        const sixStarChars = Object.entries(charCounts)
            .map(([charId, count]) => ({
                char_id: charId,
                char_name: sixStarRecords.find(r => r.charId === charId).charName,
                count: count
            }))
            .sort((a, b) => b.count - a.count)

        // 获取卡池信息用于判断UP
        await this.ensureGachaTableLoaded()
        
        // 统计UP六星和总六星
        let upSixStarCount = 0
        let totalSixStarCount = sixStarRecords.length

        for (const record of sixStarRecords) {
            // 使用 getUpChars 来获取正确的 UP 信息
            const { upSixChars } = await this.getUpChars(record.poolId)
            
            if (upSixChars && upSixChars.length > 0) {
                if (upSixChars.includes(record.charId)) {
                    upSixStarCount++
                }
            }
        }

        // 计算UP六星占比
        const upSixStarRate = totalSixStarCount > 0 
            ? ((upSixStarCount / totalSixStarCount) * 100).toFixed(1) 
            : '0.0'

        // 计算平均抽数（所有六星）
        const totalPulls = records.length
        const avgSixStarPulls = totalSixStarCount > 0 
            ? (totalPulls / totalSixStarCount).toFixed(1) 
            : '0.0'

        // 计算平均UP抽数
        const avgUpPulls = upSixStarCount > 0 
            ? (totalPulls / upSixStarCount).toFixed(1) 
            : '0.0'

        // 评价等级（基于平均六星抽数）
        const avgPulls = parseFloat(avgSixStarPulls)
        let evaluation = '欧非守恒'
        if (avgPulls <= 16) evaluation = '至尊欧皇'
        else if (avgPulls <= 20) evaluation = '大欧皇'
        else if (avgPulls <= 25) evaluation = '欧皇'
        else if (avgPulls <= 30) evaluation = '欧洲人'
        else if (avgPulls <= 35) evaluation = '欧非守恒'
        else if (avgPulls <= 38) evaluation = '非洲人'
        else if (avgPulls <= 43) evaluation = '非酋'
        else if (avgPulls <= 48) evaluation = '大非酋'
        else evaluation = '超级非酋'

        return {
            total_pulls: totalPulls,
            avg_six_star_pulls: avgSixStarPulls,
            evaluation: evaluation,
            up_six_star: upSixStarCount,
            total_six_star: totalSixStarCount,
            up_six_star_rate: upSixStarRate,
            avg_up_pulls: avgUpPulls,
            six_star_chars: sixStarChars
        }
    }
}

