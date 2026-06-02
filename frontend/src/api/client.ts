// API 客户端
import type { LLMProvider, Character, Message, Group } from './types';

export type { LLMProvider, Character, Message, Group };

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api';
const INTERNAL_TOKEN = import.meta.env.VITE_INTERNAL_TOKEN || '';

function authHeaders(): Record<string, string> {
  return INTERNAL_TOKEN ? { 'X-Internal-Token': INTERNAL_TOKEN } : {};
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
