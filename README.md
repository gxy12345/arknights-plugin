# arknights-plugin
基于森空岛API开发的Yunzai Bot插件，缓慢填坑中


在群友帮助下试运行了一段时间，功能基本上稳定可用了，故开源发布


## 安装方法
yunzai根目录运行以下命令

github:
```
git clone https://github.com/gxy12345/arknights-plugin.git ./plugins/arknights-plugin/
pnpm i
```

gitee:
```
git clone https://gitee.com/windoge/arknights-plugin.git ./plugins/arknights-plugin/
pnpm i
```


## 当前功能


注：由于机器所部署的平台差异或者其他插件的占用，可能出现无法识别"/",以下所有命令的"/"均可以使用"~"或“#方舟插件”替换


### 插件基本命令
* `#方舟插件更新` `/更新` `~更新` 更新插件
* `#方舟插件帮助` `/帮助` `~帮助` 打开帮助菜单


### 森空岛cred管理
<details><summary>展开/收起</summary>

* `/绑定` 绑定森空岛cred
* `/删除cred` 删除已绑定的森空岛cred
* `/我的cred` 查询已绑定的森空岛cred
* `/我的token` 查询已绑定的token
* `/cred帮助` 查询森空岛cred获取帮助文档

</details>



### 基本信息查询
<details><summary>展开/收起</summary>

* `/便签` 森空岛个人信息一图流
<img src="https://github.com/gxy12345/arknights-plugin/assets/13727139/34cef041-a69c-4441-b05d-d2b6ce9194f8" width="50%" height="50%">

* `/理智` 通过森空岛接口查询理智
* `/剿灭` 通过森空岛接口查询剿灭周常
* `/日常` `/周常` 通过森空岛接口查询周常完成
* `/签到` 森空岛签到（支持自动签到，需在sign.yaml配置文件中修改开关）
* `/叔叔`、`/玛恩纳` 查看干员练度卡片
<img src="https://github.com/gxy12345/arknights-plugin/assets/13727139/d351cda3-d0c4-48c7-b1da-87a51647f701" width="50%" height="50%">

* `/公招查询 支援 远程位` 公招查询，同时在结果中标记干员持有情况
* `/练度统计` `/近卫练度统计` 基于森空岛API查询干员练度汇总
<img src="https://github.com/gxy12345/arknights-plugin/assets/13727139/40fbf472-6eb9-4f76-b373-948dd2835715" width="40%" height="40%">

* `/练度分析` `/BOX分析` 分析BOX练度数据，仅供娱乐
<img src="https://github.com/gxy12345/arknights-plugin/assets/13727139/8d4b1613-d9b9-47c6-8ba7-d4c744e68709" width="40%" height="40%">

* `/刷图推荐` `/材料掉率` 从一图流获取材料掉率表
* `/公告` `/公告列表` 查询官方发布的公告
* `/公告1` `/公告2` 查看具体的公告内容
<img src="https://github.com/gxy12345/arknights-plugin/assets/13727139/c9e85590-f336-4db0-b3a6-ba858015e678" width="40%" height="40%">

* `/养成计算` 根据当前BOX情况，计算养成干员所需材料和目前材料的差值。命令规则为`/养成计算 [干员名称] [精英阶段] [等级] [技能1] [技能2] [技能3] [模组1] [模组2] [模组3]`

</details>

### MAA远程控制
该模块需要配合一个[MAA远控API服务](https://github.com/gxy12345/maa_control_api)，在maa.yaml配置文件中修改配置信息后使用


<details><summary>展开/收起</summary>

* `/MAA帮助` 查看绑定帮助
* `/我的MAA` 查看已绑定的设备
* `/MAA+(指令)` 下发MAA任务
* `/MAA任务状态`  查询已下发的任务状态

</details>


## 致谢
本插件参考了很多[Starrail-plugin](https://gitee.com/hewang1an/StarRail-plugin)的实现，感谢大佬开源的代码
