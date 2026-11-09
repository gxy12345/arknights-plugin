import { existsSync, readFileSync } from 'node:fs'

const list = value => Array.isArray(value) ? value : []
const text = value => value == null ? '' : String(value)
const number = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0
const encode = value => encodeURIComponent(text(value)).replace(/'/g, '%27')
const backgrounds = [
    '8ef86355600794e0740cb9c16fed08ce', 'a38069bc9aeecefdb3559516b37e7de1',
    '5c70853991cfa73eb9e2f074908b2018', '1bdb7bc2af4d09ac40ac7ae4d3c0f388',
    '6006d7d5a70b2d65202e26e2a29a0874', '5e51937f3c6165170e584ea28b8d0781'
]
const fallbackExp = { '2001': 200, '2002': 400, '2003': 1000, '2004': 2000 }

function readFallback() {
    try { return JSON.parse(readFileSync(new URL('../resources/calculate/item_meta.json', import.meta.url), 'utf8')) }
    catch { return {} }
}

function localIcon(name) {
    const relative = `gameData/material/${encode(name)}.png`
    return name && existsSync(new URL(`../resources/${relative}`, import.meta.url)) ? relative : ''
}

/** Raw cultivate/info rarity is zero-based; the official UI adds one before getItemBg. */
export function createMaterialCatalog(items, { loadFallback = readFallback, findLocalIcon = localIcon } = {}) {
    const official = new Map(list(items).map((item, index) => [text(item.id), { ...item, index }]))
    const cache = new Map()
    let fallback
    const legacy = id => {
        if (!fallback) {
            try { fallback = loadFallback() || {} } catch { fallback = {} }
        }
        return Object.hasOwn(fallback, id) ? fallback[id] || {} : {}
    }
    const resolve = value => {
        const id = text(value)
        if (cache.has(id)) return cache.get(id)
        const info = official.get(id)
        const old = info?.name ? {} : legacy(id)
        const name = text(info?.name || old.name) || `未知材料 ${id}`
        const rawRarity = info?.rarity
        const rarity = rawRarity !== null && rawRarity !== undefined && Number.isInteger(Number(rawRarity)) && Number(rawRarity) >= 0 && Number(rawRarity) < backgrounds.length ? Number(rawRarity) : null
        const result = {
            id, name, rarity, displayRarity: rarity === null ? null : rarity + 1,
            // Official materials use the item ID, rather than a local icon filename.
            iconUrl: id ? `https://web.hycdn.cn/arknights/game/assets/item/${encode(id)}.png` : '',
            backgroundUrl: rarity === null ? '' : `https://bbs.hycdn.cn/public/skland-web/image/tool/arknights/assets/item-background/${backgrounds[rarity]}.png`,
            fallbackIcon: findLocalIcon(name),
            index: info?.index ?? null, sortId: number(old.sortId ?? 9999999),
            exp: number(info?.exp ?? fallbackExp[id]), source: info ? 'skland' : old.name ? 'local' : 'unknown'
        }
        cache.set(id, result)
        return result
    }
    const decorate = materials => list(materials).map(item => ({ ...item, ...resolve(item.id) })).sort((a, b) => {
        if (a.index !== null && b.index !== null) return a.index - b.index
        if (a.index !== null) return -1
        if (b.index !== null) return 1
        return a.sortId - b.sortId || a.id.localeCompare(b.id)
    })
    return { resolve, decorate }
}

/** Missing inventory rows mean zero owned; never mutate the required-material rows. */
export function calculateMissingMaterials(materials, cash, exp, inventory, catalog) {
    const owned = new Map()
    for (const item of list(inventory)) owned.set(text(item.id), (owned.get(text(item.id)) || 0) + number(item.count))
    let totalExp = 0
    for (const [id, count] of owned) totalExp += catalog.resolve(id).exp * count
    return {
        cash: Math.max(0, number(cash) - (owned.get('4001') || 0)),
        exp: Math.max(0, number(exp) - totalExp),
        materials: list(materials).map(item => ({ ...item, lackCount: Math.max(0, number(item.count) - (owned.get(text(item.id)) || 0)) })).filter(item => item.lackCount > 0)
    }
}
