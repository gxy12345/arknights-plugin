import { rulePrefix } from '../utils/common.js'
import setting from '../utils/setting.js'
import runtimeRender from '../utils/runtimeRender.js'
import puppeteer from '../../../lib/puppeteer/puppeteer.js'

const cache_key = 'ARKNIGHTS:WEB_DATA:ACTIVITY'
const group_push_key = 'ARKNIGHTS:ACTIVITY:GROUP_PUSH:'
const activity_api = 'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/refs/heads/master/zh_CN/gamedata/excel/activity_table.json'

export class Activity extends plugin {
    constructor() {
        super({
            name: '[arknights-plugin]活动查询',
            dsc: '活动查询与提醒',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^${rulePrefix}(活动|活动)(列表|查询)?$`,
                    fnc: 'activityList'
                },
                {
                    reg: `^${rulePrefix}开启活动推送$`,
                    permission: 'master',
                    fnc: 'enablePush'
                },
                {
                    reg: `^${rulePrefix}关闭活动推送$`,
                    permission: 'master',
                    fnc: 'disablePush'
                },
                {
                    reg: `^${rulePrefix}(更新|刷新)活动(数据)?$`,
                    permission: 'master',
                    fnc: 'refreshActivityData'
                },
            ]
        })
        this.setting = setting.getConfig('activity')
        
        // 定时任务配置
        this.task = {
            cron: this.setting?.activity_push_cron || '0 0 10 * * ?',
            name: '活动推送任务',
            fnc: () => this.pushActivityTask()
        }
    }

    /**
     * 查询活动列表
     */
    async activityList() {
        let activity_data = await this.getActivityData()
        if (!activity_data) {
            await this.reply('获取活动数据失败，请稍后再试')
            return false
        }

        let now = Math.floor(Date.now() / 1000)
        let three_days = 3 * 24 * 60 * 60

        // 筛选进行中、即将开始和即将结束的活动
        let ongoing_activities = []
        let ending_activities = []
        let starting_activities = []

        for (let activity of activity_data) {
            // 进行中的活动（当前时间在开始和结束时间之间）
            if (activity.startTime <= now && activity.endTime > now) {
                let remainingTime = activity.endTime - now
                ongoing_activities.push({
                    ...activity,
                    remainingTime: remainingTime,
                    isUrgent: remainingTime < 24 * 60 * 60 // 不足一天
                })
            }
            // 即将结束的活动（活动未结束且距离结束时间在3天内，但不在进行中）
            else if (activity.endTime > now && activity.endTime - now <= three_days) {
                ending_activities.push({
                    ...activity,
                    remainingTime: activity.endTime - now,
                    isUrgent: activity.endTime - now < 24 * 60 * 60 // 不足一天
                })
            }
            // 即将开始的活动（活动未开始且距离开始时间在3天内）
            else if (activity.startTime > now && activity.startTime - now <= three_days) {
                starting_activities.push({
                    ...activity,
                    remainingTime: activity.startTime - now,
                    isUrgent: activity.startTime - now < 24 * 60 * 60 // 不足一天
                })
            }
        }

        // 按剩余时间排序（由近及远）
        ongoing_activities.sort((a, b) => a.remainingTime - b.remainingTime)
        ending_activities.sort((a, b) => a.remainingTime - b.remainingTime)
        starting_activities.sort((a, b) => a.remainingTime - b.remainingTime)

        // 格式化剩余时间
        ongoing_activities = ongoing_activities.map(act => ({
            ...act,
            remainingText: this.formatTime(act.remainingTime)
        }))
        ending_activities = ending_activities.map(act => ({
            ...act,
            remainingText: this.formatTime(act.remainingTime)
        }))
        starting_activities = starting_activities.map(act => ({
            ...act,
            remainingText: this.formatTime(act.remainingTime)
        }))

        // 如果没有活动
        if (ongoing_activities.length === 0 && ending_activities.length === 0 && starting_activities.length === 0) {
            await this.reply('当前没有进行中或近期3天内即将开始或结束的活动')
            return true
        }

        let currentDate = new Date()
        let year = currentDate.getFullYear()
        let month = currentDate.getMonth() + 1
        let day = currentDate.getDate()
        let dayOfWeek = currentDate.getDay()
        let weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
        let formattedDate = year + '-' + month + '-' + day + ' ' + weekDays[dayOfWeek]

        await runtimeRender(this.e, 'activity/activity.html', {
            ongoing_activities,
            ending_activities,
            starting_activities,
            current_time: formattedDate,
        }, {
            scale: 1.0
        })
        
        return true
    }

    /**
     * 开启活动推送
     */
    async enablePush() {
        if (!this.e.isGroup) {
            await this.reply('此命令仅在群聊中使用')
            return false
        }

        let group_id = this.e.group_id
        await redis.set(`${group_push_key}${group_id}`, '1')
        await this.reply('已开启本群的活动推送')
        return true
    }

    /**
     * 关闭活动推送
     */
    async disablePush() {
        if (!this.e.isGroup) {
            await this.reply('此命令仅在群聊中使用')
            return false
        }

        let group_id = this.e.group_id
        await redis.del(`${group_push_key}${group_id}`)
        await this.reply('已关闭本群的活动推送')
        return true
    }

    /**
     * 刷新活动数据（仅限主人）
     */
    async refreshActivityData() {
        await this.reply('正在更新活动数据，请稍候...')
        
        try {
            // 清除缓存
            let deleted = await redis.del(cache_key)
            logger.mark(`[方舟插件][活动查询]清除缓存，删除了 ${deleted} 个键`)
            
            // 强制获取新数据
            let activity_data = await this.getActivityData(true)
            
            if (!activity_data) {
                await this.reply('更新活动数据失败，请检查网络连接或稍后再试')
                return false
            }
            
            let count = activity_data.length
            await this.reply(`活动数据更新成功！\n共获取到 ${count} 个活动\n缓存有效期：24小时`)
            logger.mark(`[方舟插件][活动查询]活动数据已更新，共 ${count} 个活动`)
            
            return true
        } catch (error) {
            logger.error(`[方舟插件][活动查询]更新活动数据失败: ${error}`)
            await this.reply(`更新活动数据时出错：${error.message || error}`)
            return false
        }
    }

    /**
     * 定时推送任务
     */
    async pushActivityTask() {
        // 检查总开关
        if (!this.setting?.activity_push_enable) {
            logger.mark('[方舟插件][活动推送]推送总开关已关闭')
            return false
        }

        logger.mark('[方舟插件][活动推送]开始执行活动推送任务')
        
        // 获取所有开启推送的群
        let keys = await redis.keys(`${group_push_key}*`)
        if (!keys || keys.length === 0) {
            logger.mark('[方舟插件][活动推送]没有开启推送的群')
            return false
        }

        // 强制刷新缓存，确保推送的是最新数据
        let activity_data = await this.getActivityData(true)
        if (!activity_data) {
            logger.error('[方舟插件][活动推送]获取活动数据失败')
            return false
        }

        let now = Math.floor(Date.now() / 1000)
        let three_days = 3 * 24 * 60 * 60

        // 检查是否推送进行中的活动（默认不推送）
        let skipOngoing = this.setting?.skip_ongoing_in_push !== false

        // 筛选活动
        let ongoing_activities = []
        let ending_activities = []
        let starting_activities = []

        for (let activity of activity_data) {
            // 进行中的活动
            if (activity.startTime <= now && activity.endTime > now) {
                let remainingTime = activity.endTime - now
                ongoing_activities.push({
                    ...activity,
                    remainingTime: remainingTime,
                    isUrgent: remainingTime < 24 * 60 * 60
                })
            }
            // 即将结束的活动（不在进行中）
            else if (activity.endTime > now && activity.endTime - now <= three_days) {
                ending_activities.push({
                    ...activity,
                    remainingTime: activity.endTime - now,
                    isUrgent: activity.endTime - now < 24 * 60 * 60
                })
            }
            // 即将开始的活动
            else if (activity.startTime > now && activity.startTime - now <= three_days) {
                starting_activities.push({
                    ...activity,
                    remainingTime: activity.startTime - now,
                    isUrgent: activity.startTime - now < 24 * 60 * 60
                })
            }
        }

        // 根据配置决定是否包含进行中的活动
        let pushOngoing = skipOngoing ? [] : ongoing_activities
        
        // 如果没有需要推送的活动，不推送
        if (pushOngoing.length === 0 && ending_activities.length === 0 && starting_activities.length === 0) {
            logger.mark('[方舟插件][活动推送]近期没有需要推送的活动，跳过推送')
            return true
        }

        if (skipOngoing && ongoing_activities.length > 0) {
            logger.mark(`[方舟插件][活动推送]已忽略 ${ongoing_activities.length} 个进行中的活动`)
        }

        pushOngoing.sort((a, b) => a.remainingTime - b.remainingTime)
        ending_activities.sort((a, b) => a.remainingTime - b.remainingTime)
        starting_activities.sort((a, b) => a.remainingTime - b.remainingTime)

        pushOngoing = pushOngoing.map(act => ({
            ...act,
            remainingText: this.formatTime(act.remainingTime)
        }))
        ending_activities = ending_activities.map(act => ({
            ...act,
            remainingText: this.formatTime(act.remainingTime)
        }))
        starting_activities = starting_activities.map(act => ({
            ...act,
            remainingText: this.formatTime(act.remainingTime)
        }))

        let currentDate = new Date()
        let year = currentDate.getFullYear()
        let month = currentDate.getMonth() + 1
        let day = currentDate.getDate()
        let dayOfWeek = currentDate.getDay()
        let weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
        let formattedDate = year + '-' + month + '-' + day + ' ' + weekDays[dayOfWeek]

        // 准备渲染数据
        let renderData = {
            ongoing_activities: pushOngoing,
            ending_activities,
            starting_activities,
            current_time: formattedDate,
        }

        // 向每个群推送
        let success_count = 0
        for (let key of keys) {
            let group_id = key.replace(group_push_key, '')
            try {
                // 验证 group_id 是否有效（支持 QQ 群号和微信群 ID）
                if (!group_id || group_id === '') {
                    logger.warn(`[方舟插件][活动推送]无效的群号: ${group_id}`)
                    continue
                }
                
                // 使用 puppeteer 直接渲染图片（不依赖 runtime）
                let img = await this.renderActivityImageForPush(renderData)
                
                if (!img) {
                    logger.error(`[方舟插件][活动推送]生成图片失败，群 ${group_id}`)
                    continue
                }
                
                // puppeteer.screenshot 返回的已经是可发送的格式，直接发送即可
                // 直接使用原始 group_id（支持微信的 "xxxxx@chatroom" 格式）
                await Bot.pickGroup(group_id).sendMsg(img)
                success_count++
                logger.mark(`[方舟插件][活动推送]成功推送到群 ${group_id}`)
                await this.sleep(2000) // 避免发送过快
            } catch (error) {
                logger.error(`[方舟插件][活动推送]推送到群 ${group_id} 失败: ${error}`)
            }
        }

        logger.mark(`[方舟插件][活动推送]推送任务完成，成功推送到 ${success_count}/${keys.length} 个群`)
        return true
    }

    /**
     * 为定时推送任务渲染活动图片（不依赖 runtime）
     */
    async renderActivityImageForPush(data) {
        try {
            const _path = process.cwd()
            const layoutPath = `${_path}/plugins/arknights-plugin/resources/common/layout/`
            const pluginResPath = `${_path}/plugins/arknights-plugin/resources/`
            
            // 准备渲染数据
            const renderData = {
                tplFile: `${_path}/plugins/arknights-plugin/resources/activity/activity.html`,
                pluResPath: pluginResPath,
                saveId: 'activity',
                imgType: 'png',
                ...data,
                defaultLayout: layoutPath + 'default.html',
                _res_path: pluginResPath,
                _layout_path: layoutPath,
                sys: {
                    scale: 'style=transform:scale(1)',
                    createdby: 'Created By Yunzai & Arknights-plugin'
                },
                pageGotoParams: {
                    waitUntil: 'networkidle0'
                }
            }
            
            // 使用 puppeteer 截图
            const img = await puppeteer.screenshot('arknights-plugin/activity/activity', renderData)
            return img
        } catch (error) {
            logger.error(`[方舟插件][活动推送]渲染图片失败: ${error.message}`)
            logger.error(error.stack)
            return null
        }
    }

    /**
     * 获取活动数据
     * @param {boolean} forceRefresh - 是否强制刷新缓存，默认 false
     */
    async getActivityData(forceRefresh = false) {
        // 如果不强制刷新，尝试从缓存获取
        if (!forceRefresh) {
            let cacheData = await redis.get(cache_key)
            if (cacheData) {
                logger.mark('[方舟插件][活动查询]使用缓存数据')
                return JSON.parse(cacheData)
            }
        } else {
            logger.mark('[方舟插件][活动查询]强制刷新，跳过缓存')
        }

        // 从API获取
        let param = {
            timeout: 30000,
            method: 'get',
        }
        let response = {}
        try {
            response = await fetch(activity_api, param)
        } catch (error) {
            logger.error(`[方舟插件][活动查询]请求失败: ${error.toString()}`)
            return null
        }

        if (!response.ok) {
            logger.error(`[方舟插件][活动查询]接口错误，${response.status} ${response.statusText}`)
            return null
        }

        const res = await response.json()
        if (!res || !res?.basicInfo) {
            logger.error('[方舟插件][活动查询]接口返回数据格式错误')
            return null
        }

        // 提取basicInfo数据并转换为数组
        let activities = []
        for (let key in res.basicInfo) {
            let activity = res.basicInfo[key]
            // 只要有名称和有效的时间就显示（移除displayOnHome限制）
            if (activity.name && activity.startTime && activity.endTime) {
                activities.push({
                    id: activity.id,
                    name: activity.name,
                    startTime: activity.startTime,
                    endTime: activity.endTime,
                    type: activity.type,
                    displayType: activity.displayType === 'NONE' ? '活动' : activity.displayType,
                })
            }
        }

        // 缓存24小时
        await redis.set(cache_key, JSON.stringify(activities), { EX: 24 * 60 * 60 })
        
        return activities
    }

    /**
     * 格式化剩余时间
     */
    formatTime(seconds) {
        let days = Math.floor(seconds / (24 * 60 * 60))
        let hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60))
        
        if (days > 0) {
            if (hours > 0) {
                return `剩余${days}天${hours}小时`
            } else {
                return `剩余${days}天`
            }
        } else if (hours > 0) {
            return `剩余${hours}小时`
        } else {
            let minutes = Math.floor(seconds / 60)
            return `剩余${minutes}分钟`
        }
    }

    /**
     * 睡眠函数
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms))
    }
}
