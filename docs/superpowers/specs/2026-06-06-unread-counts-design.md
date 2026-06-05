# 未读消息数功能 — 设计文档

> 创建日期: 2026-06-06
> 状态: 设计中（已通过 brainstorming 所有阶段）
> 关联: 补全 `backend/src/routes/characters.ts:54` 的 TODO

## 1. 目标

为每个 1v1 角色显示未读消息数（首页红点 + TabBar 总数徽章），用户进入聊天即清零。

**Out of scope（本次不做）**：
- 群聊未读（schema 预留拓展位但本次不实现 UI）
- 推送通知（Web Push / Push API）
- 已读回执（"蓝色双勾"）
- 历史未读回填

## 2. 决策记录（Brainstorming 产物）

| 问题 | 决策 |
|---|---|
| 用户视角展示 | 首页红点 + TabBar 总数（两者都要） |
| 已读触发时机 | 打开聊天页即清零 |
| 范围 | 先 1v1，结构预留群聊拓展 |
| 数据模型 | `user_character_state` 加 `last_read_at` 列 |
| 实时性 | 30s 轮询（路由切换时立即拉一次补偿） |

## 3. 数据模型

### Migration: `20260606_pr7_unread.sql`

```sql
-- 1) user_character_state 加 last_read_at
ALTER TABLE user_character_state
  ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ;

-- 2) 存量数据 backfill：假装都读过了（避免升级后一堆"未读"）
UPDATE user_character_state
SET last_read_at = NOW()
WHERE last_read_at IS NULL;

-- 3) 索引:加速 (user_id, created_at > last_read_at) 的未读计数查询
--    已有的 idx_messages_user_char 覆盖 (user_id, character_id, created_at)
--    不需要新建

-- 4) 重新加载 PostgREST schema cache
NOTIFY pgrst, 'reload schema';
```

### 字段语义

- `last_read_at`: 用户对该角色最近一次"读完"的时间戳
- 计算未读数 SQL（概念）: `SELECT COUNT(*) FROM messages WHERE user_id = X AND character_id = Y AND group_id IS NULL AND created_at > last_read_at`

## 4. 后端 API

### 4.1 修改: `GET /api/characters`

