import { readFileSync } from 'node:fs'

const brandNames = JSON.parse(readFileSync(new URL('../resources/skinStat/brands.json', import.meta.url), 'utf8'))
const list = value => Array.isArray(value) ? value : []
const text = value => value == null ? '' : String(value)
const image = (type, id) => id ? `https://web.hycdn.cn/arknights/game/assets/${type}/${encodeURIComponent(text(id)).replace(/'/g, '%27')}.png` : ''
const timestamp = value => {
    const number = Number(value)
    return Number.isFinite(number) && number > 0 ? number < 1e12 ? number * 1000 : number : 0
}
const date = value => value && Number.isFinite(new Date(value).getTime())
    ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value)) : '获得时间未知'

export function skinDisplayCount(value) {
    return [4, 8, 12, 16].includes(Number(value)) ? Number(value) : 8
}

export function normalizeSkinAssets(data = {}, limit = 8) {
    const metadata = data.skinInfoMap || {}, chars = data.charInfoMap || {}, owned = new Map()
    for (const skin of list(data.skins)) {
        if (!skin?.id) continue
        const id = text(skin.id), ts = timestamp(skin.ts)
        if (!owned.has(id) || ts > owned.get(id).gainTime) owned.set(id, { id, gainTime: ts })
    }
    const skins = [...owned.values()].map(skin => {
        const info = metadata[skin.id] || {}, brandId = text(info.brandId)
        const charId = text(info.charId) || skin.id.split('@')[0].split('#')[0]
        const brand = data.skinBrandInfoMap?.[brandId] || data.brandInfoMap?.[brandId] || {}
        return {
            ...skin, name: text(info.name) || skin.id, charName: text(chars[charId]?.name) || charId,
            brandId, brandName: text(brand.brandName || brand.name) || brandNames[brandId] || brandId || '未识别系列',
            brandIconUrl: image('brand', brandId), portraitUrl: image('char_skin/portrait', skin.id),
            date: date(skin.gainTime), metadataMissing: !metadata[skin.id]
        }
    }).sort((a, b) => b.gainTime - a.gainTime || a.id.localeCompare(b.id))
    const series = new Map()
    for (const skin of skins) {
        const id = skin.brandId || 'unknown'
        if (!series.has(id)) series.set(id, { id, name: skin.brandName, iconUrl: skin.brandIconUrl, count: 0 })
        series.get(id).count++
    }
    return {
        total: skins.length, series: [...series.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN')),
        skins: skins.slice(0, skinDisplayCount(limit)), displayCount: skinDisplayCount(limit),
        unknownTimeCount: skins.filter(skin => !skin.gainTime).length
    }
}
