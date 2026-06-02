# User Profile + Affinity + Memory 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 AI 伴侣聊天应用上,加入 Supabase Auth 用户体系、用户卡、好感度(攻略)系统、可编辑记忆,共拆 4 个 PR 落地,每个 PR 独立可跑可测。

**Architecture:**
- 后端 Express 5 + TypeScript 维持不变,加 `requireAuth` 中间件验 Supabase JWT;所有业务表加 `user_id` 隔离
- 前端 React 19 + Vite,加 `AuthContext` + `RequireAuth` 守卫 + 新页面(Login/Signup/Profile/Memories)
- 数据隔离严格按 spec §3.3:角色本体共享,关系数据 per-user
- 每日 LLM 评估(记忆+好感度合一)由 `node-cron` 每晚 2 点跑

**Tech Stack:** Supabase Auth(JS SDK v2) + React Router 7 + Context API + node-cron + supertest(后端测试) + vitest + @testing-library/react(前端测试)

**Spec 参考:** `docs/superpowers/specs/2026-06-02-user-profile-affinity-and-memory-design.md`

**通用约定:**
- 全部 commit 信息用中文(项目当前规范)
- 每个 Task 结束都要 `git add` + `git commit`(项目还不是 git 仓库,见 PR1 Task 1.13)
- 路径全部相对项目根 `/Users/eya/Desktop/AI chat`
- 看到"← 见 §X"指回 spec 章节

---

# PR1: Auth + User Card(地基)

**目标:** Supabase Auth 接入、用户卡 CRUD、Login/Signup/Profile 页、迁移现有数据

**前置:** 现有 dev 环境能跑 (`backend` `npm run dev` + `frontend` `npm run dev`),Supabase 项目已存在

**改完验收:**
- 任何 `/api/*`(health 除外)在没 token 时返回 401
- 能注册 → 自动建 user_profiles 行 → 跳 /profile/setup → 填完跳 /
- 现有数据通过 `/api/auth/claim-legacy` 克隆到新用户
- `tsc -b` 后端 + 前端都 0 错

## File 地图(本 PR 新增/修改)

```
backend/
  src/
    middleware/
      auth.ts               -- 新增(替代之前的 internalTokenAuth)
    routes/
      auth.ts               -- 新增
      profile.ts            -- 新增
    services/
      supabase-user.ts      -- 新增
    config/
      env.ts                -- 不变
    index.ts                -- 改:挂 authRouter, profileRouter
  supabase/
    migrations/
      20260602_pr1_user_profiles.sql  -- 新增(SQL 迁移)
  tests/
    auth.test.ts            -- 新增

frontend/
  src/
    api/
      types.ts              -- 改:加 UserProfile, AuthSession
      client.ts             -- 改:加 token 头
    contexts/
      AuthContext.tsx       -- 新增
    components/
      RequireAuth.tsx       -- 新增
      AppHeader.tsx         -- 新增
    pages/
      Login.tsx             -- 新增
      Signup.tsx            -- 新增
      UserProfile.tsx       -- 新增
      UserProfileSetup.tsx  -- 新增
    App.tsx                 -- 改:AuthProvider + RequireAuth 守卫
    main.tsx                -- 不变
  tests/
    auth.test.tsx           -- 新增
```

---

## Task 1.1: 加 supertest 依赖 + 初始化 git

**Files:** `backend/package.json`, `backend/jest.config.js`(或 `vitest.config.ts`), 根 `.gitignore`

- [ ] **Step 1: 装 supertest**

```bash
cd backend
npm install -D supertest @types/supertest vitest
```

- [ ] **Step 2: 写 vitest 配置 `backend/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: 改 `backend/package.json` scripts**

加:
```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```

保留 `dev` / `build` / `start` / `nodemon` 等

- [ ] **Step 4: 初始化 git 仓库**

```bash
cd "/Users/eya/Desktop/AI chat"
git init
git config user.email "dev@local"
git config user.name "dev"
```

- [ ] **Step 5: 第一次 commit**

```bash
cd "/Users/eya/Desktop/AI chat"
git add -A
git commit -m "chore: 初始化仓库 + 现有代码"
```

---

## Task 1.2: SQL 迁移——加 user_profiles 表

**Files:** `backend/supabase/migrations/20260602_pr1_user_profiles.sql`

- [ ] **Step 1: 写迁移 SQL**

```sql
-- PR1: 加 user_profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  preferred_name TEXT,
  gender TEXT,
  age INT,
  occupation TEXT,
  mbti TEXT,
  bio TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 触发器:auth.users 新建时自动建 profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS 策略:用户只能看/改自己的 profile
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- 允许 service_role 读写(后端用)
CREATE POLICY "Service role full access on user_profiles" ON user_profiles
  FOR ALL USING (auth.role() = 'service_role');
```

- [ ] **Step 2: 手动跑迁移(本项目无 migration runner,直接在 Supabase SQL Editor 跑)**

- [ ] **Step 3: commit**

```bash
git add backend/supabase/migrations/
git commit -m "feat(db): PR1 加 user_profiles 表 + 自动创建 trigger"
```

---

## Task 1.3: 后端 auth middleware

**Files:** `backend/src/middleware/auth.ts`(覆盖之前的 internalTokenAuth)

- [ ] **Step 1: 写测试 `backend/tests/middleware-auth.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest';
import { requireAuth, optionalAuth } from '../src/middleware/auth';

describe('auth middleware', () => {
  it('requireAuth 返回 401 当没有 Authorization 头', () => {
    const req = { header: vi.fn().mockReturnValue(undefined) } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('optionalAuth 调用 next 当没有 token', () => {
    const req = { header: vi.fn().mockReturnValue(undefined) } as any;
    const res = {} as any;
    const next = vi.fn();
    optionalAuth(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 跑测试看 fail**

```bash
cd backend
npm test -- middleware-auth
```

Expected: FAIL(模块未找到)

- [ ] **Step 3: 实现 `backend/src/middleware/auth.ts`**

```ts
import type { Request, Response, NextFunction } from 'express';
import { getSupabaseClient } from '../config/supabase';

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: '未授权: 缺少 token' });
  }
  const token = authHeader.slice(7);

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ success: false, error: '未授权: token 无效' });
    }
    (req as any).user = { id: data.user.id, email: data.user.email };
    next();
  } catch (err: any) {
    return res.status(500).json({ success: false, error: '鉴权失败: ' + err.message });
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }
  const token = authHeader.slice(7);
  const supabase = getSupabaseClient();
  supabase.auth.getUser(token)
    .then(({ data }) => {
      if (data.user) (req as any).user = { id: data.user.id, email: data.user.email };
      next();
    })
    .catch(() => next());
}
```

- [ ] **Step 4: 跑测试看 pass**

```bash
npm test -- middleware-auth
```

Expected: PASS(2/2)

- [ ] **Step 5: commit**

```bash
git add backend/src/middleware/auth.ts backend/tests/middleware-auth.test.ts backend/package.json backend/vitest.config.ts
git commit -m "feat(auth): 加 requireAuth + optionalAuth 中间件"
```

---

## Task 1.4: 后端 auth 路由

**Files:** `backend/src/routes/auth.ts`, `backend/src/index.ts`

- [ ] **Step 1: 写测试 `backend/tests/auth-route.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRouter from '../src/routes/auth';

vi.mock('../src/services/supabase-user', () => ({
  signupUser: vi.fn(async (email: string, password: string, name: string) => ({
    accessToken: 'at-' + email,
    refreshToken: 'rt-' + email,
    user: { id: 'u-' + email, email, displayName: name },
  })),
  loginUser: vi.fn(async (email: string, password: string) => ({
    accessToken: 'at-' + email,
    refreshToken: 'rt-' + email,
    user: { id: 'u-' + email, email },
  })),
  refreshSession: vi.fn(async (rt: string) => ({ accessToken: 'at-' + rt, refreshToken: 'rt-' + rt })),
  logoutUser: vi.fn(async () => {}),
  getProfile: vi.fn(async (token: string) => ({
    user_id: 'u-1', email: 'a@b.com', display_name: 'a',
  })),
}));

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

describe('POST /api/auth/signup', () => {
  it('201 + 返回 tokens', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'a@b.com', password: 'pw', displayName: 'Alice' });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBe('at-a@b.com');
  });

  it('400 当缺字段', async () => {
    const res = await request(app).post('/api/auth/signup').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('200 + tokens', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com', password: 'pw' });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBe('at-a@b.com');
  });
});

describe('GET /api/auth/me', () => {
  it('401 没 token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('200 + profile 有 token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer xxx');
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('a@b.com');
  });
});
```

- [ ] **Step 2: 跑测试 fail**

```bash
npm test -- auth-route
```

- [ ] **Step 3: 写 service `backend/src/services/supabase-user.ts`**

```ts
import { getSupabaseAdmin, getSupabaseClient } from '../config/supabase';

export async function signupUser(email: string, password: string, displayName: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error) throw new Error('注册失败: ' + error.message);
  const user = data.user!;
  // 触发器会自动建 user_profiles,这里也手动 upsert 一次以防万一
  await supabase.from('user_profiles').upsert({
    user_id: user.id, display_name: displayName,
  });
  // 立即签发 token(避免让用户去收件箱点验证)
  const { data: session, error: signInError } = await getSupabaseClient().auth.signInWithPassword({ email, password });
  if (signInError) throw new Error('注册后登录失败: ' + signInError.message);
  return {
    accessToken: session!.access_token,
    refreshToken: session!.refresh_token,
    user: { id: user.id, email: user.email, displayName },
  };
}

export async function loginUser(email: string, password: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error('登录失败: ' + error.message);
  return {
    accessToken: data.session!.access_token,
    refreshToken: data.session!.refresh_token,
    user: { id: data.user!.id, email: data.user!.email },
  };
}

export async function refreshSession(refreshToken: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error) throw new Error('刷新失败: ' + error.message);
  return {
    accessToken: data.session!.access_token,
    refreshToken: data.session!.refresh_token,
  };
}

export async function logoutUser(_accessToken: string) {
  // supabase-js 没有"撤销单个 token"的 API,客户端清 localStorage 即可
  // 服务端可以做 blacklist,但本项目跳过
  return;
}

export async function getProfile(accessToken: string) {
  const supabase = getSupabaseClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser(accessToken);
  if (userErr || !userData.user) throw new Error('token 无效');
  const { data: profile, error: profErr } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userData.user.id)
    .single();
  if (profErr) throw new Error('读取 profile 失败: ' + profErr.message);
  return profile;
}
```

- [ ] **Step 4: 写路由 `backend/src/routes/auth.ts`**

```ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { signupUser, loginUser, refreshSession, logoutUser, getProfile } from '../services/supabase-user';

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

export default router;
```

- [ ] **Step 5: 在 `backend/src/index.ts` 挂载**

在已有 import 块加:
```ts
import authRouter from './routes/auth';
```

在 `app.use('/api/avatars', avatarsRouter);` 之后加:
```ts
app.use('/api/auth', authRouter);
```

- [ ] **Step 6: 跑测试 pass**

```bash
npm test -- auth-route
```

Expected: PASS

- [ ] **Step 7: tsc 检查**

```bash
cd backend && ./node_modules/.bin/tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 8: commit**

```bash
git add backend/src/routes/auth.ts backend/src/services/supabase-user.ts backend/src/index.ts backend/tests/auth-route.test.ts
git commit -m "feat(auth): 加 signup/login/refresh/logout/me 端点"
```

---

## Task 1.5: 后端 profile 路由(读 / 改)

**Files:** `backend/src/routes/profile.ts`, `backend/src/index.ts`

- [ ] **Step 1: 写路由 `backend/src/routes/profile.ts`**

```ts
import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import { getSupabaseAdmin } from '../config/supabase';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

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

router.put('/', requireAuth, async (req, res) => {
  const userId = (req as any).user.id;
  const { display_name, preferred_name, gender, age, occupation, mbti, bio } = req.body;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('user_profiles')
    .update({
      display_name, preferred_name, gender, age, occupation, mbti, bio,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select()
    .single();
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, data });
});

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
```

- [ ] **Step 2: 挂载到 `backend/src/index.ts`**

加 import:
```ts
import profileRouter from './routes/profile';
```

在 `app.use('/api/auth', authRouter);` 之后加:
```ts
app.use('/api/profile', profileRouter);
```

- [ ] **Step 3: tsc 检查 + commit**

```bash
./node_modules/.bin/tsc --noEmit
git add backend/src/routes/profile.ts backend/src/index.ts
git commit -m "feat(profile): GET/PUT /api/profile + 头像上传"
```

---

## Task 1.6: 前端——加 token 存储 + AuthContext

**Files:** `frontend/src/api/client.ts`, `frontend/src/api/types.ts`, `frontend/src/contexts/AuthContext.tsx`

- [ ] **Step 1: 扩展 `frontend/src/api/types.ts`**

在文件末尾加:
```ts
export interface UserProfile {
  user_id: string;
  email?: string;
  display_name: string | null;
  avatar_url: string | null;
  preferred_name: string | null;
  gender: string | null;
  age: number | null;
  occupation: string | null;
  mbti: string | null;
  bio: string | null;
  updated_at: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; displayName?: string };
}
```

- [ ] **Step 2: 改 `frontend/src/api/client.ts` 加 token 工具 + 改 `request()`**

在 `const INTERNAL_TOKEN = import.meta.env.VITE_INTERNAL_TOKEN || '';` 之后加:
```ts
const TOKEN_KEY = 'auth_session';

export function getStoredSession(): AuthSession | null {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function setStoredSession(session: AuthSession | null) {
  if (session) localStorage.setItem(TOKEN_KEY, JSON.stringify(session));
  else localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const session = getStoredSession();
  const headers: Record<string, string> = {};
  if (session?.accessToken) headers['Authorization'] = `Bearer ${session.accessToken}`;
  if (INTERNAL_TOKEN) headers['X-Internal-Token'] = INTERNAL_TOKEN;
  return headers;
}
```

改 `request()` 函数,在 `headers: { 'Content-Type': 'application/json', ...authHeaders(), ...options.headers }` 已经有 `authHeaders()` 调用——确保它从 const 移到调用 `getStoredSession` 之后的位置:

```ts
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...options.headers,
    },
    ...options,
  });

  if (res.status === 401) {
    setStoredSession(null);
    window.location.hash = '#/login';
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || '请求失败');
  }
  return res.json();
}
```

加 auth 相关 API:
```ts
export const authApi = {
  signup: (email: string, password: string, displayName: string) =>
    request<{ success: boolean; data: AuthSession }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    }),
  login: (email: string, password: string) =>
    request<{ success: boolean; data: AuthSession }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<{ success: boolean; data: UserProfile }>('/auth/me'),
  logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),
};

