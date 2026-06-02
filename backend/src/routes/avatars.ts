import { Router } from 'express';
import { getSupabaseAdmin } from '../config/supabase';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// 上传头像到 Supabase Storage
router.post('/upload/:characterId', upload.single('file'), async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { characterId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, error: '没有文件' });
    }

    if (file.size > 2 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: '文件超过 2MB' });
    }

    // 生成文件名
    const ext = file.mimetype.split('/')[1] || 'jpg';
    const fileName = `${characterId}-${Date.now()}.${ext}`;

    // 上传到 Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // 获取公开 URL
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;

    // 更新角色的 avatar 字段
    const { data: charData, error: updateError } = await supabase
      .from('characters')
      .update({ avatar: publicUrl })
      .eq('id', characterId)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({
      success: true,
      data: {
        url: publicUrl,
        character: charData,
      },
    });
  } catch (error: any) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
