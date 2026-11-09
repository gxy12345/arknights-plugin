# 森空岛资产展示素材

来源及用途（2026-11-09）：

- `portrait-bg.png`：官方 `skland-game/assets/img/char_portrait_bg.49aa4e.png`，由 `8624.b27ec983.js` 的干员、时装资产卡片引用。
- `profession-*.png`：官方 SDK `9560.b49ee94b.js` 中 `to` 字典列出的八个白色职业图标，原地址位于 `https://bbs.hycdn.cn/public/skland-web/image/tool/arknights/assets/profession/white/`。
- `mastery-1.svg` 至 `mastery-3.svg`：按 `8624.b27ec983.js` 中 `be` 专精组件的原始静态 SVG 属性恢复。背景 `#313131`，三圆位置、半径及透明度与原组件一致，根据专精等级逐个点亮。

没有执行原始网页脚本或 APK。技能图标、时装立绘、系列标识和模组图标使用森空岛玩家资料中的原始 ID 构造官方 CDN 地址；本目录不重复收录这些动态素材。

两个练度视图共用 `skills.html` 和 `modules.html`。共享模板使用宿主注入的绝对 `_layout_path` 定位，兼容 TRSSYz 的匿名模板编译。普通技能等级显示 1–7 的数字，专精显示上述三点标记；锁定状态单独展示。
