import { createMaterialCatalog } from './cultivateMaterials.js'

const list = value => Array.isArray(value) ? value : []
const text = value => value == null ? '' : String(value)
const num = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null
const positive = value => num(value) !== null && num(value) >= 0 ? num(value) : null
const bounded = (value, min, max) => Math.min(max, Math.max(min, value))
const encode = value => encodeURIComponent(text(value)).replace(/'/g, '%27')
const asset = (type, id) => id ? `https://web.hycdn.cn/arknights/game/assets/${type}/${encode(id)}.png` : ''
const show = value => num(value) === null ? '—' : String(Math.round(num(value) * 10) / 10)
const validId = value => value && value !== -1 && value !== '-1'
const timestamp = value => num(value) === null ? null : num(value) > 1e12 ? num(value) / 1000 : num(value)

export function playerTime(value, dateOnly = false) {
    const seconds = timestamp(value)
    if (seconds === null || seconds <= 0) return '暂无同步时间'
    return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
        ...(dateOnly ? {} : { hour: '2-digit', minute: '2-digit', hour12: false }) }).format(seconds * 1000)
}

export function playerDuration(value) {
    const seconds = positive(value)
    if (seconds === null) return '时间未知'
    if (seconds <= 0) return '已完成'
    const minutes = Math.ceil(seconds / 60), days = Math.floor(minutes / 1440), hours = Math.floor(minutes % 1440 / 60), mins = minutes % 60
    return days ? `${days}天${hours}小时` : hours ? `${hours}小时${mins}分钟` : `${minutes}分钟`
}

function meter(current, max, note = '') {
    const c = positive(current), m = positive(max)
    return { current: c, max: m, text: show(c), maxText: show(m), known: c !== null && m !== null,
        percent: c !== null && m > 0 ? bounded(c / m * 100, 0, 100) : 0, note }
}

export function playerAp(ap, now) {
    if (!ap) return meter(null, null, '暂无理智数据')
    const current = positive(ap.current), max = positive(ap.max), fullAt = timestamp(ap.completeRecoveryTime), last = timestamp(ap.lastApAddTime)
    if (current === null || max === null) return meter(current, max, '暂无理智数据')
    if (max === 0) return meter(current, max, '暂无理智上限')
    if (current >= max) return meter(current, max, current > max ? '理智已超过上限' : '理智已全部恢复')
    if (fullAt === null || fullAt <= 0) return meter(current, max, '同步时理智')
    if (fullAt <= now) return meter(max, max, '理智已全部恢复')
    const recovered = last !== null && last > 0 ? Math.max(0, Math.floor((now - last) / 360)) : 0
    return meter(Math.min(max, current + recovered), max, `${playerDuration(fullAt - now)}后回满`)
}

export function playerDrones(labor, now) {
    if (!labor) return meter(null, null, '暂无无人机数据')
    const value = positive(labor.value), max = positive(labor.maxValue), last = timestamp(labor.lastUpdateTime), remaining = positive(labor.remainSecs)
    if (value === null || max === null) return meter(value, max, '暂无无人机数据')
    if (max === 0) return meter(value, max, '暂无无人机上限')
    if (value >= max) return meter(value, max, '无人机已全部恢复')
    if (remaining === null || remaining === 0 || last === null || last <= 0) return meter(value, max, '同步时数量')
    const elapsed = Math.max(0, now - last)
    const recovered = Math.floor((max - value) * bounded(elapsed / remaining, 0, 1))
    return meter(Math.min(max, value + recovered), max, elapsed >= remaining ? '无人机已全部恢复' : `${playerDuration(remaining - elapsed)}后回满`)
}

function periodStart(now, period) {
    // Shift the CN 04:00 reset boundary to UTC midnight.
    const shifted = new Date((now + 14400) * 1000)
    let start = Math.floor((now + 14400) / 86400) * 86400 - 14400
    if (period === 'weekly') start -= ((shifted.getUTCDay() + 6) % 7) * 86400
    if (period === 'tower') start = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() >= 16 ? 16 : 1) / 1000 - 14400
    return start
}

function reward(value, storedAt, now, period) {
    const current = positive(value?.current), max = positive(value?.total)
    const expired = storedAt > 0 && storedAt < periodStart(now, period)
    return meter(expired && current !== null ? 0 : current, max, expired ? '已进入新周期' : '')
}

