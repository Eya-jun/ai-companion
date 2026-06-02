import { Router, Response } from 'express';
import { getSupabaseAdmin } from '../config/supabase';
import { generateChatResponse, ChatMessageItem } from '../services/llm';
import { assemblePrivateChatSystemPrompt } from '../services/prompt-assembly';
import { LLMProvider, streamChat } from '../config/llm-providers';

const router = Router();
const MAX_CONTEXT_MESSAGES = 20;

// 根据亲和度返回 stage 名
function stageFromAffinity(affinity: number): string {
  if (affinity >= 80) return 'intimate';
  if (affinity >= 50) return 'flirtatious';
  if (affinity >= 20) return 'familiar';
  return 'stranger';
}

// 发送消息并获取回复(私聊,user_id 限定)
router.post('/', async (req, res) => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabaseAdmin();
    const { characterId, content, model, saveToMemory = true } = req.body;

    if (!characterId || !content) {
      return res.status(400).json({ success: false, error: 'characterId 和 content 必填' });
    }

    // 1. 校验角色可见性:预设或当前用户的自定义
    const { data: character, error: charError } = await supabase
      .from('characters')
      .select('*')
      .eq('id', characterId)
      .or(`user_id.eq.${userId},is_preset.eq.true`)
      .single();

    if (charError || !character) {
      return res.status(404).json({ success: false, error: '角色不存在' });
    }

    // 2. 并行拉:user profile、user_character_state、extras、recent reasons
    const [userRes, stateRes, extrasRes, reasonsRes] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('user_character_state').select('*').eq('user_id', userId).eq('character_id', characterId).maybeSingle(),
      supabase.from('character_extras').select('*').eq('character_id', characterId).eq('user_id', userId).order('created_at', { ascending: true }),
      supabase.from('affinity_evaluations').select('eval_date, reason').eq('user_id', userId).eq('character_id', characterId)
        .gte('eval_date', new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0])
        .order('eval_date', { ascending: false }),
    ]);

    const affinity = stateRes.data?.affinity ?? 0;
    const mode = stateRes.data?.mode ?? 'daily';
    const stageName = stageFromAffinity(affinity);

    // 拉 stage_prompts(简单做法:用一个静态 fallback 表,避免每次都查 DB)
    const STAGE_SNIPPETS: Record<string, { description: string; prompt_snippet: string }> = {
      stranger: { description: '陌生', prompt_snippet: '你与用户刚认识,礼貌、拘谨、不会主动拉近距离。' },
      familiar: { description: '熟悉', prompt_snippet: '你与用户已经很熟了,会主动开玩笑、分享日常、记得她说过的话。' },
      flirtatious: { description: '暧昧', prompt_snippet: '你与用户之间有暧昧情愫。会吃醋、会有肢体接触暗示、会说一些似是而非的话。' },
      intimate: { description: '亲密', prompt_snippet: '你与用户已经确认关系。会直接表达爱意、用昵称、主动亲密、有占有欲但也很宠。' },
    };
    const stage = { stage: stageName, ...STAGE_SNIPPETS[stageName] };

    const user = userRes.data ?? { bio: null, preferred_name: null, occupation: null, age: null, mbti: null };

    const recentReasons = (reasonsRes.data || [])
      .filter(r => r.reason)
      .map(r => ({ date: r.eval_date, reason: r.reason! }));

    const enhancedPrompt = assemblePrivateChatSystemPrompt({
      character,
      user,
      stage,
      mode,
      affinity,
      extras: (extrasRes.data || []) as any,
      recentReasons,
    });

    // 3. 获取最近的历史消息(私聊,限定 user_id)
    const { data: history } = await supabase
      .from('messages')
      .select('*')
      .eq('character_id', characterId)
      .eq('user_id', userId)
      .is('group_id', null)
      .order('created_at', { ascending: false })
      .limit(MAX_CONTEXT_MESSAGES);

    // 过滤掉空消息(防止 LLM API 报错)
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

    // 6. 保存到数据库(带 user_id)
    if (saveToMemory && aiResponse && aiResponse.trim() !== '') {
      await supabase.from('messages').insert([
        {
          character_id: characterId,
          user_id: userId,
          role: 'user',
          content,
          sender_type: 'user',
          sender_name: '我',
        },
        {
          character_id: characterId,
          user_id: userId,
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

// 获取历史消息(限定当前用户)
router.get('/:characterId/messages', async (req, res) => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabaseAdmin();
    const { characterId } = req.params;
    const { limit = 50, before } = req.query;

    let query = supabase
      .from('messages')
      .select('*')
      .eq('character_id', characterId)
      .eq('user_id', userId)
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

// 清除聊天记录(限定当前用户)
router.delete('/:characterId/messages', async (req, res) => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabaseAdmin();
    const { characterId } = req.params;

    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('character_id', characterId)
      .eq('user_id', userId)
      .is('group_id', null);

    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 流式发送消息(SSE)——前端 chatApi.sendStream 用
router.post('/stream', async (req, res: Response) => {
  const userId = req.user!.id;
  const supabase = getSupabaseAdmin();
  const { characterId, content, model, saveToMemory = true } = req.body;

  if (!characterId || !content) {
    return res.status(400).json({ success: false, error: 'characterId 和 content 必填' });
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // 禁用 nginx buffering
  res.flushHeaders();

  const sendEvent = (obj: any) => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };

  try {
    // 1. 校验角色可见性
    const { data: character, error: charError } = await supabase
      .from('characters')
      .select('*')
      .eq('id', characterId)
      .or(`user_id.eq.${userId},is_preset.eq.true`)
      .single();
    if (charError || !character) {
      sendEvent({ error: '角色不存在' });
      return res.end();
    }

    // 2. 拉 user profile / state / extras / reasons(同 POST /)
    const [userRes, stateRes, extrasRes, reasonsRes] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('user_character_state').select('*').eq('user_id', userId).eq('character_id', characterId).maybeSingle(),
      supabase.from('character_extras').select('*').eq('character_id', characterId).eq('user_id', userId).order('created_at', { ascending: true }),
      supabase.from('affinity_evaluations').select('eval_date, reason').eq('user_id', userId).eq('character_id', characterId)
        .gte('eval_date', new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0])
        .order('eval_date', { ascending: false }),
    ]);

    const affinity = stateRes.data?.affinity ?? 0;
    const mode = stateRes.data?.mode ?? 'daily';
    const stageName = stageFromAffinity(affinity);
    const STAGE_SNIPPETS: Record<string, { description: string; prompt_snippet: string }> = {
      stranger: { description: '陌生', prompt_snippet: '你与用户刚认识,礼貌、拘谨、不会主动拉近距离。' },
      familiar: { description: '熟悉', prompt_snippet: '你与用户已经很熟了,会主动开玩笑、分享日常、记得她说过的话。' },
      flirtatious: { description: '暧昧', prompt_snippet: '你与用户之间有暧昧情愫。会吃醋、会有肢体接触暗示、会说一些似是而非的话。' },
      intimate: { description: '亲密', prompt_snippet: '你与用户已经确认关系。会直接表达爱意、用昵称、主动亲密、有占有欲但也很宠。' },
    };
    const stage = { stage: stageName, ...STAGE_SNIPPETS[stageName] };
    const user = userRes.data ?? { bio: null, preferred_name: null, occupation: null, age: null, mbti: null };
    const recentReasons = (reasonsRes.data || []).filter(r => r.reason).map(r => ({ date: r.eval_date, reason: r.reason! }));

    const enhancedPrompt = assemblePrivateChatSystemPrompt({
      character, user, stage, mode, affinity,
      extras: (extrasRes.data || []) as any,
      recentReasons,
    });

    // 3. 拉历史消息
    const { data: history } = await supabase
      .from('messages')
      .select('*')
      .eq('character_id', characterId)
      .eq('user_id', userId)
      .is('group_id', null)
      .order('created_at', { ascending: false })
      .limit(MAX_CONTEXT_MESSAGES);
    const validHistory = (history || []).filter(m => m.content && m.content.trim() !== '');
    const contextMessages: ChatMessageItem[] = validHistory.reverse().map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
      senderName: m.sender_name || undefined,
    }));
    contextMessages.push({ role: 'user', content });

    // 4. 推送 character meta
    sendEvent({
      meta: {
        character: { id: character.id, name: character.name, avatar: character.avatar },
        userMessage: content,
      },
    });

    // 5. 流式 LLM 调用,逐 chunk 推送
    let aiResponse = '';
    try {
      for await (const delta of streamChat({
        model: (model as LLMProvider) || 'kimi',
        messages: [
          { role: 'system', content: enhancedPrompt },
          ...contextMessages,
        ],
      })) {
        aiResponse += delta;
        sendEvent({ delta });
      }
    } catch (e: any) {
      sendEvent({ error: 'LLM 流式调用失败: ' + e.message });
      return res.end();
    }

    // 6. 保存到 DB
    if (saveToMemory && aiResponse.trim()) {
      await supabase.from('messages').insert([
        { character_id: characterId, user_id: userId, role: 'user', content, sender_type: 'user', sender_name: '我' },
        { character_id: characterId, user_id: userId, role: 'assistant', content: aiResponse, sender_type: 'character', sender_name: character.name },
      ]);
    }

    // 7. done 事件
    sendEvent({ done: true });
    res.end();
  } catch (e: any) {
    sendEvent({ error: e.message });
    res.end();
  }
});

export default router;
