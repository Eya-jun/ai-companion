# 💕 AI 伴侣聊天机器人

一个全栈的**角色扮演式 AI 聊天应用**:用户可以与单个 AI 角色私聊,也可以把多个角色拉进同一个群聊里让"他们"互相聊天。后端会把用户的对话和角色补充资料作为上下文发送给 LLM,并支持自动生成每日记忆总结。

预设场景是大学校园、用户为大三女学生,内置了 4 个预设角色(林默 / 顾夜寒 / 玄清 / 空白角色),但用户也可以在前端页面里**自定义任意角色**和**任意群聊**。

## ✨ 功能特性

- **私聊**:与单个角色聊天,自动加载最近 20 条历史消息作为上下文
- **群聊**:把多个角色放进一个群,可选"全员发言"或"随机角色互动",每个角色都保留自己的 system_prompt
- **角色管理**:创建 / 编辑 / 删除自定义角色,预设角色不可删除
- **头像上传**:从本地上传图片(最大 2MB),存入 Supabase Storage 并自动回填 `avatar` 字段
- **角色补充资料(`extras`)**:为每个角色添加 4 类附加设定,在对话时会拼接到 system_prompt 之后
  - `note`:用户补充设定
  - `story`:你们之间的故事背景
  - `relationship`:关系进展记录
  - `memory_hint`:重要记忆提示
- **每日记忆总结**:调用 LLM 用角色第一人称生成当天对话的"私密日记",按日期 upsert 到数据库
- **多 LLM 支持**:可在请求里切换不同的 provider(默认通过 `DEFAULT_LLM` 配置)

## 🧱 技术栈

