import { Router } from 'express';
import { getSupabaseAdmin } from '../config/supabase';
import { PRESET_CHARACTERS } from '../data/presets';

const router = Router();

// 获取所有角色
router.get('/', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .order('is_preset', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取单个角色
router.get('/:id', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = req.params;
    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: '角色不存在' });

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 创建自定义角色
router.post('/', async (req, res) => {
  try {
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
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新角色
router.put('/:id', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = req.params;
    const updates = req.body;

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

// 删除角色（不能删除预设角色）
router.delete('/:id', async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = req.params;

    // 检查是否是预设
    const { data: character } = await supabase
      .from('characters')
      .select('is_preset')
      .eq('id', id)
      .single();

    if (character?.is_preset) {
      return res.status(403).json({ success: false, error: '预设角色不能删除' });
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

// 初始化预设角色（启动时调用）
export async function initPresetCharacters() {
  const supabase = getSupabaseAdmin();

  for (const preset of PRESET_CHARACTERS) {
    // 检查是否已存在同名预设角色
    const { data: existing } = await supabase
      .from('characters')
      .select('id')
      .eq('name', preset.name)
      .eq('is_preset', true)
      .single();

    if (!existing) {
      await supabase.from('characters').insert(preset);
      console.log(`✅ 初始化预设角色: ${preset.name}`);
    } else {
      // 更新预设角色的内容（保持最新）
      await supabase
        .from('characters')
        .update({
          description: preset.description,
          system_prompt: preset.system_prompt,
          avatar: preset.avatar,
          greeting: preset.greeting,
        })
        .eq('id', existing.id);
      console.log(`🔄 更新预设角色: ${preset.name}`);
    }
  }
}

export default router;
