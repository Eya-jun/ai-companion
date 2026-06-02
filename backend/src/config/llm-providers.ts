import OpenAI from 'openai';
import { config } from './env';

export type LLMProvider = 'kimi' | 'deepseek' | 'minimax';
export type MessageRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: MessageRole;
  content: string;
  name?: string;
}

export interface ChatOptions {
  model: LLMProvider;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

// 创建不同 provider 的 OpenAI 客户端
const clients: Record<LLMProvider, OpenAI> = {
  kimi: new OpenAI({
    apiKey: config.llm.kimi.apiKey,
    baseURL: config.llm.kimi.baseURL,
  }),
  deepseek: new OpenAI({
    apiKey: config.llm.siliconflow.apiKey,
    baseURL: config.llm.siliconflow.baseURL,
  }),
  minimax: new OpenAI({
    apiKey: config.llm.siliconflow.apiKey,
    baseURL: config.llm.siliconflow.baseURL,
  }),
};

const modelNames: Record<LLMProvider, string> = {
  kimi: config.llm.kimi.model,
  deepseek: config.llm.siliconflow.deepseekModel,
  minimax: config.llm.siliconflow.minimaxModel,
};

export async function chat(options: ChatOptions): Promise<string> {
  const { model, messages, temperature, maxTokens = 800 } = options;
  const client = clients[model];
  const modelName = modelNames[model];

  try {
    // 某些模型（如 kimi-k2.5）只支持 temperature=1
    const response = await client.chat.completions.create({
      model: modelName,
      messages: messages as any,
      temperature: temperature ?? 1,
      max_tokens: maxTokens,
    });

    return response.choices[0]?.message?.content || '';
  } catch (error: any) {
    console.error(`LLM [${model}] error:`, error?.message || error);
    throw new Error(`LLM调用失败: ${error?.message || '未知错误'}`);
  }
}

// 默认模型
export function getDefaultProvider(): LLMProvider {
  const def = config.llm.default as LLMProvider;
  return ['kimi', 'deepseek', 'minimax'].includes(def) ? def : 'kimi';
}