export const profileApi = {
  get: () => request<{ success: boolean; data: UserProfile }>('/profile'),
  update: (data: Partial<UserProfile>) =>
    request<{ success: boolean; data: UserProfile }>('/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  uploadAvatar: async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const session = getStoredSession();
    const res = await fetch(`${API_BASE}/profile/avatar`, {
      method: 'POST',
      body: fd,
      headers: {
        ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
        ...(INTERNAL_TOKEN ? { 'X-Internal-Token': INTERNAL_TOKEN } : {}),
      },
    });
    if (!res.ok) throw new Error('上传失败');
    return res.json();
  },
};
```

最后 `export type` 行加:
```ts
export type { UserProfile, AuthSession };
```

- [ ] **Step 3: 写 `frontend/src/contexts/AuthContext.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authApi, profileApi, getStoredSession, setStoredSession, type UserProfile, type AuthSession } from '../api/client';

interface AuthContextValue {
  session: AuthSession | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => getStoredSession());
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session) {
      profileApi.get()
        .then(r => setProfile(r.data))
        .catch(() => setStoredSession(null))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [session]);

  const login = async (email: string, password: string) => {
    const r = await authApi.login(email, password);
    setStoredSession(r.data);
    setSession(r.data);
  };

  const signup = async (email: string, password: string, displayName: string) => {
    const r = await authApi.signup(email, password, displayName);
    setStoredSession(r.data);
    setSession(r.data);
  };

  const logout = async () => {
    try { await authApi.logout(); } catch {}
    setStoredSession(null);
    setSession(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    const r = await profileApi.get();
    setProfile(r.data);
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    const r = await profileApi.update(data);
    setProfile(r.data);
  };

  return (
    <AuthContext.Provider value={{ session, profile, loading, login, signup, logout, refreshProfile, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内使用');
  return ctx;
}
```

- [ ] **Step 4: 写 `frontend/src/components/RequireAuth.tsx`**

```tsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function RequireAuth() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>加载中...</div>;
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}
```

- [ ] **Step 5: tsc 检查 + commit**

```bash
cd ../frontend
./node_modules/.bin/tsc -b
git add frontend/src/api/client.ts frontend/src/api/types.ts frontend/src/contexts/AuthContext.tsx frontend/src/components/RequireAuth.tsx
git commit -m "feat(frontend): AuthContext + RequireAuth + token 工具"
```

---

## Task 1.7: Login / Signup 页面

**Files:** `frontend/src/pages/Login.tsx`, `frontend/src/pages/Signup.tsx`, `frontend/src/App.tsx`

- [ ] **Step 1: 写 `frontend/src/pages/Login.tsx`**

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: '60px auto', padding: 24 }}>
      <h2>登录</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>邮箱<br />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%', padding: 8 }} />
          </label>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>密码<br />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: 8 }} />
          </label>
        </div>
        {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
        <button type="submit" disabled={loading} style={{ width: '100%', padding: 10 }}>
          {loading ? '登录中...' : '登录'}
        </button>
      </form>
      <p style={{ marginTop: 16, textAlign: 'center' }}>
        还没有账号? <a href="#/signup">注册</a>
      </p>
    </div>
  );
}
```

- [ ] **Step 2: 写 `frontend/src/pages/Signup.tsx`**

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Signup() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signup(email, password, displayName);
      navigate('/profile/setup');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: '60px auto', padding: 24 }}>
      <h2>注册</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>邮箱<br />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%', padding: 8 }} />
          </label>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>密码(至少 6 位)<br />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} style={{ width: '100%', padding: 8 }} />
          </label>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>昵称<br />
            <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} required style={{ width: '100%', padding: 8 }} />
          </label>
        </div>
        {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
        <button type="submit" disabled={loading} style={{ width: '100%', padding: 10 }}>
          {loading ? '注册中...' : '注册'}
        </button>
      </form>
      <p style={{ marginTop: 16, textAlign: 'center' }}>
        已有账号? <a href="#/login">登录</a>
      </p>
    </div>
  );
}
```

- [ ] **Step 3: 改 `frontend/src/App.tsx` 挂载新路由**

完整覆盖为:
```tsx
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import RequireAuth from './components/RequireAuth';
import Home from './pages/Home';
import Chat from './pages/Chat';
import GroupChat from './pages/GroupChat';
import CharacterEdit from './pages/CharacterEdit';
import GroupEdit from './pages/GroupEdit';
import CharacterExtras from './pages/CharacterExtras';
import Login from './pages/Login';
import Signup from './pages/Signup';
import UserProfile from './pages/UserProfile';
import UserProfileSetup from './pages/UserProfileSetup';
import './App.css';

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<Home />} />
            <Route path="/profile" element={<UserProfile />} />
            <Route path="/profile/setup" element={<UserProfileSetup />} />
            <Route path="/chat/:characterId" element={<Chat />} />
            <Route path="/group/:groupId" element={<GroupChat />} />
            <Route path="/character/new" element={<CharacterEdit />} />
            <Route path="/character/:characterId/edit" element={<CharacterEdit />} />
            <Route path="/character/:characterId/extras" element={<CharacterExtras />} />
            <Route path="/group/new" element={<GroupEdit />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
```

- [ ] **Step 4: 占位文件 `UserProfile.tsx` 和 `UserProfileSetup.tsx`(避免 tsc 失败,Task 1.8/1.9 填实)**

```tsx
// UserProfile.tsx
export default function UserProfile() { return <div>用户卡(待 PR1 Task 1.8 实现)</div>; }
```

```tsx
// UserProfileSetup.tsx
export default function UserProfileSetup() { return <div>用户卡引导(待 PR1 Task 1.9 实现)</div>; }
```

- [ ] **Step 5: tsc + commit**

```bash
./node_modules/.bin/tsc -b
git add frontend/src/pages/Login.tsx frontend/src/pages/Signup.tsx frontend/src/pages/UserProfile.tsx frontend/src/pages/UserProfileSetup.tsx frontend/src/App.tsx
git commit -m "feat(frontend): Login/Signup 页 + App 路由加 AuthProvider 守卫"
```

---

## Task 1.8: UserProfile 页(查看/编辑)

**Files:** `frontend/src/pages/UserProfile.tsx`

- [ ] **Step 1: 完整覆盖 `frontend/src/pages/UserProfile.tsx`**

```tsx
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function UserProfile() {
  const { profile, updateProfile, refreshProfile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    display_name: '', preferred_name: '', gender: '', age: '',
    occupation: '', mbti: '', bio: '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name ?? '',
        preferred_name: profile.preferred_name ?? '',
        gender: profile.gender ?? '',
        age: profile.age?.toString() ?? '',
        occupation: profile.occupation ?? '',
        mbti: profile.mbti ?? '',
        bio: profile.bio ?? '',
      });
    }
  }, [profile]);

  if (!profile) return <div style={{ padding: 40 }}>加载中...</div>;

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await updateProfile({
        display_name: form.display_name || null,
        preferred_name: form.preferred_name || null,
        gender: form.gender || null,
        age: form.age ? parseInt(form.age, 10) : null,
        occupation: form.occupation || null,
        mbti: form.mbti || null,
        bio: form.bio || null,
      });
      setMsg('已保存');
    } catch (e: any) {
      setMsg('保存失败: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append('file', file);
      const session = JSON.parse(localStorage.getItem('auth_session') || '{}');
      const res = await fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:3000/api'}/profile/avatar`, {
        method: 'POST', body: fd,
        headers: session.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {},
      });
      if (!res.ok) throw new Error('上传失败');
      await refreshProfile();
      setMsg('头像已更新');
    } catch (e: any) {
      setMsg('上传失败: ' + e.message);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: 24 }}>
      <h2>我的用户卡</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt="" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>?</div>
        )}
        <input type="file" ref={fileRef} accept="image/*" onChange={handleAvatar} style={{ display: 'none' }} />
        <button onClick={() => fileRef.current?.click()}>更换头像</button>
      </div>
      <Field label="昵称" value={form.display_name} onChange={v => setForm({ ...form, display_name: v })} />
      <Field label="称呼(让 AI 怎么叫你)" value={form.preferred_name} onChange={v => setForm({ ...form, preferred_name: v })} />
      <Field label="性别" value={form.gender} onChange={v => setForm({ ...form, gender: v })} />
      <Field label="年龄" value={form.age} onChange={v => setForm({ ...form, age: v })} />
      <Field label="身份(学生/上班族/...)" value={form.occupation} onChange={v => setForm({ ...form, occupation: v })} />
      <Field label="MBTI" value={form.mbti} onChange={v => setForm({ ...form, mbti: v })} />
      <div style={{ marginBottom: 12 }}>
        <label>自我介绍<br />
          <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} rows={4} style={{ width: '100%', padding: 8 }} />
        </label>
      </div>
      <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px' }}>
        {saving ? '保存中...' : '保存'}
      </button>
      {msg && <span style={{ marginLeft: 12 }}>{msg}</span>}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label>{label}<br />
        <input value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: 8 }} />
      </label>
    </div>
  );
}
```

- [ ] **Step 2: tsc + commit**

```bash
./node_modules/.bin/tsc -b
git add frontend/src/pages/UserProfile.tsx
git commit -m "feat(frontend): UserProfile 页(查看/编辑/上传头像)"
```

---

## Task 1.9: UserProfileSetup 引导页

**Files:** `frontend/src/pages/UserProfileSetup.tsx`

- [ ] **Step 1: 完整覆盖 `frontend/src/pages/UserProfileSetup.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function UserProfileSetup() {
  const navigate = useNavigate();
  const { profile, updateProfile, refreshProfile } = useAuth();
  const [preferredName, setPreferredName] = useState('');
  const [occupation, setOccupation] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { refreshProfile(); }, []);

  useEffect(() => {
    if (profile) {
      setPreferredName(profile.preferred_name ?? '');
      setOccupation(profile.occupation ?? '');
      setBio(profile.bio ?? '');
    }
  }, [profile]);

  if (!profile) return <div style={{ padding: 40 }}>加载中...</div>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preferredName.trim()) {
      setError('称呼是必填的——AI 需要知道怎么叫你');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateProfile({
        preferred_name: preferredName,
        occupation: occupation || null,
        bio: bio || null,
      });
      navigate('/');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 500, margin: '40px auto', padding: 24 }}>
      <h2>欢迎,{profile.display_name} 👋</h2>
      <p>为了让 AI 更了解你,先填几个关键信息。称呼是必填的,其他可以之后在"我的资料"里改。</p>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>AI 怎么称呼你? *<br />
            <input value={preferredName} onChange={e => setPreferredName(e.target.value)} required placeholder="如:小美 / 阿月" style={{ width: '100%', padding: 8 }} />
          </label>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>身份(学生/上班族/...)<br />
            <input value={occupation} onChange={e => setOccupation(e.target.value)} placeholder="如:大三学生" style={{ width: '100%', padding: 8 }} />
          </label>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>自我介绍(简单说说自己)<br />
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} style={{ width: '100%', padding: 8 }} />
          </label>
        </div>
        {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
        <button type="submit" disabled={saving} style={{ padding: '8px 20px' }}>
          {saving ? '保存中...' : '开始聊天 →'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: tsc + commit**

```bash
./node_modules/.bin/tsc -b
git add frontend/src/pages/UserProfileSetup.tsx
git commit -m "feat(frontend): UserProfileSetup 首次引导页(必填称呼)"
```

---

## Task 1.10: AppHeader(用户菜单)

**Files:** `frontend/src/components/AppHeader.tsx`, 把它挂到 Home 页顶部

- [ ] **Step 1: 写 `frontend/src/components/AppHeader.tsx`**

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AppHeader() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (!profile) return null;

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid #eee' }}>
      <div style={{ fontSize: 14, color: '#666' }}>AI 伴侣</div>
      <div style={{ position: 'relative' }}>
        <button onClick={() => setOpen(!open)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#eee' }} />
          )}
        </button>
        {open && (
          <div style={{ position: 'absolute', right: 0, top: '100%', background: 'white', border: '1px solid #ddd', borderRadius: 6, padding: 4, zIndex: 100, minWidth: 140 }}>
            <div style={{ padding: '6px 10px', fontSize: 12, color: '#666' }}>{profile.display_name}</div>
            <button onClick={() => { setOpen(false); navigate('/profile'); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', background: 'none', border: 'none', cursor: 'pointer' }}>
              我的资料
            </button>
            <button onClick={async () => { setOpen(false); await logout(); navigate('/login'); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', background: 'none', border: 'none', cursor: 'pointer', color: 'red' }}>
              退出登录
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 在 `frontend/src/pages/Home.tsx` 顶部加 `<AppHeader />`**

在 `<div className="home">` 之后,`<header className="home-header">` 之前加:
```tsx
<AppHeader />
```

(在文件顶部 import:`import AppHeader from '../components/AppHeader';`)

- [ ] **Step 3: tsc + commit**

```bash
./node_modules/.bin/tsc -b
git add frontend/src/components/AppHeader.tsx frontend/src/pages/Home.tsx
git commit -m "feat(frontend): AppHeader 用户菜单 + 退出登录"
```

---

## Task 1.11: Claim Legacy 端点

**Files:** `backend/src/routes/auth.ts`(加新端点)

- [ ] **Step 1: 在 `services/supabase-user.ts` 加 `claimLegacy`**

```ts
export async function claimLegacy(targetUserId: string) {
  const supabase = getSupabaseAdmin();
  // 1. 找 legacy user(固定 id)
  const LEGACY_ID = '00000000-0000-0000-0000-000000000000';
  // 2. 把所有 user_id = LEGACY_ID 的数据(除预设)转移到 targetUserId
  const tables = ['characters', 'character_extras', 'groups', 'messages', 'memories'];
  for (const t of tables) {
    const { error } = await supabase
      .from(t)
      .update({ user_id: targetUserId })
      .eq('user_id', LEGACY_ID);
    if (error) throw new Error(`迁移 ${t} 失败: ${error.message}`);
  }
  // 3. group_members 需要先 group 移完
  const { error: gmErr } = await supabase
    .from('group_members')
    .update({ user_id: targetUserId })
    .eq('user_id', LEGACY_ID);
  if (gmErr) throw new Error('迁移 group_members 失败: ' + gmErr.message);
  // 4. 删 legacy user profile
  await supabase.from('user_profiles').delete().eq('user_id', LEGACY_ID);
  // 5. 删 legacy auth user
  await supabase.auth.admin.deleteUser(LEGACY_ID);
  return { success: true };
}
```

- [ ] **Step 2: 在 `routes/auth.ts` 加端点**

加 import:
```ts
import { signupUser, loginUser, refreshSession, logoutUser, getProfile, claimLegacy } from '../services/supabase-user';
```

加端点(在 `router.get('/me', ...)` 之前):
```ts
router.post('/claim-legacy', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const result = await claimLegacy(userId);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});
```

- [ ] **Step 3: tsc + commit**

```bash
cd ../backend && ./node_modules/.bin/tsc --noEmit
git add backend/src/services/supabase-user.ts backend/src/routes/auth.ts
git commit -m "feat(auth): /api/auth/claim-legacy 把 legacy 数据克隆给新用户"
```

---

## Task 1.12: 前端自动 claim

**Files:** `frontend/src/contexts/AuthContext.tsx`

- [ ] **Step 1: 在 AuthContext 加 claimLegacy 调用**

在 `refreshProfile` 函数后加:
```ts
const claimLegacyIfNeeded = async () => {
  if (localStorage.getItem('has_claimed_legacy')) return;
  try {
    await fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:3000/api'}/auth/claim-legacy`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.accessToken}` },
    });
    localStorage.setItem('has_claimed_legacy', 'true');
  } catch {}
};
```

在 `useEffect` 里 `profileApi.get()` 之后调用 `claimLegacyIfNeeded()`:
```ts
useEffect(() => {
  if (session) {
    profileApi.get()
      .then(r => setProfile(r.data))
      .then(() => claimLegacyIfNeeded())
      .catch(() => setStoredSession(null))
      .finally(() => setLoading(false));
  } else {
    setLoading(false);
  }
}, [session]);
```

- [ ] **Step 2: 在服务端跑一次 legacy 迁移(手动 SQL)**

在 Supabase SQL Editor 跑 spec §7 的 SQL,创建 legacy user + 把现有数据归属到 legacy user。

**注意**:如果数据库里还没有任何数据,可以跳过这一步(后续就没有 legacy)。

- [ ] **Step 3: tsc + commit**

```bash
cd ../frontend && ./node_modules/.bin/tsc -b
git add frontend/src/contexts/AuthContext.tsx
git commit -m "feat(frontend): 首次登录自动 claim-legacy"
```

---

## Task 1.13: PR1 收尾

- [ ] **Step 1: 跑完整 tsc(两端)**

```bash
cd "/Users/eya/Desktop/AI chat"
./backend/node_modules/.bin/tsc -p backend --noEmit
./frontend/node_modules/.bin/tsc -b frontend
```

- [ ] **Step 2: 跑后端测试**

```bash
cd backend && npm test
```

Expected:全部 PASS

- [ ] **Step 3: 手动 e2e 验证**

```bash
# 终端 A
cd backend && npm run dev

# 终端 B
cd frontend && npm run dev
```

- 打开 http://localhost:5173 → 应跳到 /login
- 注册一个新用户 → 应跳到 /profile/setup
- 填称呼和身份 → 跳到 /
- 看到首页 + 4 个预设角色(应为新用户,无聊天记录)
- 退出登录 → 跳回 /login
- 再登录 → 跳到 /

- [ ] **Step 4: commit + 收尾**

```bash
git add -A
git commit --allow-empty -m "chore: PR1 完成验收"
```

---

# PR2: 数据隔离(所有 endpoint 加 user_id)

**目标:** 现有 6 个路由模块都加 `requireAuth` + `user_id` 过滤,前端 `App.tsx` 已经做好守卫,本 PR 主要是后端改造 + 前端跑通。

**前置:** PR1 全部完成,后端 / 前端 tsc 干净,所有测试通过。

**改完验收:**
- 未登录调任何 `/api/characters` 等返回 401
- 登录用户 A 看不到用户 B 的自定义角色(但能看到 4 个预设)
- 登录用户 A 不能删除用户 B 的角色
- 多租户数据隔离冒烟测试通过

## File 地图(本 PR 改动的文件)

```
backend/src/
  index.ts                  -- 改:在 /api/characters, /api/groups, /api/chat, /api/memories,
                                   /api/extras, /api/avatars 全部加 app.use(..., requireAuth)
                                   (或每个 router 内 app.use(requireAuth))
  routes/
    characters.ts           -- 改:加 user_id 过滤 + 自动 user_id 设置
    chat.ts                 -- 改:同上
    groups.ts               -- 改:同上
    extras.ts               -- 改:同上
    memories.ts             -- 改:同上
    avatars.ts              -- 改:头像按 user_id 分目录
  tests/
    isolation.test.ts       -- 新增:两个用户的数据隔离冒烟

frontend/src/
  pages/
    Home.tsx, Chat.tsx, GroupChat.tsx,
    CharacterEdit.tsx, GroupEdit.tsx,
    CharacterExtras.tsx     -- 不改(API client 已经带 token,数据隔离是后端的事)
  contexts/AuthContext.tsx  -- 不改
```

## Task 2.1: 后端加全局 requireAuth(只对 /api/* 业务路由生效)

**Files:** `backend/src/index.ts`

- [ ] **Step 1: 改 `index.ts`**

把现有的:
```ts
app.use('/api/characters', charactersRouter);
app.use('/api/chat', chatRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/memories', memoriesRouter);
app.use('/api/extras', extrasRouter);
app.use('/api/avatars', avatarsRouter);
```

全部加 `requireAuth` 中间件:
```ts
import { requireAuth } from './middleware/auth';
// ...
app.use('/api/characters', requireAuth, charactersRouter);
app.use('/api/chat', requireAuth, chatRouter);
app.use('/api/groups', requireAuth, groupsRouter);
app.use('/api/memories', requireAuth, memoriesRouter);
app.use('/api/extras', requireAuth, extrasRouter);
app.use('/api/avatars', requireAuth, avatarsRouter);
```

`/api/auth/*` 和 `/api/profile/*` 和 `/api/health` 不动(它们自己有 / 不需要 auth)。

- [ ] **Step 2: tsc + commit**

```bash
cd backend && ./node_modules/.bin/tsc --noEmit
git add backend/src/index.ts
git commit -m "feat(auth): 业务路由加 requireAuth"
```

---

## Task 2.2: characters 路由加 user_id 隔离

**Files:** `backend/src/routes/characters.ts`

- [ ] **Step 1: 改 `GET /` 过滤**

`from('characters').select('*')` 改为:
```ts
const { data, error } = await supabase
  .from('characters')
  .select('*')
  .or(`user_id.eq.${userId},is_preset.eq.true`)
  .order('is_preset', { ascending: false })
  .order('created_at', { ascending: true });
```

(在 handler 顶部加 `const userId = (req as any).user.id;`)

- [ ] **Step 2: 改 `GET /:id` 过滤**

`.eq('id', id).single()` 之后,加校验:
```ts
if (data.user_id && data.user_id !== userId && !data.is_preset) {
  return res.status(404).json({ success: false, error: '角色不存在' });
}
```

- [ ] **Step 3: 改 `POST /` 自动设 user_id**

`.insert({ name, ..., is_preset: false, greeting: greeting || '你好。' })` 加 user_id:
```ts
.insert({
  name, description: description || '', system_prompt, avatar: avatar || '👤',
  is_preset: false, greeting: greeting || '你好。', user_id: userId,
})
```

- [ ] **Step 4: 改 `PUT /:id` 校验所有权**

在 `.update(updates).eq('id', id).select().single()` 之前:
```ts
const { data: existing } = await supabase.from('characters').select('user_id, is_preset').eq('id', id).single();
if (!existing || (existing.user_id !== userId && !existing.is_preset)) {
  return res.status(404).json({ success: false, error: '角色不存在' });
}
```

- [ ] **Step 5: 改 `DELETE /:id` 校验**

`is_preset` 检查之外加:
```ts
if (character.user_id && character.user_id !== userId) {
  return res.status(403).json({ success: false, error: '无权删除此角色' });
}
```

- [ ] **Step 6: tsc + 跑测试 + commit**

```bash
./node_modules/.bin/tsc --noEmit
npm test
git add backend/src/routes/characters.ts
git commit -m "feat(characters): 加 user_id 隔离"
```

---

## Task 2.3: groups + chat + extras + memories + avatars 路由同样改造

**Files:** 见 file 地图

- [ ] **Step 1: 同样的模式应用到以下文件**

对每个路由模块的每个 handler:
- 顶部加 `const userId = (req as any).user.id;`
- 列表查询加 `user_id` 过滤(或 `or('user_id.eq.X,is_preset.eq.true')` for characters)
- 写操作自动设 `user_id`
- 改/删之前校验 `user_id` 匹配(预设除外)

具体应用的文件:
- `backend/src/routes/groups.ts`(所有 handler)
- `backend/src/routes/chat.ts`(私聊 + 群聊)
- `backend/src/routes/extras.ts`(所有 handler)
- `backend/src/routes/memories.ts`(所有 handler)
- `backend/src/routes/avatars.ts`(改:头像按 user_id 分子目录)

参考 PR2 Task 2.2 的 5 步模式。每个文件一个 commit。

- [ ] **Step 2: tsc + 跑所有测试**

```bash
./node_modules/.bin/tsc --noEmit && npm test
```

Expected: 0 errors,所有 PASS

- [ ] **Step 3: commit 每个文件**

(每个文件单独一个 commit,信息格式 `feat(<module>): 加 user_id 隔离`)

---

## Task 2.4: 多租户数据隔离冒烟测试

**Files:** `backend/tests/isolation.test.ts`

- [ ] **Step 1: 写测试**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { getSupabaseAdmin } from '../src/config/supabase';

const app = express();
app.use(express.json());
// 挂所有路由(根据实际情况 import)
import charactersRouter from '../src/routes/characters';
import { requireAuth } from '../src/middleware/auth';
app.use('/api/characters', requireAuth, charactersRouter);

let userA: { id: string; token: string };
let userB: { id: string; token: string };
let characterAId: string;

beforeAll(async () => {
  const supabase = getSupabaseAdmin();
  // 用 admin API 创建两个测试用户
  const a = await supabase.auth.admin.createUser({ email: `testA-${Date.now()}@test.local`, password: 'pw', email_confirm: true });
  const b = await supabase.auth.admin.createUser({ email: `testB-${Date.now()}@test.local`, password: 'pw', email_confirm: true });
  userA = { id: a.data.user!.id, token: 'placeholder' };
  userB = { id: b.data.user!.id, token: 'placeholder' };
  // 用 signIn 获取 token
  const { data: sA } = await supabase.auth.signInWithPassword({ email: a.data.user!.email!, password: 'pw' });
  const { data: sB } = await supabase.auth.signInWithPassword({ email: b.data.user!.email!, password: 'pw' });
  userA.token = sA!.access_token;
  userB.token = sB!.access_token;
});

afterAll(async () => {
  const supabase = getSupabaseAdmin();
  await supabase.auth.admin.deleteUser(userA.id);
  await supabase.auth.admin.deleteUser(userB.id);
});

describe('数据隔离', () => {
  it('A 创建的角色,B 看不到', async () => {
    const create = await request(app)
      .post('/api/characters')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ name: 'A 的角色', system_prompt: 'test' });
    expect(create.status).toBe(200);
    characterAId = create.body.data.id;

    const list = await request(app)
      .get('/api/characters')
      .set('Authorization', `Bearer ${userB.token}`);
    expect(list.body.data.find((c: any) => c.id === characterAId)).toBeUndefined();
  });

  it('B 删 A 的角色返回 403/404', async () => {
    const del = await request(app)
      .delete(`/api/characters/${characterAId}`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect([403, 404]).toContain(del.status);
  });

  it('A 删自己的角色成功', async () => {
    const del = await request(app)
      .delete(`/api/characters/${characterAId}`)
      .set('Authorization', `Bearer ${userA.token}`);
    expect(del.status).toBe(200);
  });
});
```

- [ ] **Step 2: 跑测试**

```bash
npm test -- isolation
```

Expected: 3 PASS

- [ ] **Step 3: commit**

```bash
git add backend/tests/isolation.test.ts
git commit -m "test: 多租户数据隔离冒烟测试"
```

---

## Task 2.5: PR2 收尾

- [ ] **Step 1: 完整 tsc + 测试**

```bash
./node_modules/.bin/tsc --noEmit && npm test
```

- [ ] **Step 2: 手动 e2e**

- 登录 → 创建自定义角色"测试" → 退出
- 注册另一个用户 → 首页应**没有**"测试"角色,但仍能看到 4 个预设
- 切回第一个用户 → "测试"还在

- [ ] **Step 3: commit**

```bash
git commit --allow-empty -m "chore: PR2 完成验收"
```

---

# PR3: 好感度 + 记忆(本设计的核心)

**目标:** 加 stage_prompts / user_character_state / affinity_evaluations 表,每日 LLM 评估 cron,前端 AffinityMeter / IntimateModeToggle / UnlockCelebration 组件,Chat 页头部条 + 100% 解锁三重奏。

**前置:** PR2 全部完成。

**改完验收:**
- Home 页角色卡显示进度条
- Chat 页头部显示小型进度条
- 等到 cron 跑过一次(可手动触发)后,affinity 有值
- 模拟 100%(写库)后,Chat 页弹庆祝 + 显示亲密模式开关
- 切换亲密模式后,下次 chat 走 prompt §6.1 [5] 路径

## File 地图

```
backend/
  supabase/migrations/
    20260603_pr3_stage_and_state.sql    -- 新增
  src/
    routes/
      affinity.ts                       -- 新增
      memories.ts                       -- 改:支持新表字段 + user 手动加/改
    services/
      prompt-assembly.ts                -- 新增:按 §6.1 拼 system_prompt
      affinity-eval.ts                  -- 新增:每日 LLM 评估
    jobs/
      dailyAffinityEval.ts              -- 新增:cron
    config/
      env.ts                            -- 改:加 SCHEDULER_ENABLED 默认 true
    index.ts                            -- 改:挂 affinityRouter, 启动 cron
    routes/chat.ts                      -- 改:用 prompt-assembly 拼 system_prompt
  tests/
    prompt-assembly.test.ts             -- 新增
    affinity-eval.test.ts               -- 新增

frontend/
  src/
    components/
      AffinityMeter.tsx                 -- 新增
      IntimateModeToggle.tsx            -- 新增
      UnlockCelebration.tsx             -- 新增
    pages/
      Home.tsx                          -- 改:加 <AffinityMeter>
      Chat.tsx                          -- 改:头部条 + 100% 弹窗 + 模式开关
      CharacterExtras.tsx               -- 不改(本 PR 不做 Tabs,留给 PR4)
    api/
      client.ts                         -- 改:加 affinityApi
      types.ts                          -- 改:加 AffinityState 等类型
```

## Task 3.1: SQL 迁移——stage_prompts / user_character_state / affinity_evaluations + 改 messages/memories 加 user_id

**Files:** `backend/supabase/migrations/20260603_pr3_stage_and_state.sql`

- [ ] **Step 1: 写 SQL**

```sql
-- PR3: stage_prompts
CREATE TABLE IF NOT EXISTS stage_prompts (
  stage TEXT PRIMARY KEY,
  min_pct INT NOT NULL,
  max_pct INT NOT NULL,
  description TEXT NOT NULL,
  prompt_snippet TEXT NOT NULL
);

INSERT INTO stage_prompts (stage, min_pct, max_pct, description, prompt_snippet) VALUES
  ('stranger',     0,  19, '陌生', '你与用户刚认识,礼貌、拘谨、不会主动拉近距离。'),
  ('familiar',    20,  49, '熟悉', '你与用户已经很熟了,会主动开玩笑、分享日常、记得她说过的话。'),
  ('flirtatious', 50,  79, '暧昧', '你与用户之间有暧昧情愫。会吃醋、会有肢体接触暗示、会说一些似是而非的话。'),
  ('intimate',    80, 100, '亲密', '你与用户已经确认关系。会直接表达爱意、用昵称、主动亲密、有占有欲但也很宠。')
ON CONFLICT (stage) DO NOTHING;

-- PR3: user_character_state
CREATE TABLE IF NOT EXISTS user_character_state (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  affinity INT DEFAULT 0 CHECK (affinity BETWEEN 0 AND 100),
  current_stage TEXT DEFAULT 'stranger' REFERENCES stage_prompts(stage),
  mode TEXT DEFAULT 'daily' CHECK (mode IN ('daily', 'intimate')),
  unlocked_at TIMESTAMPTZ,
  difficulty TEXT DEFAULT 'normal' CHECK (difficulty IN ('easy', 'normal', 'hard')),
  special_greeting TEXT,
  PRIMARY KEY (user_id, character_id)
);

-- PR3: affinity_evaluations
CREATE TABLE IF NOT EXISTS affinity_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  eval_date DATE NOT NULL,
  prev_affinity INT NOT NULL,
  new_affinity INT NOT NULL,
  delta INT NOT NULL,
  reason TEXT,
  memory_summary TEXT,
  error TEXT,
  evaluated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, character_id, eval_date)
);

-- 给 messages / memories 加 user_id(如果没有的话)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS affinity_delta INT;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS affinity_reason TEXT;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'ai';

-- 给 characters 加 default_difficulty / unlocked_at / special_greeting
ALTER TABLE characters ADD COLUMN IF NOT EXISTS default_difficulty TEXT DEFAULT 'normal';
ALTER TABLE characters ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMPTZ;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS special_greeting TEXT;

-- 索引
CREATE INDEX IF NOT EXISTS idx_messages_user_char ON messages(user_id, character_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_affinity_eval_user_date ON affinity_evaluations(user_id, eval_date DESC);
```

- [ ] **Step 2: 在 Supabase SQL Editor 跑**

- [ ] **Step 3: commit**

```bash
git add backend/supabase/migrations/
git commit -m "feat(db): PR3 加 stage_prompts/user_character_state/affinity_evaluations"
```

---

## Task 3.2: Prompt 拼装 service

**Files:** `backend/src/services/prompt-assembly.ts`

- [ ] **Step 1: 写测试 `backend/tests/prompt-assembly.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { assemblePrivateChatSystemPrompt } from '../src/services/prompt-assembly';

const character = { name: '林默', system_prompt: '你是林默,ENFP 建筑系大三' } as any;
const user = { preferred_name: '小美', occupation: '大三学生', age: 21, mbti: 'INFP', bio: '喜欢猫' } as any;
const stage = { stage: 'flirtatious', description: '暧昧', prompt_snippet: '你们暧昧中' } as any;

describe('assemblePrivateChatSystemPrompt', () => {
  it('包含 character SP', () => {
    const sp = assemblePrivateChatSystemPrompt({ character, user, stage, mode: 'daily', affinity: 60, extras: [], recentReasons: [] });
    expect(sp).toContain('你是林默');
  });

  it('包含用户称呼', () => {
    const sp = assemblePrivateChatSystemPrompt({ character, user, stage, mode: 'daily', affinity: 60, extras: [], recentReasons: [] });
    expect(sp).toContain('「小美」');
  });

  it('intimate 模式追加亲密 descriptor', () => {
    const sp = assemblePrivateChatSystemPrompt({ character, user, stage, mode: 'intimate', affinity: 90, extras: [], recentReasons: [] });
    expect(sp).toContain('亲密的互动');
  });

  it('daily 模式不追加亲密 descriptor', () => {
    const sp = assemblePrivateChatSystemPrompt({ character, user, stage, mode: 'daily', affinity: 60, extras: [], recentReasons: [] });
    expect(sp).not.toContain('亲密的互动');
  });
});
```

- [ ] **Step 2: 跑测试 fail**

```bash
npm test -- prompt-assembly
```

- [ ] **Step 3: 实现 `backend/src/services/prompt-assembly.ts`**

```ts
import type { Character, UserProfile } from '../types/db';

const INTIMATE_DESCRIPTOR = '现在你们的关系允许更亲密的互动:可以主动用昵称、表达想念、有更多肢体接触描写、偶尔撒娇/吃醋。';

export interface ExtraForPrompt {
  type: 'note' | 'story' | 'relationship' | 'memory_hint';
  title: string;
  content: string;
}

export interface AssemblyInput {
  character: Character;
  user: UserProfile;
  stage: { stage: string; description: string; prompt_snippet: string };
  mode: 'daily' | 'intimate';
  affinity: number;
  extras: ExtraForPrompt[];
  recentReasons: { date: string; reason: string }[];
}

export function assemblePrivateChatSystemPrompt(input: AssemblyInput): string {
  const { character, user, stage, mode, affinity, extras, recentReasons } = input;
  const blocks: string[] = [];

  // [1] character SP
  blocks.push(character.system_prompt);

  // [2] extras
  if (extras.length > 0) {
    const sections: string[] = [];
    const byType: Record<string, ExtraForPrompt[]> = {};
    extras.forEach(e => {
      if (!byType[e.type]) byType[e.type] = [];
      byType[e.type].push(e);
    });
    const labels: Record<string, string> = {
      note: '【用户补充设定】',
      story: '【你们之间的故事背景】',
      relationship: '【关系进展记录】',
      memory_hint: '【重要记忆提示】',
    };
    for (const [type, items] of Object.entries(byType)) {
      sections.push(`${labels[type]}\n${items.map(e => `- ${e.title}：${e.content}`).join('\n')}`);
    }
    blocks.push(`以下是用户为你添加的额外信息（必须遵守）：\n\n${sections.join('\n\n')}`);
  }

  // [3] user info
  const userBits: string[] = [];
  if (user.bio) userBits.push(user.bio);
  if (user.preferred_name) userBits.push(`称呼她为「${user.preferred_name}」。`);
  if (user.occupation) userBits.push(`她的身份是${user.occupation}`);
  if (user.age) userBits.push(`${user.age} 岁`);
  if (user.mbti) userBits.push(`MBTI 是 ${user.mbti}`);
  if (userBits.length > 0) {
    blocks.push(`关于你的用户（以下是事实，作为参考）：\n${userBits.join('，')}。`);
  }

  // [4] stage
  blocks.push(`你们目前的关系：${stage.description}（好感度 ${affinity}%）\n${stage.prompt_snippet}`);

  // [5] intimate
  if (mode === 'intimate') {
    blocks.push(INTIMATE_DESCRIPTOR);
  }

  // [6] recent reasons
  if (recentReasons.length > 0) {
    blocks.push(`最近的互动印象：\n${recentReasons.map(r => `- ${r.date}: ${r.reason}`).join('\n')}`);
  }

  return blocks.join('\n\n═══════════════════════════════════\n\n');
}
```

- [ ] **Step 4: 跑测试 + commit**

```bash
npm test -- prompt-assembly
git add backend/src/services/prompt-assembly.ts backend/tests/prompt-assembly.test.ts
git commit -m "feat(prompt): 加 assemblePrivateChatSystemPrompt 按 §6.1 顺序拼装"
```

---

## Task 3.3: 改造 chat 路由用 prompt-assembly

**Files:** `backend/src/routes/chat.ts`

- [ ] **Step 1: 在 chat 路由顶部加 userId 拉取 user_profile / user_character_state / extras / recent reasons**

参考现有 chat 路由,改造 `/api/chat POST` handler,调用 `assemblePrivateChatSystemPrompt` 替代手写拼接。

伪代码:
```ts
const userId = (req as any).user.id;
const { characterId, content, model, saveToMemory = true } = req.body;

// 1. 拉 character(已有,加 user_id 过滤见 PR2)
const { data: character } = await supabase.from('characters').select('*').eq('id', characterId).or(`user_id.eq.${userId},is_preset.eq.true`).single();

// 2. 拉 user_profile
const { data: user } = await supabase.from('user_profiles').select('*').eq('user_id', userId).single();

// 3. 拉 user_character_state(可能 null,默认 stranger)
const { data: state } = await supabase.from('user_character_state').select('*').eq('user_id', userId).eq('character_id', characterId).maybeSingle();
const affinity = state?.affinity ?? 0;
const mode = state?.mode ?? 'daily';

// 4. 拉 stage
const stageName = affinity >= 80 ? 'intimate' : affinity >= 50 ? 'flirtatious' : affinity >= 20 ? 'familiar' : 'stranger';
const { data: stage } = await supabase.from('stage_prompts').select('*').eq('stage', stageName).single();

// 5. 拉 extras(已有,加 user_id 过滤见 PR2)
const { data: extras } = await supabase.from('character_extras').select('*').eq('character_id', characterId).eq('user_id', userId);

// 6. 拉最近 3 天 reasons
const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0];
const { data: recentEvals } = await supabase.from('affinity_evaluations').select('eval_date, reason').eq('user_id', userId).eq('character_id', characterId).gte('eval_date', threeDaysAgo).order('eval_date', { ascending: false });
const recentReasons = (recentEvals || []).map(e => ({ date: e.eval_date, reason: e.reason })).filter(r => r.reason);

// 7. 拼 prompt
const systemPrompt = assemblePrivateChatSystemPrompt({ character, user, stage, mode, affinity, extras: extras || [], recentReasons });

// 8. 调 LLM(同现状 generateChatResponse)
```

- [ ] **Step 2: tsc + commit**

```bash
./node_modules/.bin/tsc --noEmit
git add backend/src/routes/chat.ts
git commit -m "feat(chat): /api/chat 改用 prompt-assembly 拼 system_prompt"
```

---

## Task 3.4: Affinity 路由(读 / 改 mode / 读 special-greeting)

**Files:** `backend/src/routes/affinity.ts`, `backend/src/index.ts`

- [ ] **Step 1: 写 `backend/src/routes/affinity.ts`**

```ts
import { Router } from 'express';
import { getSupabaseAdmin } from '../config/supabase';
import { generateChatResponse } from '../services/llm';

const router = Router();

async function ensureState(userId: string, characterId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('user_character_state')
    .select('*')
    .eq('user_id', userId)
    .eq('character_id', characterId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;
  // 不存在则创建
  const { data: created, error: createErr } = await supabase
    .from('user_character_state')
    .insert({ user_id: userId, character_id: characterId })
    .select()
    .single();
  if (createErr) throw createErr;
  return created;
}

router.get('/characters/:id/affinity', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const characterId = req.params.id;
    const supabase = getSupabaseAdmin();
    const state = await ensureState(userId, characterId);
    const { data: latest } = await supabase
      .from('affinity_evaluations')
      .select('delta, reason, eval_date')
      .eq('user_id', userId)
      .eq('character_id', characterId)
      .order('eval_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    res.json({
      success: true,
      data: {
        affinity: state.affinity,
        stage: state.current_stage,
        mode: state.mode,
        unlockedAt: state.unlocked_at,
        latestReason: latest?.reason,
        latestDelta: latest?.delta,
        difficulty: state.difficulty,
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.put('/characters/:id/mode', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const characterId = req.params.id;
    const { mode } = req.body;
    if (mode !== 'daily' && mode !== 'intimate') {
      return res.status(400).json({ success: false, error: 'mode 必须是 daily 或 intimate' });
    }
    const supabase = getSupabaseAdmin();
    const state = await ensureState(userId, characterId);
    if (mode === 'intimate' && !state.unlocked_at) {
      return res.status(403).json({ success: false, error: '尚未解锁亲密模式' });
    }
    const { data, error } = await supabase
      .from('user_character_state')
      .update({ mode })
      .eq('user_id', userId)
      .eq('character_id', characterId)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, data: { mode: data.mode } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.put('/characters/:id/difficulty', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const characterId = req.params.id;
    const { difficulty } = req.body;
    if (!['easy', 'normal', 'hard'].includes(difficulty)) {
      return res.status(400).json({ success: false, error: 'difficulty 必须是 easy/normal/hard' });
    }
    const supabase = getSupabaseAdmin();
    // 校验:只能是自定义角色
    const { data: ch } = await supabase.from('characters').select('user_id, is_preset').eq('id', characterId).single();
    if (ch?.is_preset) {
      return res.status(403).json({ success: false, error: '预设角色不能改难度' });
    }
    if (ch?.user_id !== userId) {
      return res.status(403).json({ success: false, error: '无权修改' });
    }
    const { data, error } = await supabase
      .from('user_character_state')
      .update({ difficulty })
      .eq('user_id', userId)
      .eq('character_id', characterId)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, data: { difficulty: data.difficulty } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/characters/:id/special-greeting', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const characterId = req.params.id;
    const supabase = getSupabaseAdmin();
    const state = await ensureState(userId, characterId);
    if (!state.unlocked_at) {
      return res.status(403).json({ success: false, error: '尚未解锁' });
    }
    if (state.special_greeting) {
      return res.json({ success: true, data: { greeting: state.special_greeting } });
    }
    // 调 LLM 生成一次,保存
    const { data: ch } = await supabase.from('characters').select('*').eq('id', characterId).single();
    const greeting = await generateChatResponse({
      systemPrompt: ch!.system_prompt + '\n\n【重要】你刚刚和用户确认了关系。请用你的角色风格说一句温暖的、第一次以"恋人"身份打招呼的话(50-100 字)。',
      messages: [{ role: 'user', content: '现在请输出这句问候。' }],
    });
    await supabase
      .from('user_character_state')
      .update({ special_greeting: greeting })
      .eq('user_id', userId)
      .eq('character_id', characterId);
    res.json({ success: true, data: { greeting } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
```

- [ ] **Step 2: 挂载到 `backend/src/index.ts`**

加 import + `app.use('/api', affinityRouter);`

- [ ] **Step 3: tsc + commit**

```bash
./node_modules/.bin/tsc --noEmit
git add backend/src/routes/affinity.ts backend/src/index.ts
git commit -m "feat(affinity): GET/affinity + PUT/mode + PUT/difficulty + GET/special-greeting"
```

---

## Task 3.5: 每日评估 cron

**Files:** `backend/src/services/affinity-eval.ts`, `backend/src/jobs/dailyAffinityEval.ts`, `backend/src/index.ts`

- [ ] **Step 1: 写 service `backend/src/services/affinity-eval.ts`**

```ts
import { getSupabaseAdmin } from '../config/supabase';
import { chat, LLMProvider } from '../config/llm-providers';

const SYSTEM_PROMPT = `你是一个角色扮演分析助手。根据"昨天用户与角色的对话",输出:
1. 一段 100-300 字的"角色第一人称记忆"(像日记)
2. 评估昨天互动对好感度的影响(-5 到 +5 的整数)
请严格输出 JSON,不要任何额外文字。`;

const JSON_SCHEMA_HINT = `输出 schema:
{
  "summary": "<100-300 字>",
  "affinityDelta": <-5..5 的整数>,
  "reason": "<不超过 30 字>"
}`;

interface EvalResult {
  evaluated: number;
  errors: number;
}

export async function evaluateAllUsersYesterday(): Promise<EvalResult> {
  const supabase = getSupabaseAdmin();
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // 1. 找所有昨天有消息的 (user_id, character_id) 组合
  const { data: msgPairs, error: msgErr } = await supabase
    .from('messages')
    .select('user_id, character_id')
    .is('group_id', null)
    .gte('created_at', `${yesterday}T00:00:00Z`)
    .lte('created_at', `${yesterday}T23:59:59Z`);
  if (msgErr) throw msgErr;

  const pairs = Array.from(new Set((msgPairs || []).map(p => `${p.user_id}:${p.character_id}`)))
    .map(s => { const [u, c] = s.split(':'); return { userId: u, characterId: c }; });

  let evaluated = 0;
  let errors = 0;

  for (const { userId, characterId } of pairs) {
    try {
      // 拉取昨天所有消息
      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .eq('user_id', userId)
        .eq('character_id', characterId)
        .is('group_id', null)
        .gte('created_at', `${yesterday}T00:00:00Z`)
        .lte('created_at', `${yesterday}T23:59:59Z`)
        .order('created_at', { ascending: true });

      if (!messages || messages.length === 0) continue;

      // 拉 character + state
      const { data: character } = await supabase.from('characters').select('*').eq('id', characterId).single();
      if (!character) continue;
      const { data: state } = await supabase
        .from('user_character_state')
        .select('*')
        .eq('user_id', userId)
        .eq('character_id', characterId)
        .maybeSingle();
      const prevAffinity = state?.affinity ?? 0;
      const stageName = prevAffinity >= 80 ? 'intimate' : prevAffinity >= 50 ? 'flirtatious' : prevAffinity >= 20 ? 'familiar' : 'stranger';

      // 调 LLM
      const conversationText = messages.map(m => `${m.sender_name || (m.role === 'user' ? '我' : character.name)}: ${m.content}`).join('\n');
      const userPrompt = `角色: ${character.name}\n角色人设: ${character.system_prompt}\n当前亲密度: ${prevAffinity}% (${stageName})\n\n昨天所有对话:\n${conversationText}\n\n${JSON_SCHEMA_HINT}`;

      const result = await chat({
        model: 'kimi', // 默认走 kimi
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        maxTokens: 800,
      });

      // 解析 JSON
      let parsed: { summary: string; affinityDelta: number; reason: string };
      try {
        parsed = JSON.parse(result);
      } catch {
        await supabase.from('affinity_evaluations').insert({
          user_id: userId, character_id: characterId, eval_date: yesterday,
          prev_affinity: prevAffinity, new_affinity: prevAffinity, delta: 0,
          reason: null, memory_summary: null, error: 'JSON parse failed',
        });
        errors++;
        continue;
      }

      // clamp
      const delta = Math.max(-5, Math.min(5, parsed.affinityDelta || 0));
      const newAffinity = Math.max(0, Math.min(100, prevAffinity + delta));
      const unlocked = newAffinity >= 100 && prevAffinity < 100;

      // upsert evaluation
      await supabase.from('affinity_evaluations').upsert({
        user_id: userId, character_id: characterId, eval_date: yesterday,
        prev_affinity: prevAffinity, new_affinity: newAffinity, delta,
        reason: parsed.reason, memory_summary: parsed.summary,
      }, { onConflict: 'user_id,character_id,eval_date' });

      // upsert memory
      await supabase.from('memories').upsert({
        user_id: userId, character_id: characterId,
        memory_date: yesterday, summary: parsed.summary,
        affinity_delta: delta, affinity_reason: parsed.reason, source: 'ai',
      }, { onConflict: 'user_id,character_id,memory_date' });

      // update state
      await supabase.from('user_character_state').upsert({
        user_id: userId, character_id: characterId,
        affinity: newAffinity,
        current_stage: newAffinity >= 80 ? 'intimate' : newAffinity >= 50 ? 'flirtatious' : newAffinity >= 20 ? 'familiar' : 'stranger',
        unlocked_at: unlocked ? new Date().toISOString() : (state?.unlocked_at || null),
      }, { onConflict: 'user_id,character_id' });

      evaluated++;
    } catch (e: any) {
      console.error(`评估失败 ${userId}/${characterId}:`, e.message);
      errors++;
    }
  }

  return { evaluated, errors };
}
```

- [ ] **Step 2: 写 `backend/src/jobs/dailyAffinityEval.ts`**

```ts
import cron from 'node-cron';
import { evaluateAllUsersYesterday } from '../services/affinity-eval';

export function startDailyAffinityCron() {
  if (!cron.validate('0 2 * * *')) {
    console.error('Cron 表达式无效');
    return;
  }
  cron.schedule('0 2 * * *', async () => {
    const start = Date.now();
    console.log('[cron] 每日评估开始', new Date().toISOString());
    try {
      const result = await evaluateAllUsersYesterday();
      console.log(`[cron] 评估完成: ${result.evaluated} 成功, ${result.errors} 错误, 耗时 ${Date.now() - start}ms`);
    } catch (e: any) {
      console.error('[cron] 评估异常:', e.message);
    }
  }, { timezone: 'Asia/Shanghai' });
  console.log('[cron] 每日评估已注册: 0 2 * * * (Asia/Shanghai)');
}
```

- [ ] **Step 3: 在 `backend/src/index.ts` 启动时注册**

在 `app.listen(...)` 之前:
```ts
import { startDailyAffinityCron } from './jobs/dailyAffinityEval';
startDailyAffinityCron();
```

- [ ] **Step 4: tsc + commit**

```bash
./node_modules/.bin/tsc --noEmit
git add backend/src/services/affinity-eval.ts backend/src/jobs/dailyAffinityEval.ts backend/src/index.ts
git commit -m "feat(cron): 每日 2 点评估 affinity + memory"
```

---

## Task 3.6: 前端 AffinityMeter / IntimateModeToggle / UnlockCelebration 组件

**Files:** `frontend/src/components/AffinityMeter.tsx`, `IntimateModeToggle.tsx`, `UnlockCelebration.tsx`

- [ ] **Step 1: 写 `AffinityMeter.tsx`**

```tsx
interface Props {
  affinity: number;
  stage: 'stranger' | 'familiar' | 'flirtatious' | 'intimate';
  variant: 'card' | 'header' | 'compact';
}

const STAGE_LABEL: Record<Props['stage'], string> = {
  stranger: '陌生',
  familiar: '熟悉',
  flirtatious: '暧昧',
  intimate: '亲密',
};

const STAGE_COLOR: Record<Props['stage'], string> = {
  stranger: '#aaa',
  familiar: '#88D066',
  flirtatious: '#FFD966',
  intimate: '#FF6B9D',
};

export default function AffinityMeter({ affinity, stage, variant }: Props) {
  if (variant === 'card') {
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${affinity}%`, height: '100%', background: `linear-gradient(90deg, #FFD966, #FF6B9D)`, borderRadius: 3 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: '#888' }}>
          <span>💕 {STAGE_LABEL[stage]}中 {affinity}%</span>
          <span>再 {100 - affinity}% 解锁亲密</span>
        </div>
      </div>
    );
  }
  if (variant === 'header') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ height: 4, width: 80, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${affinity}%`, height: '100%', background: STAGE_COLOR[stage] }} />
        </div>
        <span style={{ fontSize: 11, color: STAGE_COLOR[stage], fontWeight: 'bold' }}>{STAGE_LABEL[stage]} {affinity}%</span>
      </div>
    );
  }
  return <span style={{ color: STAGE_COLOR[stage] }}>💕 {affinity}%</span>;
}
```

- [ ] **Step 2: 写 `IntimateModeToggle.tsx`**

```tsx
import { useState } from 'react';
import { affinityApi } from '../api/client';

interface Props {
  characterId: string;
  mode: 'daily' | 'intimate';
  onChange: (m: 'daily' | 'intimate') => void;
}

export default function IntimateModeToggle({ characterId, mode, onChange }: Props) {
  const [loading, setLoading] = useState(false);
  const handle = async (m: 'daily' | 'intimate') => {
    if (m === mode || loading) return;
    setLoading(true);
    try {
      await affinityApi.setMode(characterId, m);
      onChange(m);
    } catch (e: any) {
      alert('切换失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div style={{ display: 'inline-flex', border: '1px solid #FF6B9D', borderRadius: 16, overflow: 'hidden', fontSize: 12 }}>
      <button onClick={() => handle('daily')} disabled={loading}
        style={{ padding: '4px 10px', border: 'none', background: mode === 'daily' ? '#FF6B9D' : 'transparent', color: mode === 'daily' ? 'white' : '#FF6B9D', cursor: 'pointer' }}>
        💖 日常
      </button>
      <button onClick={() => handle('intimate')} disabled={loading}
        style={{ padding: '4px 10px', border: 'none', background: mode === 'intimate' ? '#FF6B9D' : 'transparent', color: mode === 'intimate' ? 'white' : '#FF6B9D', cursor: 'pointer' }}>
        💕 亲密
      </button>
    </div>
  );
}
```

- [ ] **Step 3: 写 `UnlockCelebration.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { affinityApi } from '../api/client';

interface Props {
  characterId: string;
  characterName: string;
  characterAvatar: string;
  onClose: () => void;
}

export default function UnlockCelebration({ characterId, characterName, characterAvatar, onClose }: Props) {
  const [greeting, setGreeting] = useState<string | null>(null);

  useEffect(() => {
    affinityApi.getSpecialGreeting(characterId)
      .then(r => setGreeting(r.data.greeting))
      .catch(e => setGreeting('(生成问候失败: ' + e.message + ')'));
  }, [characterId]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 32, maxWidth: 360, textAlign: 'center' }}>
        <div style={{ fontSize: 80, marginBottom: 12 }}>{characterAvatar}</div>
        <h2 style={{ color: '#FF6B9D', margin: '0 0 16px' }}>💕 100% 达成!</h2>
        <p>你和 <strong>{characterName}</strong> 的亲密度达到顶峰,关系升级为:</p>
        <h3 style={{ color: '#FF6B9D' }}>亲密</h3>
        <div style={{ background: '#FFF0F5', padding: 16, borderRadius: 8, margin: '16px 0', fontStyle: 'italic' }}>
          {greeting ?? '生成中...'}
        </div>
        <button onClick={onClose} style={{ padding: '8px 24px', background: '#FF6B9D', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
          开启我们的故事 →
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 在 `frontend/src/api/client.ts` 加 affinityApi**

```ts
export const affinityApi = {
  get: (characterId: string) =>
    request<{ success: boolean; data: AffinityState }>(`/characters/${characterId}/affinity`),
  setMode: (characterId: string, mode: 'daily' | 'intimate') =>
    request<{ success: boolean; data: { mode: string } }>(`/characters/${characterId}/mode`, {
      method: 'PUT', body: JSON.stringify({ mode }),
    }),
  setDifficulty: (characterId: string, difficulty: 'easy' | 'normal' | 'hard') =>
    request<{ success: boolean; data: { difficulty: string } }>(`/characters/${characterId}/difficulty`, {
      method: 'PUT', body: JSON.stringify({ difficulty }),
    }),
  getSpecialGreeting: (characterId: string) =>
    request<{ success: boolean; data: { greeting: string } }>(`/characters/${characterId}/special-greeting`),
};
```

`AffinityState` 类型从 `./types` import(见下一步)。

- [ ] **Step 5: 加类型到 `frontend/src/api/types.ts`**

```ts
export type AffinityStage = 'stranger' | 'familiar' | 'flirtatious' | 'intimate';

export interface AffinityState {
  affinity: number;
  stage: AffinityStage;
  mode: 'daily' | 'intimate';
  unlockedAt: string | null;
  latestReason: string | null;
  latestDelta: number | null;
  difficulty: 'easy' | 'normal' | 'hard';
}
```

- [ ] **Step 6: tsc + commit**

```bash
./node_modules/.bin/tsc -b
git add frontend/src/components/AffinityMeter.tsx frontend/src/components/IntimateModeToggle.tsx frontend/src/components/UnlockCelebration.tsx frontend/src/api/client.ts frontend/src/api/types.ts
git commit -m "feat(frontend): AffinityMeter / IntimateModeToggle / UnlockCelebration 组件"
```

---

## Task 3.7: Chat 页集成

**Files:** `frontend/src/pages/Chat.tsx`

- [ ] **Step 1: Chat.tsx 顶部加状态**

```tsx
const [affinityState, setAffinityState] = useState<AffinityState | null>(null);
const [showCelebration, setShowCelebration] = useState(false);
```

- [ ] **Step 2: useEffect 拉 affinity state**

在 `loadAll` 里加 `affinityApi.get(characterId).then(r => setAffinityState(r.data))`,或独立 useEffect。

- [ ] **Step 3: 检测首次 100% → 弹庆祝**

```tsx
useEffect(() => {
  if (affinityState?.unlockedAt) {
    const seenKey = `seen_celebration_for_${characterId}`;
    if (!localStorage.getItem(seenKey)) {
      setShowCelebration(true);
      localStorage.setItem(seenKey, 'true');
    }
  }
}, [affinityState?.unlockedAt, characterId]);
```

- [ ] **Step 4: 头部加 AffinityMeter + IntimateModeToggle**

在 header 里 description 下方加:
```tsx
{affinityState && (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
    <AffinityMeter affinity={affinityState.affinity} stage={affinityState.stage} variant="header" />
    {affinityState.unlockedAt && (
      <IntimateModeToggle characterId={characterId} mode={affinityState.mode}
        onChange={m => setAffinityState(s => s ? { ...s, mode: m } : s)} />
    )}
  </div>
)}
```

- [ ] **Step 5: 在组件底部加庆祝弹窗**

```tsx
{showCelebration && character && (
  <UnlockCelebration characterId={characterId} characterName={character.name} characterAvatar={character.avatar} onClose={() => setShowCelebration(false)} />
)}
```

- [ ] **Step 6: tsc + commit**

```bash
./node_modules/.bin/tsc -b
git add frontend/src/pages/Chat.tsx
git commit -m "feat(chat): 集成 AffinityMeter + IntimateModeToggle + 100% 庆祝弹窗"
```

---

## Task 3.8: Home 页集成

**Files:** `frontend/src/pages/Home.tsx`

- [ ] **Step 1: 在 Home.tsx 加 affinity 状态和加载逻辑**

在文件顶部 import:
```tsx
import { useEffect, useRef, useState } from 'react';
import AffinityMeter from '../components/AffinityMeter';
import { affinityApi, type AffinityState } from '../api/client';
```

在 `Home` 组件内,`const navigate = useNavigate();` 之后加:
```tsx
const [affinities, setAffinities] = useState<Record<string, AffinityState>>({});
```

改 `load` 函数,在 `setExtrasCount(counts);` 之后加:
```tsx
const aff: Record<string, AffinityState> = {};
await Promise.all(
  c.data.map(async (char: Character) => {
    try {
      const r = await affinityApi.get(char.id);
      aff[char.id] = r.data;
    } catch {
      aff[char.id] = { affinity: 0, stage: 'stranger', mode: 'daily', unlockedAt: null, latestReason: null, latestDelta: null, difficulty: 'normal' };
    }
  })
);
setAffinities(aff);
```

- [ ] **Step 2: 在角色卡片 description 下方加 AffinityMeter**

找到 `<div className="desc">{c.description}</div>` 后面加:
```tsx
{affinities[c.id] && (
  <AffinityMeter affinity={affinities[c.id].affinity} stage={affinities[c.id].stage} variant="card" />
)}
```

- [ ] **Step 3: tsc + commit**

```bash
./node_modules/.bin/tsc -b
git add frontend/src/pages/Home.tsx
git commit -m "feat(home): 角色卡显示 AffinityMeter"
```

---

## Task 3.9: PR3 收尾

- [ ] **Step 1: 完整 tsc + 测试**

```bash
cd "/Users/eya/Desktop/AI chat"
./backend/node_modules/.bin/tsc -p backend --noEmit
./frontend/node_modules/.bin/tsc -b frontend
cd backend && npm test
```

- [ ] **Step 2: 手动 e2e**

- 跑后端 + 前端
- 登录 → 角色卡显示"陌生 0%"
- 跟林默聊几条 → 等 2 点 cron(或者临时改成 `* * * * *` 跑 1 分钟看效果)
- 看到 affinity 涨 + stage 变化
- 模拟 100%(手动 SQL `update user_character_state set affinity=100, unlocked_at=now() where ...`)
- 进 chat 弹庆祝

- [ ] **Step 3: 改回 cron 表达式 + commit**

```bash
git commit --allow-empty -m "chore: PR3 完成验收"
```

---

# PR4: UX 收尾(Extras Tabs + 记忆按月分组 + 难度选择)

**目标:** 把"最后一块" UX 补完:Extras 改 Tabs、记忆按月分组可折叠 + 内联编辑、CharacterEdit 加难度选择。

**前置:** PR3 完成。

**改完验收:**
- Extras 顶部 4 个 tab,切换流畅
- 记忆页(/character/:id/memories)按月分组,可折叠,点条目可内联编辑
- 难度选择器在 CharacterEdit 页可见(仅自定义角色)
- 所有改动 tsc 干净

## File 地图

```
frontend/src/
  components/
    MemoryRow.tsx            -- 新增
    ExtraRow.tsx             -- 新增
    DifficultySelector.tsx   -- 新增
  pages/
    CharacterExtras.tsx      -- 改:4 Tabs 视图
    CharacterEdit.tsx        -- 改:加 <DifficultySelector>
    Memories.tsx             -- 新增(按月分组)
  api/client.ts              -- 改:加 memoriesApi 的 add/edit/delete
```

## Task 4.1: MemoryRow 组件(内联编辑)

**Files:** `frontend/src/components/MemoryRow.tsx`

- [ ] **Step 1: 写组件**

```tsx
import { useState } from 'react';
import { memoriesApi } from '../api/client';

export interface Memory {
  id: string;
  character_id: string;
  memory_date: string;  // YYYY-MM-DD
  summary: string;
  affinity_delta: number | null;
  affinity_reason: string | null;
  source: 'ai' | 'user';
}

interface Props {
  memory: Memory;
  onUpdated: () => void;
  onDeleted: () => void;
}

export default function MemoryRow({ memory, onUpdated, onDeleted }: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(memory.summary);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await memoriesApi.update(memory.id, { summary: text });
      onUpdated();
      setEditing(false);
    } catch (e: any) {
      alert('保存失败: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('确定删除？')) return;
    try {
      await memoriesApi.delete(memory.id);
      onDeleted();
    } catch (e: any) {
      alert('删除失败: ' + e.message);
    }
  };

  if (editing) {
    return (
      <div style={{ background: 'white', borderLeft: '3px solid #FF6B9D', padding: 10, borderRadius: 6, marginBottom: 8 }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleSave();
            } else if (e.key === 'Escape') {
              setText(memory.summary);
              setEditing(false);
            }
          }}
          rows={4}
          autoFocus
          style={{ width: '100%', padding: 6, fontSize: 12 }}
        />
        <div style={{ marginTop: 6, fontSize: 11, color: '#888' }}>
          Ctrl+Enter 保存,Esc 取消
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'white', borderLeft: '3px solid #FF6B9D', padding: 10, borderRadius: 6, marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 12 }}>📔 {memory.memory_date}{memory.source === 'user' && <span style={{ fontSize: 10, color: '#999', marginLeft: 6 }}>(手动)</span>}</strong>
        <div style={{ display: 'flex', gap: 4 }}>
          <span style={{ cursor: 'pointer' }} onClick={() => setEditing(true)}>✏️</span>
          <span style={{ cursor: 'pointer' }} onClick={handleDelete}>🗑️</span>
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#666', marginTop: 6, lineHeight: 1.5 }}>{memory.summary}</div>
      {memory.affinity_reason && (
        <div style={{ fontSize: 10, color: '#FF6B9D', marginTop: 4 }}>💕 {memory.affinity_delta! >= 0 ? '+' : ''}{memory.affinity_delta} · {memory.affinity_reason}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 在 client.ts 加 memoriesApi(add/edit/delete + list)**

```ts
export const memoriesApi = {
  list: (characterId: string) =>
    request<{ success: boolean; data: any[] }>(`/memories/character/${characterId}`),
  // 已有 (继续保留)
  // ... 已有 .summarize, .latest
  add: (characterId: string, date: string, summary: string) =>
    request<{ success: boolean; data: any }>('/memories', {
      method: 'POST', body: JSON.stringify({ characterId, date, summary }),
    }),
  update: (id: string, data: { summary: string }) =>
    request<{ success: boolean; data: any }>(`/memories/${id}`, {
      method: 'PUT', body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ success: boolean }>(`/memories/${id}`, { method: 'DELETE' }),
};
```

- [ ] **Step 3: tsc + commit**

```bash
./node_modules/.bin/tsc -b
git add frontend/src/components/MemoryRow.tsx frontend/src/api/client.ts
git commit -m "feat(frontend): MemoryRow 内联编辑组件"
```

---

## Task 4.2: ExtraRow 组件(同模式,内联编辑 Extras 条目)

**Files:** `frontend/src/components/ExtraRow.tsx`

- [ ] **Step 1: 写组件**

```tsx
import { useState } from 'react';
import { extrasApi } from '../api/client';

export interface Extra {
  id: string;
  character_id: string;
  type: 'note' | 'story' | 'relationship' | 'memory_hint';
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  extra: Extra;
  onUpdated: () => void;
  onDeleted: () => void;
}

export default function ExtraRow({ extra, onUpdated, onDeleted }: Props) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(extra.title);
  const [content, setContent] = useState(extra.content);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await extrasApi.update(extra.id, { title, content });
      onUpdated();
      setEditing(false);
    } catch (e: any) {
      alert('保存失败: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('确定删除？')) return;
    try {
      await extrasApi.delete(extra.id);
      onDeleted();
    } catch (e: any) {
      alert('删除失败: ' + e.message);
    }
  };

  if (editing) {
    return (
      <div style={{ background: 'white', padding: 10, borderRadius: 6, marginBottom: 8 }}>
        <input value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', padding: 6, marginBottom: 6 }} />
        <textarea
          value={content} onChange={e => setContent(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSave(); }
            else if (e.key === 'Escape') { setTitle(extra.title); setContent(extra.content); setEditing(false); }
          }}
          rows={3} autoFocus style={{ width: '100%', padding: 6, fontSize: 12 }}
        />
        <div style={{ marginTop: 6, fontSize: 11, color: '#888' }}>Ctrl+Enter 保存,Esc 取消</div>
      </div>
    );
  }

  return (
    <div style={{ background: 'white', padding: 10, borderRadius: 6, marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <strong style={{ fontSize: 13 }}>{extra.title}</strong>
        <div style={{ display: 'flex', gap: 4 }}>
          <span style={{ cursor: 'pointer' }} onClick={() => setEditing(true)}>✏️</span>
          <span style={{ cursor: 'pointer' }} onClick={handleDelete}>🗑️</span>
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{extra.content}</div>
    </div>
  );
}
```

- [ ] **Step 2: tsc + commit**

```bash
./node_modules/.bin/tsc -b
git add frontend/src/components/ExtraRow.tsx
git commit -m "feat(frontend): ExtraRow 内联编辑组件"
```

---

## Task 4.3: CharacterExtras 改 Tabs

**Files:** `frontend/src/pages/CharacterExtras.tsx`

- [ ] **Step 1: 完整覆盖 `frontend/src/pages/CharacterExtras.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { charactersApi, extrasApi } from '../api/client';
import ExtraRow, { type Extra } from '../components/ExtraRow';
import './Extras.css';

const TABS = [
  { type: 'note' as const, label: '📝 补充设定', desc: '语气、习惯、个性化设定' },
  { type: 'story' as const, label: '📖 故事背景', desc: '你们之间发生过的故事' },
  { type: 'relationship' as const, label: '💕 关系记录', desc: '关系进展、关键时刻' },
  { type: 'memory_hint' as const, label: '💡 记忆提示', desc: '提醒 AI 注意的事' },
];

export default function CharacterExtras() {
  const { characterId } = useParams();
  const navigate = useNavigate();
  const [character, setCharacter] = useState<any>(null);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [activeTab, setActiveTab] = useState<typeof TABS[number]['type']>('note');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Extra | null>(null);
  const [form, setForm] = useState({ title: '', content: '' });

  const load = async () => {
    if (!characterId) return;
    const [ch, ext] = await Promise.all([
      charactersApi.get(characterId),
      extrasApi.list(characterId),
    ]);
    setCharacter(ch.data);
    setExtras(ext.data);
  };

  useEffect(() => { load(); }, [characterId]);

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim() || !characterId) return;
    try {
      if (editing) {
        await extrasApi.update(editing.id, form);
      } else {
        await extrasApi.create({ character_id: characterId, type: activeTab, ...form });
      }
      setShowModal(false);
      setEditing(null);
      setForm({ title: '', content: '' });
      await load();
    } catch (e: any) {
      alert('保存失败: ' + e.message);
    }
  };

  if (!character) return <div className="extras-loading">加载中...</div>;

  const filtered = extras.filter(e => e.type === activeTab);

  return (
    <div className="extras-page">
      <header className="extras-header">
        <button className="back-btn" onClick={() => navigate(`/chat/${characterId}`)}>←</button>
        <div className="extras-header-info">
          <strong>{character.name}</strong>
          <div style={{ fontSize: 11, color: '#888' }}>补充资料</div>
        </div>
        <button className="btn-add" onClick={() => { setEditing(null); setForm({ title: '', content: '' }); setShowModal(true); }}>+ 新增</button>
      </header>

      <div style={{ display: 'flex', borderBottom: '2px solid #eee', marginBottom: 12 }}>
        {TABS.map(tab => (
          <button key={tab.type} onClick={() => setActiveTab(tab.type)}
            style={{ padding: '8px 12px', border: 'none', borderBottom: activeTab === tab.type ? '2px solid #FF6B9D' : '2px solid transparent', background: 'none', cursor: 'pointer', fontWeight: activeTab === tab.type ? 'bold' : 'normal', color: activeTab === tab.type ? '#FF6B9D' : '#666' }}>
            {tab.label} ({extras.filter(e => e.type === tab.type).length})
          </button>
        ))}
      </div>

      <div style={{ padding: 12 }}>
        <p style={{ fontSize: 12, color: '#888' }}>{TABS.find(t => t.type === activeTab)?.desc}</p>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#aaa', padding: 32 }}>还没有{TABS.find(t => t.type === activeTab)?.label},点右上角"+ 新增"开始</div>
        ) : (
          filtered.map(e => <ExtraRow key={e.id} extra={e} onUpdated={load} onDeleted={load} />)
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>{editing ? '编辑' : '新增'}{TABS.find(t => t.type === activeTab)?.label}</h3>
            <div className="form-group">
              <label>标题 *</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="form-group">
              <label>内容 *</label>
              <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={6} />
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowModal(false)}>取消</button>
              <button onClick={handleSave}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: tsc + commit**

```bash
./node_modules/.bin/tsc -b
git add frontend/src/pages/CharacterExtras.tsx
git commit -m "feat(frontend): CharacterExtras 改 4 Tabs 视图"
```

---

## Task 4.4: Memories 页(按月分组 + 可折叠)

**Files:** `frontend/src/pages/Memories.tsx`

- [ ] **Step 1: 写组件**

```tsx
import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { memoriesApi, charactersApi } from '../api/client';
import MemoryRow, { type Memory } from '../components/MemoryRow';

export default function Memories() {
  const { characterId } = useParams();
  const navigate = useNavigate();
  const [character, setCharacter] = useState<any>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newText, setNewText] = useState('');

  const load = async () => {
    if (!characterId) return;
    const [ch, mem] = await Promise.all([
      charactersApi.get(characterId),
      memoriesApi.list(characterId),
    ]);
    setCharacter(ch.data);
    setMemories(mem.data);
  };

  useEffect(() => { load(); }, [characterId]);

  const grouped = useMemo(() => {
    const map = new Map<string, Memory[]>();
    memories.forEach(m => {
      const ym = m.memory_date.substring(0, 7); // YYYY-MM
      if (!map.has(ym)) map.set(ym, []);
      map.get(ym)!.push(m);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [memories]);

  const handleAdd = async () => {
    if (!newText.trim() || !characterId) return;
    try {
      await memoriesApi.add(characterId, newDate, newText);
      setAdding(false);
      setNewText('');
      await load();
    } catch (e: any) {
      alert('新增失败: ' + e.message);
    }
  };

  if (!character) return <div style={{ padding: 40 }}>加载中...</div>;

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <button onClick={() => navigate(`/chat/${characterId}`)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>←</button>
        <strong>{character.name} 的记忆</strong>
        <button onClick={() => setAdding(true)} style={{ background: '#FF6B9D', color: 'white', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>+ 新增</button>
      </div>
      <div style={{ fontSize: 11, color: '#999', marginBottom: 12 }}>共 {memories.length} 条记忆</div>

      {adding && (
        <div style={{ background: 'white', padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <div style={{ marginBottom: 6 }}>
            日期:<input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={{ marginLeft: 8 }} />
          </div>
          <textarea value={newText} onChange={e => setNewText(e.target.value)} rows={4} placeholder="写下你想记住的事..." style={{ width: '100%', padding: 6 }} />
          <div style={{ marginTop: 8, textAlign: 'right' }}>
            <button onClick={() => setAdding(false)} style={{ marginRight: 8 }}>取消</button>
            <button onClick={handleAdd} style={{ background: '#FF6B9D', color: 'white', border: 'none', padding: '5px 12px', borderRadius: 6 }}>保存</button>
          </div>
        </div>
      )}

      {grouped.map(([ym, items]) => {
        const isCollapsed = collapsed[ym];
        return (
          <div key={ym} style={{ marginBottom: 8 }}>
            <div onClick={() => setCollapsed({ ...collapsed, [ym]: !isCollapsed })}
              style={{ background: 'white', padding: 10, borderRadius: 6, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
              <strong>📅 {ym}</strong>
              <span>{isCollapsed ? '▶' : '▼'} ({items.length})</span>
            </div>
            {!isCollapsed && (
              <div style={{ paddingLeft: 14, marginTop: 6 }}>
                {items.map(m => (
                  <MemoryRow key={m.id} memory={m} onUpdated={load} onDeleted={load} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: 加路由 `frontend/src/App.tsx`**

(已在 PR1 Task 1.7 加过 `/character/:id/memories`,本任务确保 Memories.tsx 已实现)

- [ ] **Step 3: tsc + commit**

```bash
./node_modules/.bin/tsc -b
git add frontend/src/pages/Memories.tsx frontend/src/App.tsx
git commit -m "feat(frontend): Memories 页(按月分组 + 内联编辑 + 新增)"
```

---

## Task 4.5: DifficultySelector + CharacterEdit 集成

**Files:** `frontend/src/components/DifficultySelector.tsx`, `frontend/src/pages/CharacterEdit.tsx`

- [ ] **Step 1: 写 DifficultySelector**

```tsx
interface Props {
  value: 'easy' | 'normal' | 'hard';
  onChange: (v: 'easy' | 'normal' | 'hard') => void;
}

const OPTIONS = [
  { value: 'easy' as const, label: '💚 简单', desc: '好感度涨得快' },
  { value: 'normal' as const, label: '💛 普通', desc: '正常节奏' },
  { value: 'hard' as const, label: '❤️ 困难', desc: '需要长期培养' },
];

export default function DifficultySelector({ value, onChange }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {OPTIONS.map(opt => (
        <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, border: `2px solid ${value === opt.value ? '#FF6B9D' : 'transparent'}`, borderRadius: 8, background: value === opt.value ? '#FFF0F5' : 'white', cursor: 'pointer' }}>
          <input type="radio" name="difficulty" value={opt.value} checked={value === opt.value} onChange={() => onChange(opt.value)} />
          <span><strong>{opt.label}</strong> · {opt.desc}</span>
        </label>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: CharacterEdit 加 difficulty 字段**

- 加 state `difficulty`
- 加 `<DifficultySelector />`
- 保存时调 `affinityApi.setDifficulty`
- 预设角色隐藏此字段

- [ ] **Step 3: tsc + commit**

```bash
./node_modules/.bin/tsc -b
git add frontend/src/components/DifficultySelector.tsx frontend/src/pages/CharacterEdit.tsx
git commit -m "feat(frontend): DifficultySelector + CharacterEdit 集成"
```

---

## Task 4.6: 记忆页入口(Chat 页 📝 按钮跳过去)

**Files:** `frontend/src/pages/Chat.tsx`

- [ ] **Step 1: 改 📝 按钮 onClick**

从 "调 memoriesApi.summarize" 改为 "navigate(`/character/${characterId}/memories`)"

- [ ] **Step 2: tsc + commit**

```bash
./node_modules/.bin/tsc -b
git add frontend/src/pages/Chat.tsx
git commit -m "feat(chat): 📝 按钮改为跳到记忆页"
```

---

## Task 4.7: PR4 收尾

- [ ] **Step 1: 完整 tsc + 测试**

```bash
cd "/Users/eya/Desktop/AI chat"
./backend/node_modules/.bin/tsc -p backend --noEmit
./frontend/node_modules/.bin/tsc -b frontend
cd backend && npm test
```

- [ ] **Step 2: 手动 e2e**

- Extras 顶部 4 tab,切换流畅
- 记忆页按月分组,可折叠,内联编辑
- 编辑自定义角色时,难度选择器可见;预设角色不显示
- Chat 页 📝 跳到记忆页

- [ ] **Step 3: 最终 commit**

```bash
git commit --allow-empty -m "chore: PR4 完成验收,所有 4 个 PR 完成"
```

---

# 全局收尾

- [ ] **跑完整 tsc(后端 + 前端)**

```bash
cd "/Users/eya/Desktop/AI chat"
./backend/node_modules/.bin/tsc -p backend --noEmit
./frontend/node_modules/.bin/tsc -b frontend
```

- [ ] **跑所有后端测试**

```bash
cd backend && npm test
```

- [ ] **更新 README.md 反映新功能**

- 在 README 加 "用户系统 + 好感度 + 可编辑记忆" 章节
- 更新 "本地启动" 步骤(SUPABASE_URL / ANON_KEY 之外,需 SUPABASE service_role key 配置)

- [ ] **更新 .env.example**

加新的环境变量注释

- [ ] **更新 package.json scripts**

加 `test:smoke` 等

- [ ] **最终 commit**

```bash
git add -A
git commit -m "docs: README 反映新功能"
```