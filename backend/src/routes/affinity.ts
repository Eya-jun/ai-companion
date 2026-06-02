import { Router } from 'express';
import { getSupabaseAdmin } from '../config/supabase';
import { generateChatResponse } from '../services/llm';

const router = Router();

// 拿到或新建 user_character_state
async function ensureState(userId: string, characterId: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('user_character_state')
    .select('*')
    .eq('user_id', userId)
    .eq('character_id', characterId)
    .maybeSingle();
  if (data) return data;
  const { data: created, error } = await supabase
    .from('user_character_state')
    .insert({ user_id: userId, character_id: characterId })
    .select()
    .single();
  if (error) throw error;
  return created;
}

// GET /api/characters/:id/affinity
router.get('/characters/:id/affinity', async (req, res) => {
  try {
    const userId = req.user!.id;
    const characterId = req.params.id;
    const supabase = getSupabaseAdmin();
    const state = await ensureState(userId, characterId);
    const { data: latest } = await supabase
      .from('affinity_evaluations')
      .select('delta, reason, eval_date')
      .eq('user_id', userId)
      .eq('character_id', characterId)
      .order('eval_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    res.json({
      success: true,
      data: {
        affinity: state.affinity,
        stage: state.current_stage,
        mode: state.mode,
        unlockedAt: state.unlocked_at,
        latestReason: latest?.reason ?? null,
        latestDelta: latest?.delta ?? null,
        difficulty: state.difficulty,
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /api/characters/:id/mode 切换 daily/intimate
router.put('/characters/:id/mode', async (req, res) => {
  try {
    const userId = req.user!.id;
    const characterId = req.params.id;
    const { mode } = req.body;
    if (mode !== 'daily' && mode !== 'intimate') {
      return res.status(400).json({ success: false, error: 'mode 必须是 daily 或 intimate' });
    }
    const supabase = getSupabaseAdmin();
    const state = await ensureState(userId, characterId);
    if (mode === 'intimate' && !state.unlocked_at) {
      return res.status(403).json({ success: false, error: '尚未解锁亲密模式(好感度需达到 100%)' });
    }
    const { data, error } = await supabase
      .from('user_character_state')
      .update({ mode })
      .eq('user_id', userId)
      .eq('character_id', characterId)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, data: { mode: data.mode } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /api/characters/:id/difficulty 改攻略难度(仅自定义角色)
router.put('/characters/:id/difficulty', async (req, res) => {
  try {
    const userId = req.user!.id;
    const characterId = req.params.id;
    const { difficulty } = req.body;
    if (!['easy', 'normal', 'hard'].includes(difficulty)) {
      return res.status(400).json({ success: false, error: 'difficulty 必须是 easy/normal/hard' });
    }
    const supabase = getSupabaseAdmin();
    const { data: ch } = await supabase
      .from('characters')
      .select('user_id, is_preset')
      .eq('id', characterId)
      .single();
    if (!ch) return res.status(404).json({ success: false, error: '角色不存在' });
    if (ch.is_preset) {
      return res.status(403).json({ success: false, error: '预设角色不能改难度' });
    }
    if (ch.user_id !== userId) {
      return res.status(403).json({ success: false, error: '无权修改此角色' });
    }
    const { data, error } = await supabase
      .from('user_character_state')
      .update({ difficulty })
      .eq('user_id', userId)
      .eq('character_id', characterId)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, data: { difficulty: data.difficulty } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/characters/:id/special-greeting 100% 解锁时的特殊问候
router.get('/characters/:id/special-greeting', async (req, res) => {
  try {
    const userId = req.user!.id;
    const characterId = req.params.id;
    const supabase = getSupabaseAdmin();
    const state = await ensureState(userId, characterId);
    if (!state.unlocked_at) {
      return res.status(403).json({ success: false, error: '尚未解锁' });
    }
    if (state.special_greeting) {
      return res.json({ success: true, data: { greeting: state.special_greeting } });
    }
    // LLM 生成一次并保存
    const { data: ch } = await supabase
      .from('characters')
      .select('*')
      .eq('id', characterId)
      .single();
    if (!ch) return res.status(404).json({ success: false, error: '角色不存在' });
    const greeting = await generateChatResponse({
      systemPrompt: ch.system_prompt + '\n\n【重要】你刚刚和用户确认了关系。请用你的角色风格说一句温暖的、第一次以"恋人"身份打招呼的话(50-100 字)。',
      messages: [{ role: 'user', content: '现在请输出这句问候。' }],
    });
    await supabase
      .from('user_character_state')
      .update({ special_greeting: greeting })
      .eq('user_id', userId)
      .eq('character_id', characterId);
    res.json({ success: true, data: { greeting } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
