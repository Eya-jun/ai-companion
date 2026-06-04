import { Router } from 'express';
import { getSupabaseAdmin } from '../config/supabase';
import { PresetCharacter } from '../data/presets';

const router = Router();

// 列出所有对当前用户可见的角色:预设(全用户共享) + 当前用户的自定义角色
// 额外附带最近一条消息预览 / 时间戳 / 在线状态 / 未读数,供首页消息列表使用。
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabaseAdmin();

    // 1) 基础角色列表
    const { data: chars, error } = await supabase
      .from('characters')
      .select('*')
      .or(`user_id.eq.${userId},is_preset.eq.true`)
      .order('is_preset', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) throw error;

    const charList = chars || [];
    const charIds = charList.map((c: any) => c.id);

    // 2) 当前用户对每个角色的最近一条消息(1v1 单聊,排除群消息)
    //    用 IN + DESC 一次拉,然后在内存里按 character_id 取第一条(时间最新)。
    const { data: latestMsgs } = await supabase
      .from('messages')
      .select('character_id, content, role, created_at')
      .eq('user_id', userId)
      .is('group_id', null)
      .in(
        'character_id',
        charIds.length ? charIds : ['00000000-0000-0000-0000-000000000000']
      )
      .order('created_at', { ascending: false });

    const latestMap: Record<string, any> = {};
    for (const m of latestMsgs || []) {
      if (!latestMap[m.character_id]) latestMap[m.character_id] = m;
    }

    // 3) 在线状态:24 小时内有过消息
    const onlineThreshold = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const onlineSet = new Set(
      (latestMsgs || [])
        .filter((m: any) => m.created_at > onlineThreshold)
        .map((m: any) => m.character_id)
    );

    // 4) 未读数:目前固定 0
    //    TODO: 真正实现需要:
    //    - 在 messages 上加 read_at / last_read_message_id 之类的状态
    //    - 或者新建 read_messages(user_id, character_id, last_read_at) 表
    //    - 当前 schema 没有"已读"概念,先返回 0 不影响 last_message / time / online 的展示。
    const unread = (cid: string) => 0;

    const enriched = charList.map((c: any) => {
      const lm = latestMap[c.id];
      return {
        ...c,
        last_message: lm ? (lm.content || '').slice(0, 30) : null,
        last_message_at: lm ? lm.created_at : null,
        unread_count: unread(c.id),
        online: onlineSet.has(c.id),
      };
    });

    res.json({ success: true, data: enriched });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取单个角色:必须是预设,或是当前用户的自定义
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabaseAdmin();
    const { id } = req.params;
    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: '角色不存在' });
    // 不是预设且不属于当前用户 → 视为不存在
    if (!data.is_preset && data.user_id !== userId) {
      return res.status(404).json({ success: false, error: '角色不存在' });
    }

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 创建自定义角色:自动绑定到当前用户
router.post('/', async (req, res) => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabaseAdmin();
    const { name, description, system_prompt, avatar, greeting } = req.body;

    if (!name || !system_prompt) {
      return res.status(400).json({ success: false, error: 'name 和 system_prompt 必填' });
    }

    const { data, error } = await supabase
      .from('characters')
      .insert({
        name,
        description: description || '',
        system_prompt,
        avatar: avatar || '👤',
        is_preset: false,
        greeting: greeting || '你好。',
        user_id: userId,
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新角色:必须是当前用户的自定义角色
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabaseAdmin();
    const { id } = req.params;
    const updates = req.body;

    // 先校验所有权
    const { data: existing } = await supabase
      .from('characters')
      .select('user_id, is_preset')
      .eq('id', id)
      .single();
    if (!existing || existing.is_preset || existing.user_id !== userId) {
      return res.status(404).json({ success: false, error: '角色不存在' });
    }

    // 不允许通过 PUT 改 user_id / is_preset
    delete updates.user_id;
    delete updates.is_preset;

    const { data, error } = await supabase
      .from('characters')
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

// 删除角色:预设禁止,自定义必须是当前用户的
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabaseAdmin();
    const { id } = req.params;

    const { data: character } = await supabase
      .from('characters')
      .select('user_id, is_preset')
      .eq('id', id)
      .single();

    if (!character) return res.status(404).json({ success: false, error: '角色不存在' });
    if (character.is_preset) {
      return res.status(403).json({ success: false, error: '预设角色不能删除' });
    }
    if (character.user_id !== userId) {
      return res.status(403).json({ success: false, error: '无权删除此角色' });
    }

    const { error } = await supabase
      .from('characters')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 初始化预设角色(启动时 + dev 模式文件变化时调用) — 预设保持 user_id=NULL,所有用户共享
// 入参 PRESETS 由调用方从 backend/data/characters/*.md 加载,这样内容/代码分离
export async function initPresetCharacters(PRESETS: PresetCharacter[]) {
  const supabase = getSupabaseAdmin();

  for (const preset of PRESETS) {
    const { data: existing } = await supabase
      .from('characters')
      .select('id')
      .eq('name', preset.name)
      .eq('is_preset', true)
      .single();

    if (!existing) {
      // 显式不传 user_id,留 NULL
      await supabase.from('characters').insert({
        name: preset.name,
        description: preset.description,
        system_prompt: preset.system_prompt,
        avatar: preset.avatar,
        is_preset: true,
        greeting: preset.greeting,
        user_id: null,
      });
      console.log(`✅ 初始化预设角色: ${preset.name}`);
    } else {
      // 关键:update 时 **不** 覆盖 avatar 字段,保留用户上传过的头像。
      // 之前这里强制写 avatar: preset.avatar,每次后端启动都把用户头像重置回 emoji。
      await supabase
        .from('characters')
        .update({
          description: preset.description,
          system_prompt: preset.system_prompt,
          greeting: preset.greeting,
        })
        .eq('id', existing.id);
      console.log(`🔄 更新预设角色: ${preset.name}`);
    }
  }
}

export default router;
