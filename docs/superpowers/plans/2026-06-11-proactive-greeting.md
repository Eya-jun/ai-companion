# 主动问候（AI 主动发消息）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 AI 主动问候功能：用户长期不活跃时，角色自动发送 LLM 生成的消息。

**Architecture:** 复用现有 `node-cron` 基础设施，每 15 分钟检查一次。按好感度分层阈值决定触发时机，每天上限 5 条。消息以普通 `role='assistant'` 存入 `messages` 表，前端零改动。

**Tech Stack:** Express + TypeScript + Supabase + node-cron + vitest + supertest

---

### Task 1: Database Migration

**Files:**
- Create: `backend/supabase/migrations/20260611_pr8_proactive_greeting.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- PR8: AI 主动问候功能 — 记录主动发送的消息用于 rate limiting

CREATE TABLE IF NOT EXISTS proactive_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  content_preview TEXT,
  affinity_at_send INT
);

-- 按天查某角色的发送次数
CREATE INDEX IF NOT EXISTS proactive_log_user_char_date_idx
  ON proactive_log (user_id, character_id, sent_at DESC);

-- 快速查今天发了多少条
CREATE INDEX IF NOT EXISTS proactive_log_user_char_today_idx
  ON proactive_log (user_id, character_id, sent_at)
  WHERE sent_at > CURRENT_DATE;

-- reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2: Commit**

```bash
git add backend/supabase/migrations/20260611_pr8_proactive_greeting.sql
git commit -m "feat(db): PR8 proactive_log table for AI proactive greeting rate limiting"
```

---

### Task 2: Core Cron Job

**Files:**
- Create: `backend/src/jobs/proactiveGreeting.ts`
- Modify: `backend/src/services/llm.ts` (add a new export, or use existing)

- [ ] **Step 1: Read existing patterns**

先读这两个文件确认 pattern：
```bash
cat backend/src/jobs/dailyAffinityEval.ts
cat backend/src/services/llm.ts
```

- [ ] **Step 2: Write the proactive greeting job**

Create `backend/src/jobs/proactiveGreeting.ts`:

```typescript
import cron from 'node-cron';
import { getSupabaseAdmin } from '../config/supabase';
import { generateChatResponse } from '../services/llm';

const THRESHOLDS_MS = [
  { maxAffinity: 20,  ms: 24 * 3600 * 1000 },  // 陌生
  { maxAffinity: 50,  ms: 12 * 3600 * 1000 },  // 熟悉
  { maxAffinity: 80,  ms: 6  * 3600 * 1000 },  // 暧昧
  { maxAffinity: 101, ms: 3  * 3600 * 1000 },  // 亲密
];

function getThresholdMs(affinity: number): number {
  for (const t of THRESHOLDS_MS) {
    if (affinity < t.maxAffinity) return t.ms;
  }
  return THRESHOLDS_MS[THRESHOLDS_MS.length - 1].ms;
}

function getStageLabel(affinity: number): string {
  if (affinity < 20) return '陌生';
  if (affinity < 50) return '熟悉';
  if (affinity < 80) return '暧昧';
  return '亲密';
}

