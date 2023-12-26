# arknights-plugin
基于森空岛API开发的Yunzai Bot插件，缓慢填坑中


## 安装方法
yunzai根目录运行以下命令
```
git clone https://github.com/gxy12345/arknights-plugin.git ./plugins/arknights-plugin/
pnpm i
```


## 当前功能
### 森空岛cred管理
* `/绑定cred` 绑定森空岛cred
* `/删除cred` 删除已绑定的森空岛cred
* `/我的cred` 查询已绑定的森空岛cred
* `/cred帮助` 查询森空岛cred获取帮助文档


### 基本信息查询(迭代中，随时可能废弃)
* `/便签` 森空岛个人信息一图流
* `/理智` 通过森空岛接口查询理智
* `/剿灭` 通过森空岛接口查询剿灭周常
* `/日常` `/周常` 通过森空岛接口查询周常完成
* `/签到` 森空岛签到
* `/叔叔`、`/玛恩纳` 查看干员练度卡片
* `/公招查询 支援 远程位` 公招查询，同时在结果中标记干员持有情况
* `/练度统计` `/近卫练度统计` 基于森空岛API查询干员练度汇总


### MAA远程控制
该模块需要配合一个[MAA远控API服务](https://github.com/gxy12345/maa_control_api)
* `/MAA帮助` 查看绑定帮助
* `/我的MAA` 查看已绑定的设备
* `/MAA+(指令)` 下发MAA任务
* `/MAA任务状态`  查询已下发的任务状态
