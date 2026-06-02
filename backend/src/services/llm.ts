import { chat, LLMProvider, ChatMessage, getDefaultProvider } from '../config/llm-providers';

export interface ChatMessageItem {
  role: 'user' | 'assistant';
  content: string;
  senderName?: string | null;
}

export interface ChatRequest {
  systemPrompt: string;
  messages: ChatMessageItem[];
  model?: LLMProvider;
  temperature?: number;
}

export async function generateChatResponse(req: ChatRequest): Promise<string> {
  const model = req.model || getDefaultProvider();

  const llmMessages: ChatMessage[] = [
    { role: 'system', content: req.systemPrompt },
    ...req.messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
      name: m.senderName || undefined,
    })),
  ];

  return await chat({
    model,
    messages: llmMessages,
    temperature: req.temperature,
  });
}

// 群聊中让单个角色生成回复
export async function generateGroupCharacterResponse(
  character: { id?: string; name: string; system_prompt: string },
  groupContext: Array<{
    role: 'user' | 'assistant';
    content: string;
    senderName?: string;
  }> = [],
  model?: LLMProvider
): Promise<string> {
  // 群聊场景：每个角色发言时，知道群里所有人的存在
  const groupSystemPrompt = `${character.system_prompt}

【重要】这是一个群聊场景，群里有多个角色。请以 ${character.name} 的身份回复，注意：
1. 你可以看到群里其他人的发言
2. 你的回复应该对最近的对话做出自然反应
3. 保持你独特的性格特点
`;

  return await generateChatResponse({
    systemPrompt: groupSystemPrompt,
    messages: groupContext,
    model,
  });
}
