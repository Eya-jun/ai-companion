import { Router } from 'express';
import { getSupabaseAdmin } from '../config/supabase';
import { generateGroupCharacterResponse } from '../services/llm';
import { LLMProvider } from '../config/llm-providers';

const MAX_CONTEXT_MESSAGES = 30;

const router = Router();

// ========== 群聊管理 ==========

// 列出当前用户的所有群聊
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // 为每个群聊获取成员(限定 user_id)
    const groupsWithMembers = await Promise.all(
      (data || []).map(async (group) => {
        const { data: members } = await supabase
          .from('group_members')
          .select('character_id, characters(id, name, avatar, description)')
          .eq('group_id', group.id)
          .eq('user_id', userId);
        return { ...group, members: members || [] };
      })
    );

    res.json({ success: true, data: groupsWithMembers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取单个群聊详情(校验所有权)
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabaseAdmin();
    const { id } = req.params;

    const { data: group, error } = await supabase
      .from('groups')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !group) {
      return res.status(404).json({ success: false, error: '群聊不存在' });
    }

    const { data: members } = await supabase
      .from('group_members')
      .select('character_id, characters(id, name, avatar, description, system_prompt)')
      .eq('group_id', id)
      .eq('user_id', userId);

    res.json({ success: true, data: { ...group, members: members || [] } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 创建群聊(自动绑定当前用户)
router.post('/', async (req, res) => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabaseAdmin();
    const { name, description, characterIds = [] } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: '群名必填' });
    }

    // 校验 characterIds:所有角色都必须是预设或当前用户的
    if (characterIds.length > 0) {
      const { data: chs } = await supabase
        .from('characters')
        .select('id, user_id, is_preset')
        .in('id', characterIds);
      const allOk = (chs || []).every(c => c.is_preset || c.user_id === userId);
      if (!allOk || (chs || []).length !== characterIds.length) {
        return res.status(400).json({ success: false, error: '包含不可用的角色' });
      }
    }

    // 创建群
    const { data: group, error } = await supabase
      .from('groups')
      .insert({ name, description: description || '', user_id: userId })
      .select()
      .single();

    if (error) throw error;

    // 添加成员
    if (characterIds.length > 0) {
      const members = characterIds.map((cid: string) => ({
        group_id: group.id,
        character_id: cid,
        user_id: userId,
      }));
      await supabase.from('group_members').insert(members);
    }

    res.json({ success: true, data: group });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新群信息(校验所有权)
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabaseAdmin();
    const { id } = req.params;
    const { name, description } = req.body;

    const { data: existing } = await supabase
      .from('groups')
      .select('user_id')
      .eq('id', id)
      .single();
    if (!existing || existing.user_id !== userId) {
      return res.status(404).json({ success: false, error: '群聊不存在' });
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;

    const { data, error } = await supabase
      .from('groups')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除群聊(校验所有权)
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabaseAdmin();
    const { id } = req.params;

    const { data: existing } = await supabase
      .from('groups')
      .select('user_id')
      .eq('id', id)
      .single();
    if (!existing || existing.user_id !== userId) {
      return res.status(404).json({ success: false, error: '群聊不存在' });
    }

    const { error } = await supabase
      .from('groups')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== 群成员管理 ==========

// 添加群成员(校验群所有权 + 角色可见性)
router.post('/:id/members', async (req, res) => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabaseAdmin();
    const { id } = req.params;
    const { characterId } = req.body;

    if (!characterId) {
      return res.status(400).json({ success: false, error: 'characterId 必填' });
    }

    // 校验群所有权
    const { data: group } = await supabase
      .from('groups')
      .select('user_id')
      .eq('id', id)
      .single();
    if (!group || group.user_id !== userId) {
      return res.status(404).json({ success: false, error: '群聊不存在' });
    }

    // 校验角色可见性
    const { data: ch } = await supabase
      .from('characters')
      .select('user_id, is_preset')
      .eq('id', characterId)
      .single();
    if (!ch || (!ch.is_preset && ch.user_id !== userId)) {
      return res.status(404).json({ success: false, error: '角色不存在' });
    }

    const { data, error } = await supabase
      .from('group_members')
      .insert({ group_id: id, character_id: characterId, user_id: userId })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ success: false, error: '该角色已在群中' });
      }
      throw error;
    }

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 移除群成员
router.delete('/:id/members/:characterId', async (req, res) => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabaseAdmin();
    const { id, characterId } = req.params;

    // 校验群所有权
    const { data: group } = await supabase
      .from('groups')
      .select('user_id')
      .eq('id', id)
      .single();
    if (!group || group.user_id !== userId) {
      return res.status(404).json({ success: false, error: '群聊不存在' });
    }

    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', id)
      .eq('character_id', characterId);

    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== 群聊消息 ==========

// 发送消息到群聊
router.post('/:id/chat', async (req, res) => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabaseAdmin();
    const { id } = req.params;
    const { content, model, triggerAll = false } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, error: 'content 必填' });
    }

    // 校验群所有权 + 取成员
    const { data: group } = await supabase
      .from('groups')
      .select('user_id')
      .eq('id', id)
      .single();
    if (!group || group.user_id !== userId) {
      return res.status(404).json({ success: false, error: '群聊不存在' });
    }

    const { data: members } = await supabase
      .from('group_members')
      .select('character_id, characters(*)')
      .eq('group_id', id)
      .eq('user_id', userId);

    if (!members || members.length === 0) {
      return res.status(400).json({ success: false, error: '群聊为空' });
    }

    // 1. 保存用户消息(带 user_id)
    const { data: userMessage } = await supabase
      .from('messages')
      .insert({
        group_id: id,
        user_id: userId,
        role: 'user',
        content,
        sender_type: 'user',
        sender_name: '我',
        sender_id: null,
      })
      .select()
      .single();

    // 2. 获取历史消息(限定 user_id)
    const { data: history } = await supabase
      .from('messages')
      .select('*')
      .eq('group_id', id)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(MAX_CONTEXT_MESSAGES);

    const contextMessages = (history || []).reverse().map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
      senderName: m.sender_name,
    }));

    const characters = members.map(m => (m as any).characters).filter(Boolean);

    // 默认让第一个角色回复,如果 triggerAll 则让所有角色都回
    const charactersToRespond = triggerAll ? characters : [characters[0]];

    // 加载所有角色的补充资料(限定 user_id)
    const allExtras: Record<string, any[]> = {};
    for (const char of characters) {
      const { data: extras } = await supabase
        .from('character_extras')
        .select('*')
        .eq('character_id', char.id)
        .eq('user_id', userId);
      allExtras[char.id] = extras || [];
    }

    const responses = [];
    for (const char of charactersToRespond) {
      try {
        const charExtras = allExtras[char.id] || [];
        let enhancedPrompt = char.system_prompt;
        if (charExtras.length > 0) {
          const sections: string[] = [];
          const byType: Record<string, any[]> = {};
          charExtras.forEach(e => {
            if (!byType[e.type]) byType[e.type] = [];
            byType[e.type].push(e);
          });
          if (byType.note) sections.push(`【补充设定】\n${byType.note.map((e: any) => `- ${e.title}：${e.content}`).join('\n')}`);
          if (byType.story) sections.push(`【故事背景】\n${byType.story.map((e: any) => `- ${e.title}：${e.content}`).join('\n')}`);
          if (byType.relationship) sections.push(`【关系】\n${byType.relationship.map((e: any) => `- ${e.title}：${e.content}`).join('\n')}`);
          if (byType.memory_hint) sections.push(`【记忆提示】\n${byType.memory_hint.map((e: any) => `- ${e.title}：${e.content}`).join('\n')}`);

          if (sections.length > 0) {
            enhancedPrompt = `${char.system_prompt}\n\n═══════════════════════════════════════\n用户为你添加的额外信息（必须遵守）：\n═══════════════════════════════════════\n\n${sections.join('\n\n')}`;
          }
        }

        const charResponse = await generateGroupCharacterResponse(
          { id: char.id, name: char.name, system_prompt: enhancedPrompt },
          contextMessages,
          model as LLMProvider
        );

        const { data: aiMessage } = await supabase
          .from('messages')
          .insert({
            group_id: id,
            user_id: userId,
            character_id: char.id,
            role: 'assistant',
            content: charResponse,
            sender_type: 'character',
            sender_name: char.name,
            sender_id: char.id,
          })
          .select()
          .single();

        if (aiMessage) responses.push(aiMessage);
        contextMessages.push({
          role: 'assistant',
          content: charResponse,
          senderName: char.name,
        });
      } catch (err: any) {
        console.error(`角色 ${char.name} 回复失败:`, err.message);
      }
    }

    res.json({
      success: true,
      data: {
        userMessage: userMessage ?? null,
        responses,
        characters,
      },
    });
  } catch (error: any) {
    console.error('Group chat error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取群聊消息历史(限定当前用户)
router.get('/:id/messages', async (req, res) => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabaseAdmin();
    const { id } = req.params;
    const { limit = 50, before } = req.query;

    // 校验群所有权
    const { data: group } = await supabase
      .from('groups')
      .select('user_id')
      .eq('id', id)
      .single();
    if (!group || group.user_id !== userId) {
      return res.status(404).json({ success: false, error: '群聊不存在' });
    }

    let query = supabase
      .from('messages')
      .select('*')
      .eq('group_id', id)
      .eq('user_id', userId)
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

// 触发角色间互动
router.post('/:id/trigger', async (req, res) => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabaseAdmin();
    const { id } = req.params;
    const { model, rounds = 1 } = req.body;

    // 校验群所有权 + 取成员
    const { data: group } = await supabase
      .from('groups')
      .select('user_id')
      .eq('id', id)
      .single();
    if (!group || group.user_id !== userId) {
      return res.status(404).json({ success: false, error: '群聊不存在' });
    }

    const { data: members } = await supabase
      .from('group_members')
      .select('character_id, characters(*)')
      .eq('group_id', id)
      .eq('user_id', userId);

    if (!members || members.length < 2) {
      return res.status(400).json({ success: false, error: '群聊至少需要2个角色才能触发互动' });
    }

    // 限定当前用户的历史消息
    const { data: history } = await supabase
      .from('messages')
      .select('*')
      .eq('group_id', id)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(MAX_CONTEXT_MESSAGES);

    const contextMessages = (history || []).reverse().map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
      senderName: m.sender_name,
    }));

    const characters = members.map(m => (m as any).characters).filter(Boolean);
    const responses = [];

    for (let r = 0; r < Math.min(rounds, 3); r++) {
      const char = characters[Math.floor(Math.random() * characters.length)];
      try {
        const charResponse = await generateGroupCharacterResponse(
          { name: char.name, system_prompt: char.system_prompt },
          contextMessages,
          model as LLMProvider
        );

        const { data: aiMessage } = await supabase
          .from('messages')
          .insert({
            group_id: id,
            user_id: userId,
            character_id: char.id,
            role: 'assistant',
            content: charResponse,
            sender_type: 'character',
            sender_name: char.name,
            sender_id: char.id,
          })
          .select()
          .single();

        if (aiMessage) responses.push(aiMessage);
        contextMessages.push({
          role: 'assistant',
          content: charResponse,
          senderName: char.name,
        });
      } catch (err: any) {
        console.error(`角色 ${char.name} 回复失败:`, err.message);
      }
    }

    res.json({ success: true, data: responses });
  } catch (error: any) {
    console.error('Trigger interaction error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
