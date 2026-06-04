import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config/env';
import { internalTokenAuth, requireAuth } from './middleware/auth';
import './types/express'; // 加载 Express.Request 的 user 类型扩展
import { initPresetCharacters } from './routes/characters';
import { loadPresetCharacters } from './data/presets';
import charactersRouter from './routes/characters';
import chatRouter from './routes/chat';
import groupsRouter from './routes/groups';
import memoriesRouter from './routes/memories';
import extrasRouter from './routes/extras';
import avatarsRouter from './routes/avatars';
import authRouter from './routes/auth';
import profileRouter from './routes/profile';
import affinityRouter from './routes/affinity';
import { startDailyAffinityCron } from './jobs/dailyAffinityEval';

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
    // 初始化预设角色(从 backend/data/characters/*.md 加载)
    console.log('🚀 启动中...');
    const presets = await loadPresetCharacters();
    await initPresetCharacters(presets);
    console.log(`✅ 预设角色初始化完成 (${presets.length} 个)`);

    // dev 模式:监听角色 .md 文件,改动后自动重新同步到 Supabase
    if (process.env.NODE_ENV !== 'production') {
      const chokidar = await import('chokidar');
      const watchDir = path.resolve(process.cwd(), 'data/characters');
      const watcher = chokidar.default.watch(path.join(watchDir, '*.md'), {
        ignored: /(^|[\\\/])\../, // 忽略点文件
        persistent: true,
        ignoreInitial: true,
      });
      const reload = async (event: string, filePath: string) => {
        console.log(`\n📝 检测到角色文件 ${event}: ${path.basename(filePath)}`);
        try {
          const fresh = await loadPresetCharacters();
          await initPresetCharacters(fresh);
          console.log('✅ 已自动同步到 Supabase');
        } catch (e: any) {
          console.error('❌ 自动同步失败:', e.message);
        }
      };
      watcher.on('add', p => reload('新增', p));
      watcher.on('change', p => reload('修改', p));
      watcher.on('unlink', p => reload('删除', p));
      console.log(`👀 正在监听角色文件: ${watchDir}/*.md (dev 模式)`);
    }

    app.listen(config.port, () => {
      console.log(`\n🎉 服务器已启动: http://localhost:${config.port}`);
      startDailyAffinityCron();
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
      console.log(`   GET  /api/characters/:id/affinity`);
      console.log(`   PUT  /api/characters/:id/mode`);
      console.log(`   PUT  /api/characters/:id/difficulty`);
      console.log(`   GET  /api/characters/:id/special-greeting`);
      console.log(`\n🤖 默认 LLM: ${config.llm.default}`);
    });
  } catch (error: any) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

start();
