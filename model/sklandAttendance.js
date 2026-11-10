const games = { arknights: '明日方舟', endfield: '终末地' }
const label = value => typeof value === 'string' ? value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 80) : ''
const codeOf = value => !['number', 'string'].includes(typeof value?.code) || value.code === '' ? null : Number(value.code)
const failed = game => ({ game, status: 'failed', message: '签到失败，请检查绑定或稍后重试', awards: [] })

/** Binding UID is an account ID; Endfield attendance requires the nested game role. */
export function getEndfieldRoles(response) {
    if (codeOf(response) !== 0 || !Array.isArray(response.data?.list)) throw new Error('终末地角色查询失败')
    const roles = new Map()
    for (const game of response.data.list) {
        if (!game || typeof game.appCode !== 'string') throw new Error('角色列表资料不完整')
        if (game.appCode !== 'endfield') continue
        if (!Array.isArray(game.bindingList)) throw new Error('终末地角色资料不完整')
        for (const binding of game.bindingList) {
            if (!binding || (!Array.isArray(binding.roles) && !binding.defaultRole)
                || (binding.roles != null && !Array.isArray(binding.roles))) throw new Error('终末地角色资料不完整')
            const candidates = [...(binding.roles || []), ...(binding.defaultRole ? [binding.defaultRole] : [])]
            for (const role of candidates) {
                const roleId = String(role?.roleId ?? ''), serverId = String(role?.serverId ?? '')
                if (!/^[1-9]\d*$/.test(roleId) || !/^\d+$/.test(serverId)) throw new Error('终末地角色资料不完整')
                const key = `${serverId}:${roleId}`
                if (!roles.has(key)) roles.set(key, { roleId, serverId,
                    name: label(role.nickname) || label(binding.nickName) || '管理员', serverName: label(role.serverName) })
            }
        }
    }
    return [...roles.values()]
}

export function attendanceResult(response, game) {
    const code = codeOf(response), data = response?.data
    const duplicate = code === 10001 && (game === 'arknights'
        || /请勿重复签到|今日(?:已经|已)签到|今天(?:已经|已)签到|already\s+(?:signed|checked)/i.test(response.message || ''))
    if (duplicate || code === 0 && data?.already_signed === true) return { game, status: 'signed', message: '今天已经签到过了', awards: [] }
    if (code !== 0 || !data || typeof data !== 'object' || Array.isArray(data)) return failed(game)
    const raw = game === 'arknights' ? data.awards : data.awardIds
    const awards = (Array.isArray(raw) ? raw : []).flatMap(award => {
        const item = game === 'arknights' ? award?.resource : data.resourceInfoMap?.[award?.id]
        const name = label(item?.name), value = game === 'arknights' ? award?.count : item?.count ?? award?.count
        const count = value == null || value === '' ? NaN : Number(value)
        return name && Number.isFinite(count) && count >= 0 ? [{ name, count }] : []
    })
    return { game, status: 'success', message: '签到完成', awards }
}

export function formatAttendanceResults(results) {
    return ['森空岛签到结果', ...results.map(result => {
        const role = result.role ? ` · ${result.role.name}${result.role.serverName ? `（${result.role.serverName}）` : ''}` : ''
        const awards = result.status === 'success' ? result.awards.length
            ? '\n' + result.awards.map(item => `${item.name} × ${item.count}`).join('\n') : '（奖励信息暂不可用）' : ''
        return `【${games[result.game]}${role}】${result.message}${awards}`
    })].join('\n')
}

/** Direct official requests, sharing credentials without changing the bound AK UID. */
export default class SklandAttendance {
    constructor(user, { sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
        this.request = user.sklReq
        this.sleep = sleep
    }

    async getData(type, params = {}) {
        try { return await this.request.getData(type, params) } catch { return null }
    }

    async run({ includeEndfield = true } = {}) {
        const results = [attendanceResult(await this.getData('attendance'), 'arknights')]
        if (!includeEndfield) return results
        let roles
        try { roles = getEndfieldRoles(await this.getData('binding')) } catch {
            results.push({ ...failed('endfield'), message: '角色查询失败，请检查绑定或稍后重试' })
            return results
        }
        if (!roles.length) results.push({ game: 'endfield', status: 'skipped', message: '未发现可签到角色，已跳过', awards: [] })
        for (const role of roles) {
            await this.sleep(1000)
            const response = await this.getData('endfield_attendance', { headers: {
                'sk-game-role': `3_${role.roleId}_${role.serverId}`,
                Origin: 'https://game.skland.com', Referer: 'https://game.skland.com/'
            } })
            results.push({ ...attendanceResult(response, 'endfield'), role })
        }
        return results
    }
}
