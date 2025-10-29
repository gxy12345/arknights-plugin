import { rulePrefix } from '../utils/common.js'
import { NicknameManager } from '../utils/nicknameManager.js'
import setting from '../utils/setting.js'

export class nickname extends plugin {
  constructor() {
    super({
      name: '[arknights-plugin]别名管理',
      dsc: '管理角色自定义别名',
      event: 'message',
      priority: 10,
      rule: [
        {
          reg: `^${rulePrefix}添加别名\\s*(.*)$`,
          fnc: 'addNickname'
        },
        {
          reg: `^${rulePrefix}查看别名\\s*(.*)$`,
          fnc: 'viewNickname'
        },
        {
          reg: `^${rulePrefix}删除别名\\s*(.*)$`,
          fnc: 'deleteNickname'
        }
      ]
    })
    this.nicknameManager = new NicknameManager()
  }

  /**
   * 检查权限
   */
  checkPermission(e, action) {
    const config = setting.getConfig('nickname')
    const permission = config[`${action}_permission`] || 'master'

    if (permission === 'off') {
      e.reply('该功能已关闭')
      return false
    }

    if (permission === 'master' && !e.isMaster) {
      e.reply('仅主人可以使用该功能')
      return false
    }

    // permission === 'all' 或 (permission === 'master' && e.isMaster)
    return true
  }

  /**
   * 添加别名
   */
  async addNickname(e) {
    if (!this.checkPermission(e, 'add')) {
      return true
    }

    const input = e.msg.replace(new RegExp(`^${rulePrefix}添加别名\\s*`), '').trim()
    
    if (!input) {
      e.reply('请按照格式输入：/添加别名 干员原名 干员别名\n例如：/添加别名 银灰 前夫哥')
      return true
    }

    // 分割输入，支持多个空格
    const parts = input.split(/\s+/)
    
    if (parts.length !== 2) {
      e.reply('格式错误！请按照格式输入：/添加别名 干员原名 干员别名\n例如：/添加别名 银灰 前夫哥')
      return true
    }

    const [charName, newNickname] = parts

    // 检查干员原名是否存在（不做强制校验，仅作提示）
    const exists = await this.nicknameManager.checkCharExists(charName)

    // 检查别名是否已被使用
    const conflictChar = await this.nicknameManager.checkNicknameConflict(newNickname, charName)
    if (conflictChar) {
      e.reply(`别名"${newNickname}"已被干员"${conflictChar}"使用，不允许重复！`)
      return true
    }

    // 添加别名
    const userId = e.user_id
    const result = await this.nicknameManager.addNickname(charName, newNickname, userId)
    
    if (result.success) {
      // 根据干员是否存在给出不同的提示
      if (!exists) {
        e.reply(`成功为干员"${charName}"添加别名"${newNickname}"\n提示：该干员未在内建别名库中找到，可能是新角色或干员名填写有误，请注意核对`)
      } else {
        e.reply(`成功为干员"${charName}"添加别名"${newNickname}"`)
      }
    } else {
      e.reply(`添加失败：${result.message}`)
    }

    return true
  }

  /**
   * 查看别名
   */
  async viewNickname(e) {
    if (!this.checkPermission(e, 'view')) {
      return true
    }

    const input = e.msg.replace(new RegExp(`^${rulePrefix}查看别名\\s*`), '').trim()
    
    if (!input) {
      // 显示所有自定义别名
      const allCustomNicknames = await this.nicknameManager.getAllCustomNicknames()
      
      if (Object.keys(allCustomNicknames).length === 0) {
        e.reply('当前没有自定义别名')
        return true
      }

      let message = '当前所有自定义别名：\n'
      for (const [charName, nicknames] of Object.entries(allCustomNicknames)) {
        message += `\n【${charName}】\n`
        nicknames.forEach(nick => {
          message += `  - ${nick}\n`
        })
      }
      
      e.reply(message.trim())
      return true
    }

    // 查看指定干员的别名
    const charName = input
    const nicknames = await this.nicknameManager.getNicknamesForChar(charName)
    
    if (!nicknames || (nicknames.builtin.length === 0 && nicknames.custom.length === 0)) {
      e.reply(`未找到干员"${charName}"的别名信息`)
      return true
    }

    let message = `干员"${charName}"的别名：\n`
    
    if (nicknames.builtin.length > 0) {
      message += `\n【内建别名】\n`
      nicknames.builtin.forEach(nick => {
        message += `  ${nick}\n`
      })
    }
    
    if (nicknames.custom.length > 0) {
      message += `\n【自定义别名】\n`
      nicknames.custom.forEach(nick => {
        message += `  ${nick}\n`
      })
    }

    e.reply(message.trim())
    return true
  }

  /**
   * 删除别名
   */
  async deleteNickname(e) {
    if (!this.checkPermission(e, 'delete')) {
      return true
    }

    const input = e.msg.replace(new RegExp(`^${rulePrefix}删除别名\\s*`), '').trim()
    
    if (!input) {
      e.reply('请按照格式输入：/删除别名 干员原名 干员别名\n例如：/删除别名 银灰 前夫哥')
      return true
    }

    // 分割输入，支持多个空格
    const parts = input.split(/\s+/)
    
    if (parts.length !== 2) {
      e.reply('格式错误！请按照格式输入：/删除别名 干员原名 干员别名\n例如：/删除别名 银灰 前夫哥')
      return true
    }

    const [charName, nicknameToDelete] = parts
    const userId = e.user_id

    // 删除别名
    const result = await this.nicknameManager.deleteNickname(charName, nicknameToDelete, userId)
    
    if (result.success) {
      e.reply(`成功删除干员"${charName}"的别名"${nicknameToDelete}"`)
    } else {
      e.reply(`删除失败：${result.message}`)
    }

    return true
  }
}

