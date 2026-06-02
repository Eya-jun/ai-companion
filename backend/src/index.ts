import express from 'express';
import cors from 'cors';
import { config } from './config/env';
import { internalTokenAuth, requireAuth } from './middleware/auth';
import './types/express'; // 加载 Express.Request 的 user 类型扩展
import { initPresetCharacters } from './routes/characters';
import charactersRouter from './routes/characters';
import chatRouter from './routes/chat';
import groupsRouter from './routes/groups';
import memoriesRouter from './routes/memories';
import extrasRouter from './routes/extras';
import avatarsRouter from './routes/avatars';
import authRouter from './routes/auth';
import profileRouter from './routes/profile';
import affinityRouter from './routes/affinity';

const app = express();

app.use(cors({
  origin: (origin, callback) => {
    // 同源请求(浏览器 devtools、curl、服务端调用)通常没 origin,放行
    if (!origin) return callback(null, true);
    if (config.allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS: 来源 ${origin} 不在白名单中`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// 鉴权(默认关闭,设置了 INTERNAL_TOKEN 才生效)
app.use('/api', internalTokenAuth);

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      defaultLLM: config.llm.default,
    },
  });
});

// 路由
app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
// 业务路由:统一 requireAuth
app.use('/api/characters', requireAuth, charactersRouter);
app.use('/api/chat', requireAuth, chatRouter);
app.use('/api/groups', requireAuth, groupsRouter);
app.use('/api/memories', requireAuth, memoriesRouter);
app.use('/api/extras', requireAuth, extrasRouter);
app.use('/api/avatars', requireAuth, avatarsRouter);
app.use('/api', requireAuth, affinityRouter);

// 错误处理(必须 4 参数才是 Express error 中间件)
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, error: err?.message || '服务器错误' });
});

// 启动
async function start() {
  try {
    // 初始化预设角色
    console.log('🚀 启动中...');
    await initPresetCharacters();
    console.log('✅ 预设角色初始化完成');

    app.listen(config.port, () => {
      console.log(`\n🎉 服务器已启动: http://localhost:${config.port}`);
      console.log(`📝 API 文档:`);
      console.log(`   GET  /api/health`);
      console.log(`   GET  /api/characters`);
      console.log(`   POST /api/characters`);
      console.log(`   POST /api/chat`);
      console.log(`   GET  /api/chat/:characterId/messages`);
      console.log(`   GET  /api/groups`);
      console.log(`   POST /api/groups`);
      console.log(`   POST /api/groups/:id/chat`);
      console.log(`   POST /api/groups/:id/trigger`);
      console.log(`   POST /api/memories/summarize`);
      console.log(`\n🤖 默认 LLM: ${config.llm.default}`);
    });
  } catch (error: any) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

start();
