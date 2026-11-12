import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { garrisonRecordLabels, garrisonRecordStatistics } from './garrisonView.js'

const pending = new Map()
const toneOrder = ['training', 'standard', 'risk', 'extreme', 'ultimate', 'neutral']
const difficultyKey = ({ modeCode, difficultyCode }) => JSON.stringify([modeCode, difficultyCode])

async function readStatistics(file) {
    try {
        const data = JSON.parse(await readFile(file, 'utf8'))
        if (data?.version !== 1 || !Array.isArray(data.recordIds) || !Array.isArray(data.difficulties) ||
            !Number.isFinite(data.kills) || !Number.isSafeInteger(data.killsReported)) {
            throw new Error('Invalid garrison statistics file')
        }
        return data
    } catch (error) {
        if (error.code !== 'ENOENT') throw error
        return { version: 1, recordIds: [], difficulties: [], kills: 0, killsReported: 0, latestTrophy: null }
    }
}

async function saveStatistics(file, data) {
    const temp = `${file}.${randomUUID()}.tmp`
    await mkdir(dirname(file), { recursive: true })
    try {
        await writeFile(temp, JSON.stringify(data), { encoding: 'utf8', mode: 0o600 })
        await rename(temp, file)
    } catch (error) {
        await unlink(temp).catch(() => {})
        throw error
    }
}

async function mergeStatistics(file, seasonId, records) {
    const data = await readStatistics(file)
    const ids = new Set(data.recordIds)
    const groups = new Map(data.difficulties.map(row => [difficultyKey(row), row]))
    for (const raw of records) {
        const { id, modeCode, difficultyCode, success, timestamp, killCnt, trophyAfter } = garrisonRecordStatistics(raw)
        if (!id || ids.has(id)) continue
        ids.add(id)
        const difficulty = modeCode === 'LOCAL' ? 'TRAINING' : difficultyCode
        const key = difficultyKey({ modeCode, difficultyCode: difficulty })
        if (!groups.has(key)) groups.set(key, { modeCode, difficultyCode: difficulty, total: 0, wins: 0 })
        const row = groups.get(key)
        row.total++
        if (success) row.wins++

        if (Number.isFinite(killCnt) && killCnt >= 0) {
            data.kills += killCnt
            data.killsReported++
        }
        const time = Number(timestamp)
        const timeMs = time < 1e12 ? time * 1000 : time
        if (Number.isFinite(timeMs) && timeMs > (data.latestTrophy?.timeMs ?? 0) &&
            Number.isFinite(trophyAfter) && trophyAfter >= 0) {
            data.latestTrophy = { timeMs, value: trophyAfter }
        }
    }

    if (ids.size > data.recordIds.length) {
        data.recordIds = [...ids]
        data.difficulties = [...groups.values()]
        await saveStatistics(file, data)
    }
    const difficulties = data.difficulties.map(({ modeCode, difficultyCode, total, wins }) => {
        const { mode, modeTone, difficulty, difficultyTone } = garrisonRecordLabels({ modeCode, difficultyCode, seasonId })
        return { mode, modeTone, label: difficulty, tone: difficultyTone, total, wins }
    }).sort((a, b) => a.modeTone.localeCompare(b.modeTone) || toneOrder.indexOf(a.tone) - toneOrder.indexOf(b.tone))
    return {
        total: ids.size,
        wins: difficulties.reduce((sum, row) => sum + row.wins, 0),
        trophies: data.latestTrophy?.value ?? null,
        kills: data.killsReported ? data.kills : null,
        killsReported: data.killsReported,
        difficulties
    }
}

export class GarrisonStatisticsStore {
    constructor(directory = resolve('data/arknights/garrison/statistics')) {
        this.directory = resolve(directory)
    }

    async sync(uid, seasonId, records) {
        try {
            if (!uid || !seasonId) throw new Error('Missing garrison account or season')
            const file = resolve(this.directory, `uid-${encodeURIComponent(uid)}`, `${encodeURIComponent(seasonId)}.json`)
            // Queue updates from concurrent commands for the same account and season.
            const previous = pending.get(file)
            const task = (previous ? previous.catch(() => {}) : Promise.resolve())
                .then(() => mergeStatistics(file, seasonId, records))
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
