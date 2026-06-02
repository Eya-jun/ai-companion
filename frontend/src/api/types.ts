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