export function buildPlayerIdentity(data, now = Math.floor(Date.now() / 1000)) {
    const status = data.status || {}, avatar = status.avatar || {}, secretary = status.secretary || {}, metadata = data.charInfoMap || {}
    const registered = timestamp(status.registerTs), stored = timestamp(status.storeTs)
    const safeAvatar = /^https:\/\/(?:web|bbs)\.hycdn\.cn\//.test(text(avatar.url)) ? avatar.url : ''
    const stage = status.mainStageProgress
    return { name: text(status.name) || '博士', uid: text(status.uid) || '—', level: show(status.level), server: text(status.serverName),
        avatar: safeAvatar || asset(avatar.type === 'ICON' ? 'avatar' : 'char_skin/avatar', avatar.id),
        registered: registered > 0 ? playerTime(registered, true) : '暂无入职记录',
        days: registered > 0 && now >= registered ? Math.ceil((now - registered) / 86400) : null,
        mainStage: stage ? text(data.stageInfoMap?.[stage]?.code || stage) : stage === '' || stage === null ? '全部完成' : '暂无进度',
        secretary: { name: metadata[secretary.charId]?.name || (validId(secretary.charId) ? '助理干员' : '未设置助理'),
            portrait: asset(secretary.skinId ? 'char_skin/portrait' : 'char/portrait', secretary.skinId || secretary.charId),
            fallback: asset('char/portrait', secretary.charId) },
        syncedAt: playerTime(stored), queriedAt: playerTime(now), storedAt: stored,
        stale: stored > 0 && now - stored > 3600, hasSyncTime: stored > 0 }
}

function clueInfo(meeting, now) {
    const clue = meeting?.clue
    const factions = ['RHINE', 'PENGUIN', 'BLACKSTEEL', 'URSUS', 'GLASGOW', 'KJERAG', 'RHODES']
    const names = ['莱茵生命', '企鹅物流', '黑钢国际', '乌萨斯学生自治团', '格拉斯哥帮', '喀兰贸易', '罗德岛']
    const board = new Set(list(clue?.board)), complete = factions.every(id => board.has(id)), end = timestamp(clue?.shareCompleteTime)
    const sharing = clue?.sharing === true
    const state = !clue ? '暂无线索数据' : sharing ? end > now ? '线索交流中' : '交流已结束' : complete ? '可开启线索交流' : '线索收集中'
    return { known: Boolean(clue), count: factions.filter(id => board.has(id)).length, own: show(clue?.own), received: show(clue?.received),
        sharing, state, note: sharing && end > now ? `${playerDuration(end - now)}后结束` : !sharing && complete ? '7份线索已集齐' : '',
        board: factions.map((id, index) => ({ id, number: index + 1, name: names[index], owned: board.has(id) })) }
}

function trainingInfo(training, data, now) {
    const trainee = training?.trainee, trainer = training?.trainer, valid = validId(trainee?.charId)
    const selected = num(trainee?.targetSkill), remaining = num(training?.remainSecs)
    const owned = list(data.chars).find(c => c.charId === trainee?.charId)
    const skill = selected !== null && selected >= 0 ? list(owned?.skills)[selected] : null
    const sinceQuery = Math.max(0, now - (timestamp(data.currentTs) || now))
    const seconds = remaining !== null && remaining >= 0 ? Math.max(0, remaining - sinceQuery) : null
    let state = !training ? '暂无训练数据' : !valid ? '空闲中' : selected === null || selected < 0 ? '未选择专精技能' : seconds === null ? '训练状态未知' : seconds <= 0 ? '专精已完成' : '专精训练中'
    return { state, active: valid && selected !== null && selected >= 0 && seconds > 0,
        name: data.charInfoMap?.[trainee?.charId]?.name || (valid ? '受训干员' : '暂无受训干员'),
        skill: selected !== null && selected >= 0 ? `技能${selected + 1}` : '', mastery: positive(skill?.specializeLevel),
        note: seconds > 0 ? `${playerDuration(seconds)}后完成` : '',
        trainee, trainer }
}

