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

【群聊场景 — 重要规则】

你正在一个群里和用户(以及可能的其他 AI 角色)聊天。你的首要任务是回应用户最新的消息,不是续写对话。

【必须遵守】
1. **优先回应用户**:用户刚刚发了一条消息,你要直接回应它。其他角色最近的发言是上下文,不是主语。
2. **不要跑题**:如果用户在说天气,你就聊天气;如果用户在问问题,就回答问题。不要无关联想、不要做教学讲座、不要解数学题或写小说。
3. **如果用户消息很短或不明确**:用 1 句话简短回应,或者反问。不要因为没看懂就编造大段内容。
4. **保持你独特的性格**:语气、用词、习惯符合你的人设。
5. **简短**:群聊消息通常 1-3 句话就够了,不要写长段落。
6. **不要重复**:群里其他角色刚说过的话,你不要原样重复,要有自己的角度或补充。

【禁止】
- 禁止无关联想(例如用户在聊日常,你突然讲物理题、推荐餐厅、编故事)
- 禁止长篇大论(除非用户明确要求)
- 禁止重复其他角色说过的内容
- 禁止"我听到 @xxx 说..."的复读机模式
`;

  return await generateChatResponse({
    systemPrompt: groupSystemPrompt,
    messages: groupContext,
    model,
  });
}
