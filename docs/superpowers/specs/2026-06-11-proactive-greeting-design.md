# 主动问候（AI 主动发消息）功能 — 设计文档

> 创建日期: 2026-06-11
> 状态: 设计中（已通过 brainstorming 所有阶段）
> 关联: 复用现有 `node-cron` 基础设施（`dailyAffinityEval.ts` 模式）

## 1. 目标

当用户长期不活跃时，AI 角色主动发送消息，打破"只有用户触发才有对话"的单向模式。

**Out of scope（本次不做）**：
- 群聊主动消息
- Push 通知（Web Push）
- 用户开关（关闭某角色的主动问候）
- 模板库 fallback（LLM 失败时用固定问候语）
- 按时间段定制 prompt（早上/中午/晚上说不同的话）
- UI 特殊标识（proactive 消息在 frontend 和普通 AI 回复长得一样）

## 2. 决策记录（Brainstorming 产物）

| 问题 | 决策 |
|---|---|
| 触发时机 | 用户长期不活跃时 |
| 范围 | 每角色独立计时器 |
| 不活跃阈值 | 陌生 24h / 熟悉 12h / 暧昧 6h / 亲密 3h |
| 每日上限 | 5 条/角色/天，不限制时间 |
| 内容策略 | AI 现编（每次调 LLM） |
| 存储 | 存进 `messages` 表（`role='assistant'`，和普通回复一样） |
| 后端标记 | `proactive_log` 独立表（非 `messages.is_proactive`） |

## 3. 数据模型

### Migration: `20260611_pr8_proactive_greeting.sql`

```sql
-- 记录 AI 主动发送的消息（用于 rate limiting + 统计分析）
CREATE TABLE IF NOT EXISTS proactive_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  content_preview TEXT,  -- 前 50 字，方便调试
  affinity_at_send INT   -- 发的时候的好感度，分析用
);

-- 按天查某角色的发送次数（核心查询）
CREATE INDEX IF NOT EXISTS proactive_log_user_char_date_idx
  ON proactive_log (user_id, character_id, sent_at DESC);

-- 快速查今天发了多少条
CREATE INDEX IF NOT EXISTS proactive_log_user_char_today_idx
  ON proactive_log (user_id, character_id, sent_at)
  WHERE sent_at > CURRENT_DATE;
```

### 表关系

```
proactive_log（新表）
  ├── user_id        → FK auth.users(id) ON DELETE CASCADE
  ├── character_id   → FK characters(id) ON DELETE CASCADE
  ├── sent_at        → 发送时间（rate limiting 关键字段）
  ├── content_preview→ 消息前 50 字（调试/日志）
  └── affinity_at_send→ 当时好感度（分析用）

messages（已有表，不动 schema）
  ├── 所有字段保持原样
  └── NO is_proactive 列（前端不区分，保持沉浸感）
```

## 4. 核心逻辑

### 4.1 Cron 调度

```typescript
// backend/src/jobs/proactiveGreeting.ts
import cron from 'node-cron';

export function startProactiveGreetingCron() {
  cron.schedule('*/15 * * * *', async () => {
    console.log('[proactive] 开始检查', new Date().toISOString());
    await checkAndSendProactiveMessages();
  }, { timezone: 'Asia/Shanghai' });
  console.log('[cron] 主动问候已注册: */15 * * * * (Asia/Shanghai)');
}
```

**为什么 15 分钟**：够频繁（最小延迟 15 分钟），但不至于太耗资源。

### 4.2 检查 & 发送流程

```typescript
async function checkAndSendProactiveMessages() {
  const supabase = getSupabaseAdmin();
  let sent = 0, skipped = 0, capped = 0;

  // 1. 拉所有 user_character_state
  const { data: states } = await supabase
    .from('user_character_state')
    .select('user_id, character_id, affinity');

  for (const state of states || []) {
    const { user_id, character_id, affinity } = state;
    const thresholdMs = getThresholdMs(affinity);

    // 2. 查最后一条消息时间
    const { data: lastMsg } = await supabase
      .from('messages')
      .select('created_at')
      .eq('user_id', user_id)
      .eq('character_id', character_id)
      .is('group_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // 从未聊过 → 不触发（不骚扰新用户）
    if (!lastMsg) { skipped++; continue; }

    const inactiveMs = Date.now() - new Date(lastMsg.created_at).getTime();
    if (inactiveMs < thresholdMs) { skipped++; continue; }

    // 3. 查今天已发了多少条
    const { count: sentToday } = await supabase
      .from('proactive_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .eq('character_id', character_id)
      .gte('sent_at', new Date().toISOString().split('T')[0]); // CURRENT_DATE

    if ((sentToday || 0) >= 5) { capped++; continue; }

    // 4. 调 LLM 生成消息
    try {
      const content = await generateProactiveMessage(user_id, character_id, affinity);
      if (!content || content.length > 500) { skipped++; continue; }

      // 5. 插入 messages（和普通 AI 回复完全一样）
      await supabase.from('messages').insert({
        user_id,
        character_id,
        role: 'assistant',
        content: content.slice(0, 300), // 截断保险
      });

      // 6. 记 proactive_log
      await supabase.from('proactive_log').insert({
        user_id,
        character_id,
        content_preview: content.slice(0, 50),
        affinity_at_send: affinity,
      });

      sent++;
    } catch (e: any) {
      console.error('[proactive] LLM 失败:', e.message);
      skipped++;
    }
  }

  console.log(`[proactive] 本轮: ${sent}条发送, ${skipped}条跳过, ${capped}条已达上限`);
}

// 阈值映射（毫秒）
function getThresholdMs(affinity: number): number {
  if (affinity < 20)  return 24 * 3600 * 1000;  // 陌生
  if (affinity < 50)  return 12 * 3600 * 1000;  // 熟悉
  if (affinity < 80)  return 6  * 3600 * 1000;  // 暧昧
  return 3 * 3600 * 1000;                       // 亲密
}
```

