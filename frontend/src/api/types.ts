// 类型定义

export type LLMProvider = 'kimi' | 'deepseek' | 'minimax';

export interface Character {
  id: string;
  name: string;
  description?: string;
  system_prompt: string;
  avatar: string;
  is_preset: boolean;
  greeting: string;
  created_at?: string;
  updated_at?: string;
}

export interface Message {
  id: string;
  character_id?: string;
  group_id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sender_id?: string;
  sender_name?: string;
  sender_type: 'user' | 'character' | 'system';
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  members?: Array<{
    character_id: string;
    characters: Character;
  }>;
}

// ===== Auth 相关 =====

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

// ===== Affinity 相关(PR3 用,先定义) =====

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
