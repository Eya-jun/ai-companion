import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRouter from '../src/routes/auth';

vi.mock('../src/config/supabase', () => ({
  getSupabaseAdmin: vi.fn(() => ({
    auth: {
      admin: {
        createUser: vi.fn(),
        deleteUser: vi.fn(),
      },
    },
    from: vi.fn(),
  })),
  getSupabaseClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async (token: string) => ({
        data: { user: { id: 'u-from-' + token, email: 'a@b.com' } },
        error: null,
      })),
      signInWithPassword: vi.fn(),
      refreshSession: vi.fn(),
    },
    from: vi.fn(),
  })),
}));

vi.mock('../src/services/supabase-user', () => ({
  signupUser: vi.fn(async (email: string, _password: string, name: string) => ({
    accessToken: 'at-' + email,
    refreshToken: 'rt-' + email,
    user: { id: 'u-' + email, email, displayName: name },
  })),
  loginUser: vi.fn(async (email: string, _password: string) => ({
    accessToken: 'at-' + email,
    refreshToken: 'rt-' + email,
    user: { id: 'u-' + email, email },
  })),
  refreshSession: vi.fn(async (rt: string) => ({ accessToken: 'at-' + rt, refreshToken: 'rt-' + rt })),
  logoutUser: vi.fn(async () => {}),
  getProfile: vi.fn(async (_token: string) => ({
    user_id: 'u-1', email: 'a@b.com', display_name: 'a',
  })),
  claimLegacy: vi.fn(async () => ({ success: true })),
}));

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

describe('POST /api/auth/signup', () => {
  it('200 + 返回 tokens', async () => {
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
