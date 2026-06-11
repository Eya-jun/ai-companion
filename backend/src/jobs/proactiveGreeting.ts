import cron from 'node-cron';
import { getSupabaseAdmin } from '../config/supabase';
import { generateChatResponse } from '../services/llm';

const MAX_DAILY_PROACTIVE = 5;
const MAX_CONTENT_LENGTH = 300;
const PREVIEW_LENGTH = 50;
const LLM_TEMPERATURE = 0.9;
const MESSAGE_HISTORY_LIMIT = 3;
const PROMPT_MAX_CHARS = 60;

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

function getTodayStartInShanghai(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const y = parts.find(p => p.type === 'year')!.value;
  const m = parts.find(p => p.type === 'month')!.value;
  const d = parts.find(p => p.type === 'day')!.value;

  return `${y}-${m}-${d}T00:00:00+08:00`;
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

    const { data: lastMsg, error: lastMsgErr } = await supabase
      .from('messages')
      .select('created_at')
      .eq('user_id', user_id)
      .eq('character_id', character_id)
      .is('group_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (lastMsgErr || !lastMsg) {
      skipped++;
      continue;
    }

    const inactiveMs = Date.now() - new Date(lastMsg.created_at).getTime();
    if (inactiveMs < thresholdMs) {
      skipped++;
      continue;
    }

    const todayStart = getTodayStartInShanghai();
    const { count: sentToday, error: countErr } = await supabase
      .from('proactive_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .eq('character_id', character_id)
      .gte('sent_at', todayStart);

    if (countErr) {
      console.error('[proactive] 计数失败:', countErr.message);
      skipped++;
      continue;
    }

    if ((sentToday || 0) >= MAX_DAILY_PROACTIVE) {
      capped++;
      continue;
    }

    try {
      const content = await generateProactiveMessage(user_id, character_id, affinity);
      if (!content || content.trim().length === 0) {
        skipped++;
        continue;
      }
      const safeContent = content.slice(0, MAX_CONTENT_LENGTH);

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

      const { error: logErr } = await supabase.from('proactive_log').insert({
        user_id,
        character_id,
        content_preview: safeContent.slice(0, PREVIEW_LENGTH),
        affinity_at_send: affinity,
      });

      if (logErr) {
        console.error('[proactive] 记 log 失败:', logErr.message);
      }

      sent++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[proactive] LLM 失败:', msg);
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

  const { data: recent, error: recentErr } = await supabase
    .from('messages')
    .select('role, content')
    .eq('user_id', userId)
    .eq('character_id', characterId)
    .is('group_id', null)
    .order('created_at', { ascending: false })
    .limit(MESSAGE_HISTORY_LIMIT);

  if (recentErr) {
    console.error('[proactive] 拉最近消息失败:', recentErr.message);
  }

  const recentMessages = (recent || [])
    .reverse()
    .map((m) => `${m.role === 'user' ? '用户' : '你'}: ${m.content}`)
    .join('\n');

  const stage = getStageLabel(affinity);

  const prompt = `你是「${character.name}」，性格设定：${character.system_prompt}

你们目前的关系阶段是「${stage}」（好感度 ${affinity}/100）。

最近几条聊天记录：
<recent_messages>
${recentMessages || '（还没有聊天记录）'}
</recent_messages>

现在你没有收到用户消息，但你想主动说点什么。写一句自然、口语化的话（不超过${PROMPT_MAX_CHARS}字），不要开头说"我想跟你聊聊"这种太正式的话。可以直接是一句日常、一个观察、一个撒娇、一个分享。`;

  return generateChatResponse({
    systemPrompt: prompt,
    messages: [],
    temperature: LLM_TEMPERATURE,
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
