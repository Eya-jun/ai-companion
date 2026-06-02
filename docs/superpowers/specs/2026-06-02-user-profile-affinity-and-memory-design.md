# User Profile + Affinity + Memory 改造设计

**日期**: 2026-06-02
**状态**: 已设计,待用户审阅
**作者**: 协作式 brainstorming

---

## 1. 目标与范围

### 1.1 一句话目标

让 AI 角色的回复**贴合具体的"我"**,而不是泛化的"大三女生"。通过三个新机制实现:

1. **用户卡**:用户告诉 AI 自己的画像(身份、MBTI、称呼等)
2. **好感度系统**:用户与角色之间有"亲密度进度",影响 AI 行为
3. **可编辑记忆**:AI 自动按日生成记忆,用户可改/可加

附带改进:Extras 页面改为 Tabs 视图(更易聚焦于同类型规则)。

### 1.2 范围

**In scope**:
- Supabase Auth 接入(完整账号体系)
- 用户卡(7 字段)
- Extras UI 改 Tabs
- 好感度(每日 LLM 评估,4 固定阶段,100% 解锁亲密模式)
- 记忆(按月分组汇总,内联编辑)
- 现有数据迁移到新用户体系

**Out of scope**(后续 spec 单独做):
- LLM 流式输出
- 输入限流 / 成本控制
- 角色市场 / 搜索 / 标签
- 移动端适配 / 暗色模式
- 群聊的亲密度(群聊无亲密度)

---

## 2. 决策日志(brainstorming 结果)

| 问题 | 决策 |
|---|---|
| 用户系统范围 | 完整 Supabase Auth(每用户独立数据) |
| 用户卡范围 | 一人一卡,全角色共享 |
| Extras UI | B 方案:顶部 4 Tabs(补充设定 / 故事 / 关系 / 记忆) |
| 角色卡好感度显示 | A 方案:进度条 + 阶段文字 |
| 100% 解锁效果 | 庆祝弹窗 + 特殊问候语 + 解锁"亲密模式"开关(三重奏) |
| 好感度增长 | 每天 LLM 评估一次(与每日记忆合成一次调用) |
| 评估触发时机 | 每晚 2 点 cron(`node-cron`) |
| 亲密阶段 | 固定 4 阶:陌生 / 熟悉 / 暧昧 / 亲密(20/50/80/100) |
| 记忆视图 | B 方案:按月分组,可折叠 |
| 记忆编辑方式 | 内联编辑(行变 textarea,Ctrl+Enter 保存,Esc 取消) |
| 用户卡字段 | 头像 / 称呼 / 性别 / 年龄 / 身份 / MBTI / 自我介绍 |

---

## 3. 数据模型

### 3.1 已有表(加 `user_id` 外键)

```
characters
  + user_id UUID NULL                  -- 预设角色为 NULL,自定义角色绑定到用户
  + default_difficulty TEXT            -- 攻略难度: easy / normal / hard(自定义角色)
  -- 现有字段保留

character_extras
  + user_id UUID NOT NULL

groups
  + user_id UUID NOT NULL

group_members
  + user_id UUID NOT NULL              -- 透传所属 group

messages
  + user_id UUID NOT NULL

memories
  + user_id UUID NOT NULL
  + affinity_delta INT NULL            -- 当天 AI 评估的好感度变化(-5..+5)
  + affinity_reason TEXT NULL          -- 评估理由(LLM 输出原文)
  + source TEXT DEFAULT 'ai'           -- 'ai' / 'user' 区分 AI 生成还是用户手写
```

### 3.2 新增表

