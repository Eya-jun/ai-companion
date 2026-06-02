import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),

  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },

  llm: {
    default: process.env.DEFAULT_LLM || 'kimi',
    kimi: {
      apiKey: process.env.KIMI_API_KEY || '',
      baseURL: process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1',
      model: process.env.KIMI_MODEL || 'kimi-k2.5',
    },
    siliconflow: {
      apiKey: process.env.SILICONFLOW_API_KEY || '',
      baseURL: process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1',
      deepseekModel: process.env.DEEPSEEK_MODEL || 'deepseek-ai/DeepSeek-V3.2',
      minimaxModel: process.env.MINIMAX_MODEL || 'MiniMaxAI/MiniMax-M2.5',
    },
  },

  // 允许的 CORS 来源(逗号分隔),默认仅本机前端
  allowedOrigins: (process.env.ALLOWED_ORIGINS ||
    'http://localhost:5173,http://localhost:3000').split(',').map(s => s.trim()).filter(Boolean),

  // 内部 token:留空则关闭鉴权,设置后所有 /api/* 请求必须带 X-Internal-Token
  internalToken: process.env.INTERNAL_TOKEN || '',
};

// 验证必要的环境变量
const requiredKeys = [
  ['SUPABASE_URL', config.supabase.url],
  ['SUPABASE_SERVICE_ROLE_KEY', config.supabase.serviceRoleKey],
  ['KIMI_API_KEY', config.llm.kimi.apiKey],
  ['SILICONFLOW_API_KEY', config.llm.siliconflow.apiKey],
];

const missing = requiredKeys.filter(([_, v]) => !v).map(([k]) => k);
if (missing.length > 0) {
  console.warn(`⚠️  缺少环境变量: ${missing.join(', ')}`);
}

if (config.internalToken) {
  console.log('🔒 内部鉴权已启用 (X-Internal-Token)');
}
