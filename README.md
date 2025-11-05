# arknights-plugin
基于森空岛API开发的Yunzai Bot插件，缓慢填坑中


在群友帮助下试运行了一段时间，功能基本上稳定可用了，故开源发布


## 安装方法
yunzai根目录运行以下命令

github:
```
git clone https://github.com/gxy12345/arknights-plugin.git ./plugins/arknights-plugin/
pnpm install --filter=arknights-plugin
```

gitee:
```
git clone https://gitee.com/windoge/arknights-plugin.git ./plugins/arknights-plugin/
pnpm install --filter=arknights-plugin
```


## 当前功能


注：由于机器所部署的平台差异或者其他插件的占用，可能出现无法识别"/",以下所有命令的"/"均可以使用"~"或“#方舟插件”替换


### 插件基本命令
* `#方舟插件更新` `/更新` `~更新` 更新插件
* `#方舟插件帮助` `/帮助` `~帮助` 打开帮助菜单


### 森空岛cred管理
<details><summary>展开/收起</summary>

* `/绑定` 绑定森空岛cred
* `/扫码绑定` 通过森空岛APP扫码的方式绑定
* `/删除cred` 删除已绑定的森空岛cred
* `/我的cred` 查询已绑定的森空岛cred
* `/我的token` 查询已绑定的token
* `/cred帮助` 查询森空岛cred获取帮助文档

</details>



### 游戏信息查询(需要绑定账号)
<details><summary>展开/收起</summary>

* <details><summary><code>/便签</code> 森空岛个人信息一图流</summary>
  
  <img src="https://github.com/gxy12345/arknights-plugin/assets/13727139/34cef041-a69c-4441-b05d-d2b6ce9194f8" width="50%" height="50%">
  
  </details>

* `/签到` 森空岛签到（支持自动签到，需在sign.yaml配置文件中修改开关）
* <details><summary><code>/抽卡记录</code> <code>/寻访记录</code> 查询账号近期的详细抽卡记录</summary>
  
  <img src="https://github.com/user-attachments/assets/905a7681-afc1-492e-b221-36eeaae63175" width="50%" height="50%">
  
  </details>

  * `/抽卡记录 不归花火` 查询指定卡池的抽卡记录

* <details><summary><code>/抽卡分析</code> <code>/寻访分析</code> 查询账号整体抽卡分析图</summary>
  
  <img src="https://github.com/user-attachments/assets/782729cd-abb0-4879-99fc-cb088e5bc0e1" width="50%" height="50%">
  
  </details>

* <details><summary><code>/叔叔</code>、<code>/玛恩纳</code> 查看干员练度卡片</summary>
  
  <img src="https://github.com/gxy12345/arknights-plugin/assets/13727139/d351cda3-d0c4-48c7-b1da-87a51647f701" width="50%" height="50%">
  
  </details>

* <details><summary><code>/练度统计</code> <code>/近卫练度统计</code> 基于森空岛API查询干员练度汇总</summary>
  
  <img src="https://github.com/gxy12345/arknights-plugin/assets/13727139/40fbf472-6eb9-4f76-b373-948dd2835715" width="40%" height="40%">
  
  </details>

* <details><summary><code>/练度卡片</code> <code>/练度面板</code> 新版的练度统计</summary>
  
  <img src="https://github.com/user-attachments/assets/8263514f-beb3-4b84-84c9-39336ce75edc" width="40%" height="40%">
  
  </details>

* <details><summary><code>/练度分析</code> <code>/BOX分析</code> 分析BOX练度数据，仅供娱乐</summary>
  
  <img src="https://github.com/gxy12345/arknights-plugin/assets/13727139/8d4b1613-d9b9-47c6-8ba7-d4c744e68709" width="40%" height="40%">
  
  </details>

* <details><summary><code>/养成计算</code> 根据当前BOX情况，计算养成干员所需材料和目前材料的差值。命令规则为<code>/养成计算 [干员名称] [精英阶段] [等级] [技能1] [技能2] [技能3] [模组1] [模组2] [模组3]</code></summary>
  
  <img src="https://github.com/user-attachments/assets/dbb73236-2cda-42c5-88bc-cee86b67daba" width="40%" height="40%">
  
  </details>

* `/肉鸽` `/集成战略` 查看各个主题肉鸽的完成情况
* `/添加别名 斩业星熊 新熊` `/查看别名 斩业星熊` `/删除别名 斩业星熊 新熊` 自定义干员别名
* `/理智` 通过森空岛接口查询理智
* `/剿灭` 通过森空岛接口查询剿灭周常
* `/日常` `/周常` 通过森空岛接口查询周常完成

</details>

### 其他查询(不需要绑定账号)
<details><summary>展开/收起</summary>
一些不需要绑定即可使用的功能

* `/公招查询 支援 远程位` 公招查询，同时在结果中标记干员持有情况
* `/刷图推荐` `/材料掉率` 从一图流获取材料掉率表
* `/公告` `/公告列表` 查询官方发布的公告
* <details><summary><code>/公告1</code> <code>/公告2</code> 查看具体的公告内容</summary>
  
  <img src="https://github.com/gxy12345/arknights-plugin/assets/13727139/c9e85590-f336-4db0-b3a6-ba858015e678" width="40%" height="40%">
  
  </details>

* <details><summary><code>/{干员名/别名}养成统计</code> <code>/{干员名/别名}养成推荐</code> 从yituliu获取养成统计</summary>

  <img src="https://github.com/user-attachments/assets/d72c2a6d-0aac-400d-8b4d-6db6f4a312dd" width="50%" height="50%">
  
  </details>

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
