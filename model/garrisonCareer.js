import { garrisonImageUrl } from './garrisonView.js'

const titleTypes = [
    ['COIN', '资金管理'],
    ['KILL', '补救能力'],
    ['DAMAGE', '领袖挑战'],
    ['BOND', '盟约理解'],
    ['CHAR', '人力调度'],
    ['EQUIP', '装备活用']
]

const titleAssets = 'https://bbs.hycdn.cn/skland-fe-static/assets/arknights/auto_chess/'
const platingIcon = 'https://bbs.hycdn.cn/public/skland-activity/image/arknights-garrison-act3autochess/398720ef796f61e337511cea79feef04.png'
const text = value => typeof value === 'string' ? value.trim() : ''
const list = value => Array.isArray(value) ? value : []
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null

export function decodeGarrisonCareer(data) {
    if (typeof data?.content === 'string') {
        const bytes = Uint8Array.from(atob(data.content), char => char.charCodeAt(0))
        data = JSON.parse(new TextDecoder().decode(bytes))
    }
    const career = data?.career
    if (!career || typeof career !== 'object' || Array.isArray(career)) {
        throw new Error('森空岛未返回赛季履历。')
    }
    return career
}

function titles(value) {
    return list(value).flatMap(row => {
        const name = text(row?.name)
        if (!name) return []
        const picId = text(row.picId)
        const iconUrl = /^[a-zA-Z0-9_-]+$/.test(picId) ? titleAssets + 'title/' + picId + '.png' : ''
        return [{ name, count: count(row.count), iconUrl }]
    })
}

function titleChart(source) {
    if (!titleTypes.some(([id]) => count(source?.[id]) !== null)) return null
    const dimensions = titleTypes.map(([id, name]) => ({ name, count: count(source[id]) ?? 0 }))
    const total = dimensions.reduce((sum, dimension) => sum + dimension.count, 0)
    // The official hexagon fills each sector from the center by its share of all six counts.
    const sector = share => {
        const halfWidth = 2 + 44 * share
        const top = (133 - 79 * share).toFixed(2)
        return `${(200 - halfWidth).toFixed(2)},${top} ${(200 + halfWidth).toFixed(2)},${top} 202,133 198,133`
    }

    const axes = dimensions.map((dimension, index) => {
        const angle = (index - 1.5) * Math.PI / 3
        const label = { x: Math.round(200 + 107 * Math.cos(angle)), y: Math.round(140 + 107 * Math.sin(angle)) }
        return {
            ...dimension, label, rotation: index * 60,
            fill: dimension.count ? sector(dimension.count / total) : '',
            anchor: label.x < 200 ? 'end' : label.x > 200 ? 'start' : 'middle'
        }
    })
    return { axes, total, track: sector(1) }
}

export function normalizeGarrisonCareer(career, resource = {}) {
    const strategies = new Map(Object.values(resource.strategies || {}).map(item => [text(item?.strategyId), item]))
    const badges = new Map()
    for (const badge of list(career.bandBadges)) {
        const id = text(badge?.id)
        if (!id) continue
        const strategy = strategies.get(id)
        const plated = badge.masterVictor === true || badge.masterVictor === 1 || badges.get(id)?.plated === true
        badges.set(id, {
            id, name: text(strategy?.name) || id, iconUrl: garrisonImageUrl(strategy?.iconUrl),
            plated, badgeUrl: plated ? platingIcon : titleAssets + 'special_band.png'
        })
    }
    return {
        badges: Array.isArray(career.bandBadges) ? [...badges.values()].sort((a, b) => a.id.localeCompare(b.id)) : null,
        chart: titleChart(career.titleTypeCnt),
        titleLists: [
            { name: '称号总览', entries: Array.isArray(career.normalTitles) ? titles(career.normalTitles) : null },
            { name: '趣味称号', entries: Array.isArray(career.specialTitles) ? titles(career.specialTitles) : null }
        ]
    }
}