**响应**（每个角色加 `unread_count`）:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "...",
      "avatar": "...",
      "last_message": "...",
      "last_message_at": "...",
      "online": true,
      "unread_count": 3    // 🆕 新字段
    }
  ]
}
```

**实现**: 在 `characters.ts` 现有 4 步查询之后加第 5 步 —— 对每个角色用 `user_id + character_id + group_id IS NULL + created_at > last_read_at` 计数（1 个 IN 查询拉所有消息，然后在内存里按 character_id 聚合）。

### 4.2 新增: `POST /api/characters/:id/read`

**请求体**: 空
**响应**:
```json
{ "success": true, "data": { "last_read_at": "2026-06-06T..." } }
```

**实现**:
```sql
INSERT INTO user_character_state (user_id, character_id, last_read_at)
VALUES ($1, $2, NOW())
ON CONFLICT (user_id, character_id)
DO UPDATE SET last_read_at = NOW();
```

**鉴权**: 必须验证 `characterId` 对当前用户可见（own + preset），避免 mark 不属于自己的角色。

### 4.3 新增: `GET /api/unread/total`

**响应**:
```json
{ "success": true, "data": { "total": 7 } }
```

**实现**: 复用 4.1 的聚合逻辑，对 1v1 消息求和。

## 5. 前端 UI

### 5.1 新组件: `Badge` (velin 风格)

**Props**:
```typescript
interface BadgeProps {
  count?: number;        // 数字时显示 "5" / "99+"
  showDot?: boolean;     // 强制红点（无数字）
  max?: number;          // 默认 99，超过显示 "99+"
}
```

**位置**: `frontend/src/components/velin/Badge/`
- `Badge.tsx`
- `Badge.module.css`
- `index.ts`

**显示规则**:
- `count === 0` 且 `!showDot` → 不渲染
- `0 < count <= max` → 显示数字
- `count > max` → 显示 `${max}+`（默认 99+）
- `showDot === true` → 红色实心圆点（无数字）

**主题色**: 红色背景（`var(--velin-color-danger)` 或新建 token），白色数字，圆角方形。

### 5.2 修改: `CharacterCard`

右上角叠加 `<Badge count={unread_count} />`。

### 5.3 修改: `TabBar`

「消息」tab 右上角叠加 `<Badge count={totalUnread} />`。

**TabBar 数据来源**: AppShell 提供 `useUnreadTotal()` hook（封装 30s 轮询 + 路由 focus 拉）。

### 5.4 修改: `Home.tsx`

```typescript
useEffect(() => {
  const load = () => api.getCharacters().then(setChars);
  load();
  const timer = setInterval(load, 30_000);
  return () => clearInterval(timer);
}, []);
```

加 `useLocation` 监听路由，路由回到 `/` 时 `load()` 一次。

### 5.5 修改: `Chat.tsx`

```typescript
useEffect(() => {
  // Fire-and-forget: 不阻塞聊天 UI
  api.readCharacter(characterId).catch(console.error);
}, [characterId]);
```

### 5.6 修改: `frontend/src/api/client.ts`

新增两个方法:
```typescript
readCharacter(id: string): Promise<void>
getUnreadTotal(): Promise<number>
```

## 6. 边界情况 & 错误处理

| 场景 | 行为 |
|---|---|
| 用户从未打开过该角色 | `user_character_state` 无 row → unread_count = 全部消息数；POST /read 时 upsert |
| 群消息被错误计入 | SQL 严格加 `is('group_id', null)` 过滤 |
| 未读数 > 99 | UI 显示 `99+` |
| 存量数据 last_read_at NULL | migration 步骤 2 backfill 为 NOW（避免升级后一堆"未读"） |
| 打开 chat 网络失败 | 静默失败，下次重试；不阻塞 UI |
| 两设备同时打开 | 都调 POST /read → 取 max(now) |
| 轮询失败 | 静默重试，不弹 toast |
| 未读数算出负数（时间错乱） | clamp 到 0 |

## 7. 性能考虑

- `GET /characters` 已用 `IN + ORDER BY created_at DESC` 一次拉取最近消息，**新增 unread 计数复用同一次查询**，不开新 query。
- 30s 轮询 × 2 endpoints（characters + unread/total）= 每分钟约 4 次 GET，**Railway / Vercel 免费额度完全够用**。
- `idx_messages_user_char (user_id, character_id, created_at DESC)` 已存在（PR3 建的），未读计数查询走它即可。

## 8. 测试

### Backend 单测 (`backend/tests/`)
- `unread-total.test.ts` 🆕
  - 3 角色分别 5/2/0 条未读 → GET /total → 7
- `characters-unread.test.ts` 🆕
  - 用户对 X 有 last_read_at = T，插 3 条 T 之后消息 → GET /characters → X.unread_count = 3
- `mark-read.test.ts` 🆕
  - 从未 mark 过 → POST /read → 验证 upsert + last_read_at ≈ now
  - 再次 GET /characters → unread_count = 0

### Frontend 单测 (`frontend/src/.../*.test.tsx`)
- `Badge.test.tsx` 🆕
  - count=0 → 不渲染
  - count=5 → "5"
  - count=100 → "99+"
  - showDot=true → 红点

### 不测
- 轮询 timer（难测、价值低）
- 路由 focus 拉数据（同上）

## 9. 部署流程

1. 写 migration 文件 + 推到 feature branch
2. 写后端代码 + 单元测试 + 跑 `npm test`
3. 写前端代码 + Badge 测试 + 跑 `npm run lint` + `npm run build`
4. 开 PR → 借 Vercel Preview URL 自测
5. Preview OK 后合并 main
6. **关键: 合并后立即到 Supabase SQL Editor 跑 PR7 migration**（生产数据库变更必须手动）
7. 验证线上: 打开网站，看到角色卡红点 → 进入 chat → 红点消失

## 10. 风险 & 回滚

**风险**:
- `last_read_at` backfill 设 NOW 会让所有存量消息瞬间"已读"（用户失去历史未读提示）
- 缓解: PR7 migration 注释里明确说明，可接受

**回滚**:
- 删 `unread_count` 字段（前端加 try/catch 兼容）
- 删 POST /read 调用
- 删 `last_read_at` 列（`ALTER TABLE ... DROP COLUMN`）
- 不需要回滚数据，前端不调用就完全不感知