### 4.3 LLM Prompt 设计

```typescript
async function generateProactiveMessage(
  userId: string,
  characterId: string,
  affinity: number
): Promise<string> {
  const supabase = getSupabaseAdmin();

  // 拉角色信息
  const { data: character } = await supabase
    .from('characters')
    .select('name, system_prompt')
    .eq('id', characterId)
    .single();

  // 拉最近 3 条聊天记录（供 context）
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
    .map(m => `${m.role === 'user' ? '用户' : '你'}: ${m.content}`)
    .join('\n');

  const stage = affinity < 20 ? '陌生'
              : affinity < 50 ? '熟悉'
              : affinity < 80 ? '暧昧'
              : '亲密';

  const prompt = `你是「${character.name}」，性格设定：${character.system_prompt}

你们目前的关系阶段是「${stage}」（好感度 ${affinity}/100）。

最近几条聊天记录：
${recentMessages || '（还没有聊天记录）'}

现在你没有收到用户消息，但你想主动说点什么。写一句自然、口语化的话（不超过60字），不要开头说"我想跟你聊聊"这种太正式的话。可以直接是一句日常、一个观察、一个撒娇、一个分享。`;

  return await callLLM(prompt);
}
```

**成本控制要点**：
- 只拉最近 3 条聊天记录（控制 input token）
- 强制输出 ≤ 60 字（控制 output token）
- 最坏情况：50 条/天 × 30 天 ≈ ¥9-18/月（deepseek）

## 5. 边界情况 & 错误处理

| 场景 | 行为 |
|---|---|
| **用户从未和该角色聊过** | messages 表为空 → `lastMsg = null` → 不触发。等用户主动聊过一次才开始计时。 |
| **今天已发满 5 条** | `proactive_log` 计数 ≥ 5 → 跳过，等明天。 |
| **15 分钟内多次满足阈值** | 每次 cron 只发 1 条（发完记 log，下次 cron 再判断）。不会 burst。 |
| **LLM 调用失败 / 超时** | 跳过本次，15 分钟后重试。不记 log，不计入上限。 |
| **LLM 返回空或超长内容** | 空 → 跳过；>500 字 → 截断到 300 字再存。 |
| **用户删除角色** | `ON DELETE CASCADE` 自动清理 `proactive_log` + `messages`。 |
| **凌晨 0:00 附近** | `CURRENT_DATE` 自动跨天，不需要额外处理。 |
| **Railway 重启** | cron 在 `index.ts` 启动时重新注册，状态由数据库持久化。 |
| **多用户同时满足条件** | 串行处理（for 循环），防止并发插入导致顺序错乱。 |
| **两设备同时打开 app** | 不影响——proactive 是后端 cron 触发，与前端无关。 |

## 6. API（可选）

### GET /api/proactive/stats

后台调试用，看今天发了多少条。

```json
{
  "success": true,
  "data": {
    "today_total": 23,
    "by_character": [
      { "character_id": "...", "count": 5 },
      { "character_id": "...", "count": 3 }
    ]
  }
}
```

## 7. 前端影响

**零改动**。proactive 消息以 `role='assistant'` 存进 `messages` 表，前端现有的 30s 轮询自然能发现：
- `Home.tsx` 轮询 → `last_message` / `unread_count` 更新 → CharacterCard 显示红点
- `TabBar` 轮询 → `total_unread` 更新
- 用户点进 Chat → 正常 mark as read

## 8. 测试

- `proactive-greeting.test.ts` 🆕
  - **场景 A**: affinity=85, last_msg=4h ago → 应触发（亲密 3h 阈值）
  - **场景 B**: affinity=85, last_msg=2h ago → 不应触发
  - **场景 C**: affinity=10, last_msg=20h ago → 不应触发（陌生 24h 阈值）
  - **场景 D**: 今天已发 5 条 → 不应触发
  - **场景 E**: 从未聊过（messages 为空）→ 不应触发
  - **场景 F**: LLM 失败 → 不记 log，下次重试
  - **场景 G**: 用户删除角色 → `proactive_log` 级联删除

## 9. 部署流程

1. 写 migration 文件 + 推到 feature branch
2. 写 `proactiveGreeting.ts` cron job + 单元测试
3. 修改 `index.ts` 注册 cron
4. 跑 `npm test` 通过
5. 开 PR → Preview 验证
6. 合并 main → Railway 自动部署
7. **到 Supabase SQL Editor 跑 PR8 migration**
8. 观察日志：`[proactive] 本轮: X条发送, Y条跳过`

## 10. 风险 & 回滚

**风险**：
- LLM 调用成本：最坏 ¥9-18/月（deepseek），实际平均 1-2 条/角色/天
- 用户可能觉得"AI 太黏人"——可通过调低上限/调高阈值缓解

**回滚**：
- 停掉 cron：注释 `index.ts` 里的 `startProactiveGreetingCron()`
- 删 `proactive_log` 表：`DROP TABLE proactive_log;`
- messages 表里的 proactive 消息保留（和普通消息一样，不影响功能）
