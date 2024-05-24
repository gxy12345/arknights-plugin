import setting from './utils/setting.js'
import lodash from 'lodash'
import { pluginResources } from './utils/path.js'
import path from 'path'

// 支持锅巴
export function supportGuoba () {
  let allGroup = []
  Bot.gl.forEach((v, k) => { allGroup.push({ label: `${v.group_name}(${k})`, value: k }) })
  return {
    pluginInfo: {
      name: 'arknights-plugin',
      title: '明日方舟插件',
      author: '@gxy12345',
      authorLink: 'https://github.com/gxy12345',
      link: 'https://github.com/gxy12345/arknights-plugin',
      isV3: true,
      isV2: false,
      description: '基于森空岛API，提供明日方舟便捷查询和签到功能',
      icon: 'bi:box-seam',
      iconColor: '#03cffc',
      iconPath: path.join(pluginResources, 'common/icon/amiya.png')
    },
    // 配置项信息
    configInfo: {
      // 配置项 schemas
      schemas: [{
        component: 'Divider',
        label: '通用设置'
      },
      {
        field: 'help.cred_help_doc',
        label: 'cred绑定教程链接',
        bottomHelpMessage: '发送/cred帮助时，回复的链接',
        component: 'Input',
        required: true,
        componentProps: {
          placeholder: '请输入链接'
        }
      },
      {
        field: 'common.prefix_mode',
        label: '插件命令前缀',
        bottomHelpMessage: '修改插件命令前缀,修改后重启生效',
        component: 'Select',
        required: true,
        componentProps: {
          options: [
            {label: '完整模式(最泛用的匹配模式，支持最多前缀匹配)', value: 1},
            {label: '兼容模式(防止和其他方舟相关插件冲突，移除了“#方舟插件”）', value: 2},
            {label: '简洁模式(只使用"/"和“~”进行匹配)', value: 3},
          ],
          placeholder: '选择模式',
        },
      },
      {
        field: 'game_info.char_stat_page_size',
        label: '练度统计每页数量',
        bottomHelpMessage: '/练度统计 指令每页数量上限',
        component: 'InputNumber',
        required: true,
        componentProps: {
          min: 20,
          max: 200,
          placeholder: '请输入20-200数字'
        }
      },
      {
        component: 'Divider',
        label: '签到设置'
      },
      {
        field: 'sign.auto_sign',
        label: '自动签到开关',
        bottomHelpMessage: '自动签到功能总开关',
        component: 'Switch'
      },
      {
        field: 'sign.auto_sign_cron',
        label: '自动签到crontab配置',
        bottomHelpMessage: '可修改自动签到执行的时间和频率',
        component: 'Input',
        required: true,
        componentProps: {
          placeholder: 'crontab'
        }
      },
      {
        component: 'Divider',
        label: 'MAA远程控制设置'
      },
      {
        field: 'maa.maa_control_toggle',
        label: 'MAA模块总开关',
        bottomHelpMessage: '开启后才能使用MAA功能',
        component: 'Switch'
      },
      {
        field: 'maa.maa_api_host',
        label: 'MAA API Host',
        bottomHelpMessage: '已部署的MAA API服务的地址，包含端口号',
        component: 'Input',
        required: true,
        componentProps: {
          placeholder: '请输入MAA Host'
        }
      }
      ],
      getConfigData () {
        return setting.merge()
      },
      // 设置配置的方法（前端点确定后调用的方法）
      setConfigData (data, { Result }) {
        let config = {}
        for (let [keyPath, value] of Object.entries(data)) {
          lodash.set(config, keyPath, value)
        }
        config = lodash.merge({}, setting.merge, config)
        setting.analysis(config)
        return Result.ok({}, '保存成功~')
      }
    }
  }
}