```
user_profiles                         -- 1 user = 1 card
  user_id UUID PK REFERENCES auth.users
  display_name TEXT NULL
  avatar_url TEXT NULL
  preferred_name TEXT NULL            -- 称呼
  gender TEXT NULL
  age INT NULL
  occupation TEXT NULL                -- 身份
  mbti TEXT NULL
  bio TEXT NULL
  updated_at TIMESTAMP

user_character_state                  -- 每用户对每角色的攻略进度
  user_id UUID
  character_id UUID
  affinity INT DEFAULT 0              -- 0..100
  current_stage TEXT                  -- stranger/familiar/flirtatious/intimate
  mode TEXT DEFAULT 'daily'           -- daily / intimate(100% 才可切)
  unlocked_at TIMESTAMP NULL
  difficulty TEXT DEFAULT 'normal'    -- easy / normal / hard
  special_greeting TEXT NULL          -- 100% 那天由 LLM 生成的特殊问候(per-user)
  PRIMARY KEY (user_id, character_id)

affinity_evaluations                  -- 每日评估的原始记录
  id UUID PK
  user_id UUID
  character_id UUID
  eval_date DATE
  prev_affinity INT
  new_affinity INT
  delta INT
  reason TEXT
  memory_summary TEXT
  evaluated_at TIMESTAMP
  UNIQUE (user_id, character_id, eval_date)

stage_prompts                         -- 4 阶段默认 prompt
  stage TEXT PK
  min_pct INT
  max_pct INT
  prompt_snippet TEXT
  description TEXT
```

### 3.3 关键决策

#### 什么共享、什么 per-user(必读)

预设角色是**模板**,不是数据。每位用户从同一份"林默"开始,各自独立地与他相处。

| 资源 | 共享范围 | 表 / 字段 |
|---|---|---|
| 角色本体(林默是谁) | **全用户共享**(`is_preset=true, user_id=NULL`) | `characters.system_prompt`, `greeting`, `description`, `avatar` |
| Extras(用户对角色的设定) | **per-user** | `character_extras` 已加 `user_id NOT NULL`,查询时强制 `user_id = req.user.id` |
| 私聊消息 | **per-user** | `messages` 已加 `user_id NOT NULL` |
| 群聊消息 | **per-user**(归群主) | `messages` + `groups.user_id` |
| 记忆 | **per-user** | `memories` + `affinity_evaluations` 都加 `user_id` |
| 好感度 / 阶段 / 模式 / 解锁 | **per-user** | `user_character_state` 主键就是 `(user_id, character_id)` |
| 难度 | **per-user**(每位用户对"林默"的难度可不同) | `user_character_state.difficulty` |
| 用户卡 | **per-user** | `user_profiles` 主键就是 `user_id` |
| 阶段 prompt 模板 | **全用户共享** | `stage_prompts` 没有 user_id |

**为什么必须这样**:如果记忆/Extras/好感度共享,A 用户和 B 用户跟林默的对话会被混进同一个上下文。LLM 看到的是"用户 A 说我喜欢白裙子"+"用户 B 的好友列表"+"用户 A 的表白被拒"——角色会人格分裂,这是经典的"context pollution"。所以**角色本体是模板,和角色的关系数据完全是私有的**。

#### 其他决策

- **memory 升级为"原始记录 + 同步产出"**:`affinity_evaluations` 是事实表,`memories` 是它的视图(按 `eval_date` 查最新一条)
- **stage_prompts 是表不是代码常量**——以后想加第 5 阶段或调阈值,直接改表,不用发版
- **`initPresetCharacters` 启动时只插入 4 条 `is_preset=true, user_id=NULL` 的行**(逻辑与现状一致),不复制给每个用户

---

## 4. 后端

### 4.1 Auth(Supabase Auth 接管)

| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/auth/signup` | POST | email + password + display_name,触发器自动建 `user_profiles` |
| `/api/auth/login` | POST | 返回 access_token + refresh_token |
| `/api/auth/refresh` | POST | refresh_token 换新 access_token |
| `/api/auth/logout` | POST | 撤销 token |
| `/api/auth/me` | GET | 返回当前 `user_profiles` 整行 |

**Token 处理**:前端存 localStorage,所有 `/api/*`(除 signup/login/refresh/health)带 `Authorization: Bearer <token>`。

**后端中间件**:
- `requireAuth(req, res, next)`:用 `supabase.auth.getUser(token)` 验 token,挂 `req.user = { id, email, ... }`
- `optionalAuth(req, res, next)`:有 token 就挂,没有放行(给 `/api/health` 用)
- 旧 `internalTokenAuth` 保留作为双保险(默认关闭,通过 `INTERNAL_TOKEN` 启用)

### 4.2 业务端点改造

| 端点 | 改动 |
|---|---|
| `GET/POST/PUT/DELETE /api/characters[/:id]` | 查 `user_id = req.user.id OR is_preset = true`;新建自动 `user_id = req.user.id, is_preset = false`;删除校验 `user_id` |
| `GET/POST/PUT/DELETE /api/groups[/:id]` | 加 `user_id` 隔离 |
| `GET/POST/PUT/DELETE /api/extras[/:id]` | 加 `user_id` 隔离 |
| `GET/POST/DELETE /api/chat/...` | 私聊消息加 `user_id`;**POST `/api/chat` 在拼 system_prompt 时按 §6.1 顺序注入用户卡 + 当前阶段 prompt + (可选) 亲密 descriptor** |
| `GET/POST /api/groups/:id/chat` | 群聊消息加 `user_id` |
| `GET /api/avatars/upload/:characterId` | 头像按 `user_id` 分子目录:`{user_id}/{character_id}-{ts}.{ext}` |

### 4.3 新增端点

| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/profile` | GET / PUT | 当前 `user_profiles`(头像 multipart,存 `avatars/{user_id}/`) |
| `/api/characters/:id/affinity` | GET | 返回 `{affinity, stage, mode, unlockedAt, latestReason, latestDelta, difficulty}` |
| `/api/characters/:id/mode` | PUT | 切换 `daily` ↔ `intimate`,`unlocked_at != null` 才允许 |
| `/api/characters/:id/difficulty` | PUT | 改攻略难度(仅自定义角色) |
| `/api/characters/:id/special-greeting` | GET | 取 `user_character_state.special_greeting`,如未生成则触发一次 LLM 生成 |
| `/api/characters/:id/memories` | GET | 替代旧 `memories/character/:id`,返回带 `affinityDelta, reason, source` |
| `/api/memories` | POST | 手动新增,`source='user'` |
| `/api/memories/:id` | PUT / DELETE | 用户编辑/删除(允许改 AI 生成的) |
| `/api/auth/claim-legacy` | POST | 用一次性 token 把 legacy 数据克隆给新用户 |

### 4.4 每日评估 Cron

新建 `backend/src/jobs/dailyAffinityEval.ts`:

```ts
cron.schedule('0 2 * * *', async () => {
  const result = await evaluateAllUsersYesterday();
  console.log(`[cron] 每日评估完成: ${result.evaluated} 组合`);
});
```

`evaluateAllUsersYesterday()` 流程:
1. 查 `auth.users` 拿到所有用户
2. 对每个用户 × 每个有过昨天消息的角色
3. 调一次 LLM(详见 §6.3),输出 JSON
4. upsert 到 `affinity_evaluations`
5. 更新 `user_character_state.affinity` 和 `current_stage`
6. 跨过 100% 阈值时设 `unlocked_at = now()`

---

## 5. 前端

### 5.1 新增页面

| 路由 | 作用 |
|---|---|
| `/login` `/signup` | 登录注册 |
| `/profile` | 查看/编辑用户卡 |
| `/profile/setup` | 首次登录引导,不可跳过 |
| `/character/:id/memories` | 记忆汇总(B 方案:按月分组) |

### 5.2 改造现有页面

| 页面 | 改动 |
|---|---|
| `Home` | 顶部加用户菜单;每个角色卡加 `<AffinityMeter>`(A 方案) |
| `Chat` | 头部加小型 `<AffinityMeter>` + `<IntimateModeToggle>`(100% 后显示);📝 按钮跳到 `/character/:id/memories`;100% 弹 `<UnlockCelebration>`(从 `/api/characters/:id/special-greeting` 取一次性生成的问候,localStorage `seen_celebration_for_{characterId}` 标记本设备只弹一次) |
| `GroupChat` | 5 秒轮询 → 1 秒延迟 + trigger 后立即刷新;无亲密度展示 |
| `CharacterEdit` | 加 `<DifficultySelector>` |
| `CharacterExtras` | 改 B 方案(顶部 4 Tabs,内联编辑) |

### 5.3 新增共享组件

```
src/components/
  AffinityMeter.tsx       -- {affinity, stage, variant: 'card'|'header'|'compact'}
  IntimateModeToggle.tsx  -- {characterId, mode, onChange}
  UnlockCelebration.tsx   -- 全屏 modal,展示 special_greeting
  MemoryRow.tsx           -- 内联编辑(显示态 <-> 编辑态)
  ExtraRow.tsx            -- 内联编辑(同 MemoryRow 复用模式)
  DifficultySelector.tsx  -- 3 选 1(简单/普通/困难)
  RequireAuth.tsx         -- 路由守卫
  AppHeader.tsx           -- 顶部用户菜单
```

### 5.4 状态管理

`src/contexts/AuthContext.tsx`:
```ts
type AuthState = {
  user: UserProfile | null;
  loading: boolean;
  login: (email, pwd) => Promise<void>;
  logout: () => void;
};
```

`api/client.ts` 的 `request()` 自动塞 `Authorization` 头。

### 5.5 路由结构

```
<HashRouter>
  <AuthProvider>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<Home />} />
        <Route path="/profile" element={<UserProfile />} />
        <Route path="/profile/setup" element={<UserProfileSetup />} />
        <Route path="/chat/:id" element={<Chat />} />
        <Route path="/group/:id" element={<GroupChat />} />
        <Route path="/character/new" element={<CharacterEdit />} />
        <Route path="/character/:id/edit" element={<CharacterEdit />} />
        <Route path="/character/:id/extras" element={<CharacterExtras />} />
        <Route path="/character/:id/memories" element={<Memories />} />
        <Route path="/group/new" element={<GroupEdit />} />
      </Route>
    </Routes>
  </AuthProvider>
</HashRouter>
```

---

## 6. LLM Prompts

### 6.1 私聊 System Prompt 组装顺序

```
[1] character.system_prompt
═══════════════════════════════════
[2] 以下是用户为你添加的额外信息(必须遵守):
   【用户补充设定】...
   【你们之间的故事背景】...
   【关系进展记录】...
   【重要记忆提示】...
═══════════════════════════════════
[3] 关于你的用户(以下是事实,作为参考):
   {user.bio}
   称呼她为「{user.preferred_name}」。
   她的身份是{user.occupation},{user.age} 岁,MBTI 是 {user.mbti}。
═══════════════════════════════════
[4] 你们目前的关系:{stage.description}(好感度 {affinity}%)
   {stage.prompt_snippet}
═══════════════════════════════════
[5] (mode == 'intimate') 你们已经确认关系:{intimate_descriptor}
═══════════════════════════════════
[6] (最近 3 天有 affinity_evaluations) 最近的互动印象:
   - {date}: {reason}
```

### 6.2 4 阶段默认 Prompt(写入 `stage_prompts` 表的初始数据)

```sql
INSERT INTO stage_prompts (stage, min_pct, max_pct, description, prompt_snippet) VALUES
('stranger',     0,  19, '陌生', '你与用户刚认识,礼貌、拘谨、不会主动拉近距离。'),
('familiar',    20,  49, '熟悉', '你与用户已经很熟了,会主动开玩笑、分享日常、记得她说过的话。'),
('flirtatious', 50,  79, '暧昧', '你与用户之间有暧昧情愫。会吃醋、会有肢体接触暗示、会说一些似是而非的话。'),
('intimate',    80, 100, '亲密', '你与用户已经确认关系。会直接表达爱意、用昵称、主动亲密、有占有欲但也很宠。');
```

亲密模式 snippet(只在 `mode='intimate'` 时追加):
```
现在你们的关系允许更亲密的互动:可以主动用昵称、表达想念、有更多肢体接触描写、偶尔撒娇/吃醋。
```

### 6.3 每日评估 Prompt

```
[system]
你是一个角色扮演分析助手。根据"昨天用户与角色的对话",输出:
1. 一段 100-300 字的"角色第一人称记忆"(像日记)
2. 评估昨天互动对好感度的影响(-5 到 +5 的整数)
请严格输出 JSON,不要任何额外文字。

[user]
角色: {character.name}
角色人设: {character.system_prompt}
当前亲密度: {affinity}% ({stage.description})

昨天所有对话:
{...messages, "我: xxx" / "{character.name}: xxx"}

输出 schema:
{
  "summary": "<100-300 字>",
  "affinityDelta": <-5..5 的整数>,
  "reason": "<不超过 30 字>"
}
```

后端用 `response_format: { type: 'json_object' }` 强约束。

**LLM 评估失败兜底**:
- 解析 JSON 失败:用 `summary=null, affinityDelta=0, reason='LLM 评估失败,已记录原文'`,把原始 response 存到 `affinity_evaluations.reason` 便于排查
- 超出 -5..+5 范围:clamp 到边界
- LLM 调用超时(>30s):跳过该 user-character,记录到 `affinity_evaluations` 加一列 `error TEXT`

---

## 7. 迁移策略

```sql
-- 1. 创建 legacy user
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000000', 'legacy@local');

-- 2. 建默认用户卡
INSERT INTO user_profiles (user_id, display_name) VALUES
  ('00000000-0000-0000-0000-000000000000', '原账号');

-- 3. 归属老数据
UPDATE characters        SET user_id = '00000000-0000-0000-0000-000000000000' WHERE is_preset = false;
UPDATE character_extras  SET user_id = '00000000-0000-0000-0000-000000000000';
UPDATE groups            SET user_id = '00000000-0000-0000-0000-000000000000';
UPDATE group_members     SET user_id = '00000000-0000-0000-0000-000000000000' WHERE group_id IN (SELECT id FROM groups);
UPDATE messages          SET user_id = '00000000-0000-0000-0000-000000000000';
UPDATE memories          SET user_id = '00000000-0000-0000-0000-000000000000';
```

**前端不强制登录 legacy 账号**——首次启动时,如果 localStorage 没有 `has_claimed_legacy` 标志,自动注册新用户并调 `/api/auth/claim-legacy`,把 legacy 数据克隆到新账号下,然后写标志。后端在迁移完所有 legacy 数据后将 legacy 用户的 `user_id` 指向新用户,**不**保留 legacy 账号(防遗留垃圾数据)。

---

## 8. 实施顺序(4 个 PR)

| PR | 内容 | 估时 |
|---|---|---|
| **PR1: Auth + User Card** | Supabase Auth 接入、Login/Signup/Profile 页、middleware、迁移 | 大 |
| **PR2: 数据隔离** | 所有 endpoint 加 `user_id` 过滤,AuthContext,RequireAuth | 中 |
| **PR3: 好感度 + 记忆** | affinity state、stage_prompts、cron、每日评估、Home 卡进度条、Chat 头部条、100% 解锁 | 大 |
| **PR4: UX 收尾** | Extras 改 Tabs、记忆改按月分组+内联编辑、难度选择、亲密模式开关 | 中 |

每个 PR 结束独立可跑可测。**PR3 之前的版本数据/UX 看起来跟现在一样,只是多了登录**。

---

## 9. 测试

- **后端**:`requireAuth` / 业务 endpoint 的 `user_id` 隔离集成测试;`evaluateAllUsersYesterday` 用 mock 消息
- **前端**:`AuthContext` mock;`AffinityMeter` 4 状态快照;`MemoryRow` 内联编辑交互
- **LLM 稳定性**:`npm run eval:smoke` 跑 3 条预置对话,断言输出是合法 JSON 且 delta 在合理范围
- **数据隔离冒烟**:用两个测试账号分别创建同名角色,验证 A 看不到 B 的、B 删 A 的不会成功

---

## 10. 待办 / 未来

以下为本次不做的明确标记,留给后续 spec:

- LLM 流式输出
- 输入限流 / 成本控制
- 角色市场 / 搜索 / 标签
- 移动端适配 / 暗色模式
- 群聊的亲密度(目前设计上不支持,要做的话需要新 brainstorm)
- 群聊页面去掉 5 秒轮询(已在 #16 任务中,独立 PR)
- `node-cron` 迁移到独立 worker(目前跑在 Express 进程里,小项目够用,大了要拆)