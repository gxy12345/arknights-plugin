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
      schemas: [      {
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
        bottomHelpMessage: '修改插件命令前缀,修改后重启生效。关键词：方舟、明日方舟、arknights、方舟插件',
        component: 'Select',
        required: true,
        componentProps: {
          options: [
            {label: '模式1: 关键词 + 前缀 # 或 / (例如: #方舟绑定、/方舟绑定)', value: 1},
            {label: '模式2: 仅前缀 ~ 或 ～ (例如: ~帮助、～帮助)', value: 2},
            {label: '模式3: 关键词+#或/ 或 仅~或～ (例如: #方舟绑定、~帮助)', value: 3},
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
        field: 'game_info.max_announce',
        label: '公告显示数量上限',
        bottomHelpMessage: '/公告列表 显示公告数量上限',
        component: 'InputNumber',
        required: true,
        componentProps: {
          min: 3,
          max: 10,
          placeholder: '3-10数字'
        }
      },
      {
        component: 'Divider',
        label: '别名管理权限设置'
      },
      {
        field: 'nickname.add_permission',
        label: '添加别名权限',
        bottomHelpMessage: '设置谁可以使用/添加别名命令',
        component: 'Select',
        required: true,
        componentProps: {
          options: [
            {label: '所有人', value: 'all'},
            {label: '仅主人', value: 'master'},
            {label: '关闭', value: 'off'},
          ],
          placeholder: '选择权限',
        },
      },
      {
        field: 'nickname.view_permission',
        label: '查看别名权限',
        bottomHelpMessage: '设置谁可以使用/查看别名命令',
        component: 'Select',
        required: true,
        componentProps: {
          options: [
            {label: '所有人', value: 'all'},
            {label: '仅主人', value: 'master'},
            {label: '关闭', value: 'off'},
          ],
          placeholder: '选择权限',
        },
      },
      {
        field: 'nickname.delete_permission',
        label: '删除别名权限',
        bottomHelpMessage: '设置谁可以使用/删除别名命令',
        component: 'Select',
        required: true,
        componentProps: {
          options: [
            {label: '所有人', value: 'all'},
            {label: '仅主人', value: 'master'},
            {label: '关闭', value: 'off'},
          ],
          placeholder: '选择权限',
        },
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
        label: '活动推送设置'
      },
      {
        field: 'activity.activity_push_enable',
        label: '活动推送总开关',
        bottomHelpMessage: '开启后才能使用活动推送功能，关闭后所有群都不会收到推送',
        component: 'Switch'
      },
      {
        field: 'activity.activity_push_cron',
        label: '活动推送crontab配置',
        bottomHelpMessage: '可修改活动推送执行的时间和频率，默认每天上午10:00执行',
        component: 'Input',
        required: true,
        componentProps: {
          placeholder: '0 0 10 * * ?'
        }
      },
      {
        field: 'activity.skip_ongoing_in_push',
        label: '推送时忽略进行中的活动',
        bottomHelpMessage: '开启后，定时推送只包含即将开始和即将结束的活动，不包含正在进行中的活动',
        component: 'Switch'
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
      },
      {
        component: 'Divider',
        label: '抽卡记录设置'
      },
      {
        field: 'gacha.days_range',
        label: '抽卡记录展示天数',
        bottomHelpMessage: '设置抽卡记录展示的时间范围（天数）',
        component: 'InputNumber',
        required: true,
        componentProps: {
          min: 30,
          max: 365,
          placeholder: '请输入30-365数字'
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
