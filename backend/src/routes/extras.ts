import { Router } from 'express';
import { getSupabaseAdmin } from '../config/supabase';

const router = Router();

// 获取角色的所有补充资料
router.get('/character/:characterId', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { characterId } = req.params;

    const { data, error } = await supabase
      .from('character_extras')
      .select('*')
      .eq('character_id', characterId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 创建补充资料
router.post('/', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { character_id, type, title, content } = req.body;

    if (!character_id || !type || !title || !content) {
      return res.status(400).json({ success: false, error: 'character_id, type, title, content 必填' });
    }

    if (!['note', 'story', 'relationship', 'memory_hint'].includes(type)) {
      return res.status(400).json({ success: false, error: 'type 必须是 note/story/relationship/memory_hint' });
    }

    const { data, error } = await supabase
      .from('character_extras')
      .insert({ character_id, type, title, content })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新补充资料
router.put('/:id', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = req.params;
    const updates = req.body;

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

// 删除补充资料
router.delete('/:id', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = req.params;

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
