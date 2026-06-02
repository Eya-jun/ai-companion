import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import { getSupabaseAdmin } from '../config/supabase';

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

// GET /api/profile - 返回当前用户的 user_profiles
router.get('/', requireAuth, async (req, res) => {
  const userId = req.user!.id;
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
  const userId = req.user!.id;
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
  const userId = req.user!.id;
  const file = req.file;
  if (!file) return res.status(400).json({ success: false, error: '没有文件' });
  // multer 的 fileFilter 已经挡过 mimetype,这里只兜底 size
  if (file.size > 2 * 1024 * 1024) return res.status(400).json({ success: false, error: '文件超过 2MB' });

  // 用白名单强制 ext(不直接用 client 送的 mimetype,避免 html/svg 等伪装)
  const safeExt = file.mimetype === 'image/png' ? 'png'
    : file.mimetype === 'image/webp' ? 'webp'
    : 'jpg';
  const fileName = `${userId}/${Date.now()}.${safeExt}`;

  const supabase = getSupabaseAdmin();
  // 强制 contentType 为 image/jpeg,避免 storage 存用户伪造的 content-type
  const safeContentType = file.mimetype === 'image/png' ? 'image/png'
    : file.mimetype === 'image/webp' ? 'image/webp'
    : 'image/jpeg';
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(fileName, file.buffer, { contentType: safeContentType, upsert: true });
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
