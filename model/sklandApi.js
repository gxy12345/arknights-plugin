export default class sklandApi {

    constructor(uid, server = 'cn') {
        this.server = server
        this.uid = uid
    }


    getUrlMap = (data = {}) => {
        let api_host, hostRecord
        const query = (params) => new URLSearchParams(
            Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
        ).toString()
        if (['cn'].includes(this.server)) {
            api_host = 'https://zonai.skland.com/'
        }
        let urlMap = {
            arknights: {
                /* user信息 */
                user_info: {
                    url: `${api_host}api/v1/user`,
                },
                /* 森空岛用户 ID（集成战略详情需要） */
                user_teenager: {
                    url: `${api_host}api/v1/user/teenager`,
                },
                /* binding list */
                binding: {
                    url: `${api_host}api/v1/game/player/binding`,
                },
                /* 游戏详情 */
                game_player_info: {
                    url: `${api_host}api/v1/game/player/info`,
                    query: query({ uid: this.uid })
                },
                /* 集成战略主题详情 */
                rogue_detail: {
                    url: `${api_host}api/game/arknights/rogue`,
                    query: query({ uid: this.uid, targetUserId: data.targetUserId, topicId: data.topicId })
                },
                /* 玩家统计和游戏好友列表 */
                game_player_statistic: {
                    url: `${api_host}api/v1/game/player/statistic`,
                    query: query({ uid: data.uid || this.uid })
                },
                game_friend_list: {
                    url: `${api_host}api/v1/game/friend/list`,
                },
                /* 签到 */
                attendance: {
                    url: `${api_host}api/v1/game/attendance`,
                    body: { uid: this.uid, gameId: 1 }
                },
                /* 签到信息查询 */
                attendance_query: {
                    url: `${api_host}api/v1/game/attendance`,
                    query: query({ uid: this.uid, gameId: 1 })
                },
                /* 刷新token */
                refresh: {
                    url: `${api_host}api/v1/auth/refresh`,
                },
                /* 养成计算-干员养成材料 */
                cal_character: {
                    url: `${api_host}api/v1/game/cultivate/character`,
                    query: query({ characterId: data.characterId })
                },
                /* 养成计算-通用信息查询 */
                cal_info: {
                    url: `${api_host}api/v1/game/cultivate/info`,
                },
                /* 养成计算-玩家信息查询 */
                cal_player: {
                    url: `${api_host}api/v1/game/cultivate/player`,
                    query: query({ uid: this.uid })
                },
                cards: {
                    url: `${api_host}api/v1/game/cards`
                },
            }
        }

        return urlMap['arknights']
    }
}