export async function checkAndSendProactiveMessages(): Promise<void> {
  const supabase = getSupabaseAdmin();
  let sent = 0, skipped = 0, capped = 0;

  const { data: states, error: statesErr } = await supabase
    .from('user_character_state')
    .select('user_id, character_id, affinity');

  if (statesErr) {
    console.error('[proactive] 拉状态失败:', statesErr.message);
    return;
  }

  for (const state of states || []) {
    const { user_id, character_id, affinity } = state;
    const thresholdMs = getThresholdMs(affinity);

    // 查最后一条消息时间
    const { data: lastMsg } = await supabase
      .from('messages')
      .select('created_at')
      .eq('user_id', user_id)
      .eq('character_id', character_id)
      .is('group_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!lastMsg) {
      skipped++;
      continue; // 从未聊过，不骚扰
    }

    const inactiveMs = Date.now() - new Date(lastMsg.created_at).getTime();
    if (inactiveMs < thresholdMs) {
      skipped++;
      continue;
    }

    // 查今天已发了多少条
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count: sentToday, error: countErr } = await supabase
      .from('proactive_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .eq('character_id', character_id)
      .gte('sent_at', todayStart.toISOString());

    if (countErr) {
      console.error('[proactive] 计数失败:', countErr.message);
      skipped++;
      continue;
    }

    if ((sentToday || 0) >= 5) {
      capped++;
      continue;
    }

    // 生成消息
    try {
      const content = await generateProactiveMessage(user_id, character_id, affinity);
      if (!content || content.trim().length === 0) {
        skipped++;
        continue;
      }
      const safeContent = content.slice(0, 300);

      // 插入 messages
      const { error: insertErr } = await supabase.from('messages').insert({
        user_id,
        character_id,
        role: 'assistant',
        content: safeContent,
      });

      if (insertErr) {
        console.error('[proactive] 插入 messages 失败:', insertErr.message);
        skipped++;
        continue;
      }

      // 记 proactive_log
      const { error: logErr } = await supabase.from('proactive_log').insert({
        user_id,
        character_id,
        content_preview: safeContent.slice(0, 50),
        affinity_at_send: affinity,
      });

      if (logErr) {
        console.error('[proactive] 记 log 失败:', logErr.message);
        // messages 已插入，log 失败不算致命，继续
      }

      sent++;
    } catch (e: any) {
      console.error('[proactive] LLM 失败:', e.message);
      skipped++;
    }
  }

  console.log(`[proactive] 本轮: ${sent}条发送, ${skipped}条跳过, ${capped}条已达上限`);
}

async function generateProactiveMessage(
  userId: string,
  characterId: string,
  affinity: number
): Promise<string> {
  const supabase = getSupabaseAdmin();

  const { data: character, error: charErr } = await supabase
    .from('characters')
    .select('name, system_prompt')
    .eq('id', characterId)
    .single();

  if (charErr || !character) {
    throw new Error('角色不存在');
  }

  const { data: recent } = await supabase
    .from('messages')
    .select('role, content')
    .eq('user_id', userId)
    .eq('character_id', characterId)
    .is('group_id', null)
    .order('created_at', { ascending: false })
    .limit(3);

  const recentMessages = (recent || [])
    .reverse()
    .map((m: any) => `${m.role === 'user' ? '用户' : '你'}: ${m.content}`)
    .join('\n');

  const stage = getStageLabel(affinity);

  const prompt = `你是「${character.name}」，性格设定：${character.system_prompt}

你们目前的关系阶段是「${stage}」（好感度 ${affinity}/100）。

最近几条聊天记录：
${recentMessages || '（还没有聊天记录）'}

现在你没有收到用户消息，但你想主动说点什么。写一句自然、口语化的话（不超过60字），不要开头说"我想跟你聊聊"这种太正式的话。可以直接是一句日常、一个观察、一个撒娇、一个分享。`;

  return generateChatResponse({
    systemPrompt: prompt,
    messages: [],
    temperature: 0.9,
  });
}

export function startProactiveGreetingCron() {
  if (!cron.validate('*/15 * * * *')) {
    console.error('[cron] proactive greeting 表达式无效');
    return;
  }

  cron.schedule(
    '*/15 * * * *',
    async () => {
      console.log('[proactive] 开始检查', new Date().toISOString());
      await checkAndSendProactiveMessages();
    },
    { timezone: 'Asia/Shanghai' },
  );

  console.log('[cron] 主动问候已注册: */15 * * * * (Asia/Shanghai)');
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/jobs/proactiveGreeting.ts
git commit -m "feat(proactive): cron job for AI-initiated greeting messages

- Checks user inactivity every 15 minutes
- Affinity-based thresholds: 24/12/6/3 hours
- Max 5 proactive messages per character per day
- Stores in messages table (no UI distinction)"
```

---

### Task 3: Register Cron in App Entry

**Files:**
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Add import and start call**

在 `backend/src/index.ts` 中，在 `startDailyAffinityCron` 的 import 旁边加一行：

```typescript
import { startDailyAffinityCron } from './jobs/dailyAffinityEval';
import { startProactiveGreetingCron } from './jobs/proactiveGreeting';  // 新增
```

在 `startDailyAffinityCron()` 调用旁边加一行：

```typescript
startDailyAffinityCron();
startProactiveGreetingCron();  // 新增
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/index.ts
git commit -m "chore(cron): register proactive greeting cron on app startup"
```

---

### Task 4: Write Tests

**Files:**
- Create: `backend/tests/proactive-greeting.test.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/proactive-greeting.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkAndSendProactiveMessages } from '../src/jobs/proactiveGreeting';

