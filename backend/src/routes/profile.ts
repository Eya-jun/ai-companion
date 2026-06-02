import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import { getSupabaseAdmin } from '../config/supabase';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// GET /api/profile - 返回当前用户的 user_profiles
router.get('/', requireAuth, async (req, res) => {
  const userId = (req as any).user.id;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, data });
});

// PUT /api/profile - 更新当前用户的 user_profiles
router.put('/', requireAuth, async (req, res) => {
  const userId = (req as any).user.id;
  const { display_name, preferred_name, gender, age, occupation, mbti, bio } = req.body;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('user_profiles')
    .update({
      display_name,
      preferred_name,
      gender,
      age,
      occupation,
      mbti,
      bio,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select()
    .single();
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, data });
});

// POST /api/profile/avatar - 上传头像(按 user_id 分目录)
router.post('/avatar', requireAuth, upload.single('file'), async (req, res) => {
  const userId = (req as any).user.id;
  const file = req.file;
  if (!file) return res.status(400).json({ success: false, error: '没有文件' });
  if (file.size > 2 * 1024 * 1024) return res.status(400).json({ success: false, error: '文件超过 2MB' });

  const ext = file.mimetype.split('/')[1] || 'jpg';
  const fileName = `${userId}/${Date.now()}.${ext}`;

  const supabase = getSupabaseAdmin();
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: true });
  if (uploadError) return res.status(500).json({ success: false, error: uploadError.message });

  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);

  const { data, error: updateError } = await supabase
    .from('user_profiles')
    .update({ avatar_url: urlData.publicUrl, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select()
    .single();
  if (updateError) return res.status(500).json({ success: false, error: updateError.message });

  res.json({ success: true, data: { url: urlData.publicUrl, profile: data } });
});

export default router;
