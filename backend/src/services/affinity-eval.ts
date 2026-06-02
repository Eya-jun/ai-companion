// 每日评估服务:扫所有 (user, character) 组合,对昨天对话调 LLM 评估 affinity + memory

import { getSupabaseAdmin } from '../config/supabase';
import { chat } from '../config/llm-providers';

const SYSTEM_PROMPT = `你是一个角色扮演分析助手。根据"昨天用户与角色的对话",输出:
1. 一段 100-300 字的"角色第一人称记忆"(像日记)
2. 评估昨天互动对好感度的影响(-5 到 +5 的整数)
请严格输出 JSON,不要任何额外文字。`;

function stageFromAffinity(affinity: number): string {
  if (affinity >= 80) return 'intimate';
  if (affinity >= 50) return 'flirtatious';
  if (affinity >= 20) return 'familiar';
  return 'stranger';
}

interface EvalResult {
  evaluated: number;
  errors: number;
  skipped: number;
}

export async function evaluateAllUsersYesterday(): Promise<EvalResult> {
  const supabase = getSupabaseAdmin();
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // 找所有昨天有消息的 (user_id, character_id) 组合
  const { data: msgPairs, error: msgErr } = await supabase
    .from('messages')
    .select('user_id, character_id')
    .is('group_id', null)
    .gte('created_at', `${yesterday}T00:00:00Z`)
    .lte('created_at', `${yesterday}T23:59:59Z`);
  if (msgErr) throw msgErr;

  const pairSet = new Set<string>();
  (msgPairs || []).forEach(p => {
    if (p.user_id && p.character_id) pairSet.add(`${p.user_id}|${p.character_id}`);
  });
  const pairs = Array.from(pairSet).map(s => {
    const [u, c] = s.split('|');
    return { userId: u, characterId: c };
  });

  let evaluated = 0, errors = 0, skipped = 0;

  for (const { userId, characterId } of pairs) {
    try {
      // 拉昨天消息
      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .eq('user_id', userId)
        .eq('character_id', characterId)
        .is('group_id', null)
        .gte('created_at', `${yesterday}T00:00:00Z`)
        .lte('created_at', `${yesterday}T23:59:59Z`)
        .order('created_at', { ascending: true });
      if (!messages || messages.length === 0) { skipped++; continue; }

      // 拉 character
      const { data: character } = await supabase
        .from('characters')
        .select('*')
        .eq('id', characterId)
        .single();
      if (!character) { skipped++; continue; }

      // 拉 state
      const { data: state } = await supabase
        .from('user_character_state')
        .select('*')
        .eq('user_id', userId)
        .eq('character_id', characterId)
        .maybeSingle();
      const prevAffinity = state?.affinity ?? 0;
      const stageName = stageFromAffinity(prevAffinity);

      // 调 LLM
      const conversationText = messages
        .map(m => `${m.sender_name || (m.role === 'user' ? '我' : character.name)}: ${m.content}`)
        .join('\n');
      const userPrompt = `角色: ${character.name}\n角色人设: ${character.system_prompt}\n当前亲密度: ${prevAffinity}% (${stageName})\n\n昨天所有对话:\n${conversationText}\n\n输出 schema:\n{\n  "summary": "<100-300 字>",\n  "affinityDelta": <-5..5 的整数>,\n  "reason": "<不超过 30 字>"\n}`;

      let raw: string;
      try {
        raw = await chat({
          model: 'kimi',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          maxTokens: 800,
        });
      } catch (e: any) {
        await supabase.from('affinity_evaluations').insert({
          user_id: userId, character_id: characterId, eval_date: yesterday,
          prev_affinity: prevAffinity, new_affinity: prevAffinity, delta: 0,
          reason: null, memory_summary: null, error: 'LLM call failed: ' + e.message,
        });
        errors++;
        continue;
      }

      // 解析 JSON
      let parsed: { summary: string; affinityDelta: number; reason: string };
      try {
        parsed = JSON.parse(raw);
      } catch {
        await supabase.from('affinity_evaluations').insert({
          user_id: userId, character_id: characterId, eval_date: yesterday,
          prev_affinity: prevAffinity, new_affinity: prevAffinity, delta: 0,
          reason: null, memory_summary: null, error: 'JSON parse failed: ' + raw.slice(0, 200),
        });
        errors++;
        continue;
      }

      // clamp
      const delta = Math.max(-5, Math.min(5, parsed.affinityDelta || 0));
      const newAffinity = Math.max(0, Math.min(100, prevAffinity + delta));
      const unlocked = newAffinity >= 100 && prevAffinity < 100;

      // upsert evaluation
      await supabase.from('affinity_evaluations').upsert({
        user_id: userId, character_id: characterId, eval_date: yesterday,
        prev_affinity: prevAffinity, new_affinity: newAffinity, delta,
        reason: parsed.reason, memory_summary: parsed.summary,
      }, { onConflict: 'user_id,character_id,eval_date' });

      // upsert memory
      await supabase.from('memories').upsert({
        user_id: userId, character_id: characterId,
        memory_date: yesterday, summary: parsed.summary,
        affinity_delta: delta, affinity_reason: parsed.reason, source: 'ai',
      }, { onConflict: 'user_id,character_id,memory_date' });

      // upsert state
      await supabase.from('user_character_state').upsert({
        user_id: userId, character_id: characterId,
        affinity: newAffinity,
        current_stage: stageFromAffinity(newAffinity),
        unlocked_at: unlocked ? new Date().toISOString() : (state?.unlocked_at || null),
      }, { onConflict: 'user_id,character_id' });

      evaluated++;
    } catch (e: any) {
      console.error(`[affinity-eval] ${userId}/${characterId} 失败:`, e.message);
      errors++;
    }
  }

  return { evaluated, errors, skipped };
}
