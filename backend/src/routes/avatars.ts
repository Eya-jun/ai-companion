import { Router } from 'express';
import { getSupabaseAdmin } from '../config/supabase';
import multer from 'multer';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('仅支持图片文件'));
    }
    cb(null, true);
  },
});

// 上传角色头像(按 user_id 分目录,避免不同用户的角色头像冲突)
router.post('/upload/:characterId', upload.single('file'), async (req, res) => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabaseAdmin();
    const { characterId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, error: '没有文件' });
    }
    if (file.size > 2 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: '文件超过 2MB' });
    }

    // 校验角色所有权(预设也允许改,改完所有用户都看到——预设本身是全用户共享的)
    const { data: character } = await supabase
      .from('characters')
      .select('user_id, is_preset')
      .eq('id', characterId)
      .single();
    if (!character) return res.status(404).json({ success: false, error: '角色不存在' });
    if (!character.is_preset && character.user_id !== userId) {
      return res.status(403).json({ success: false, error: '无权修改此角色' });
    }

    // 文件名:按 user_id 分目录
    const safeExt = file.mimetype === 'image/png' ? 'png'
      : file.mimetype === 'image/webp' ? 'webp'
      : 'jpg';
    const fileName = `${userId}/${characterId}-${Date.now()}.${safeExt}`;

    // 强制 contentType 为白名单之一
    const safeContentType = file.mimetype === 'image/png' ? 'image/png'
      : file.mimetype === 'image/webp' ? 'image/webp'
      : 'image/jpeg';
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file.buffer, {
        contentType: safeContentType,
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
    const publicUrl = urlData.publicUrl;

    const { data: charData, error: updateError } = await supabase
      .from('characters')
      .update({ avatar: publicUrl })
      .eq('id', characterId)
      .select()
      .single();
    if (updateError) throw updateError;

    res.json({ success: true, data: { url: publicUrl, character: charData } });
  } catch (error: any) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