// Mock LLM service
vi.mock('../src/services/llm', () => ({
  generateChatResponse: vi.fn(async () => '想你啦～'),
}));

// Mock Supabase
const mockInsert = vi.fn(async () => ({ error: null }));
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
}));

mockSelect.mockReturnValue({
  eq: vi.fn(() => ({ is: vi.fn(() => ({ order: vi.fn(() => ({ limit: vi.fn(() => ({ single: mockSingle })) })) })) })),
}));

vi.mock('../src/config/supabase', () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: mockFrom,
  })),
}));

describe('checkAndSendProactiveMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('不触发：从未聊过（messages 为空）', async () => {
    mockSelect.mockReturnValueOnce({
      select: vi.fn(() => ({ data: [{ user_id: 'u1', character_id: 'c1', affinity: 85 }] })),
    });
    mockSingle.mockResolvedValueOnce({ data: null, error: null }); // 最后一条消息为空

    await checkAndSendProactiveMessages();

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('触发：亲密 85，最后消息 4h 前', async () => {
    const fourHoursAgo = new Date(Date.now() - 4 * 3600 * 1000).toISOString();

    mockSelect.mockReturnValueOnce({
      select: vi.fn(() => ({ data: [{ user_id: 'u1', character_id: 'c1', affinity: 85 }] })),
    });
    mockSingle.mockResolvedValueOnce({ data: { created_at: fourHoursAgo }, error: null });
    mockSelect.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({ count: 0, error: null })),
          })),
        })),
      })),
    });

    await checkAndSendProactiveMessages();

    expect(mockInsert).toHaveBeenCalledTimes(2); // messages + proactive_log
  });

  it('不触发：亲密 85，最后消息 2h 前（阈值 3h 未达）', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();

    mockSelect.mockReturnValueOnce({
      select: vi.fn(() => ({ data: [{ user_id: 'u1', character_id: 'c1', affinity: 85 }] })),
    });
    mockSingle.mockResolvedValueOnce({ data: { created_at: twoHoursAgo }, error: null });

    await checkAndSendProactiveMessages();

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('不触发：陌生 10，最后消息 20h 前（阈值 24h 未达）', async () => {
    const twentyHoursAgo = new Date(Date.now() - 20 * 3600 * 1000).toISOString();

    mockSelect.mockReturnValueOnce({
      select: vi.fn(() => ({ data: [{ user_id: 'u1', character_id: 'c1', affinity: 10 }] })),
    });
    mockSingle.mockResolvedValueOnce({ data: { created_at: twentyHoursAgo }, error: null });

    await checkAndSendProactiveMessages();

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('不触发：今天已发满 5 条', async () => {
    const fourHoursAgo = new Date(Date.now() - 4 * 3600 * 1000).toISOString();

    mockSelect.mockReturnValueOnce({
      select: vi.fn(() => ({ data: [{ user_id: 'u1', character_id: 'c1', affinity: 85 }] })),
    });
    mockSingle.mockResolvedValueOnce({ data: { created_at: fourHoursAgo }, error: null });
    mockSelect.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({ count: 5, error: null })),
          })),
        })),
      })),
    });

    await checkAndSendProactiveMessages();

    expect(mockInsert).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests (expect FAIL)**

```bash
cd "/Users/eya/Desktop/AI chat/backend" && npx vitest run tests/proactive-greeting.test.ts
```

Expected: 可能有编译错误或 mock 不匹配，因为 `checkAndSendProactiveMessages` 需要被 export。

- [ ] **Step 3: Fix exports in job file**

确保 `backend/src/jobs/proactiveGreeting.ts` 里 `checkAndSendProactiveMessages` 是 `export async function`。

- [ ] **Step 4: Run tests again (expect PASS)**

```bash
cd "/Users/eya/Desktop/AI chat/backend" && npx vitest run tests/proactive-greeting.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Run full test suite**

```bash
cd "/Users/eya/Desktop/AI chat/backend" && npm test
```

Expected: All existing tests still pass + new tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/tests/proactive-greeting.test.ts
git commit -m "test(proactive): add proactive greeting unit tests

- Never chatted: skip
- Intimate 85, 4h ago: trigger
- Intimate 85, 2h ago: skip (threshold 3h)
- Stranger 10, 20h ago: skip (threshold 24h)
- Already sent 5 today: skip (cap)"
```

