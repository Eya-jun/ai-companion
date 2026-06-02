import { Router } from 'express';
import { getSupabaseAdmin } from '../config/supabase';
import { generateChatResponse } from '../services/llm';
import { LLMProvider } from '../config/llm-providers';

const router = Router();

// 获取角色的所有记忆
router.get('/character/:characterId', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { characterId } = req.params;
    const { limit = 30, before } = req.query;

    let query = supabase
      .from('memories')
      .select('*')
      .eq('character_id', characterId)
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

// 生成某天的记忆总结
router.post('/summarize', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { characterId, date, model } = req.body;

    if (!characterId) {
      return res.status(400).json({ success: false, error: 'characterId 必填' });
    }

    const targetDate = date || new Date().toISOString().split('T')[0];

    // 1. 获取角色
    const { data: character } = await supabase
      .from('characters')
      .select('*')
      .eq('id', characterId)
      .single();

    if (!character) {
      return res.status(404).json({ success: false, error: '角色不存在' });
    }

    // 2. 获取当天的所有聊天记录
    const startOfDay = `${targetDate}T00:00:00Z`;
    const endOfDay = `${targetDate}T23:59:59Z`;

    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .eq('character_id', characterId)
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

    // 4. 保存到数据库
    const { data, error } = await supabase
      .from('memories')
      .upsert({
        character_id: characterId,
        summary,
        memory_date: targetDate,
      }, { onConflict: 'character_id,memory_date' })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Summarize error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取最近一次记忆
router.get('/character/:characterId/latest', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { characterId } = req.params;

    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('character_id', characterId)
      .order('memory_date', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    res.json({ success: true, data: data || null });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
