import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import charactersRouter from '../src/routes/characters';

// Mock supabase 客户端,记录所有查询并返回预置数据
const eqCalls: Array<{ col: string; val: any }> = [];
const orCalls: string[] = [];
const updateEqCalls: Array<{ col: string; val: any }> = [];
const deleteEqCalls: Array<{ col: string; val: any }> = [];

const mockFrom = (table: string) => {
  const query: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn((col: string, val: any) => {
      eqCalls.push({ col, val });
      return query;
    }),
    or: vi.fn((expr: string) => {
      orCalls.push(expr);
      return query;
    }),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() => {
      // 模拟 characters 单条查询
      if (table === 'characters') {
        // GET /:id 路径
        const idEq = eqCalls.find(c => c.col === 'id');
        if (idEq) {
          // 返回一个非预设、非当前用户拥有的角色
          return Promise.resolve({ data: { id: idEq.val, is_preset: false, user_id: 'other-user' }, error: null });
        }
      }
      return Promise.resolve({ data: null, error: null });
    }),
    then: undefined,
  };
  // 模拟 update 链
  query.update = vi.fn((updates: any) => {
    return {
      eq: vi.fn((col: string, val: any) => {
        updateEqCalls.push({ col, val });
        return { select: () => ({ single: () => Promise.resolve({ data: { ...updates, id: val }, error: null }) }) };
      }),
    };
  });
  query.delete = vi.fn(() => ({
    eq: vi.fn((col: string, val: any) => {
      deleteEqCalls.push({ col, val });
      return Promise.resolve({ error: null });
    }),
  }));
  query.insert = vi.fn((data: any) => ({
    select: () => ({ single: () => Promise.resolve({ data: { id: 'new-id', ...data }, error: null }) }),
  }));
  return query;
};

vi.mock('../src/config/supabase', () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: vi.fn((table: string) => mockFrom(table)),
  })),
  getSupabaseClient: vi.fn(),
}));

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  // 模拟 requireAuth 中间件已挂上,设置 user
  req.user = { id: 'user-A', email: 'a@x.com' };
  next();
});
app.use('/api/characters', charactersRouter);

describe('多租户数据隔离', () => {
  it('GET /api/characters 列表加 user_id OR is_preset 过滤', async () => {
    eqCalls.length = 0;
    orCalls.length = 0;
    const res = await request(app).get('/api/characters');
    expect(res.status).toBe(200);
    // 关键断言:用了 or() 过滤 user_id=A 或 is_preset=true
    expect(orCalls.length).toBeGreaterThan(0);
    expect(orCalls[0]).toContain('user-A');
    expect(orCalls[0]).toContain('is_preset');
  });

  it('GET /:id 非预设且不属于当前用户 → 404', async () => {
    eqCalls.length = 0;
    const res = await request(app).get('/api/characters/char-X');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('角色不存在');
  });

  it('PUT /:id PUT 时不允许改 user_id 字段', async () => {
    eqCalls.length = 0;
    updateEqCalls.length = 0;
    // 先给 single 返回 owned 角色
    const mockFromLocal = (table: string) => {
      const q: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => {
          if (table === 'characters') {
            return Promise.resolve({ data: { user_id: 'user-A', is_preset: false }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }),
        update: vi.fn((updates: any) => ({
          eq: vi.fn((col: string, val: any) => {
            updateEqCalls.push({ col, val, updates });
            return { select: () => ({ single: () => Promise.resolve({ data: { ...updates, id: val }, error: null }) }) };
          }),
        })),
      };
      return q;
    };
    // 重新 mock
    const { getSupabaseAdmin } = await import('../src/config/supabase');
    (getSupabaseAdmin as any).mockReturnValue({ from: vi.fn((t: string) => mockFromLocal(t)) });

    const res = await request(app)
      .put('/api/characters/char-Y')
      .send({ name: 'new name', user_id: 'hacker', is_preset: true });
    expect(res.status).toBe(200);
    // 关键断言:user_id 和 is_preset 都被从 updates 里删了
    const lastUpdate = updateEqCalls[updateEqCalls.length - 1];
    expect(lastUpdate.updates.user_id).toBeUndefined();
    expect(lastUpdate.updates.is_preset).toBeUndefined();
    expect(lastUpdate.updates.name).toBe('new name');
  });

  it('DELETE /:id 预设 → 403', async () => {
    // mock: 返回预设角色
    const { getSupabaseAdmin } = await import('../src/config/supabase');
    (getSupabaseAdmin as any).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { is_preset: true, user_id: null }, error: null }),
        delete: vi.fn().mockReturnThis(),
      })),
    });

    const res = await request(app).delete('/api/characters/char-P');
    expect(res.status).toBe(403);
  });

  it('DELETE /:id 非所有者 → 403', async () => {
    const { getSupabaseAdmin } = await import('../src/config/supabase');
    (getSupabaseAdmin as any).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { is_preset: false, user_id: 'other-user' }, error: null }),
        delete: vi.fn().mockReturnThis(),
      })),
    });

    const res = await request(app).delete('/api/characters/char-Q');
    expect(res.status).toBe(403);
  });
});
