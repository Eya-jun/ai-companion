import { Router } from 'express';
import { getSupabaseAdmin } from '../config/supabase';
import { generateChatResponse } from '../services/llm';
import { LLMProvider } from '../config/llm-providers';

const router = Router();

// 获取角色的所有记忆(限定当前用户)
router.get('/character/:characterId', async (req, res) => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabaseAdmin();
    const { characterId } = req.params;
    const { limit = 30, before } = req.query;

    let query = supabase
      .from('memories')
      .select('*')
      .eq('character_id', characterId)
      .eq('user_id', userId)
      .order('memory_date', { ascending: false })
      .limit(parseInt(limit as string, 10));

    if (before) {
      query = query.lt('memory_date', before);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 生成某天的记忆总结(限定当前用户)
router.post('/summarize', async (req, res) => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabaseAdmin();
    const { characterId, date, model } = req.body;

    if (!characterId) {
      return res.status(400).json({ success: false, error: 'characterId 必填' });
    }

    const targetDate = date || new Date().toISOString().split('T')[0];

    // 1. 获取角色(校验可见性)
    const { data: character } = await supabase
      .from('characters')
      .select('*')
      .eq('id', characterId)
      .or(`user_id.eq.${userId},is_preset.eq.true`)
      .single();

    if (!character) {
      return res.status(404).json({ success: false, error: '角色不存在' });
    }

    // 2. 获取当天当前用户的所有聊天记录
    const startOfDay = `${targetDate}T00:00:00Z`;
    const endOfDay = `${targetDate}T23:59:59Z`;

    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('character_id', characterId)
      .eq('user_id', userId)
      .is('group_id', null)
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay)
      .order('created_at', { ascending: true });

    if (!messages || messages.length === 0) {
      return res.json({ success: true, data: null, message: '当天没有聊天记录' });
    }

    // 3. 让 LLM 生成记忆总结
    const conversationText = messages
      .map(m => `${m.sender_name || (m.role === 'user' ? '我' : character.name)}: ${m.content}`)
      .join('\n');

    const summaryPrompt = `你是 ${character.name}。请根据今天与用户的聊天内容，写一段"双人记忆空间"形式的总结。

【总结要求】
1. 以 ${character.name} 的第一人称视角
2. 记录今天发生的重要事件、情感变化、关键话题
3. 100-300字左右
4. 语气符合角色性格
5. 这是一段私密日记，不是给别人看的

【今天和用户的对话】
${conversationText}

请直接输出总结内容，不要用任何标题或前缀：`;

    const summary = await generateChatResponse({
      systemPrompt: '你是一个善于总结的助手，根据对话内容生成第一人称的记忆总结。',
      messages: [{ role: 'user', content: summaryPrompt }],
      model: model as LLMProvider,
    });

    // 4. 保存到数据库(user_id 加上) —— 允许多条,纯 insert
    const { data, error } = await supabase
      .from('memories')
      .insert({
        character_id: characterId,
        user_id: userId,
        summary,
        memory_date: targetDate,
        source: 'ai',
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Summarize error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 手动新增一条记忆
router.post('/', async (req, res) => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabaseAdmin();
    const { characterId, date, summary } = req.body;
    if (!characterId || !date || !summary) {
      return res.status(400).json({ success: false, error: 'characterId, date, summary 必填' });
    }
    // 校验角色可见性
    const { data: ch } = await supabase
      .from('characters')
      .select('user_id, is_preset')
      .eq('id', characterId)
      .or(`user_id.eq.${userId},is_preset.eq.true`)
      .single();
    if (!ch) return res.status(404).json({ success: false, error: '角色不存在' });

    const { data, error } = await supabase
      .from('memories')
      .insert({
        user_id: userId, character_id: characterId,
        memory_date: date, summary, source: 'user',
      })
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 更新记忆(限定当前用户)
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabaseAdmin();
    const { id } = req.params;
    const { summary } = req.body;
    if (!summary) {
      return res.status(400).json({ success: false, error: 'summary 必填' });
    }
    const { data: existing } = await supabase
      .from('memories')
      .select('user_id')
      .eq('id', id)
      .single();
    if (!existing || existing.user_id !== userId) {
      return res.status(404).json({ success: false, error: '记忆不存在' });
    }
    const { data, error } = await supabase
      .from('memories')
      .update({ summary })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 删除记忆
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabaseAdmin();
    const { id } = req.params;
    const { data: existing } = await supabase
      .from('memories')
      .select('user_id')
      .eq('id', id)
      .single();
    if (!existing || existing.user_id !== userId) {
      return res.status(404).json({ success: false, error: '记忆不存在' });
    }
    const { error } = await supabase.from('memories').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 获取最近一次记忆(限定当前用户)
router.get('/character/:characterId/latest', async (req, res) => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabaseAdmin();
    const { characterId } = req.params;

    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('character_id', characterId)
      .eq('user_id', userId)
      .order('memory_date', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    res.json({ success: true, data: data || null });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取某角色所有珍藏记忆(is_starred = true)
router.get('/character/:characterId/starred', async (req, res) => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabaseAdmin();
    const { characterId } = req.params;
    const { limit = 50, before } = req.query;

    let query = supabase
      .from('memories')
      .select('*')
      .eq('character_id', characterId)
      .eq('user_id', userId)
      .eq('is_starred', true)
      .order('starred_at', { ascending: false })
      .limit(parseInt(limit as string, 10));

    if (before) {
      query = query.lt('starred_at', before);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 切换单条记忆的珍藏状态(不带 starred = toggle)
router.put('/:id/star', async (req, res) => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabaseAdmin();
    const { id } = req.params;
    const { starred } = req.body; // boolean, optional — if omitted, toggle current value

    const { data: existing } = await supabase
      .from('memories')
      .select('id, user_id, is_starred')
      .eq('id', id)
      .single();
    if (!existing) return res.status(404).json({ success: false, error: '记忆不存在' });
    if (existing.user_id !== userId) {
      return res.status(403).json({ success: false, error: '无权修改此记忆' });
    }

    const currentStarred = existing.is_starred ?? false;
    const newStarred = starred === undefined ? !currentStarred : !!starred;
    const { data, error } = await supabase
      .from('memories')
      .update({
        is_starred: newStarred,
        starred_at: newStarred ? new Date().toISOString() : null,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
