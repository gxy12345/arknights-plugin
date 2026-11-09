# 卫戍干员卡片素材

这些素材来自 2026-11-09 调查中保存的官方 `game-tools` 脚本 `stronghold-B5zPXs9G.js`，沿用官方游戏素材的用途。

源脚本 SHA-256：`192db262b05b18ea2933dedcbaf76f67efb3106b439f1f0e3bd3d7b9783bc310`。

- `tier-1.svg` 至 `tier-6.svg`：从阶级组件的静态 SVG path 和样式属性恢复，保留原始罗马数字、轮廓与颜色。
- `elite-0.png`、`elite-1.png`、`elite-2.png`：精英阶段 0/1/2 的内嵌 PNG。
- `elite-merged.png`：合并等级大于等于 1 时使用的官方金色精英图标。
- `portrait-tier-1.png` 至 `portrait-tier-6.png`：半身卡片的阶级背景。

PNG 从脚本内的 data URL 解码；SVG 仅解析静态属性后序列化，没有执行原脚本。技能图标和模组的 `icon.type` / `icon.shiningColor` 使用对应赛季、版本资料中的地址，不在本目录重复收录。图片缺失时保留名称或占位文字。

本次静态分析的 REA Evidence：`ev_9132ce416295e01bd9457ccb8f2b656f262240f92aace7326f46fd45367b544a`。分析限定于该脚本，跨文件关系及运行时行为不在该记录的完整覆盖范围内。
