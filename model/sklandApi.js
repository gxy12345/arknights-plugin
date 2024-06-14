export default class sklandApi {

    constructor(uid, server = 'cn') {
        this.server = server
        this.uid = uid
    }


    getUrlMap = (data = {}) => {
        let api_host, hostRecord
        if (['cn'].includes(this.server)) {
            api_host = 'https://zonai.skland.com/'
        }
        let urlMap = {
            arknights: {
                /* user信息 */
                user_info: {
                    url: `${api_host}api/v1/user`,
                },
                /* 游戏详情 */
                game_player_info: {
                    url: `${api_host}api/v1/game/player/info`,
                    query: `uid=${this.uid}`
                },
                /* 签到 */
                attendance: {
                    url: `${api_host}api/v1/game/attendance`,
                    body: { uid: this.uid, gameId: 1 }
                },
                /* 签到信息查询 */
                attendance_query: {
                    url: `${api_host}api/v1/game/attendance`,
                    query: `uid=${this.uid}&gameId=1`
                },
                /* 刷新token */
                refresh: {
                    url: `${api_host}api/v1/auth/refresh`,
                },
                /* 养成计算-干员养成材料 */
                cal_character: {
                    url: `${api_host}api/v1/game/cultivate/character`,
                    query: `characterId=${data.characterId}`
                },
                /* 养成计算-通用信息查询 */
                cal_info: {
                    url: `${api_host}api/v1/game/cultivate/info`,
                },
                /* 养成计算-玩家信息查询 */
                cal_player: {
                    url: `${api_host}api/v1/game/cultivate/player`,
                    query: `uid=${this.uid}`
                },
            }
        }

        return urlMap['arknights']
    }
}
