import { rulePrefix } from '../utils/common.js'
import SKLandUser from '../model/sklandUser.js'
import { buildProfileView, buildInfrastructureView } from '../model/playerView.js'
import runtimeRender from '../utils/runtimeRender.js'

export class Profile extends plugin {
    constructor() {
        super({ name: '[arknights-plugin]便签与基建', dsc: '博士便签和基建状态', event: 'message', priority: 100,
            rule: [
                { reg: `^${rulePrefix}(博士卡片|便签|卡片)$`, fnc: 'profileCard' },
                { reg: `^${rulePrefix}基建(查询)?$`, fnc: 'infrastructure' }
            ] })
    }

    async profileCard() { return this.renderPlayer('profile') }
    async infrastructure() { return this.renderPlayer('infrastructure') }

    async renderPlayer(view) {
        try {
            const user = new SKLandUser(this.e.at || this.e.user_id)
            if (!await user.getUser()) {
                await this.reply('尚未绑定森空岛账号，请先发送“绑定”或“扫码绑定”（需添加插件前缀）。')
                return true
            }
            const response = await user.getGamePlayerInfo()
            if (response?.code !== 0 || !response.data?.status) {
                await this.reply('未能获取游戏资料，请检查绑定或稍后重试。')
                return true
            }
            if (view === 'infrastructure' && !response.data.building) {
                await this.reply('未能获取基建资料，请进入游戏同步后重试。')
                return true
            }
            const now = Math.floor(Date.now() / 1000)
            const data = view === 'infrastructure' ? { base: buildInfrastructureView(response.data, { now }) } : { profile: buildProfileView(response.data, { now }) }
            await runtimeRender(this.e, view === 'infrastructure' ? 'profileCard/infrastructure.html' : 'profileCard/profileCard.html', data, { scale: 1, timeout: 120000 })
        } catch {
            globalThis.logger?.error?.(`[方舟插件][${view === 'infrastructure' ? '基建' : '便签'}]查询或图片渲染失败`)
            await this.reply(`${view === 'infrastructure' ? '基建' : '便签'}查询失败，请稍后重试。`)
        }
        return true
    }
}
