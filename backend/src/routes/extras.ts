import { Router } from 'express';
import { getSupabaseAdmin } from '../config/supabase';

const router = Router();

// 列出某角色的所有补充资料(限定当前用户)
router.get('/character/:characterId', async (req, res) => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabaseAdmin();
    const { characterId } = req.params;

    const { data, error } = await supabase
      .from('character_extras')
      .select('*')
      .eq('character_id', characterId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 创建补充资料(自动绑定当前用户)
router.post('/', async (req, res) => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabaseAdmin();
    const { character_id, type, title, content } = req.body;

    if (!character_id || !type || !title || !content) {
      return res.status(400).json({ success: false, error: 'character_id, type, title, content 必填' });
    }
    if (!['note', 'story', 'relationship', 'memory_hint'].includes(type)) {
      return res.status(400).json({ success: false, error: 'type 必须是 note/story/relationship/memory_hint' });
    }

    // 校验角色可见性:必须是预设或属于当前用户
    const { data: ch } = await supabase
      .from('characters')
      .select('user_id, is_preset')
      .eq('id', character_id)
      .single();
    if (!ch || (!ch.is_preset && ch.user_id !== userId)) {
      return res.status(404).json({ success: false, error: '角色不存在' });
    }

    const { data, error } = await supabase
      .from('character_extras')
      .insert({ character_id, type, title, content, user_id: userId })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新补充资料(校验所有权)
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabaseAdmin();
    const { id } = req.params;

    const { data: existing } = await supabase
      .from('character_extras')
      .select('user_id')
      .eq('id', id)
      .single();
    if (!existing || existing.user_id !== userId) {
      return res.status(404).json({ success: false, error: '资料不存在' });
    }

    const updates = req.body;
    delete updates.user_id; // 不允许改 user_id

    const { data, error } = await supabase
      .from('character_extras')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除补充资料(校验所有权)
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabaseAdmin();
    const { id } = req.params;

    const { data: existing } = await supabase
      .from('character_extras')
      .select('user_id')
      .eq('id', id)
      .single();
    if (!existing || existing.user_id !== userId) {
      return res.status(404).json({ success: false, error: '资料不存在' });
    }

    const { error } = await supabase
      .from('character_extras')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
