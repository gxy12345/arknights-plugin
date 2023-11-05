import moment from 'moment'
import { rulePrefix } from '../utils/common.js'
import SKLandUser from '../model/sklandUser.js'
import { getAvatarUrl } from '../model/imgApi.js'
import runtimeRender from '../utils/runtimeRender.js'

export class Profile extends plugin {
    constructor() {
        super({
            name: '[arknights-plugin]游戏角色卡片',
            dsc: '明日方舟角色卡片',
            event: 'message',
            priority: 100,
            rule: [
                {
                    reg: `^${rulePrefix}(博士卡片|便签|卡片)$`,
                    fnc: 'profileCard'
                },
            ]
        })
        this.bindUser = {}
    }

    async profileCard() {
        let sklUser = new SKLandUser(this.e.user_id)
        if (!await sklUser.getUser()) {
            await this.reply('未绑定森空岛cred，请先绑定后再使用功能。可发送 #cred帮助 查看获取方法')
            return true
        }

        let game_res = await sklUser.sklReq.getData('game_player_info')
        let user_res = await sklUser.sklReq.getData('user_info')
        if (game_res?.code === 0 && game_res?.message === 'OK' && user_res?.code === 0 && user_res?.message === 'OK') {
            return await this.generate_profile_card(game_res.data, user_res.data)
        } else {
            logger.mark(`user info失败，响应:${JSON.stringify(user_res)}`)
            logger.mark(`user info失败，响应:${JSON.stringify(game_res)}`)
            await this.reply(`查询失败，请检查cred或稍后再试`)
        }
        return true

    }

    async generate_profile_card(game_data, user_data) {
        let user_info = {}
        let game_info = {}
        // 角色信息
        user_info.avatar_url = getAvatarUrl(game_data.status.avatar.id)
        user_info.name = game_data.status.name
        user_info.level = game_data.status.level
        user_info.uid = game_data.status.uid
        user_info.reg_date = moment.unix(game_data.status.registerTs).format('YYYY-MM-DD')
        user_info.days_before_now = moment().diff(moment.unix(game_data.status.registerTs), 'day')
        user_info.main_progress = game_data.status.mainStageProgress || '全部完成'

        // 角色家具皮肤数量
        user_info.funi_num = user_data.gameStatus.furnitureCnt
        user_info.char_num = user_data.gameStatus.charCnt
        user_info.skin_num = user_data.gameStatus.skinCnt

        // 理智
        game_info.ap_total = game_data.status.ap.max
        game_info.ap_current = game_data.status.ap.current > game_data.status.ap.max ? game_data.status.ap.max : game_data.status.ap.current
        game_info.ap_rate = Math.round(game_info.ap_current / game_info.ap_total * 100)
        // 无人机
        game_info.uav_total = game_data.building.labor.maxValue
        game_info.uav_current = game_data.building.labor.value
        game_info.uav_rate = Math.round(game_info.uav_current / game_info.uav_total * 100)
        // 线索
        const findClue = (clue) => {
            return game_data.building.meeting.clue.board.find(item => item == clue) ? '100' : '60';
        };
        let cule_status = `<span class="custom-text" style="filter: brightness(${findClue('RHINE')}%)">①</span>
        <span class="custom-text" style="filter: brightness(${findClue('PENGUIN')}%)">②</span>
        <span class="custom-text" style="filter: brightness(${findClue('BLACKSTEEL')}%)">③</span>
        <span class="custom-text" style="filter: brightness(${findClue('URSUS')}%)">④</span>
        <span class="custom-text" style="filter: brightness(${findClue('GLASGOW')}%)">⑤</span>
        <span class="custom-text" style="filter: brightness(${findClue('KJERAG')}%)">⑥</span>
        <span class="custom-text" style="filter: brightness(${findClue('RHODES')}%)">⑦</span>
        `
        game_info.clue_rate = Math.round(game_data.building.meeting.clue.board.length / 7 * 100)
        // 日常
        game_info.daily_current = game_data.routine.daily.current
        game_info.daily_total = game_data.routine.daily.total
        game_info.daily_rate = Math.round(game_info.daily_current / game_info.daily_total * 100)
        game_info.weekly_current = game_data.routine.weekly.current
        game_info.weekly_total = game_data.routine.weekly.total
        game_info.weekly_rate = Math.round(game_info.weekly_current / game_info.weekly_total * 100)
        // 公招
        const isRecruitFinish = (recruit_item) => {
            if (recruit_item.state != 2) return false
            let current_ts = moment().valueOf()
            logger.mark(`current_ts: ${current_ts} finish_ts: ${recruit_item.finishTs}`)
            return recruit_item.finishTs < current_ts && recruit_item.finishTs > 0
        };
        game_info.recruit_finish = game_data.recruit.filter(function (recruit_item) {
            if (recruit_item.state != 2) return false
            let current_ts = moment().valueOf()
            logger.mark(`current_ts: ${current_ts} finish_ts: ${recruit_item.finishTs}`)
            return recruit_item.finishTs < current_ts && recruit_item.finishTs > 0
        }).length
        game_info.recruit_total = game_data.recruit.filter(function (item) { return item.state != 0 }).length
        game_info.recruit_rate = Math.round(game_info.recruit_finish / game_info.recruit_total * 100)
        // 保全
        game_info.tower_lower_current = game_data.tower.reward.lowerItem.current
        game_info.tower_lower_total = game_data.tower.reward.lowerItem.total
        game_info.tower_lower_rate = Math.round(game_info.tower_lower_current / game_info.tower_lower_total * 100)
        game_info.tower_higher_current = game_data.tower.reward.higherItem.current
        game_info.tower_higher_total = game_data.tower.reward.higherItem.total
        game_info.tower_higher_rate = Math.round(game_info.tower_higher_current / game_info.tower_higher_total * 100)
        // 剿灭
        game_info.campaign_current = game_data.campaign.reward.current
        game_info.campaign_total = game_data.campaign.reward.total
        game_info.campaign_rate = Math.round(game_info.campaign_current / game_info.campaign_total * 100)

        logger.mark(`user_info: ${JSON.stringify(user_info)}`)
        logger.mark(`game_info: ${JSON.stringify(game_info)}`)
        logger.mark(`clue: ${cule_status}`)

        await runtimeRender(this.e, 'profileCard/profileCard.html', {
            user_info: user_info,
            game_info: game_info,
            cule_status: cule_status
        }, {
            scale: 1.6
        })

    }

}