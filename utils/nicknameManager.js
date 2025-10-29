import fs from 'fs'
import YAML from 'yaml'
import path from 'path'

const _path = process.cwd()
const customNicknameFile = path.join(_path, 'data', 'arknights-plugin', 'custom_nicknames.yaml')
const builtinNicknameFile = path.join(_path, 'plugins', 'arknights-plugin', 'resources', 'charProfile', 'nickname.yaml')

/**
 * 别名管理器
 * 支持查询内建别名和自定义别名
 */
export class NicknameManager {
  constructor() {
    this.ensureCustomNicknameFile()
  }

  /**
   * 确保自定义别名文件存在
   */
  ensureCustomNicknameFile() {
    const dir = path.dirname(customNicknameFile)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    
    if (!fs.existsSync(customNicknameFile)) {
      fs.writeFileSync(customNicknameFile, '# 用户自定义别名\n# 格式: 干员名: [别名1, 别名2, ...]\n', 'utf8')
    }
  }

  /**
   * 读取内建别名
   */
  getBuiltinNicknames() {
    try {
      const buffer = fs.readFileSync(builtinNicknameFile, 'utf8')
      return YAML.parse(buffer) || {}
    } catch (error) {
      logger.error(`[别名管理] 读取内建别名失败: ${error}`)
      return {}
    }
  }

  /**
   * 读取自定义别名
   */
  getCustomNicknames() {
    try {
      const buffer = fs.readFileSync(customNicknameFile, 'utf8')
      const data = YAML.parse(buffer)
      return data || {}
    } catch (error) {
      logger.error(`[别名管理] 读取自定义别名失败: ${error}`)
      return {}
    }
  }

  /**
   * 保存自定义别名
   */
  saveCustomNicknames(nicknames) {
    try {
      const yamlStr = YAML.stringify(nicknames)
      fs.writeFileSync(customNicknameFile, yamlStr, 'utf8')
      return true
    } catch (error) {
      logger.error(`[别名管理] 保存自定义别名失败: ${error}`)
      return false
    }
  }

  /**
   * 检查干员是否存在（在内建别名中）
   */
  async checkCharExists(charName) {
    const builtinNicknames = this.getBuiltinNicknames()
    return charName in builtinNicknames
  }

  /**
   * 检查别名冲突
   * @returns {string|null} 如果冲突返回已使用该别名的干员名，否则返回null
   */
  async checkNicknameConflict(nickname, excludeChar = null) {
    // 检查内建别名
    const builtinNicknames = this.getBuiltinNicknames()
    for (const [charName, nicknames] of Object.entries(builtinNicknames)) {
      if (charName !== excludeChar && nicknames.includes(nickname)) {
        return charName
      }
    }

    // 检查自定义别名
    const customNicknames = this.getCustomNicknames()
    for (const [charName, nicknames] of Object.entries(customNicknames)) {
      if (charName !== excludeChar && Array.isArray(nicknames) && nicknames.includes(nickname)) {
        return charName
      }
    }

    return null
  }

  /**
   * 添加自定义别名
   */
  async addNickname(charName, nickname, userId) {
    try {
      const customNicknames = this.getCustomNicknames()
      
      if (!customNicknames[charName]) {
        customNicknames[charName] = []
      }

      // 检查是否已经存在该别名
      if (customNicknames[charName].includes(nickname)) {
        return { success: false, message: '该别名已存在' }
      }

      customNicknames[charName].push(nickname)
      
      if (this.saveCustomNicknames(customNicknames)) {
        logger.info(`[别名管理] 用户${userId}为"${charName}"添加别名"${nickname}"`)
        return { success: true }
      } else {
        return { success: false, message: '保存失败' }
      }
    } catch (error) {
      logger.error(`[别名管理] 添加别名失败: ${error}`)
      return { success: false, message: error.message }
    }
  }

  /**
   * 删除自定义别名
   */
  async deleteNickname(charName, nickname, userId) {
    try {
      const customNicknames = this.getCustomNicknames()
      
      if (!customNicknames[charName] || !Array.isArray(customNicknames[charName])) {
        return { success: false, message: `干员"${charName}"没有自定义别名` }
      }

      const index = customNicknames[charName].indexOf(nickname)
      if (index === -1) {
        return { success: false, message: `别名"${nickname}"不存在或不是自定义别名` }
      }

      customNicknames[charName].splice(index, 1)
      
      // 如果该干员没有别名了，删除该干员的记录
      if (customNicknames[charName].length === 0) {
        delete customNicknames[charName]
      }

      if (this.saveCustomNicknames(customNicknames)) {
        logger.info(`[别名管理] 用户${userId}删除"${charName}"的别名"${nickname}"`)
        return { success: true }
      } else {
        return { success: false, message: '保存失败' }
      }
    } catch (error) {
      logger.error(`[别名管理] 删除别名失败: ${error}`)
      return { success: false, message: error.message }
    }
  }

  /**
   * 获取指定干员的所有别名（内建+自定义）
   */
  async getNicknamesForChar(charName) {
    const builtinNicknames = this.getBuiltinNicknames()
    const customNicknames = this.getCustomNicknames()

    const result = {
      builtin: builtinNicknames[charName] || [],
      custom: customNicknames[charName] || []
    }

    return result
  }

  /**
   * 获取所有自定义别名
   */
  async getAllCustomNicknames() {
    return this.getCustomNicknames()
  }

  /**
   * 通过别名查找干员名（内建别名优先）
   */
  findCharByNickname(nickname) {
    // 先查找内建别名
    const builtinNicknames = this.getBuiltinNicknames()
    for (const [charName, nicknames] of Object.entries(builtinNicknames)) {
      if (nicknames.includes(nickname)) {
        return charName
      }
    }

    // 再查找自定义别名
    const customNicknames = this.getCustomNicknames()
    for (const [charName, nicknames] of Object.entries(customNicknames)) {
      if (Array.isArray(nicknames) && nicknames.includes(nickname)) {
        return charName
      }
    }

    return null
  }
}