function recruits(data, now) {
    return list(data.recruit).map((slot, index) => {
        const state = num(slot.state), end = timestamp(slot.finishTs), start = timestamp(slot.startTs)
        const ready = state === 3 || state === 2 && end > 0 && end <= now
        const total = positive(slot.duration) || (end > start && start > 0 ? end - start : null)
        return { index: index + 1, state: ready ? '可聘用' : state === 0 ? '未开放' : state === 1 ? '空闲' : state === 2 ? '招募中' : '状态未知',
            ready, working: state === 2 && !ready, note: state === 2 && end > now ? `${playerDuration(end - now)}后完成` : ready ? '等待博士确认' : '',
            percent: ready ? 100 : state === 2 && total > 0 && end > 0 ? bounded((total - end + now) / total * 100, 0, 100) : 0 }
    })
}

function assistOperators(data) {
    return list(data.assistChars).map((char, index) => {
        if (!validId(char?.charId)) return { empty: true, index: index + 1 }
        const meta = data.charInfoMap?.[char.charId] || {}, owner = list(data.chars).find(c => c.charId === char.charId)
        const skillIndex = list(owner?.skills).findIndex(s => s.id === char.skillId)
        const equip = char.equip, equipMeta = data.equipmentInfoMap?.[equip?.id] || {}
        const hasModule = equip?.id && !equip.id.startsWith('uniequip_001_') && text(equipMeta.typeIcon).toUpperCase() !== 'ORIGINAL'
        return { index: index + 1, name: meta.name || '助战干员', avatar: asset(char.skinId ? 'char_skin/avatar' : 'char/avatar', char.skinId || char.charId),
            fallback: asset('char/avatar', char.charId), level: show(char.level), elite: show(char.evolvePhase),
            skill: asset('char_skill', char.skillId), skillName: skillIndex >= 0 ? `技能${skillIndex + 1}` : '助战技能',
            skillLevel: positive(char.specializeLevel) > 0 ? `专精${char.specializeLevel}` : `${show(char.mainSkillLvl)}级`,
            module: hasModule ? `${equipMeta.name || text(equipMeta.typeIcon).toUpperCase() || '已装备模组'} Lv.${show(equip.level)}` : '未装备模组' }
    })
}

export function buildProfileView(data = {}, { now = Math.floor(Date.now() / 1000) } = {}) {
    const user = buildPlayerIdentity(data, now), building = data.building || {}, status = data.status || {}
    const charCount = Array.isArray(data.chars) ? new Set(data.chars.filter(c => c?.charId && (c.charId === 'char_002_amiya' || !c.charId.includes('_amiya'))).map(c => c.charId)).size : positive(status.charCnt)
    const assets = [{ label: '雇佣干员', value: charCount }, { label: '时装收藏', value: Array.isArray(data.skins) ? new Set(data.skins.map(s => s.id)).size : positive(status.skinCnt) },
        { label: '家具保有', value: positive(building.furniture?.total) ?? positive(status.furnitureCnt) }, { label: '蚀刻章', value: positive(data.medal?.total) }]
    const recruitment = recruits(data, now), training = trainingInfo(building.training, data, now)
    const tasks = [{ label: '每日任务', ...reward(data.routine?.daily, user.storedAt, now, 'daily') },
        { label: '每周任务', ...reward(data.routine?.weekly, user.storedAt, now, 'weekly') },
        { label: '剿灭作战', ...reward(data.campaign?.reward, user.storedAt, now, 'weekly') },
        { label: '数据增补条', ...reward(data.tower?.reward?.lowerItem, user.storedAt, now, 'tower') },
        { label: '数据增补仪', ...reward(data.tower?.reward?.higherItem, user.storedAt, now, 'tower') }]
    return { user, assets: assets.map(a => ({ ...a, value: show(a.value) })), ap: playerAp(status.ap, now), drones: playerDrones(building.labor, now),
        tasks, recruits: recruitment, recruitReady: recruitment.filter(s => s.ready).length, recruitTotal: recruitment.filter(s => s.state !== '未开放').length,
        training, clues: clueInfo(building.meeting, now), refreshCount: show(building.hire?.refreshCount), assists: assistOperators(data) }
}

