import { mkdir, readFile, rename, writeFile, unlink } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const endpoints = {
    operators: '/h5/v1/game/arknights/char-book/list',
    operator: '/h5/v1/game/arknights/char-book/char-info',
    recruit: '/h5/v1/game/recruit/character'
}
const record = value => value && typeof value === 'object' && !Array.isArray(value)
const nonempty = value => Array.isArray(value) && value.length > 0
export function validToolData(type, data, id) {
    if (!record(data)) return false
    if (type === 'operator') return data.id === id && typeof data.name === 'string' && data.name.length > 0 && Number.isInteger(data.rarity) && data.rarity >= 0 && data.rarity <= 5 && typeof data.profession === 'string' && nonempty(data.phase) && data.phase.every(p => record(p.maxLevelAttribute)) && Array.isArray(data.skills) && data.skills.every(s => typeof s.id === 'string' && nonempty(s.levels)) && Array.isArray(data.equipments) && data.equipments.every(m => typeof m.id === 'string' && nonempty(m.phases))
    if (type === 'operators') return nonempty(data.characters) && data.characters.every(c => typeof c.id === 'string' && typeof c.name === 'string')
    if (type === 'recruit') return nonempty(data.tags) && nonempty(data.characters) && data.tags.every(t => Number.isInteger(t.tagId) && typeof t.tagName === 'string') && data.characters.every(c => typeof c.charId === 'string' && typeof c.name === 'string' && Number.isInteger(c.rarity) && c.rarity >= 0 && c.rarity <= 5 && Array.isArray(c.tagIds) && c.tagIds.every(id => data.tags.some(t => t.tagId === id)))
    return false
}

/** Only public H5 game data is persisted. No cred, token or player UID is used. */
export class SklandTools {
    constructor({ fetcher = (...args) => globalThis.fetch(...args), cacheDir = fileURLToPath(new URL('../.cache/skland-tools/', import.meta.url)), now = Date.now, ttl = 6 * 60 * 60 * 1000, retryMs = 60000 } = {}) {
        Object.assign(this, { fetcher, cacheDir, now, ttl, retryMs })
        this.memory = new Map()
        this.pending = new Map()
        this.failedAt = new Map()
    }

    async get(type, id = '') {
        if (!Object.hasOwn(endpoints, type) || (type === 'operator' && !/^char_[a-zA-Z0-9_]+$/.test(id))) throw new Error('无效的图鉴请求')
        const key = type === 'operator' ? `${type}-${id}` : type
        if (this.pending.has(key)) return this.pending.get(key)
        const task = this.load(type, id, key).finally(() => this.pending.delete(key))
        this.pending.set(key, task)
        return task
    }

    async load(type, id, key) {
        const filename = path.join(this.cacheDir, `${key}.json`)
        let cached = this.memory.get(key)
        if (!cached) {
            try {
                const disk = JSON.parse(await readFile(filename, 'utf8'))
                if (disk.version === 1 && Number.isFinite(disk.fetchedAt) && disk.fetchedAt <= this.now() && validToolData(type, disk.data, id)) cached = disk
            } catch { /* First use or a corrupt cache: fetch the public endpoint. */ }
        }
        if (cached && this.now() - cached.fetchedAt < this.ttl) {
            this.memory.set(key, cached)
            return { ...cached, stale: false }
        }
        const failed = this.failedAt.get(key)
        if (failed !== undefined && this.now() - failed < this.retryMs) {
            if (cached) return { ...cached, stale: true }
            throw new Error('森空岛数据暂时不可用，请稍后重试')
        }
        try {
            const url = new URL(endpoints[type], 'https://zonai.skland.com')
            if (type === 'operator') url.searchParams.set('charId', id)
            const response = await this.fetcher(url.toString(), { signal: AbortSignal.timeout(20000), headers: { Accept: 'application/json' } })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            const body = await response.json()
            if (body.code !== 0 || !validToolData(type, body.data, id)) throw new Error('官方数据结构不完整')
            const result = { version: 1, fetchedAt: this.now(), data: body.data }
            this.memory.set(key, result)
            this.failedAt.delete(key)
            // A read-only filesystem must not prevent an otherwise successful query.
            const temp = `${filename}.${randomUUID()}.tmp`
            try {
                await mkdir(this.cacheDir, { recursive: true })
                await writeFile(temp, JSON.stringify(result), 'utf8')
                await rename(temp, filename)
            } catch { await unlink(temp).catch(() => {}) }
            return { ...result, stale: false }
        } catch {
            this.failedAt.set(key, this.now())
            if (cached) {
                this.memory.set(key, cached)
                return { ...cached, stale: true }
            }
            throw new Error('森空岛数据获取失败，请稍后重试')
        }
    }
}

export default new SklandTools()
