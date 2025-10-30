import { rulePrefix } from '../utils/common.js'
import SKLandUser from '../model/sklandUser.js'
import runtimeRender from '../utils/runtimeRender.js'

export class RogueInfo extends plugin {
    constructor() {
        super({
            name: '[arknights-plugin]肉鸽战绩查询',
            dsc: '森空岛肉鸽战绩查询',
            event: 'message',
            priority: 100,
            rule: [
                {
                    reg: `^${rulePrefix}(肉鸽|集成战略)$`,
                    fnc: 'rogueInfo'
                }
            ]
        })
    }

    async rogueInfo() {
        let uid = this.e.at || this.e.user_id
        let sklUser = new SKLandUser(uid)
        if (!await sklUser.getUser()) {
            await this.reply('未绑定森空岛cred，请先绑定后再使用功能。可发送 /cred帮助 查看获取方法')
            return true
        }

        await this.reply(`开始获取肉鸽战绩信息，请稍等`)

        let res = await sklUser.getGamePlayerInfo()

        if (res?.code === 0 && res?.message === 'OK') {
            let rogueData = res.data.rogue
            let rogueInfoMap = res.data.rogueInfoMap

            // 检查是否有肉鸽数据
            if (!rogueData || !rogueData.records || rogueData.records.length === 0) {
                await this.reply('暂无肉鸽战绩数据')
                return true
            }

            // 处理数据，将 records 和 rogueInfoMap 合并
            let rogueList = rogueData.records.map(record => {
                let info = rogueInfoMap[record.rogueId] || {}
                return {
                    ...record,
                    name: info.name || '未知',
                    picUrl: info.picUrl || '',
                    sort: info.sort || 0
                }
            }).sort((a, b) => a.sort - b.sort) // 按顺序排序

            // 获取用户信息
            let userInfo = {
                name: res.data.status.name,
                uid: res.data.status.uid
            }

            let update_time = new Date(Number(res.timestamp) * 1000)

            await runtimeRender(this.e, 'rogue/rogue.html', {
                rogueList: rogueList,
                user_info: userInfo,
                update_time_str: update_time.toLocaleString(),
            }, {
                scale: 1.0
            })
        } else {
            logger.mark(`肉鸽战绩查询失败，响应:${JSON.stringify(res)}`)
            await this.reply(`查询失败，请检查cred或稍后再试`)
        }
        return true
    }
}