---

### Task 5: Manual Verification

**Files:** None (手动操作)

- [ ] **Step 1: Build 后端**

```bash
cd "/Users/eya/Desktop/AI chat/backend" && npm run build
```

Expected: `tsc` 无错误。

- [ ] **Step 2: 本地启动后端**

```bash
cd "/Users/eya/Desktop/AI chat/backend" && npm run dev
```

Expected: 控制台出现 `[cron] 主动问候已注册: */15 * * * * (Asia/Shanghai)`

- [ ] **Step 3: 等 15 分钟或手动触发**

如果等不了 15 分钟，临时改 `*/15 * * * *` 为 `* * * * *`（每分钟），重启看日志：

```
[proactive] 开始检查 2026-06-11T...
[proactive] 本轮: X条发送, Y条跳过, Z条已达上限
```

验证：
- 从未聊过的角色 → skipped（不触发）
- 满足阈值的角色 → sent（发了消息）

- [ ] **Step 4: 检查 Supabase 数据库**

进 SQL Editor 查：
```sql
SELECT * FROM proactive_log ORDER BY sent_at DESC LIMIT 5;
SELECT * FROM messages WHERE role = 'assistant' ORDER BY created_at DESC LIMIT 5;
```

Expected: proactive_log 和 messages 各多了一条记录。

- [ ] **Step 5: 恢复 cron 间隔**

改回 `*/15 * * * *`。

- [ ] **Step 6: Commit**

```bash
git add backend/src/jobs/proactiveGreeting.ts
git commit -m "fix(proactive): adjust cron interval to 15min after manual test"
```
（如果没有改代码，这一步跳过）

---

### Task 6: Deploy to Production

**Files:** Migration file (已在 Task 1 创建)

- [ ] **Step 1: Push to GitHub**

```bash
cd "/Users/eya/Desktop/AI chat"
git push origin main
```

- [ ] **Step 2: Railway 自动部署**

等 Railway 自动 build + deploy（1-2 分钟）。

- [ ] **Step 3: 跑 production migration**

到 Supabase SQL Editor 跑：
```sql
-- 粘贴 backend/supabase/migrations/20260611_pr8_proactive_greeting.sql 内容
```

- [ ] **Step 4: 验证 production**

看 Railway logs：
```
[cron] 主动问候已注册: */15 * * * * (Asia/Shanghai)
```

等 15 分钟，看是否出现：
```
[proactive] 开始检查 ...
[proactive] 本轮: X条发送, Y条跳过, Z条已达上限
```

---

## Self-Review

### Spec Coverage Check

| Spec Section | Plan Task | 状态 |
|---|---|---|
| PR8 migration (proactive_log 表) | Task 1 | ✅ |
| Cron 调度 (*/15 * * * *) | Task 2 | ✅ |
| 阈值映射 (24/12/6/3h) | Task 2 (代码内) | ✅ |
| 每日上限 5 条 | Task 2 (计数逻辑) | ✅ |
| LLM prompt 设计 | Task 2 (generateProactiveMessage) | ✅ |
| 存 messages 表 (role='assistant') | Task 2 | ✅ |
| 从未聊过不触发 | Task 4 (test case 1) | ✅ |
| 已达上限不触发 | Task 4 (test case 5) | ✅ |
| 注册 cron | Task 3 | ✅ |
| 部署流程 | Task 6 | ✅ |

### Placeholder Scan

- ❌ 无 "TBD" / "TODO" / "implement later"
- ❌ 无 "add appropriate error handling"
- ❌ 无 "similar to Task X"
- ✅ 所有步骤都有具体代码和命令

### Type Consistency

- `checkAndSendProactiveMessages` 在 Task 2 定义为 `export async function`，Task 4 测试里 import 路径一致 ✅
- `generateChatResponse` 从 `../services/llm` import，和现有代码一致 ✅
- `getSupabaseAdmin` mock 方式和 `auth-route.test.ts` 一致 ✅

### Gap Found

- Spec 提到了 `GET /api/proactive/stats`（可选后台 API），但 plan 里没有。按 YAGNI 原则，首次实现不建这个 route，以后需要再加。这个 gap 是刻意的 ✅
