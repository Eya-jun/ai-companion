// API 客户端
import type { LLMProvider, Character, Message, Group, UserProfile, AuthSession, AffinityState } from './types';

export type { LLMProvider, Character, Message, Group, UserProfile, AuthSession, AffinityState };

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api';
const INTERNAL_TOKEN = import.meta.env.VITE_INTERNAL_TOKEN || '';

export { API_BASE };
const TOKEN_KEY = 'auth_session';

// ===== Token 持久化 =====

export function getStoredSession(): AuthSession | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as AuthSession; } catch { return null; }
}

export function setStoredSession(session: AuthSession | null) {
  if (typeof localStorage === 'undefined') return;
  if (session) localStorage.setItem(TOKEN_KEY, JSON.stringify(session));
  else localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const session = getStoredSession();
  if (session?.accessToken) headers['Authorization'] = `Bearer ${session.accessToken}`;
  if (INTERNAL_TOKEN) headers['X-Internal-Token'] = INTERNAL_TOKEN;
  return headers;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...options.headers,
    },
    ...options,
  });

  // 401 → 清 token,跳登录页
  if (res.status === 401) {
    setStoredSession(null);
    if (typeof window !== 'undefined' && !window.location.hash.startsWith('#/login')) {
      window.location.hash = '#/login';
    }
    throw new Error('未授权');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || '请求失败');
  }

  return res.json();
}

// ========== Characters ==========
export const charactersApi = {
  list: () => request<{ success: boolean; data: Character[] }>('/characters'),
  get: (id: string) => request<{ success: boolean; data: Character }>(`/characters/${id}`),
  create: (data: Partial<Character>) =>
    request<{ success: boolean; data: Character }>('/characters', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<Character>) =>
    request<{ success: boolean; data: Character }>(`/characters/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ success: boolean }>(`/characters/${id}`, { method: 'DELETE' }),
};

// ========== Chat (Private) ==========
export const chatApi = {
  send: (characterId: string, content: string, model?: LLMProvider) =>
    request<{
      success: boolean;
      data: {
        userMessage: string;
        aiResponse: string;
        character: { id: string; name: string; avatar: string };
      };
    }>('/chat', {
      method: 'POST',
      body: JSON.stringify({ characterId, content, model }),
    }),
  getMessages: (characterId: string) =>
    request<{ success: boolean; data: Message[] }>(`/chat/${characterId}/messages`),
  clear: (characterId: string) =>
    request<{ success: boolean }>(`/chat/${characterId}/messages`, { method: 'DELETE' }),
};

// 流式 chat 事件类型
export type StreamEvent =
  | { meta: { character: { id: string; name: string; avatar: string }; userMessage: string } }
  | { delta: string }
  | { done: true }
  | { error: string };

/**
 * 流式发送消息,逐 chunk 回调
 * onEvent 收到每个 SSE 事件(meta / delta / done / error)
 * 流式完成或出错时 resolve
 */
export async function sendStream(
  characterId: string,
  content: string,
  model: LLMProvider | undefined,
  onEvent: (e: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const session = getStoredSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (session?.accessToken) headers['Authorization'] = `Bearer ${session.accessToken}`;
  if (INTERNAL_TOKEN) headers['X-Internal-Token'] = INTERNAL_TOKEN;

  const res = await fetch(`${API_BASE}/chat/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ characterId, content, model }),
    signal,
  });

  if (res.status === 401) {
    setStoredSession(null);
    throw new Error('未授权');
  }
  if (!res.ok || !res.body) {
    throw new Error(`请求失败: HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE 事件以 \n\n 分隔
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || ''; // 最后一个可能不完整,留到下个 chunk

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      try {
        const evt: StreamEvent = JSON.parse(data);
        onEvent(evt);
        if ('error' in evt) throw new Error((evt as any).error);
      } catch (e: any) {
        // 忽略单条解析错误,继续
        if (e?.name === 'AbortError') throw e;
      }
    }
  }
}

// ========== Groups ==========
export const groupsApi = {
  list: () => request<{ success: boolean; data: Group[] }>('/groups'),
  get: (id: string) => request<{ success: boolean; data: Group }>(`/groups/${id}`),
  create: (data: { name: string; description?: string; characterIds?: string[] }) =>
    request<{ success: boolean; data: Group }>('/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: { name?: string; description?: string }) =>
    request<{ success: boolean; data: Group }>(`/groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ success: boolean }>(`/groups/${id}`, { method: 'DELETE' }),
  addMember: (groupId: string, characterId: string) =>
    request<{ success: boolean }>(`/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ characterId }),
    }),
  removeMember: (groupId: string, characterId: string) =>
    request<{ success: boolean }>(`/groups/${groupId}/members/${characterId}`, {
      method: 'DELETE',
    }),
  sendMessage: (groupId: string, content: string, model?: LLMProvider, triggerAll = false) =>
    request<{
      success: boolean;
      data: { userMessage: Message; responses: Message[]; characters: Character[] };
    }>(`/groups/${groupId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ content, model, triggerAll }),
    }),
  triggerInteraction: (groupId: string, model?: LLMProvider, rounds = 1) =>
    request<{ success: boolean; data: Message[] }>(`/groups/${groupId}/trigger`, {
      method: 'POST',
      body: JSON.stringify({ model, rounds }),
    }),
  getMessages: (groupId: string) =>
    request<{ success: boolean; data: Message[] }>(`/groups/${groupId}/messages`),
};

// ========== Memories ==========
export const memoriesApi = {
  list: (characterId: string) =>
    request<{ success: boolean; data: any[] }>(`/memories/character/${characterId}`),
  latest: (characterId: string) =>
    request<{ success: boolean; data: any }>(`/memories/character/${characterId}/latest`),
  summarize: (characterId: string, date?: string, model?: LLMProvider) =>
    request<{ success: boolean; data: any }>('/memories/summarize', {
      method: 'POST',
      body: JSON.stringify({ characterId, date, model }),
    }),
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

// ========== Extras (角色补充资料) ==========
export const extrasApi = {
  list: (characterId: string) =>
    request<{ success: boolean; data: any[] }>(`/extras/character/${characterId}`),
  create: (data: { character_id: string; type: string; title: string; content: string }) =>
    request<{ success: boolean; data: any }>('/extras', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<{ type: string; title: string; content: string }>) =>
    request<{ success: boolean; data: any }>(`/extras/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ success: boolean }>(`/extras/${id}`, { method: 'DELETE' }),
};

// ========== Auth ==========
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

// ========== Profile (用户卡) ==========
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
    const headers = authHeaders();
    const res = await fetch(`${API_BASE}/profile/avatar`, {
      method: 'POST',
      body: fd,
      headers, // 不设 Content-Type,让浏览器自动加 boundary
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || '上传失败');
    }
    return res.json() as Promise<{ success: boolean; data: { url: string; profile: UserProfile } }>;
  },
};

// ========== Affinity (好感度) ==========
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
