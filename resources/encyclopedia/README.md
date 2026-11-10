# 森空岛干员图鉴与公招数据

2026-11-10 使用 REA 检查用户提供的森空岛 2.3.0 APK（SHA-256 `c738c18a77c3865d97809d676dfc46477716f2472474828c20ae56e94df57964`）。JADX 只能看到 7 个壳类；APK 没有被执行。REA 归档检查确认存在 RN bundle；全包提取受到大小写重名资源限制，因此只单独读取了指定 bundle，未尝试绕过壳或登录。APK 和网页内容仅作为分析数据。

用户临时授权的只读工具箱请求确认两个官方入口：

- [干员图鉴](https://game.skland.com/arknights/operator/list)：工具 ID 13。
- [公招索引](https://www.skland.com/h/ak/recruit-calculator)：工具 ID 14。

工具箱本身需要登录；下面三个 H5 数据接口已经通过**不携带 cred、token、UID**的实际请求验证成功。插件只使用它们，不保存本次临时凭据。

| 用途 | GET 地址 | 已验证字段 |
| --- | --- | --- |
| 全部干员 | `https://zonai.skland.com/h5/v1/game/arknights/char-book/list` | `characters`、`filterTree` |
| 干员详情 | `https://zonai.skland.com/h5/v1/game/arknights/char-book/char-info?charId=...` | `phase`、`maxFavourAttribute`、`talents`、`skills[].levels`、`potentialRanks`、`equipments[].phases` |
| 当前公招池 | `https://zonai.skland.com/h5/v1/game/recruit/character` | `tags`、`characters[].tagIds` |

公招客户端没有请求组合计算结果：官方路由脚本模块 `27393` 在客户端枚举最多三个标签的交集，并在不含高级资深干员时去掉六星。接口中的星级为 0–5，展示时转换为 1–6；标签ID直接来自服务器。资深干员不再由插件推测或补到四星干员上。

## 可复核的静态来源

读取当前入口引用的官方脚本，作为静态文本交给 REA；未执行原始网页 bundle。REA 是有限文件范围的静态观察，不等同于完整 APP 还原。

| 官方脚本 | SHA-256 | 观察 |
| --- | --- | --- |
| `https://bbs.hycdn.cn/skland-fe-static/skland-game/main-0a037d97.263024b7.js` | `dff832010665bf667d2311f7af9fc3575b91fb836e4e26a38cdc5382001e26a6` | 模块3883、52686按登录状态选择`/h5/v1/`或`/api/v1/`图鉴接口 |
| `https://bbs.hycdn.cn/skland-fe-static/skland-game/8388.c2b9213f.js` | `176044d4f89ceb5e1dcb0bb213b09fbef805bba32c257dac059a379e110c9f1a` | 干员数据页读取满级属性、信赖、技能等级、模组阶段 |
| `https://web.hycdn.cn/skland/site/index.6c03d7.js` | `19c430794d98eb9784c35b9bc0b1efe02d610e8d76058c2142abd291bb57883e` | `getRecruitAgg`读取公开公招池并转换零基星级 |
| `https://web.hycdn.cn/skland/site/4228.af5d34.js` | `e93c9607e6975e5e70855b646973b8a09ee97df318523a649a786997facbc6c9` | 公招标签选择和模块27393的本地计算 |

REA 证据：APK `ev_1c30c9d18ee785d066e72859f7e71337fc43c554892d13c539941dd3afd09f57`；归档 `ev_4fa77306daf8300ffe58dbee8e2e0735bb65f65a6f2658abc229eacf437dafc6`；图鉴服务 `ev_47737ab4ca1cd8baecc09529023d46bc2b817e25c1e59b199c6dd8ed0904cfc4`；当前网页文件 `ev_5d5f174f5b5c3675db0f57b25e8c7df2bce70cf6555b70feb06ad2824f67670a`；公招算法 `ev_0131b1121b002354041b3b4d36ff4821db402da3b91e9baddc9359f16aab85d0`。临时分析目录不作为插件依赖，也不随插件分发。

立绘使用官方SDK的 `https://bbs.hycdn.cn/skland-fe-static/assets/arknights/char_illustration/{id}.png`，失败后尝试官方 `char/portrait/{id}.png`。技能、模组使用 `https://web.hycdn.cn/arknights/game/assets/char_skill/` 和 `uniequip/`。职业图标与背景复用项目已有 `operatorAssets` 官方素材；背景来源记录在该目录的README。半身裁切、横版布局和信息分栏是本插件的展示适配。

星级使用上述 `8388.c2b9213f.js` 中 `RarityStar` 组件引用的官方原图：`https://bbs.hycdn.cn/skland-fe-static/skland-game/assets/img/star.c25ec4.png`。下载原始 PNG 为 `rarity-star.png`，60×60，SHA-256 `77e963a0e3a886751a1730a33622a4c080747adfa50dc70b0bde5a68dba85cb2`；按实际星数重复展示，保留官方图形及相邻星重叠比例。对应 REA 静态证据为 `ev_0207aabf10a76b0a03bb50575aab8101f32546cc871cc44809141da8949ebb92`。

README 的 `.github/images/encyclopedia-overview.webp`、`encyclopedia-skills.webp`、`encyclopedia-modules.webp` 与 `recruit-tool.webp` 为当前模板的实际截图，分别使用维什戴尔、维什戴尔、年及官方公招池公开数据；只转换为 WebP，不改写图片内容。这些预览在 README 的 `details` 内默认折叠。

## 展示与缓存

- 命令格式为“前缀 + 干员名称或别名 + 图鉴/技能/模组”，例如 `#方舟维什戴尔图鉴`、`~叔叔技能 专3`、`~年模组`；帮助菜单和图片内指引采用相同语序。
- 半身立绘在上移版本的基础上沿容器高度下调5%；右上角不显示干员ID。
- 总览属性：最高精英阶段满级 + 满信赖；不叠加潜能或模组。天赋及潜能增强文本选最高精英阶段，并显示所需潜能条件。
- 技能页默认显示7级与专1–3；可指定1–10或专1–3。全等级按1–4、5–7、专1–3分图，低星干员自动跳过不存在的等级组。相同攻击范围只展示一次。
- 模组展示各级总属性、变更文本、解锁条件和任务，每图最多两套模组；未变化的特性和天赋沿用前级。模块故事及养成材料不属于本视图范围。
- `.cache/skland-tools/` 保存版本化公开JSON，6小时按需刷新；同一请求合并并发。刷新失败保留上次成功缓存并标注获取时间，一分钟内限制失败重试。错误响应、空池、损坏JSON和不完整结构不会覆盖成功缓存。无历史缓存时提示失败，不退回陈旧手工名单。
- 公招沿用高价值组合视图：保底四星及以上，以及含一星支援机械的组合；每图最多八组。持有状态是独立可选的账号查询，失败时不影响公开结果。

验证包含缓存并发、重启读取、错误保留、星级转换、标签交集、高资/资深、机械、新标签、名称歧义、富文本、命令到模板传参与匿名模板编译。实际公开数据覆盖阿米娅、医疗阿米娅、维什戴尔、年、令、Lancet-2；截图检查三种视图及长名称、空状态和图片全部失败。未在完整 Yunzai/TRSS 宿主中执行聊天发图。
