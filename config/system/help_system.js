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
    group: '绑定相关',
    list: [
      {
        icon: 1,
        title: '#方舟cred帮助',
        desc: '绑定帮助'
      }, {
        icon: 2,
        title: '#方舟绑定',
        desc: '绑定森空岛账号'
      },{
        icon: 2,
        title: '#方舟扫码绑定',
        desc: '通过森空岛APP扫码的方式绑定'
      }, {
        icon: 3,
        title: '#方舟我的cred',
        desc: '查看已绑定的森空岛cred'
      }, {
        icon: 3,
        title: '#方舟我的token',
        desc: '查看已绑定的token'
      }, {
        icon: 4,
        title: '#方舟删除cred',
        desc: '删除cred和token（解绑）'
      }
    ]
  }, {
    group: '游戏信息查询(需要绑定账号)',
    list: [
      {
        icon: 5,
        title: '#方舟便签 #方舟博士卡片',
        desc: '角色资料卡片'
      },
      {
        icon: 12,
        title: '#方舟玛恩纳 #方舟叔叔',
        desc: '干员练度卡片'
      },
      {
        icon: 7,
        title: '#方舟练度统计 #方舟练度统计2',
        desc: '干员练度统计，支持分页'
      },
      {
        icon: 7,
        title: '#方舟练度卡片 #方舟练度面板',
        desc: '查看干员练度面板'
      },
      {
        icon: 13,
        title: '#方舟练度分析 #方舟BOX分析',
        desc: '分析BOX以及评分，仅供娱乐'
      },
      {
        icon: 8,
        title: '#方舟先锋练度统计 #方舟六星练度统计',
        desc: '筛选后的练度统计，支持分页'
      }, {
        icon: 9,
        title: '#方舟签到',
        desc: '手动进行森空岛签到'
      },
      {
        icon: 81,
        title: '#方舟养成计算+[TAG列表]',
        desc: '例:#方舟养成计算 推王 2 90 7 10 7'
      },
      {
        icon: 81,
        title: '#方舟养成计算',
        desc: '不输入tag时可以获取命令帮助'
      },
      {
        icon: 19,
        title: '#方舟抽卡记录 #方舟寻访记录',
        desc: '查看抽卡记录'
      },
      {
        icon: 20,
        title: '#方舟抽卡分析 #方舟寻访分析',
        desc: '查看抽卡分析'
      },
      {
        icon: 10,
        title: '#方舟肉鸽 #方舟集成战略',
        desc: '查看肉鸽完成情况'
      }
    ]
  }, {
    group: '其他信息查询(不需要绑定账号)',
    list: [
      {
        icon: 15,
        title: '#方舟公告 #方舟公告列表',
        desc: '查询鹰角官方发布的公告'
      },
      {
        icon: 15,
        title: '#方舟公告1 #方舟公告2',
        desc: '查看公告列表中的具体公告内容'
      },
      {
        icon: 15,
        title: '#方舟材料掉率 #方舟刷图推荐',
        desc: '从一图流获取材料掉率图'
      },
      {
        icon: 15,
        title: '#方舟公招查询+[TAG列表]',
        desc: '从一图流获取材料掉率图'
      },
      {
        icon: 21,
        title: '#方舟添加别名 #方舟删除别名',
        desc: '自定义干员别名, 例如#方舟添加别名 银灰 前夫哥'
      },
      {
        icon: 21,
        title: '#方舟查看别名',
        desc: '查看干员别名, 例如#方舟查看别名 银灰'
      },
      {
        icon: 7,
        title: '#方舟EW养成统计 #方舟玛恩纳养成推荐',
        desc: '查看yituliu的养成统计'
      }
    ]
  }, {
    group: 'MAA远程控制',
    list: [{
      icon: 90,
      title: '#方舟MAA帮助',
      desc: '查看MAA绑定帮助'
    }, {
      icon: 90,
      title: '#方舟我的MAA',
      desc: '查看已绑定的设备'
    }, {
      icon: 90,
      title: '#方舟MAA+(指令)',
      desc: '下发MAA任务'
    }, {
      icon: 90,
      title: '#方舟MAA任务状态',
      desc: '查询已下发的任务状态'
    }
    ]
  }
]
