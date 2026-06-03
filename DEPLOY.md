# 部署指南(后端 Railway + 前端 Vercel)

> 让 AI 伴侣**任何设备、任何网络**都能访问。
> 一次性配置,部署后 7×24 在线。

## 架构

```
[用户手机/电脑]
    ↓ HTTPS
[Vercel: 前端 React 静态站](免费,全球 CDN)
    ↓ HTTPS /api/*
[Railway: 后端 Node.js]($5/月免费额度)
    ↓ Supabase 客户端
[Supabase: 数据库 + 鉴权 + 文件存储](免费 50k MAU)
    ↓ HTTPS
[Moonshot / SiliconFlow: Kimi / DeepSeek / MiniMax LLM](按量付费)
```

## 一、前置准备(已完成)

- [x] 已有 Supabase 项目,跑了 4 份 migration:
  - `20260602_pr1_user_profiles.sql`
  - `20260602_pr2_user_id_columns.sql`
  - `20260602_pr3_affinity_and_memory.sql`
  - `20260602_pr4_memories_unique.sql`
- [x] Railway 账号(github 登录)
- [x] Vercel 账号(github 登录)
- [x] 代码已 push 到 GitHub(下一步会做)

## 二、把代码 push 到 GitHub

```bash
cd "/Users/eya/Desktop/AI chat"

# 如果还没 git remote,先在 GitHub 上建一个空 repo(比如 ai-companion),然后:
git remote add origin https://github.com/YOUR_USERNAME/ai-companion.git
git branch -M main
git push -u origin main
```

> ⚠️ **不要 commit `.env` 文件**(.env 在 .gitignore 里,安全的)
> ✅ `.env.example` 应该 commit(只示意,不包含真实 key)

## 三、部署后端到 Railway

### 3.1 新建项目

1. 进 https://railway.app/dashboard
2. 点 **"New Project"** → **"Deploy from GitHub repo"**
3. 选你的 `ai-companion` repo
4. Railway 会自动检测到 `backend/railway.toml`

### 3.2 配置

5. 在项目设置 → **"Settings"** → **"Build"**:
   - Root Directory: `backend`
6. 进 **"Variables"** tab,加以下环境变量(从你本地 `backend/.env` 抄过来,改 ALLOWED_ORIGINS 暂用 `*`):

```
PORT=3000
SUPABASE_URL=https://yattgyiygfpyxdcldmdm.supabase.co
SUPABASE_ANON_KEY=<你的 anon key>
SUPABASE_SERVICE_ROLE_KEY=<你的 service_role key>
KIMI_API_KEY=<你的 kimi key>
KIMI_BASE_URL=https://api.moonshot.cn/v1
KIMI_MODEL=kimi-k2.5
SILICONFLOW_API_KEY=<你的 siliconflow key>
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
DEEPSEEK_MODEL=deepseek-ai/DeepSeek-V3.2
MINIMAX_MODEL=MiniMaxAI/MiniMax-M2.5
DEFAULT_LLM=kimi
ALLOWED_ORIGINS=*
```

7. Railway 自动 build + deploy。几分钟后会给一个 URL,例如:
   ```
   https://ai-companion-backend.up.railway.app
   ```

8. **测试后端**:
   - 浏览器开 `https://ai-companion-backend.up.railway.app/api/health`
   - 应该看到 `{"success":true,"data":{"status":"ok","defaultLLM":"kimi"}}`

### 3.3 (可选)绑定域名

在 Railway 项目 → Settings → Domains → Custom Domain,加你的域名 `api.your-domain.com`,按提示加 CNAME。

## 四、部署前端到 Vercel

### 4.1 新建项目

1. 进 https://vercel.com/dashboard
2. 点 **"Add New..."** → **"Project"**
3. 选 `ai-companion` repo
4. **重要**:点 **"Edit"** 改 **"Root Directory"** 为 `frontend`
5. Framework Preset: **Vite**(自动检测)
6. Build & Output Settings 不用改(自动)

### 4.2 环境变量

在 **"Environment Variables"** 加:

```
VITE_API_BASE=https://ai-companion-backend.up.railway.app/api
```

(替换成你 Railway 给的 URL)

7. 点 **"Deploy"**。几分钟后会得:
   ```
   https://ai-companion.vercel.app
   ```

### 4.3 改后端 CORS

回到 Railway,把 `ALLOWED_ORIGINS` 从 `*` 改成:
```
ALLOWED_ORIGINS=https://ai-companion.vercel.app
```
Railway 会自动重新部署后端。

### 4.4 测试

浏览器开 `https://ai-companion.vercel.app`,**任何设备任何网络**都能用 🎉

## 五、绑定自定义域名(可选,提升品牌)

### 在 Cloudflare Registrar 买一个 `.com`

1. https://www.cloudflare.com/products/registrar/
2. 搜想要的域名,比如 `ai-companion.com`,~$10/年
3. 买下来,添加到 Cloudflare

### Vercel 加域名

- 项目 → Settings → Domains → 输入 `ai-companion.com`
- 按提示加 CNAME / A 记录

### Railway 加 API 子域名

- 项目 → Settings → Domains → 输入 `api.ai-companion.com`

完成后:
- 前端:`https://ai-companion.com`
- 后端:`https://api.ai-companion.com/api`

## 六、自动部署(已配置好)

每次你 `git push`,Railway 和 Vercel 会**自动重新部署**。无需手动操作。

## 七、费用估算

| 服务 | 免费额度 | 超额后 |
|---|---|---|
| Vercel | 100GB 流量/月 | $20/月起 |
| Railway | $5/月 credit | 按用量 ~$0.000463/GB-小时 |
| Supabase | 50k MAU + 500MB DB | $25/月起 |
| Moonshot(Kimi) | 看活动 | 约 ¥0.012/千 tokens |
| 域名(可选) | - | $10/年 |

**小流量个人使用**:基本 $0(都在免费额度内),LLM 月消耗 ¥5-20 左右

## 八、监控 & 故障排查

### 看后端日志
Railway 项目 → Deployments → 最新 → View Logs

### 看前端日志
Vercel 项目 → Deployments → 最新 → 函数日志

### 常见问题

| 问题 | 原因 | 解决 |
|---|---|---|
| Vercel 部署失败 "build error" | TS 类型错 | 跑 `cd frontend && npm run build` 试 |
| 打开页面白屏 | 后端 URL 配错 | 检查 Vercel `VITE_API_BASE` |
| 注册时报 CORS | ALLOWED_ORIGINS 缺前端域名 | 加 Vercel URL 到后端 env |
| Kimi 401 | API key 失效 | 重新生成后替换 Railway env |
| Supabase RLS 报错 | SQL 漏跑 | 在 Supabase SQL Editor 重跑所有 migration |

## 九、回滚

如果新部署坏了:

- **Vercel**:Deployments → 选上一个成功的 → "Promote to Production"
- **Railway**:Deployments → 选上一个 → "Redeploy"
