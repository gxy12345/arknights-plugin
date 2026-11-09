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
                /* binding list */
                binding: {
                    url: `${api_host}api/v1/game/player/binding`,
                },
                /* 游戏详情 */
                game_player_info: {
                    url: `${api_host}api/v1/game/player/info`,
                    query: query({ uid: this.uid })
                },
                /* 卫戍协议攻略与历史战绩（官方攻略工具只读接口） */
                garrison_resource: {
                    url: `${api_host}api/v1/game/garrison/guide/resource`,
                    query: query({ seasonId: data.seasonId, versionId: data.versionId })
                },
                garrison_index: {
                    url: `${api_host}api/v1/game/garrison/guide/index`,
                    query: query({ source: 'COMMUNITY', sortType: data.sortType ?? 1,
                        seasonId: data.seasonId, pageSize: data.pageSize ?? 10,
                        pageToken: data.pageToken, titleKeyword: data.titleKeyword })
                },
                garrison_info: {
                    url: `${api_host}api/v1/game/garrison/guide/info`,
                    query: query({ guideId: data.guideId, hostNeedEditing: true })
                },
                garrison_history: {
                    url: `${api_host}api/v1/game/garrison/guide/history-log`,
                    query: query({ seasonId: data.seasonId })
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
