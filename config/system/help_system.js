/**
 * 请注意，系统不会读取help_default.js ！！！！
 * 【请勿直接修改此文件，且可能导致后续冲突】
 *
 * 如需自定义可将文件【复制】一份，并重命名为 help.js
 *
 * */

export const helpCfg = {
  title: 'Arknights-Plugin帮助',
  subTitle: 'Yunzai-Bot & Arknights-plugin',
  columnCount: 3,
  colWidth: 275,
  theme: 'all',
  themeExclude: ['default'],
  style: {
    fontColor: '#ceb78b',
    descColor: '#eee',
    contBgColor: 'rgba(6, 21, 31, .5)',
    contBgBlur: 3,
    headerBgColor: 'rgba(6, 21, 31, .4)',
    rowBgColor1: 'rgba(6, 21, 31, .2)',
    rowBgColor2: 'rgba(6, 21, 31, .35)'
  }
}

export const helpList = [
  {
    group: '绑定相关(支持"#方舟","/",“~”前缀)',
    list: [
      {
        icon: 1,
        title: '/cred帮助',
        desc: '绑定帮助'
      }, {
        icon: 2,
        title: '/绑定',
        desc: '绑定森空岛账号'
      }, {
        icon: 3,
        title: '/我的cred',
        desc: '查看已绑定的森空岛cred'
      }, {
        icon: 3,
        title: '/我的token',
        desc: '查看已绑定的token'
      }, {
        icon: 4,
        title: '/删除cred',
        desc: '删除cred和token（解绑）'
      }
    ]
  }, {
    group: '游戏信息查询(支持"#方舟","/",“~”前缀)',
    list: [
      {
        icon: 5,
        title: '/便签 /博士卡片',
        desc: '角色资料卡片'
      }, {
        icon: 12,
        title: '/玛恩纳 /叔叔',
        desc: '干员练度卡片'
      }, {
        icon: 7,
        title: '/练度统计 /练度统计2',
        desc: '干员练度统计，支持分页'
      }, {
        icon: 13,
        title: '/练度分析 /BOX分析',
        desc: '分析BOX以及评分，仅供娱乐'
      },
      {
        icon: 8,
        title: '/先锋练度统计 /六星练度统计',
        desc: '筛选后的练度统计，支持分页'
      }, {
        icon: 9,
        title: '/签到',
        desc: '手动进行森空岛签到'
      }, {
        icon: 81,
        title: '/公招查询+[TAG列表]',
        desc: '例:/公招查询 高资 输出 辅助'
      }, {
        icon: 15,
        title: '/公告 /公告列表',
        desc: '查询鹰角官方发布的公告'
      }, {
        icon: 15,
        title: '/公告1 /公告2',
        desc: '查看公告列表中的具体公告内容'
      }, {
        icon: 14,
        title: '/材料掉率 /刷图推荐',
        desc: '从一图流获取材料掉率图'
      }
    ]
  }, {
    group: 'MAA远程控制',
    list: [{
      icon: 90,
      title: '/MAA帮助',
      desc: '查看MAA绑定帮助'
    }, {
      icon: 90,
      title: '/我的MAA',
      desc: '查看已绑定的设备'
    }, {
      icon: 90,
      title: '/MAA+(指令)',
      desc: '下发MAA任务'
    }, {
      icon: 90,
      title: '/MAA任务状态',
      desc: '查询已下发的任务状态'
    }
    ]
  }
]
