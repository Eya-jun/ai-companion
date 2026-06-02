import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  signupUser,
  loginUser,
  refreshSession,
  logoutUser,
  getProfile,
  claimLegacy,
} from '../services/supabase-user';

const router = Router();

router.post('/signup', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password || !displayName) {
      return res.status(400).json({ success: false, error: 'email, password, displayName 必填' });
    }
    const result = await signupUser(email, password, displayName);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'email, password 必填' });
    }
    const result = await loginUser(email, password);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(401).json({ success: false, error: e.message });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ success: false, error: 'refreshToken 必填' });
    const result = await refreshSession(refreshToken);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(401).json({ success: false, error: e.message });
  }
});

router.post('/logout', async (req, res) => {
  const authHeader = req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  await logoutUser(token);
  res.json({ success: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const authHeader = req.header('Authorization')!;
  const token = authHeader.slice(7);
  try {
    const profile = await getProfile(token);
    res.json({ success: true, data: profile });
  } catch (e: any) {
    res.status(401).json({ success: false, error: e.message });
  }
});

router.post('/claim-legacy', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const result = await claimLegacy(userId);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
