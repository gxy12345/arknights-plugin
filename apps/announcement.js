import puppeteer from 'puppeteer'
import { rulePrefix } from '../utils/common.js'
import constant from "../components/constant.js";
import setting from '../utils/setting.js';
import runtimeRender from '../utils/runtimeRender.js'

const _path = process.cwd();
const cache_key = 'ARKNIGHTS:WEB_DATA:ANNOUNCE'
const announcement_api = 'https://ak-conf.hypergryph.com/config/prod/announce_meta/Android/announcement.meta.json'

export class Announcement extends plugin {
    constructor() {
        super({
            name: '[arknights-plugin]公告查询',
            dsc: '官方公告查询',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: `^${rulePrefix}(公告|通知|活动)(列表|查询)?$`,
                    fnc: 'announcementList'
                },
                {
                    reg: `^${rulePrefix}(公告|通知|活动)\\d{1,2}$`,
                    fnc: 'announcementDetail'
                },
            ]
        })
        this.bindUser = {}
        this.setting = setting.getConfig('game_info')
    }

    async announcementList() {
        let announce_data = await this.getAnnouncement()
        if (!announce_data) {
            await this.reply('获取公告失败')
            return false
        }
        let max_annouce = this.setting?.max_announce || 10
        // let filterd_announce = announce_data.filter(obj => obj.group === 'ACTIVITY')
        if (announce_data.length > max_annouce) {
            announce_data = announce_data.slice(0, max_annouce)
        }

        let daily_data = this.getDailyResource()
        logger.mark(`[方舟插件]daily_data: ${JSON.stringify(daily_data)}`)

        let currentDate = new Date();
        let year = currentDate.getFullYear();
        let month = currentDate.getMonth() + 1;
        let day = currentDate.getDate();
        let dayOfWeek = currentDate.getDay();

        let weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    
        let formattedDate = year + '-' + month + '-' + day + ' ' + weekDays[dayOfWeek];
    
        await runtimeRender(this.e, 'announce/announce.html', {
            announce_list: announce_data,
            daily_list: daily_data,
            current_time: formattedDate,
        }, {
            scale: 1.0
        })
        return true
    }

    async announcementDetail() {
        let match = /\d{1,2}/.exec(this.e.msg)
        let announce_index = Number(match)

        let announce_data = await this.getAnnouncement()
        if (!announce_data) {
            await this.reply('获取公告失败')
            return false
        }
        let max_annouce = this.setting?.max_announce || 10
        // let filterd_announce = announce_data.filter(obj => obj.group === 'ACTIVITY')
        if (announce_data.length > max_annouce) {
            announce_data = announce_data.slice(0, max_annouce)
        }

        if (announce_data.length < announce_index) return true

        const browser = await puppeteer.launch(this.getPuppeteerOptions())
        const page = await browser.newPage()
        await page.goto(announce_data[announce_index-1].webUrl)
        await page.setViewport({
            height: 0,
            width: 1000,
        })
        await this.reply(segment.image(await page.screenshot({
            fullPage: true
        })))
        await browser.close()
        return true
    }

    getPuppeteerOptions() {
        return {
            headless: true,
            args: [
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-setuid-sandbox',
                '--no-first-run',
                '--no-sandbox',
                '--no-zygote',
                '--single-process',
                '--incognito'
            ]
        }
    }

    getDailyResource() {
        const dailyResource = constant.gameData.daily_resource
        const currentDate = new Date()
        let currentWeekday = currentDate.getDay()
        if (currentWeekday == 0) currentWeekday = 7

        let filterdResource = dailyResource.filter(obj => obj.day.includes(currentWeekday))
        return filterdResource
    }

    async getAnnouncement() {
        let cacheData = await redis.get(cache_key)
        if (cacheData) {
            return JSON.parse(cacheData)
        }
        let param = {
            timeout: 10000,
            method: 'get',
        }
        let response = {}
        try {
            response = await fetch(announcement_api, param)
        } catch (error) {
            Bot.logger.error(error.toString())
            return null
        }
        if (!response.ok) {
            Bot.logger.error(`[arknights-plugin] announcement接口错误,${response.status} ${response.statusText}`)
            return null
        }
        const res = await response.json()
        if (!res || !res?.announceList) {
            Bot.logger.mark('announcement接口错误')
            return null
        }

        await redis.set(cache_key, JSON.stringify(res.announceList), { EX: 900 });
        return res.announceList
    }

}