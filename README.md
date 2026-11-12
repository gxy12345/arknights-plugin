<div align="center">

# arknights-plugin

**把罗德岛的数据，带到聊天里。**

适用于 Yunzai Bot 的明日方舟插件<br>
查询干员与时装资产、查看活动与卫戍战绩，也能完成日常签到与养成规划。

[![Version](https://img.shields.io/badge/version-2.1.0-22bbff?style=flat-square)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-607d8b?style=flat-square)](LICENSE)
[![Yunzai](https://img.shields.io/badge/Yunzai-Bot-252b32?style=flat-square)](https://github.com/yoimiya-kokomi/Yunzai-Bot)

[效果展示](#效果展示) · [安装与绑定](#安装与绑定) · [命令指南](#命令指南) · [配置说明](#配置说明) · [更新日志](CHANGELOG.md)

</div>

[![效果总览：干员练度、时装收藏、卫戍协议与活动进度](.github/images/overview.webp)](.github/images/overview.webp)

## 2.1.0 新变化

- **干员图鉴**：无需绑定账号，使用干员名称或别名即可查询立绘、星级、属性、天赋与潜能。
- **技能与模组详情**：查看各技能等级、专精效果，以及全部模组各阶段的属性、效果与解锁任务。
- **公招索引更新**：按招募标签查询干员组合，绑定后可查看未持有与满潜标记。
- **博士便签更新**：集中查看个人资料、理智、任务、招募、线索、专精训练与助战干员，使用官方标准助理肖像。
- **新增基建总览**：通过 `基建` / `基建查询` 查看房间进驻、心情、生产仓储、贸易订单与收益。
- **终末地签到**：签到时自动发现同账号下的终末地角色；Guoba 提供默认开启的“自动签到终末地”选项。

## 效果展示

点击图片可放大，展开下方条目查看各功能效果。

<details>
<summary>查看干员图鉴、技能、模组与公招索引效果</summary>

无需绑定账号，即可查看干员图鉴、技能、模组和公招索引。

| 干员图鉴 · `维什戴尔图鉴` | 干员技能 · `维什戴尔技能` |
| :---: | :---: |
| [![干员图鉴：立绘、星级、属性、天赋与潜能](.github/images/encyclopedia-overview.webp)](.github/images/encyclopedia-overview.webp) | [![干员技能：7级和专1–3的效果与技力数据](.github/images/encyclopedia-skills.webp)](.github/images/encyclopedia-skills.webp) |
| **干员模组 · `年模组`** | **公招索引 · `公招 高资 支援`** |
| [![干员模组：全部模组各阶段属性、效果与解锁任务](.github/images/encyclopedia-modules.webp)](.github/images/encyclopedia-modules.webp) | [![公招索引：按招募标签查询干员组合](.github/images/recruit-tool.webp)](.github/images/recruit-tool.webp) |

以上命令需添加当前配置的插件前缀，例如 `#方舟维什戴尔图鉴`、`~银灰技能 专3`。

</details>

### 干员资产与时装

<table>
<tr>
<td width="50%" align="center" valign="top"><strong>练度卡片</strong><br>查看干员立绘、练度、技能、专精和模组<br><br><a href=".github/images/operators-cards.webp"><img src=".github/images/operators-preview.webp" alt="干员练度卡片" width="100%"></a></td>
<td width="50%" align="center" valign="top"><strong>时装统计</strong><br>收藏总数、系列分布与最近获得时间<br><br><a href=".github/images/skins.webp"><img src=".github/images/skins-preview.webp" alt="时装统计：各系列数量与最近获得的八套时装" width="100%"></a></td>
</tr>
</table>

<details>
<summary>查看练度列表与更多养成效果</summary>

| 练度列表 | 干员详情 |
| :---: | :---: |
| [![练度列表](.github/images/operators-list.webp)](.github/images/operators-list.webp) | [![干员详情](.github/images/operator.webp)](.github/images/operator.webp) |
| **BOX 练度分析** | **养成材料计算** |
| [![BOX 练度分析](.github/images/box-analysis.webp)](.github/images/box-analysis.webp) | [![养成材料计算](.github/images/materials.webp)](.github/images/materials.webp) |

[查看一图流养成统计效果](.github/images/training.webp)

</details>

### 卫戍协议与活动

<table>
<tr>
<td width="50%" align="center" valign="top"><strong>卫戍协议</strong><br>查看攻略、逐局战绩与完整阵容<br><br><a href=".github/images/garrison-record.webp"><img src=".github/images/garrison-preview.webp" alt="卫戍协议逐局战绩的阵容详情" width="100%"></a></td>
<td width="50%" align="center" valign="top"><strong>活动进度</strong><br>快速区分进行中与已完成的活动<br><br><a href=".github/images/activity.webp"><img src=".github/images/activity-preview.webp" alt="活动关卡进度列表" width="100%"></a></td>
</tr>
</table>

<details>
<summary>查看完整攻略、逐局战绩与公告效果</summary>

| 攻略详情 | 战绩详情 |
| :---: | :---: |
| [![卫戍攻略详情](.github/images/garrison-guide.webp)](.github/images/garrison-guide.webp) | [![卫戍战绩详情](.github/images/garrison-record.webp)](.github/images/garrison-record.webp) |

[查看官方公告效果](.github/images/announcement.webp)

</details>

<details>
<summary>查看新版博士便签与基建效果</summary>

| 博士便签 · `便签` / `博士卡片` | 基建总览 · `基建` / `基建查询` |
| :---: | :---: |
| [![博士便签：个人资料、理智、任务、招募与助战干员](.github/images/profile.webp)](.github/images/profile.webp) | [![基建总览：房间进驻、心情、生产仓储、订单、线索与专精训练](.github/images/infrastructure.webp)](.github/images/infrastructure.webp) |

绑定森空岛账号后，发送 `#方舟便签` 或 `#方舟基建` 即可查询。进驻、心情、库存与订单以图中的游戏同步时间为准。预览中的姓名与 UID 均为示例。

</details>

<details>
<summary>查看寻访记录与分析效果</summary>

| 寻访记录 | 寻访分析 |
| :---: | :---: |
| [![寻访记录](.github/images/recruit-record.webp)](.github/images/recruit-record.webp) | [![寻访分析](.github/images/recruit-analysis.webp)](.github/images/recruit-analysis.webp) |

</details>

## 安装与绑定

### 安装插件

在 **Yunzai 根目录**执行，选择一个仓库地址即可。

```bash
# GitHub
git clone --depth=1 https://github.com/gxy12345/arknights-plugin.git ./plugins/arknights-plugin/
pnpm install --filter=arknights-plugin
```

<details>
<summary>使用 Gitee 安装</summary>

```bash
git clone --depth=1 https://gitee.com/windoge/arknights-plugin.git ./plugins/arknights-plugin/
pnpm install --filter=arknights-plugin
```

</details>

安装完成后重启 Yunzai。需要图形化配置时，可配合 Guoba 插件使用。

### 绑定森空岛

使用默认前缀发送：

```text
#方舟帮助
#方舟扫码绑定
#方舟便签
```

也可以发送 `#方舟绑定` 按提示绑定 cred，或通过 `#方舟cred帮助` 查看获取说明。绑定后即可使用便签、签到、干员资产、时装、活动进度和卫戍协议等功能。

### 命令前缀

**以下命令表省略前缀，使用时请添加当前配置的前缀。** 默认模式为 `1`，例如 `#方舟练度卡片`。

| 模式 | 支持形式 | 示例 |
| --- | --- | --- |
| `1`（默认） | `#` 或 `/` + 关键词 | `#方舟帮助`、`/方舟帮助`、`#方舟插件帮助` |
| `2` | `~` 或 `～` | `~帮助`、`～帮助` |
| `3` | 同时支持模式 1、2 | `#方舟帮助`、`~帮助` |

关键词支持 `方舟`、`明日方舟`、`arknights`、`方舟插件`。在 Guoba 或 `config/common.yaml` 中修改 `prefix_mode`，重启后生效。

## 命令指南

<details>
<summary>查看插件帮助菜单效果</summary>

[![插件帮助菜单](.github/images/help.webp)](.github/images/help.webp)

</details>

### 日常与账号

| 命令 | 用途 |
| --- | --- |
| `帮助` / `更新` | 打开帮助菜单 / 更新插件 |
| `扫码绑定` / `绑定` | 绑定森空岛账号 |
| `删除cred` / `我的cred` / `我的token` / `cred帮助` | 管理绑定与查看绑定说明 |
| `便签` / `博士卡片` | 查看个人资料、理智、任务、招募状态与助战干员 |
| `基建` / `基建查询` | 查看各房间进驻干员、心情、库存、订单、线索与专精训练 |
| `签到` | 同时签到明日方舟及同账号下的终末地角色，没有终末地角色时自动跳过 |
| `理智` / `剿灭` / `日常` / `周常` | 查询理智、剿灭与任务完成情况 |
| `肉鸽` / `集成战略` | 查询各主题集成战略的完成情况 |
| `抽卡记录` / `寻访记录` | 查询近期寻访记录；可追加卡池名称，如 `抽卡记录 不归花火` |
| `抽卡分析` / `寻访分析` | 查看整体寻访分析 |

### 干员、练度与时装

| 命令 | 用途 |
| --- | --- |
| `玛恩纳` / `叔叔` | 使用干员名称或别名查看个人练度详情 |
| `练度统计` / `练度列表` / `练度查询` | 干员资产列表 |
| `练度卡片` / `练度面板` | 查看干员立绘与练度卡片 |
| `近卫练度统计` / `六星练度卡片` | 按职业或星级筛选；可组合使用 |
| `练度统计2` / `练度卡片2` | 查看第 2 页，页码紧接命令 |
| `练度分析` / `BOX分析` | 分析 BOX 练度数据，仅供娱乐 |
| `时装统计` | 统计全部时装与系列数量，展示最近获得的时装 |
| `养成计算 干员名 精英阶段 等级 技能1 技能2 技能3 模组1 模组2 模组3` | 按当前 BOX 与库存计算养成材料差值 |
| `干员名养成统计` / `干员名养成推荐` | 查询一图流养成统计，支持别名 |
| `添加别名 斩业星熊 新熊` | 添加自定义干员别名 |
| `查看别名 斩业星熊` / `删除别名 斩业星熊 新熊` | 查看或删除自定义别名 |

养成计算会列出目标所需材料，并提示当前缺少的数量。

时装统计可查看收藏总数、系列数量和最近获得的时装，可在配置中调整最近时装的展示数量。

### 卫戍协议

需要绑定森空岛账号；命令中的 `卫戍` 也可写为 `卫戍协议`。

| 命令 | 用途 |
| --- | --- |
| `卫戍帮助` | 查看卫戍协议命令说明 |
| `卫戍攻略 [关键词]` | 查询社区攻略 |
| `卫戍攻略下一页` | 继续当前攻略搜索 |
| `卫戍攻略详情 序号或ID` | 查看成型阵容、回合配置、盟约、装备与操作思路 |
| `卫戍战绩 [页码] [赛季ID]` | 查询逐局历史记录 |
| `卫戍战绩详情 序号` | 查看最近一次战绩列表中的完整阵容与装备 |
| `卫戍统计 [赛季ID]` | 查看各难度累计通关次数、累计击败数及最近记录的奖杯数 |
| `卫戍赛季` | 查看官方可查询赛季 |

详情命令同时支持 `~卫戍攻略详情 1` 与 `~卫戍攻略详情1`，战绩详情同理（示例使用前缀模式 2 或 3）。查看战绩详情前，请先查询战绩列表。

查询「卫戍战绩」或「卫戍统计」时，会将接口返回的新对局计入本地统计。汇总与去重用的对局 ID 按游戏 UID 和赛季保存在云崽的 `data/arknights/garrison/statistics/` 目录。已收录的对局即使超出接口返回上限，仍会计入累计统计。首次同步时只能收录接口仍可查询的对局。

### 活动、资讯与工具

| 命令 | 用途 | 账号要求 |
| --- | --- | --- |
| `活动` / `活动列表` / `活动查询` | 查看账号活动关卡进度 | 需要绑定 |
| `活动 完整名称或ID` | 查看指定活动的区域完成数 | 需要绑定 |
| `活动日历` | 查询近期活动时间 | 无需绑定 |
| `开启活动推送` / `关闭活动推送` | 开关本群活动推送 | 仅主人 |
| `更新活动数据` | 刷新活动日历数据 | 仅主人 |
| `维什戴尔图鉴` | 横版立绘、属性、天赋、潜能和技能速览，支持干员别名 | 无需绑定 |
| `维什戴尔技能` | 查看7级和专1–3技能数据，可追加 `1`–`10`、`专1`–`专3` 或 `全等级` | 无需绑定 |
| `维什戴尔模组` | 查看全部模组各级属性、特性、天赋及解锁任务 | 无需绑定 |
| `公招查询 支援 远程位` / `公招索引` | 按招募标签查询组合，绑定后标记持有与满潜 | 无需绑定 |
| `刷图推荐` / `材料掉率` | 查询一图流材料掉率表 | 无需绑定 |
| `公告` / `公告列表` / `公告1` | 查询公告列表与指定公告内容 | 无需绑定 |

图鉴命令格式为“前缀 + 干员名称或别名 + 图鉴/技能/模组”，例如 `#方舟银灰图鉴`、`~叔叔技能 专3`、`~年模组`。支持无歧义的部分名称；阿米娅可指定 `阿米娅（术师）`、`阿米娅（近卫）`、`阿米娅（医疗）`。技能的 `8`–`10` 对应专1–3，追加 `全等级` 可查看全部等级。

公招每次可输入1–5个标签，以空格、逗号或 `+` 分隔；支持“高资、资深、近战、远程、快活、回费”等简写。高级资深干员标签保留时才可招募六星，支援机械需要短时招募；实际结果以游戏内标签、招募时长及标签是否保留为准。

### MAA 远程控制

需另行部署 [MAA 远控 API 服务](https://github.com/gxy12345/maa_control_api)，并在 `config/maa.yaml` 中填写服务信息。

| 命令 | 用途 |
| --- | --- |
| `MAA帮助` | 查看配置与绑定说明 |
| `MAA绑定设备` / `我的MAA` | 绑定或查看设备 |
| `MAA指令` | 下发对应任务，具体指令见帮助 |
| `MAA任务状态` | 查看已下发任务的状态 |

## 配置说明

推荐通过 Guoba 修改配置，也可编辑插件目录下的 `config/*.yaml`。

| 文件 | 关键配置 | 默认值 / 说明 |
| --- | --- | --- |
| `common.yaml` | `prefix_mode` | `1`，命令前缀模式，修改后重启生效 |
| `game_info.yaml` | `char_stat_page_size` | `30`，练度列表每页数量 |
| `game_info.yaml` | `char_stat_card_page_size` | `35`，练度卡片每页数量 |
| `game_info.yaml` | `skin_stat_count` | `8`，可选 `4`、`8`、`12`、`16` |
| `sign.yaml` | `auto_sign` / `auto_sign_cron` | 自动签到总开关与定时规则 |
| `sign.yaml` | `auto_sign_endfield` | 默认 `true`；定时及全部签到时，同时签到已发现的终末地角色 |
| `activity.yaml` | `activity_push_enable` / `activity_push_cron` | 活动推送总开关与定时规则，群推送还需通过命令开启 |
| `maa.yaml` | 远控服务信息 | 配合独立的 MAA 远控 API 使用 |

升级后若仍显示 12 套时装，请检查已有的 `config/game_info.yaml`，将 `skin_stat_count` 改为 `8`。展示数量修改后，下次查询即可生效。

“自动签到终末地”可在 Guoba 的“签到设置”中修改，保存后下次任务生效。关闭该选项不影响手动发送“签到”；签到仅处理当前绑定的森空岛账号，不需要另外绑定终末地。

## 致谢

感谢 [StarRail-plugin](https://gitee.com/hewang1an/StarRail-plugin) 和参与试用与反馈的群友。

基建功能的信息展示参考 [Enhance for Skland](https://github.com/ling0x03/Enhance-for-Skland)。

数据与素材来自森空岛、明日方舟及一图流等相关来源。本项目采用 [MIT License](LICENSE)。
