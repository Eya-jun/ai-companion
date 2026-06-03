# Vélin · 尺素 · 设计方案说明

## 实施状态 (2026-06-04)

✅ React 端实现完成,代码落在 `feat/velin-ui-redesign` 分支。

- 设计系统底层:`frontend/src/styles/{tokens,motion,glass}.css` + `frontend/src/theme/characterThemes.ts`
- 10 个 velin 组件:`Avatar` / `CharacterCard` / `ChatBubble` / `ChatHeader` / `ChatInput` / `SearchPill` / `SearchModal` / `StatRing` / `StatCount` / `MemoryCard` / `TabBar` + `Wordmark` + `AppShell`
- 4 屏重写 / 新增:Home / Private Chat / Group Chat / CharacterDetail (新)
- 路由 + 导航:CharacterCard → CharacterDetail → "开始聊天" → Chat
- tsc 通过,production build 通过(`dist/assets/index-*.js` ~290 kB,gzip 89 kB)

**已知 follow-up**:
- `Home.tsx` 中 `extrasCount` 状态被 fetch 但未渲染(临时用 `void extrasCount;` 占位) — 后续可以删除该 fetch,或将其展示为卡片上的"记忆数"角标
- 后端 `/api/characters` 响应未返回 `last_message` / `last_message_at` / `unread_count` / `online` 字段 — 当前用 `(c as any)` cast,后端补字段后移除 cast
- ESLint 报告 53 errors(多数是 pre-existing 的 `any` 用法,非本次改动引入),6 个 set-state-in-effect 主要在老页面里
- 7 个动效 / 视觉迭代点(原文档下方的"可能的迭代方向")暂未进入量产调优阶段,等上线后再调

## 灵感来源与设计语言

整体方向落在 **iOS 18 Premium**，刻意与星野 AI 和 LINE 拉开距离。星野 AI 给我们的最大启发是"角色即主角"——所以首屏用大字号角色卡片 + 主题色边缘 + 在线点来强调每个 AI 的独立人格；私聊和详情页的背景是角色主题色的低饱和径向渐变，让"换角色 = 换一种情绪氛围"。LINE 的影响克制：聊天气泡的圆角比例、tab bar 的 4 槽结构、列表密度（不是星野的留白也不是 LINE 的拥挤，介于二者之间）。但所有这些都被压在 iOS 18 的玻璃材质之下——所有面板、tab bar、聊天 header、详情底部操作区都走 `backdrop-filter: blur(20-32px) saturate(180%)` + `rgba(255,255,255,0.04-0.09)` 的半透明层 + 1px hairline。这种"透"是 iOS 18 区别于 iOS 17 之前所有设计语言的核心签名。

字体走系统级 Inter + PingFang SC fallback（不在 Google Fonts 里找中文字体，避免字体加载导致的中文 fallback 抖动）。圆角统一 8/12/16/22/28 五档，胶囊形 999 用于输入框、tab、按钮。所有动效只有一个：ambient blob 的 14-18s 慢速呼吸（`cubic-bezier(0.16, 1, 0.3, 1)`），其余状态都是静态的——克制动效的原则。

## 动态取色的应用位置

四个角色主题色（林默 · forest/moss、顾夜寒 · ice blue/silver、玄清 · deep purple/lavender、苏晚 · warm gray/cream）以 CSS 变量形式锚定在 `:root`，被 4 个屏幕以不同方式消费：**首页**用主题色作为卡片左边 2px 边缘线和头像环高光，列表本身只用极轻的玻璃色；**私聊**用主题色渲染 chat header 的发送按钮、对方气泡的 ring glow、以及整屏背景的顶部径向渐变——切换角色相当于切换一种"房间光线"；**群聊**让每个角色的发言气泡都带自己主题色的 8% 底色 + 18% 边框颜色，发送按钮跟随当前活跃角色（这里是玄清），系统消息 chip 保持中性；**角色详情**最重：hero 区是大色块主题渐变 + radial pattern，下方 3 个圆形进度条（好感度 78 / 亲密度 64 / 记忆 42）分别对应三个其他角色的主题色——形成一个"主角色被他的社交关系环绕"的视觉隐喻，主操作按钮"开始聊天"则用角色 B 自己的蓝色渐变。

## 可能的迭代方向

几处可能想跟你来回迭代的点：(1) 群聊里"正在输入"的 chip 用了角色主题色文字，但放在深色玻璃上对比度勉强够 AA，量产前可能需要在 glass 底色上再调一档；(2) 角色详情 hero 区目前用首字 + 渐变作为"肖像"，但更产品化的方案应该是可上传的 AI 生成图——这是 placeholder，等真接入资产时 hero 的高度和 portrait 尺寸可能要重新平衡；(3) 私聊里"我"的消息气泡用了主题色渐变 + glow 阴影，是借 iMessage 蓝色气泡的视觉惯例，但可能想跟未读小红点统一语义——目前两者都是品牌强调色，未来想统一为同一个 accent token；(4) 4 个角色主题色的明度差我故意拉得很大（moss / silver / lavender / cream），是为了让你一眼看出"动态取色在工作"，但量产时建议用 HCT 色域做一组同明度的 4 色变体，避免主题色过深导致玻璃材质上的白字过曝；(5) 首页的大标题 "消息" 用的是 36px 紧字距——iOS 18 HIG 允许 34-40px 区间，但若你后面想把首屏做成"角色总览"而非消息列表，标题可能要换成角色名或"陪伴"。
