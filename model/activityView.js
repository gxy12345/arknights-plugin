/**
 * Official web getAkActInfo("activity") contract:
 * data.activity[].{actId,zones} + data.activityInfoMap[actId].
 * Only original SideStory / Intermezzi activities appear in the APP list.
 */
const count = value => typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
const searchText = value => String(value ?? '').replace(/\s+/g, '').toLocaleLowerCase('zh-CN')

export function normalizeActivityProgress(data = {}) {
    if (!data || typeof data !== 'object' || !Array.isArray(data.activity)) return []
    const infoMap = data.activityInfoMap && typeof data.activityInfoMap === 'object' ? data.activityInfoMap : {}
    return data.activity.flatMap(record => {
        if (!record || typeof record !== 'object') return []
        const info = infoMap[record.actId]
        if (!info?.id || info.isReplicate || !['SIDESTORY', 'BRANCHLINE'].includes(info.type) || !info.picUrl) return []
        const zones = Array.isArray(record.zones) ? record.zones.map((zone, index) => {
            const current = count(zone?.clearedStage)
            const total = count(zone?.totalStage)
            const known = current !== null && total !== null && current <= total
            return { name: `区域 ${index + 1}`, current, total, known }
        }) : []
        const known = Array.isArray(record.zones) && zones.every(zone => zone.known)
        const current = known ? zones.reduce((sum, zone) => sum + zone.current, 0) : null
        const total = known ? zones.reduce((sum, zone) => sum + zone.total, 0) : null
        const completed = known && total > 0 && current === total
        return [{
            id: String(record.actId),
            name: String(info.name || record.actId),
            type: info.type === 'SIDESTORY' ? 'SideStory' : '插曲',
            picUrl: /^https?:\/\//i.test(info.picUrl) ? info.picUrl : '',
            current,
            total,
            known,
            completed,
            progress: known && total > 0 ? Math.min(100, Math.round(current / total * 10000) / 100) : 0,
            status: !known ? '数据不完整' : total === 0 ? '暂无关卡数据' : completed ? '已完成' : '进行中',
            zones
        }]
    }).reverse()
}

export function findActivities(activities, query) {
    const key = searchText(query)
    if (!key) return activities
    const exact = activities.filter(activity => searchText(activity.id) === key || searchText(activity.name) === key)
    return exact.length ? exact : activities.filter(activity => searchText(activity.name).includes(key))
}
