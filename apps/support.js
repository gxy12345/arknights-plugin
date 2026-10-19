import fs from 'node:fs'
import path from 'node:path'
import { rulePrefix } from '../utils/common.js'
import SKLandUser from '../model/sklandUser.js'
import { getAvatarUrl, getSkinAvatarUrl, getSkillIconUrl } from '../model/imgApi.js'
import runtimeRender from '../utils/runtimeRender.js'

const characterInfoPath = path.join(process.cwd(), 'plugins/arknights-plugin/resources/gameData/character/character_info.json')
let characterInfo = {}
try {
    characterInfo = JSON.parse(fs.readFileSync(characterInfoPath, 'utf8')).character_info || {}
} catch (error) {
    globalThis.logger?.warn?.(`[方舟插件][助战]读取干员数据失败: ${error.message}`)
}

const phaseText = ['精英0', '精英1', '精英2']

function findCharacter(charId = '') {
    const normalizedId = String(charId).split('#')[0]
    return characterInfo[normalizedId] || characterInfo[charId] || {}
}

function getOwner(node = {}, fallback = {}) {
    return {
        name: node.name || node.nickName || node.nickname || node.playerName || node.gameName || fallback.name || '未知博士',
        uid: node.uid || node.playerUid || node.gameUid || fallback.uid || '',
        userId: node.userId || node.sklandUserId || node.sklandUid || fallback.userId || '',
    }
}

function readAssist(node = {}, owner = {}) {
    const charId = node.charId || node.characterId || node.operatorId || node.id
    if (!charId) return null

    const info = findCharacter(charId)
    const skinId = node.skinId || node.avatarId || `${charId}#1`
    const avatarUrl = String(skinId).includes('#') ? getSkinAvatarUrl(String(skinId)) : getAvatarUrl(String(skinId))
    const skillId = node.skillId || node.skill || node.mainSkillId || ''
    const phase = Number(node.evolvePhase ?? node.phase ?? node.elite ?? 0)
    const level = node.level ?? node.lv ?? '-'
    const specializeLevel = node.specializeLevel ?? node.mastery ?? node.skillLevel ?? 0
    const equip = node.equip || node.module || node.defaultEquipId || node.equipId || ''

    return {
        charId,
        name: node.charName || node.name || info.name || charId,
        rarity: Number(node.rarity ?? info.rarity ?? 0) + 1,
        avatarUrl,
        skillId,
        skillIconUrl: skillId ? getSkillIconUrl(skillId) : '',
        phase: phaseText[phase] || `精英${phase}`,
        level,
        specializeLevel,
        equip,
        ownerName: owner.name,
        ownerUid: owner.uid,
        ownerUserId: owner.userId,
        sklandUrl: owner.userId ? `skland://usersearch?userId=${encodeURIComponent(owner.userId)}` : '',
    }
}

function collectAssistEntries(value, fallbackOwner = {}, output = [], visited = new Set()) {
    if (!value || typeof value !== 'object') return output
    if (visited.has(value)) return output
    visited.add(value)

    if (Array.isArray(value)) {
        for (const item of value) collectAssistEntries(item, fallbackOwner, output, visited)
        return output
    }

    const owner = getOwner(value, fallbackOwner)
    const directAssist = value.assistChars || value.assistCharacters || value.assistants
    if (Array.isArray(directAssist)) {
        for (const item of directAssist) {
            const entry = readAssist(item, owner)
            if (entry) output.push(entry)
        }
    }

    const direct = readAssist(value, owner)
    if (direct && (value.charId || value.characterId || value.operatorId)) output.push(direct)

    for (const [key, child] of Object.entries(value)) {
        if (key === 'assistChars' || key === 'assistCharacters' || key === 'assistants') continue
        if (child && typeof child === 'object') collectAssistEntries(child, owner, output, visited)
    }
    return output
}

function dedupeAssistEntries(entries) {
    const map = new Map()
    for (const item of entries) {
        const key = `${item.ownerUserId || item.ownerUid || item.ownerName}:${item.charId}:${item.level}:${item.specializeLevel}`
        if (!map.has(key)) map.set(key, item)
    }
    return [...map.values()]
}

export class SupportSearch extends plugin {
    constructor() {
        super({
            name: '[arknights-plugin]助战检索',
            dsc: '森空岛助战干员检索',
            event: 'message',
            priority: 100,
            rule: [
                {
                    reg: `^${rulePrefix}助战(?:检索|查询)?(?:\\s+(.+))?$`,
                    fnc: 'search'
                }
            ]
        })
    }

    async search() {
        const match = this.e.msg.match(new RegExp(`^${rulePrefix}助战(?:检索|查询)?(?:\\s+(.+))?$`))
        // rulePrefix 本身包含捕获组，干员关键词始终取最后一个捕获组。
        const keyword = match?.at(-1)?.trim()
        if (!keyword) {
            await this.reply(`用法：${rulePrefix}助战 <干员名>\n例如：${rulePrefix}助战 森蚺`)
            return true
        }

        const target = this.e.at || this.e.user_id
        const sklUser = new SKLandUser(target)
        if (!await sklUser.getUser()) {
            await this.reply('未绑定森空岛cred，请先绑定后再使用功能。可发送 /cred帮助 查看获取方法')
            return true
        }

        await this.reply(`正在检索助战干员「${keyword}」，请稍等`)
        const friendRes = await sklUser.getGameFriendList()
        const infoRes = await sklUser.getGamePlayerInfo()
        const fallbackOwner = {
            name: infoRes?.data?.status?.name || sklUser.name,
            uid: infoRes?.data?.status?.uid || sklUser.uid,
            userId: await sklUser.getSklandUserId(),
        }

        let candidates = []
        if (friendRes?.code === 0) candidates = collectAssistEntries(friendRes.data || friendRes, fallbackOwner)
        if (!candidates.length && infoRes?.code === 0) {
            candidates = collectAssistEntries(infoRes.data || infoRes, fallbackOwner)
        }

        const normalizedKeyword = keyword.toLowerCase()
        const results = dedupeAssistEntries(candidates).filter(item =>
            item.name.toLowerCase().includes(normalizedKeyword) ||
            String(item.charId).toLowerCase().includes(normalizedKeyword)
        ).slice(0, 30)

        if (!results.length) {
            await this.reply(`未找到「${keyword}」的助战记录。当前接口返回的好友列表可能未授权助战数据。`)
            return true
        }

        await runtimeRender(this.e, 'support/support.html', {
            keyword,
            result_count: results.length,
            results,
        }, { scale: 1.0 })
        return true
    }
}
