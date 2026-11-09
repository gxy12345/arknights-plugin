import { normalizeGarrisonGuide, normalizeGarrisonRecord } from './garrisonView.js'

const errors = {
    garrison_resource: '获取卫戍协议资料失败，请稍后再试',
    garrison_index: '获取卫戍协议攻略失败，请检查登录状态或稍后再试',
    garrison_info: '获取卫戍协议攻略详情失败，攻略可能已下架，请稍后再试',
    garrison_history: '获取卫戍协议战绩失败，请检查账号绑定或稍后再试'
}

export default class GarrisonService {
    constructor(user) {
        this.user = user
        this.pending = new Map()
    }

    async request(type, params = {}) {
        try {
            const result = await this.user.sklReq.getData(type, {
                ...params, headers: { 'sk-game-role': `1_${this.user.uid}_0` }
            })
            if (!result || Number(result.code) !== 0 || !result.data || typeof result.data !== 'object') throw new Error()
            return result.data
        } catch {
            // Do not surface backend bodies, request details, or credentials to chat.
            throw new Error(errors[type] || '卫戍协议查询失败，请稍后再试')
        }
    }

    cached(key, fetcher) {
        if (!this.pending.has(key)) {
            const pending = Promise.resolve().then(fetcher).catch(error => {
                this.pending.delete(key)
                throw error
            })
            this.pending.set(key, pending)
        }
        return this.pending.get(key)
    }

    async getResources(seasonId = '') {
        const resource = await this.getResourceVersion(seasonId, '')
        if (seasonId && String(resource.versionInfo?.seasonId) !== String(seasonId)) {
            throw new Error('未找到指定的卫戍协议赛季')
        }
        return resource
    }

    getResourceVersion(seasonId = '', versionId = '') {
        return this.cached(`resource:${seasonId}:${versionId}`, () => this.request('garrison_resource', { seasonId, versionId }))
    }

    async getGuides({ keyword = '', pageToken = '', sortType = 1, seasonId = '' } = {}) {
        const resource = await this.getResources(seasonId)
        const params = {
            titleKeyword: String(keyword).trim(), pageToken, sortType: Number(sortType) === 2 ? 2 : 1,
            seasonId: seasonId || resource.versionInfo?.seasonId, pageSize: 10
        }
        const data = await this.request('garrison_index', params)
        return {
            guides: (Array.isArray(data.list) ? data.list : []).map(item => normalizeGarrisonGuide(item, resource, data.seasonResourceMap)),
            hasMore: data.hasMore === true, pageToken: String(data.pageToken || ''), resource
        }
    }

    async getGuide(id) {
        const guideId = String(id || '').trim()
        if (!guideId) throw new Error('请提供卫戍协议攻略 ID')
        const data = await this.request('garrison_info', { guideId })
        if (String(data.guide?.guide?.guideId || '') !== guideId) throw new Error('攻略不存在或返回的攻略 ID 不匹配')
        const raw = data.guide.guide
        let resource
        try {
            resource = await this.getResourceVersion(raw.seasonId || '', raw.versionId || '')
        } catch {
            // Embedded seasonResourceMap still permits display if an old resource was retired.
            resource = await this.getResources().catch(() => ({}))
        }
        return { guide: normalizeGarrisonGuide(data.guide, resource, data.seasonResourceMap), resource }
    }

    async getHistory(seasonId = '') {
        const resource = await this.getResources(seasonId)
        const selectedSeason = seasonId || resource.versionInfo?.seasonId || ''
        if (!selectedSeason) throw new Error('暂无可查询的卫戍协议赛季')
        const data = await this.request('garrison_history', { seasonId: selectedSeason })
        const records = (Array.isArray(data.records) ? data.records : []).filter(record => String(record.activityId || '') === String(selectedSeason))
        const versionResources = {}
        await Promise.all([...new Set(records.map(record => String(record.versionId || '')))].map(async versionId => {
            try {
                const previous = await this.getResourceVersion(selectedSeason, versionId)
                // A server that silently returns current metadata must not label old records.
                if (String(previous.versionInfo?.seasonId) !== String(selectedSeason) || String(previous.versionInfo?.versionId) !== versionId) return
                versionResources[selectedSeason] ||= { versionResourceMap: {} }
                versionResources[selectedSeason].versionResourceMap[versionId] = previous
            } catch {
                // Records remain queryable as IDs when historical metadata is unavailable.
            }
        }))
        return {
            records: records.map(record => normalizeGarrisonRecord(record, resource, versionResources))
                .sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0)),
            resource, seasonId: String(selectedSeason)
        }
    }
}