| 层 | 选型 |
|---|---|
| 前端 | React 19 + TypeScript + Vite + React Router 7 |
| 后端 | Node.js + Express 5 + TypeScript + ts-node + nodemon |
| 数据库 & 存储 | Supabase(JS SDK v2,使用 service_role key) |
| LLM | OpenAI 兼容协议,默认走 [Kimi (Moonshot)](https://platform.moonshot.cn),可选 DeepSeek / MiniMax(SiliconFlow 代理) |
| 工具库 | `multer`(头像上传)、`node-cron`(已安装,目前未在路由中使用)、`axios` |

## 📁 目录结构

```
.
├── backend/                # Express + TypeScript API
│   ├── src/
│   │   ├── index.ts        # 入口:启动 + 初始化预设角色
│   │   ├── config/
│   │   │   ├── env.ts      # 加载 .env 并暴露 config 对象
│   │   │   ├── llm-providers.ts   # 三家 LLM 的 OpenAI 客户端
│   │   │   └── supabase.ts # Supabase admin 客户端
│   │   ├── data/presets.ts # 4 个内置预设角色
│   │   ├── routes/         # 6 个 Express 路由模块
│   │   └── services/llm.ts # 私聊/群聊的 LLM 调用封装
│   ├── .env                # ⚠️ 不要提交,包含 API 密钥
│   └── package.json
├── frontend/               # React + Vite SPA
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx         # HashRouter 路由表
│   │   ├── api/            # 统一 fetch 封装 + 类型
│   │   ├── pages/          # Home / Chat / GroupChat / CharacterEdit / GroupEdit / CharacterExtras
│   │   ├── components/     # MessageBubble 等
│   │   └── utils/          # 响应解析等工具
│   └── package.json
└── README.md               # 本文件
```

## 🚀 本地启动

需要本地已安装 **Node.js 18+** 和 **npm**。

### 1. 启动后端

```bash
cd backend
npm install
# 编辑 .env,填入你自己的密钥(见下一节)
npm run dev          # nodemon + ts-node,监听 3000 端口
```

启动时会自动调用 `initPresetCharacters()`,在 Supabase 里创建/更新 4 个预设角色。

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev          # Vite 默认在 5173 端口
```

前端通过 `HashRouter` 路由,API 地址在 `src/api/client.ts` 里**硬编码**为 `http://localhost:3000/api`,需要修改时直接改这一行即可。

### 3. 访问

打开浏览器到 Vite 提示的端口(一般是 http://localhost:5173 ),首页会列出私聊角色和群聊。

## 🔐 环境变量(`backend/.env`)

> ⚠️ **安全提醒**
> - `backend/.env` **已经在 `.gitignore` 中**,但请不要把任何真实密钥粘贴到 issue / 截图 / 对话上下文里。
> - 仓库当前已存在的 `.env` 包含若干真实第三方 API 密钥,**强烈建议立刻在对应平台轮换它们**,并用 `git filter-repo` 或 BFG 把这些密钥从历史中清除。
> - 前端目前没有 `.env` 文件。**注意**:`frontend/.gitignore` 当前没有显式忽略 `.env` / `.env.local`,如果以后给前端加环境变量,请手动把这两行补进去。

| 变量 | 必填 | 说明 |
|---|---|---|
| `PORT` | 否 | 后端端口,默认 `3000` |
| `SUPABASE_URL` | ✅ | Supabase 项目 URL |
| `SUPABASE_ANON_KEY` | ✅ | Supabase 公开 anon key(目前未在路由中使用) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service_role key,**会绕过 RLS**,请只在后端使用 |
| `KIMI_API_KEY` | ✅ | Moonshot Kimi 的 API key |
| `KIMI_BASE_URL` | 否 | 默认 `https://api.moonshot.cn/v1` |
| `KIMI_MODEL` | 否 | 默认 `kimi-k2.5`(注意该模型只支持 `temperature=1`) |
| `SILICONFLOW_API_KEY` | ✅ | SiliconFlow 的 API key,供 DeepSeek / MiniMax 使用 |
| `SILICONFLOW_BASE_URL` | 否 | 默认 `https://api.siliconflow.cn/v1` |
| `DEEPSEEK_MODEL` | 否 | 默认 `deepseek-ai/DeepSeek-V3.2` |
| `MINIMAX_MODEL` | 否 | 默认 `MiniMaxAI/MiniMax-M2.5` |
| `DEFAULT_LLM` | 否 | 可选 `kimi` / `deepseek` / `minimax`,默认 `kimi` |

## 🗄️ Supabase 表结构

后端代码中使用了以下表/字段,新建项目时需要在 Supabase SQL 中创建:

- `characters`: `id, name, description, system_prompt, avatar, is_preset, greeting, created_at, updated_at`
- `messages`: `id, character_id?, group_id?, role, content, sender_type, sender_name, sender_id?, created_at`
- `groups`: `id, name, description, created_at`
- `group_members`: `id, group_id, character_id`
- `character_extras`: `id, character_id, type, title, content, created_at, updated_at`
  - `type` ∈ `{note, story, relationship, memory_hint}`
- `memories`: `id, character_id, summary, memory_date`(用 `(character_id, memory_date)` 做 upsert 唯一约束)
- `avatars` bucket:用于头像上传的公开 Storage bucket

## 📡 API 概览

后端所有接口统一挂载在 `/api` 前缀下,响应格式统一为 `{ success: boolean, data?, error? }`。

| 模块 | 方法 & 路径 | 说明 |
|---|---|---|
| 健康检查 | `GET /api/health` | 返回状态、当前时间、默认 LLM |
| 角色 | `GET /api/characters` | 列出所有角色(预设在前) |
| 角色 | `GET /api/characters/:id` | 获取单个角色 |
| 角色 | `POST /api/characters` | 创建自定义角色 |
| 角色 | `PUT /api/characters/:id` | 更新角色 |
| 角色 | `DELETE /api/characters/:id` | 删除(预设角色会被拒绝) |
| 私聊 | `POST /api/chat` | 发送消息,自动注入 extras + 最近 20 条历史 |
| 私聊 | `GET /api/chat/:characterId/messages?limit=&before=` | 分页拉历史 |
| 私聊 | `DELETE /api/chat/:characterId/messages` | 清空聊天记录 |
| 群聊 | `GET / POST / PUT / DELETE /api/groups[/:id]` | 群的基本 CRUD |
| 群聊 | `POST /api/groups/:id/members` `DELETE /api/groups/:id/members/:characterId` | 群成员增删 |
| 群聊 | `POST /api/groups/:id/chat` | 群内发消息,`triggerAll=true` 让所有成员都回 |
| 群聊 | `POST /api/groups/:id/trigger` | 不发用户消息,让角色们自己互动 N 轮(N≤3) |
| 群聊 | `GET /api/groups/:id/messages?limit=&before=` | 群消息历史 |
| 记忆 | `POST /api/memories/summarize` | 用 LLM 生成指定日期(默认今天)的第一人称总结 |
| 记忆 | `GET /api/memories/character/:characterId` | 该角色的所有记忆 |
| 记忆 | `GET /api/memories/character/:characterId/latest` | 最近一条记忆 |
| Extras | `GET /api/extras/character/:characterId` | 角色的所有补充资料 |
| Extras | `POST / PUT / DELETE /api/extras[/:id]` | 增删改 |
| 头像 | `POST /api/avatars/upload/:characterId` | multipart/form-data,字段名 `file`,≤2MB |

## 🛣️ 前端路由

```
/                              首页:角色卡片 + 群聊卡片
/chat/:characterId             私聊页
/group/:groupId                群聊页
/character/new                 新建角色
/character/:characterId/edit   编辑自定义角色
/character/:characterId/extras 角色补充资料管理
/group/new                     新建群聊
```

## 🧪 开发命令

| 目录 | 命令 | 作用 |
|---|---|---|
| `backend` | `npm run dev` | nodemon + ts-node,热重启 |
| `backend` | `npm run build` | 编译到 `dist/` |
| `backend` | `npm start` | 跑 `dist/index.js` |
| `frontend` | `npm run dev` | Vite 开发服务器 |
| `frontend` | `npm run build` | 类型检查 + Vite 打包 |
| `frontend` | `npm run lint` | ESLint |
| `frontend` | `npm run preview` | 本地预览构建产物 |

## ⚠️ 已知短板 / TODO 建议

- **没有鉴权**:后端路由完全开放,任何人都能读写所有数据,只适合本地或内网使用
- **CORS 全开**:`app.use(cors())` 没限制 origin,生产环境务必收紧
- **Supabase `service_role_key` 在后端**:能绕过所有 RLS,务必不要泄露给前端
- **前端 API 地址硬编码**:没有走 `import.meta.env`,部署/切换环境需要改源码
- **`node-cron` 已装未用**:可以接一个定时任务,比如每天凌晨自动跑一次 `memories/summarize`
- **没有测试**:两个 `package.json` 的 `test` 都是占位脚本

## 📜 License

ISC