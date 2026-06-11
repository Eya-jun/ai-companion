import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkAndSendProactiveMessages } from '../src/jobs/proactiveGreeting';

// ── Mocks ────────────────────────────────────────────────────────────────────

const insertCalls: Array<{ table: string; data: any }> = [];

function makeThenable(result: { data: any; error: any }) {
  return {
    then: (onFulfilled: any) => Promise.resolve(onFulfilled(result)),
  };
}

function buildMockQuery(result: { data: any; error: any }) {
  const q: any = {
    select: vi.fn(() => q),
    eq: vi.fn(() => q),
    is: vi.fn(() => q),
    order: vi.fn(() => q),
    limit: vi.fn(() => q),
    single: vi.fn(() => makeThenable(result)),
    gte: vi.fn(() => makeThenable(result)),
  };
  // Make the query builder itself thenable so `await supabase.from('x').select()` works
  q.then = (onFulfilled: any) => Promise.resolve(onFulfilled(result));
  return q;
}

function buildCountQuery(count: number | null, error?: any) {
  const q: any = {
    select: vi.fn(() => q),
    eq: vi.fn(() => q),
    gte: vi.fn(() => makeThenable({ count, error: error || null })),
  };
  q.then = (onFulfilled: any) => Promise.resolve(onFulfilled({ count, error: error || null }));
  return q;
}

let mockFromImpl = (_table: string) => buildMockQuery({ data: null, error: null });

vi.mock('../src/config/supabase', () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: vi.fn((table: string) => mockFromImpl(table)),
  })),
}));

vi.mock('../src/services/llm', () => ({
  generateChatResponse: vi.fn().mockResolvedValue('想你了，在干嘛呢？'),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function hoursAgoISO(n: number): string {
  return new Date(Date.now() - n * 3600 * 1000).toISOString();
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('checkAndSendProactiveMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertCalls.length = 0;
    mockFromImpl = () => buildMockQuery({ data: null, error: null });
  });

  it('不触发：从未聊过（messages 为空）', async () => {
    mockFromImpl = (table: string) => {
      if (table === 'user_character_state') {
        return buildMockQuery({
          data: [{ user_id: 'u1', character_id: 'c1', affinity: 85 }],
          error: null,
        });
      }
      if (table === 'messages') {
        return buildMockQuery({ data: null, error: { message: '无记录' } });
      }
      return buildMockQuery({ data: null, error: null });
    };

    await checkAndSendProactiveMessages();

    expect(insertCalls.length).toBe(0);
  });

  it('触发：亲密 85，最后消息 4h 前', async () => {
    const createdAt = hoursAgoISO(4);

    mockFromImpl = (table: string) => {
      if (table === 'user_character_state') {
        return buildMockQuery({
          data: [{ user_id: 'u1', character_id: 'c1', affinity: 85 }],
          error: null,
        });
      }
      if (table === 'messages') {
        const q = buildMockQuery({ data: null, error: null });
        q.single = vi.fn(() => makeThenable({
          data: { created_at: createdAt },
          error: null,
        }));
        q.insert = vi.fn((data: any) => {
          insertCalls.push({ table: 'messages', data });
          return Promise.resolve({ error: null });
        });
        return q;
      }
      if (table === 'proactive_log') {
        const q = buildCountQuery(0);
        q.insert = vi.fn((data: any) => {
          insertCalls.push({ table: 'proactive_log', data });
          return Promise.resolve({ error: null });
        });
        return q;
      }
      if (table === 'characters') {
        return buildMockQuery({
          data: { name: '小晴', system_prompt: '活泼开朗' },
          error: null,
        });
      }
      return buildMockQuery({ data: null, error: null });
    };

    await checkAndSendProactiveMessages();

    expect(insertCalls.length).toBe(2);
    expect(insertCalls.some((c) => c.table === 'messages')).toBe(true);
    expect(insertCalls.some((c) => c.table === 'proactive_log')).toBe(true);
  });

  it('不触发：亲密 85，最后消息 2h 前（阈值 3h 未达）', async () => {
    const createdAt = hoursAgoISO(2);

    mockFromImpl = (table: string) => {
      if (table === 'user_character_state') {
        return buildMockQuery({
          data: [{ user_id: 'u1', character_id: 'c1', affinity: 85 }],
          error: null,
        });
      }
      if (table === 'messages') {
        const q = buildMockQuery({ data: null, error: null });
        q.single = vi.fn(() => makeThenable({
          data: { created_at: createdAt },
          error: null,
        }));
        q.insert = vi.fn((data: any) => {
          insertCalls.push({ table: 'messages', data });
          return Promise.resolve({ error: null });
        });
        return q;
      }
      return buildMockQuery({ data: null, error: null });
    };

    await checkAndSendProactiveMessages();

    expect(insertCalls.length).toBe(0);
  });

  it('不触发：陌生 10，最后消息 20h 前（阈值 24h 未达）', async () => {
    const createdAt = hoursAgoISO(20);

    mockFromImpl = (table: string) => {
      if (table === 'user_character_state') {
        return buildMockQuery({
          data: [{ user_id: 'u1', character_id: 'c1', affinity: 10 }],
          error: null,
        });
      }
      if (table === 'messages') {
        const q = buildMockQuery({ data: null, error: null });
        q.single = vi.fn(() => makeThenable({
          data: { created_at: createdAt },
          error: null,
        }));
        q.insert = vi.fn((data: any) => {
          insertCalls.push({ table: 'messages', data });
          return Promise.resolve({ error: null });
        });
        return q;
      }
      return buildMockQuery({ data: null, error: null });
    };

    await checkAndSendProactiveMessages();

    expect(insertCalls.length).toBe(0);
  });

  it('不触发：今天已发满 5 条', async () => {
    const createdAt = hoursAgoISO(4);

    mockFromImpl = (table: string) => {
      if (table === 'user_character_state') {
        return buildMockQuery({
          data: [{ user_id: 'u1', character_id: 'c1', affinity: 85 }],
          error: null,
        });
      }
      if (table === 'messages') {
        const q = buildMockQuery({ data: null, error: null });
        q.single = vi.fn(() => makeThenable({
          data: { created_at: createdAt },
          error: null,
        }));
        q.insert = vi.fn((data: any) => {
          insertCalls.push({ table: 'messages', data });
          return Promise.resolve({ error: null });
        });
        return q;
      }
      if (table === 'proactive_log') {
        const q = buildCountQuery(5);
        q.insert = vi.fn((data: any) => {
          insertCalls.push({ table: 'proactive_log', data });
          return Promise.resolve({ error: null });
        });
        return q;
      }
      return buildMockQuery({ data: null, error: null });
    };

    await checkAndSendProactiveMessages();

    expect(insertCalls.length).toBe(0);
  });
});
