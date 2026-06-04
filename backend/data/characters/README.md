# 预设角色配置文件

> 这里就是改角色设定的地方 —— 不用碰后端代码,改完保存就自动同步到 Supabase。

## 文件结构

每个角色一个 `.md` 文件,文件名建议和角色名一致(便于一眼看出对应关系,但不强求)。

```
backend/data/characters/
├── 林默.md
├── 顾夜寒.md
├── 玄清.md
└── 空白角色.md
```

## 文件格式

每个文件 = YAML frontmatter + Markdown body:

```markdown
---
name: 林默                    # 必填,角色名(用于和数据库现有行匹配)
description: 青梅竹马·ENFP·建筑系大三
avatar: 🌳
greeting: 嘿！又见面啦！
---

<这里是 system_prompt 的全部内容,可以写任意多行,
支持中文、emoji、Markdown 语法,实际写入数据库时
整段(包括换行)都会保留>
```

### frontmatter 字段

| 字段 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `name` | ✅ | — | 角色名,匹配数据库现有预设行的依据 |
| `description` | ❌ | `""` | 一句话简介,显示在角色列表 |
| `avatar` | ❌ | `👤` | 默认 emoji 头像(只在首次插入时使用) |
| `greeting` | ❌ | `你好。` | 首次聊天时的问候语 |
| `system_prompt` | — | — | 写在 body 里(不是 frontmatter) |

### 注意事项

- **不要改 `name`**:改了 `name` 之后会和数据库现有行失去匹配,系统会创建一条新行(旧行还在数据库里)。
- **首次插入时 avatar 才会写入**:后续改 .md 里的 `avatar` 不会覆盖数据库里用户上传过的自定义头像(为了保留你给角色的图)。
- **system_prompt / description / greeting 改完就生效**:dev 模式自动同步;生产模式需要重启后端。

## 开发流(自动同步)

启动后端:

```bash
cd backend
npm run dev
```

控制台看到这一行就表示监听已开:

```
👀 正在监听角色文件: .../data/characters/*.md (dev 模式)
```

之后随便改任意 `.md` 并保存,控制台会输出:

```
📝 检测到角色文件 修改: 林默.md
✅ 已自动同步到 Supabase
```

不需要重启,刷新前端就能看到效果。

## 怎么测试

1. 复制一份现有 `.md` 文件做实验(比如 `林默-测试.md`),改一下 `name` / `system_prompt`
2. 保存 → 等待控制台 `✅ 已自动同步`
3. 在前端打开这个角色,看回复是否变了
4. 测完删掉 `.md` 即可(数据库行会保留,不影响其他用户)

## 故障排查

- **控制台没出现 `👀 正在监听角色文件`**:检查 `NODE_ENV` 是否被设成了 `production`
- **`❌ 自动同步失败: 缺少 YAML frontmatter`**:文件没以 `---` 开头,或者闭合 `---` 缺失
- **`.md` 改了但前端没变**:刷新页面;如果还不行,看 Supabase 表格里 `is_preset = true` 且 `name` 对应的那行 `system_prompt` 是否已更新

## 生产环境

- `npm run build && npm start`(Railway 部署)走的是**启动时一次性同步**
- 改 `.md` 后需要重新部署(redeploy)才生效
- 生产模式不会开 chokidar 监听
