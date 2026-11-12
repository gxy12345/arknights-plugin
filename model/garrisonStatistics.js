import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { garrisonMetricRecord } from './garrisonView.js'
import { mergeMetricRecords } from './garrisonStatisticsCore.js'

const pending = new Map()

async function readStatistics(file) {
    try {
        return await readFile(file)
    } catch (error) {
        if (error.code !== 'ENOENT') throw error
        return undefined
    }
}

async function saveStatistics(file, data) {
    const temp = `${file}.${randomUUID()}.tmp`
    await mkdir(dirname(file), { recursive: true })
    try {
        await writeFile(temp, JSON.stringify(data), { encoding: 'utf8', mode: 0o600, flag: 'wx' })
        await rename(temp, file)
    } catch (error) {
        if (error.code !== 'EEXIST') await unlink(temp).catch(() => {})
        throw error
    }
}

async function mergeStatistics(file, seasonId, records, assets) {
    const original = await readStatistics(file)
    const saved = original === undefined ? undefined : JSON.parse(original.toString('utf8'))
    const { snapshot, summary, changed } = mergeMetricRecords(seasonId, saved, records, assets)
    if (changed) {
        if (saved?.version === 1) {
            const backup = `${file.slice(0, -5)}.v1.${Date.now()}.${randomUUID()}.bak`
            await writeFile(backup, original, { mode: 0o600, flag: 'wx' })
        }
        await saveStatistics(file, snapshot)
    }
    return summary
}

export class GarrisonStatisticsStore {
    constructor(directory = resolve('data/arknights/garrison/statistics')) {
        this.directory = resolve(directory)
    }

    async sync(uid, seasonId, records, assets = []) {
        try {
            if (!uid || !seasonId) throw new Error('Missing garrison account or season')
            const file = resolve(this.directory, `uid-${encodeURIComponent(uid)}`, `${encodeURIComponent(seasonId)}.json`)
            const facts = records.map(garrisonMetricRecord)
            // Queue updates from concurrent commands for the same account and season.
            const previous = pending.get(file)
            const task = (previous ? previous.catch(() => {}) : Promise.resolve())
                .then(() => mergeStatistics(file, seasonId, facts, assets))
            pending.set(file, task)
            try {
                return await task
            } finally {
                if (pending.get(file) === task) pending.delete(file)
            }
        } catch (cause) {
            const error = new Error('卫戍统计本地存储失败', { cause })
            error.code = 'GARRISON_STATISTICS_STORAGE'
            throw error
        }
    }
}

export default new GarrisonStatisticsStore()