export function buildingResidents(residents, data, slots) {
    const occupants = list(residents).filter(r => r && validId(r.charId))
    const chars = new Map(list(data.chars).map(c => [c.charId, c]))
    const result = occupants.map((resident, i) => {
        const char = chars.get(resident.charId), meta = data.charInfoMap?.[resident.charId] || {}, ap = positive(resident.ap)
        const mood = ap === null ? null : bounded(ap / 360000, 0, 24)
        return { id: text(resident.charId), index: num(resident.index) ?? i, name: meta.name || '干员资料缺失',
            avatar: asset(char?.skinId ? 'char_skin/avatar' : 'char/avatar', char?.skinId || resident.charId), fallback: asset('char/avatar', resident.charId),
            mood: mood === null ? '—' : mood.toFixed(1), percent: mood === null ? 0 : mood / 24 * 100,
            moodKnown: mood !== null, moodTone: mood === null ? 'unknown' : mood === 0 ? 'exhausted' : mood < 6 ? 'low' : 'normal' }
    }).sort((a, b) => a.index - b.index)
    while (result.length < slots) result.push({ empty: true, index: result.length, name: '空闲位置' })
    return result
}

const roomKinds = { control: '控制中枢', manufacture: '制造站', trading: '贸易站', power: '发电站', meeting: '会客室', hire: '办公室', training: '训练室', dormitory: '宿舍' }
const productionLayout = ['slot_24', 'slot_25', 'slot_26', 'slot_14', 'slot_15', 'slot_16', 'slot_5', 'slot_6', 'slot_7']
const dormLayout = ['slot_28', 'slot_20', 'slot_9', 'slot_3']
const sortRooms = layout => (a, b) => {
    const ai = layout.indexOf(a.id), bi = layout.indexOf(b.id)
    return (ai < 0 ? layout.length : ai) - (bi < 0 ? layout.length : bi) || a.id.localeCompare(b.id, 'zh-CN', { numeric: true })
}

