import { Router } from 'express';
import { getSupabaseAdmin } from '../config/supabase';
import { generateChatResponse, ChatMessageItem } from '../services/llm';
import { LLMProvider } from '../config/llm-providers';

const router = Router();
const MAX_CONTEXT_MESSAGES = 20;

// 发送消息并获取回复
router.post('/', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { characterId, content, model, saveToMemory = true } = req.body;

    if (!characterId || !content) {
      return res.status(400).json({ success: false, error: 'characterId 和 content 必填' });
    }

    // 1. 获取角色信息
    const { data: character, error: charError } = await supabase
      .from('characters')
      .select('*')
      .eq('id', characterId)
      .single();

    if (charError || !character) {
      return res.status(404).json({ success: false, error: '角色不存在' });
    }

    // 2. 获取角色的补充资料（注入到 system_prompt）
    const { data: extras } = await supabase
      .from('character_extras')
      .select('*')
      .eq('character_id', characterId)
      .order('created_at', { ascending: true });

    // 构造增强的 system_prompt
    let enhancedPrompt = character.system_prompt;
    if (extras && extras.length > 0) {
      const extrasByType: Record<string, any[]> = {};
      extras.forEach(e => {
        if (!extrasByType[e.type]) extrasByType[e.type] = [];
        extrasByType[e.type].push(e);
      });

      const sections: string[] = [];

      if (extrasByType.note && extrasByType.note.length > 0) {
        sections.push(`【用户补充设定】
${extrasByType.note.map(e => `- ${e.title}：${e.content}`).join('\n')}`);
      }

      if (extrasByType.story && extrasByType.story.length > 0) {
        sections.push(`【你们之间的故事背景】
${extrasByType.story.map(e => `- ${e.title}：${e.content}`).join('\n')}`);
      }

      if (extrasByType.relationship && extrasByType.relationship.length > 0) {
        sections.push(`【关系进展记录】
${extrasByType.relationship.map(e => `- ${e.title}：${e.content}`).join('\n')}`);
      }

      if (extrasByType.memory_hint && extrasByType.memory_hint.length > 0) {
        sections.push(`【重要记忆提示】
${extrasByType.memory_hint.map(e => `- ${e.title}：${e.content}`).join('\n')}`);
      }

      if (sections.length > 0) {
        enhancedPrompt = `${character.system_prompt}

═══════════════════════════════════════
以下是用户为你添加的额外信息，**必须严格遵守**：
═══════════════════════════════════════

${sections.join('\n\n')}`;
      }
    }

    // 3. 获取最近的历史消息（私聊）
    const { data: history } = await supabase
      .from('messages')
      .select('*')
      .eq('character_id', characterId)
      .is('group_id', null)
      .order('created_at', { ascending: false })
      .limit(MAX_CONTEXT_MESSAGES);

    // 过滤掉空消息（防止 LLM API 报错）
    const validHistory = (history || []).filter(m =>
      m.content && m.content.trim() !== ''
    );

    const contextMessages: ChatMessageItem[] = validHistory.reverse().map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
      senderName: m.sender_name || undefined,
    }));

    // 4. 加上用户当前消息
    contextMessages.push({ role: 'user', content });

    // 5. 调用 LLM 生成回复
    const aiResponse = await generateChatResponse({
      systemPrompt: enhancedPrompt,
      messages: contextMessages,
      model: model as LLMProvider,
    });

    // 6. 保存到数据库（避免空消息）
    if (saveToMemory && aiResponse && aiResponse.trim() !== '') {
      await supabase.from('messages').insert([
        {
          character_id: characterId,
          role: 'user',
          content,
          sender_type: 'user',
          sender_name: '我',
        },
        {
          character_id: characterId,
          role: 'assistant',
          content: aiResponse,
          sender_type: 'character',
          sender_name: character.name,
        },
      ]);
    }

    res.json({
      success: true,
      data: {
        userMessage: content,
        aiResponse,
        character: {
          id: character.id,
          name: character.name,
          avatar: character.avatar,
        },
      },
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取历史消息
router.get('/:characterId/messages', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { characterId } = req.params;
    const { limit = 50, before } = req.query;

    let query = supabase
      .from('messages')
      .select('*')
      .eq('character_id', characterId)
      .is('group_id', null)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit as string, 10));

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, data: (data || []).reverse() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 清除聊天记录
router.delete('/:characterId/messages', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { characterId } = req.params;

    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('character_id', characterId)
      .is('group_id', null);

    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
