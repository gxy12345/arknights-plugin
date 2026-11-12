/**
 * 请注意，系统不会读取help_default.js ！！！！
 * 【请勿直接修改此文件，且可能导致后续冲突】
 *
 * 如需自定义可将文件【复制】一份，并重命名为 help.js
 *
 * */

export const helpCfg = {
  title: 'Arknights-Plugin 帮助',
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
        title: '#方舟cred帮助', appIcon: 'help.svg',
        desc: '绑定帮助'
      }, {
        icon: 2,
        title: '#方舟绑定',
        desc: '绑定森空岛账号'
      },{
        icon: 2,
        title: '#方舟扫码绑定', appIcon: 'scan.svg',
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
        title: '#方舟删除cred', appIcon: 'delete.svg',
        desc: '删除cred和token（解绑）'
      }
    ]
  }, {
    group: '游戏信息查询(需要绑定账号)',
    list: [
      {
        icon: 5,
        title: '#方舟便签 #方舟博士卡片', appIcon: 'toolbox-data.png', appIconColor: true,
        desc: '个人资料、理智、任务、招募与助战干员'
      },
      { icon: 5, title: '#方舟基建 #方舟基建查询', appIcon: 'toolbox-data.png', appIconColor: true, desc: '查看房间进驻、心情、生产、订单与专精训练' },
      {
        icon: 12,
        title: '#方舟玛恩纳 #方舟叔叔', appIcon: 'toolbox-operator.png', appIconColor: true,
        desc: '干员练度卡片'
      },
      {
        icon: 7,
        title: '#方舟练度统计 #方舟练度统计2', appIcon: 'toolbox-operator.png', appIconColor: true,
        desc: '干员资产紧凑列表，支持分页'
      },
      {
        icon: 7,
        title: '#方舟练度卡片 #方舟练度面板', appIcon: 'toolbox-operator.png', appIconColor: true,
        desc: '干员资产卡片，展示全部技能与专精'
      },
      {
        icon: 12,
        title: '#方舟时装统计', appIcon: 'skin.png',
        desc: '时装总数与系列统计，默认展示最近 8 套'
      },
      {
        icon: 13,
        title: '#方舟练度分析 #方舟BOX分析',
        desc: '分析BOX以及评分，仅供娱乐'
      },
      {
        icon: 8,
        title: '#方舟先锋练度统计 #方舟六星练度统计', appIcon: 'toolbox-operator.png', appIconColor: true,
        desc: '筛选后的练度统计，支持分页'
      }, {
        icon: 9,
        title: '#方舟签到', appIcon: 'toolbox-signin.png', appIconColor: true,
        desc: '签到明日方舟及同账号下的终末地角色'
      },
      {
        icon: 81,
        title: '#方舟养成计算 干员名 精英 等级', appIcon: 'toolbox-cultivate.png', appIconColor: true,
        desc: '可追加三个技能和模组等级，计算消耗与缺料'
      },
      {
        icon: 81,
        title: '#方舟养成计算', appIcon: 'toolbox-cultivate.png', appIconColor: true,
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
        title: '#方舟肉鸽 #方舟集成战略', appIcon: 'toolbox-rogue.png', appIconColor: true,
        desc: '查看肉鸽完成情况'
      },
      { icon: 5, title: '#方舟理智 #方舟剿灭', appIcon: 'sanity.png', desc: '查看理智与剿灭周常进度' },
      { icon: 5, title: '#方舟日常 #方舟周常', appIcon: 'daily.png', desc: '查看每日、每周任务完成情况' },
      { icon: 15, title: '#方舟活动 #方舟活动列表', appIcon: 'activity.svg', desc: '查询账号的活动关卡完成进度' },
      { icon: 15, title: '#方舟活动 完整名称或ID', appIcon: 'activity.svg', desc: '查询单个活动的各区域完成情况' }
    ]
  }, {
    group: '卫戍协议（需要绑定账号）',
    list: [
      { icon: 10, title: '#方舟卫戍帮助', appIcon: 'toolbox-garrison.png', appIconColor: true, desc: '查看命令用法，卫戍也可写为卫戍协议' },
      { icon: 10, title: '#方舟卫戍攻略 [关键词]', appIcon: 'toolbox-garrison.png', appIconColor: true, desc: '搜索社区攻略' },
      { icon: 10, title: '#方舟卫戍攻略下一页', appIcon: 'toolbox-garrison.png', appIconColor: true, desc: '继续当前攻略搜索' },
      { icon: 10, title: '#方舟卫戍攻略详情1', appIcon: 'toolbox-garrison.png', appIconColor: true, desc: '查看攻略阵容与思路，支持空格及攻略ID' },
      { icon: 10, title: '#方舟卫戍战绩 [页码] [赛季ID]', appIcon: 'toolbox-garrison.png', appIconColor: true, desc: '查询逐局历史战绩' },
      { icon: 10, title: '#方舟卫戍战绩详情1', appIcon: 'toolbox-garrison.png', appIconColor: true, desc: '查看上次列表中的对局，支持空格' },
      { icon: 10, title: '#方舟卫戍统计', appIcon: 'toolbox-garrison.png', appIconColor: true, desc: '查看累计通关、击败和最近奖杯' },
      { icon: 10, title: '#方舟卫戍赛季', appIcon: 'toolbox-garrison.png', appIconColor: true, desc: '查看官方可查询赛季' }
    ]
  }, {
    group: '其他信息查询(不需要绑定账号)',
    list: [
      { icon: 12, title: '#方舟维什戴尔图鉴', appIcon: 'toolbox-operator.png', appIconColor: true, desc: '横版立绘、属性、天赋、潜能和技能速览；支持别名' },
      { icon: 12, title: '#方舟维什戴尔技能', appIcon: 'toolbox-operator.png', appIconColor: true, desc: '7级与专精；可追加1–10、专1–3或全等级' },
      { icon: 12, title: '#方舟维什戴尔模组', appIcon: 'toolbox-operator.png', appIconColor: true, desc: '全部模组各级属性、特性、天赋与解锁任务' },
      { icon: 15, title: '#方舟活动日历', appIcon: 'calendar.webp', appIconColor: true, desc: '查看近期活动时间，与账号关卡进度分开查询' },
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
        title: '#方舟公招查询 支援 远程位', appIcon: 'toolbox-recruit.png', appIconColor: true,
        desc: '官方实时公招池，绑定后标记持有和满潜'
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
    group: '活动推送管理（仅主人）',
    auth: 'master',
    list: [
      { icon: 15, title: '#方舟开启活动推送', desc: '开启本群活动提醒' },
      { icon: 15, title: '#方舟关闭活动推送', desc: '关闭本群活动提醒' },
      { icon: 15, title: '#方舟更新活动数据', appIcon: 'refresh.svg', desc: '清除活动时间缓存并重新获取' }
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