/** Independent snapshot presentation, guided by official fields and the reference feature set. */
export function buildInfrastructureView(data = {}, { now = Math.floor(Date.now() / 1000), items = [] } = {}) {
    const building = data.building || {}, catalog = createMaterialCatalog(items), training = trainingInfo(building.training, data, now)
    const material = id => catalog.resolve(id)
    const room = (kind, raw, index = 0) => {
        if (!raw) return null
        const level = positive(raw.level), capacity = ['manufacture', 'trading'].includes(kind) ? Math.max(1, Math.min(3, level || 1)) : kind === 'meeting' ? Math.max(1, Math.min(2, level || 1)) : ['control', 'dormitory'].includes(kind) ? 5 : 1
        const residents = buildingResidents(raw.chars, data, level === 0 ? 0 : capacity)
        const base = { kind, id: text(raw.slotId || `${kind}_${index}`), name: roomKinds[kind], number: index + 1, level: show(level), locked: level === 0,
            known: level !== null, residents, occupied: residents.filter(c => !c.empty).length, status: level === 0 ? '未建造' : '', metrics: [], details: [], notes: [] }
        if (kind === 'manufacture') {
            const formula = data.manufactureFormulaInfoMap?.[raw.formulaId], product = formula?.itemId ? material(formula.itemId) : null
            base.product = product ? { name: product.name, icon: product.iconUrl } : { name: raw.formulaId ? `未知配方 ${raw.formulaId}` : '未设置配方', icon: '' }
            base.stock = meter(raw.weight, raw.capacity)
            base.metrics = [{ label: '仓储', value: `${base.stock.text}/${base.stock.maxText}` }, { label: '生产效率', value: num(raw.speed) !== null ? `${Math.round(raw.speed * 100)}%` : '—' }, { label: '已完成', value: show(raw.complete) }]
            const finish = timestamp(raw.completeWorkTime)
            base.status = !raw.formulaId || raw.formulaId === '0' ? '未设置生产' : !base.stock.known ? '暂无仓储数据' : base.stock.current >= base.stock.max && base.stock.max > 0 ? '仓库已满' : positive(raw.remain) === 0 ? '生产计划已完成' : '制造中'
            if (finish > now) base.notes.push(`预计${playerDuration(finish - now)}后满仓`)
            else if (finish > 0 && base.stock.current < base.stock.max) base.notes.push('生产进度待游戏同步')
        } else if (kind === 'trading') {
            const stock = Array.isArray(raw.stock) ? raw.stock : null
            base.stock = meter(stock ? stock.length : null, raw.stockLimit)
            base.product = { name: ({ O_GOLD: '龙门商法', O_DIAMOND: '开采协力' })[raw.strategy] || (raw.strategy ? `未知贸易策略 ${raw.strategy}` : '未设置贸易策略'), icon: '' }
            const total = list(stock).reduce((sum, order) => sum + (positive(order.gain?.count) || 0), 0)
            const gainNames = [...new Set(list(stock).flatMap(order => order.gain?.id ? [material(order.gain.id).name] : []))]
            const gainsKnown = stock && stock.every(order => positive(order.gain?.count) !== null)
            base.metrics = [{ label: '已存订单', value: `${base.stock.text}/${base.stock.maxText}` }, { label: '收益合计', value: !gainsKnown ? '—' : gainNames.length > 1 ? '多种收益' : `${show(total)}${gainNames.length === 1 ? ` ${gainNames[0]}` : ''}` }]
            base.details = list(stock).map(order => ({
                delivery: list(order.delivery).map(item => `${material(item.id).name} ×${show(item.count)}`).join(' + ') || '交付材料未知',
                gain: order.gain ? `${material(order.gain.id).name} ×${show(order.gain.count)}` : '收益未知'
            }))
            base.status = stock?.length ? '有订单待交付' : stock ? '等待订单' : '暂无订单数据'
            const finish = timestamp(raw.completeWorkTime)
            if (finish > now) base.notes.push(`下单剩余 ${playerDuration(finish - now)}`)
            else if (finish > 0) base.notes.push('新订单进度待游戏同步')
        } else if (kind === 'power') {
            const output = positive(raw.power) ?? positive(raw.output) ?? ({ 1: 60, 2: 130, 3: 270 })[level]
            base.metrics = [{ label: raw.power != null || raw.output != null ? '供电' : '标准供电', value: show(output) }]
            base.status = base.occupied ? '运转中' : '未进驻干员'
        } else if (kind === 'control') {
            base.metrics = [{ label: '进驻干员', value: `${base.occupied}/${capacity}` }]
            base.status = base.occupied ? '中枢运行中' : '未进驻干员'
        } else if (kind === 'dormitory') {
            base.metrics = [{ label: '氛围', value: show(raw.comfort) }, { label: '休息干员', value: `${base.occupied}/5` }]
            base.status = base.occupied ? '休息中' : '宿舍空闲'
        } else if (kind === 'meeting') {
            base.clues = clueInfo(raw, now)
            base.metrics = [{ label: '自有线索', value: base.clues.own }, { label: '接收线索', value: base.clues.received }]
            base.status = base.clues.state
            if (base.clues.note) base.notes.push(base.clues.note)
        } else if (kind === 'hire') {
            base.metrics = [{ label: '可用联络', value: show(raw.refreshCount) }]
            const finish = timestamp(raw.completeWorkTime)
            base.status = positive(raw.refreshCount) > 0 ? '可刷新招募标签' : base.occupied ? '联络中' : '联络暂停'
            if (finish > now) base.notes.push(`${playerDuration(finish - now)}后完成联络`)
            else if (finish > 0) base.notes.push('联络进度待游戏同步')
        } else if (kind === 'training') {
            base.status = training.state
            base.residents = [training.trainee, training.trainer].map((r, i) => ({ ...buildingResidents(r ? [r] : [], data, 1)[0], role: i ? '协助干员' : '受训干员' }))
            base.occupied = base.residents.filter(r => !r.empty).length
            base.metrics = [{ label: '专精技能', value: training.skill || '—' }, { label: '当前专精', value: training.mastery === null ? '—' : show(training.mastery) }]
            if (training.note) base.notes.push(training.note)
        }
        return base
    }
    const production = [['manufacture', 'manufactures'], ['trading', 'tradings'], ['power', 'powers']].flatMap(([kind, key]) => list(building[key]).map((r, i) => room(kind, r, i))).filter(Boolean).sort(sortRooms(productionLayout))
    const dormitories = list(building.dormitories).map((r, i) => room('dormitory', r, i)).filter(Boolean).sort(sortRooms(dormLayout))
    const control = room('control', building.control), services = ['meeting', 'hire', 'training'].map(kind => room(kind, building[kind])).filter(Boolean)
    const all = [control, ...production, ...services, ...dormitories].filter(Boolean)
    const tired = Array.isArray(building.tiredChars) ? new Set(building.tiredChars.map(c => text(c?.charId || c))).size : null
    return { user: buildPlayerIdentity(data, now), control, production, services, dormitories, drones: playerDrones(building.labor, now),
        roomCount: all.filter(r => !r.locked).length, residentCount: new Set(all.flatMap(r => r.residents.filter(c => !c.empty).map(c => c.id))).size,
        tiredCount: show(tired), unknown: !data.building || !all.length }
}
