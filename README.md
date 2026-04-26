# ContentOS — AI 内容营销平台

为中文代理商设计的 AI 内容创作、协作与发布平台。

## 快速开始 (3 分钟上手)

### 前置要求

- Node.js 18+
- npm / yarn / pnpm / bun

### 一键启动

```bash
# 1. 安装依赖
npm install

# 2. 设置环境变量 (复制并重命名)
cp .env.example .env.local

# 3. 初始化数据库
npm run db:setup

# 4. 启动开发服务器
npm run dev
```

访问 http://localhost:3000

### 🎮 交互式教程

无需安装即可体验：访问 [ContentOS 教程演示](https://contentos.dev/playground)（或运行项目后访问 `/playground`）

在浏览器中直接体验 AI 内容生成，无需配置 API Key。输入主题，选择平台，即可生成符合各平台调性的内容。

### 环境变量说明

创建 `.env.local` 文件并配置以下变量：

```bash
# 数据库 (SQLite 本地开发)
DATABASE_URL="file:./prisma/dev.db"

# AI 生成 (可选 - 不配置则使用 Mock 模式)
DEEPSEEK_API_KEY="your_deepseek_api_key"
DEEPSEEK_BASE_URL="https://api.deepseek.com/v1"  # 可选

# 快速测试 (Mock AI 模式)
MOCK_AI="true"  # 设置后无需 API Key 即可测试

# NextAuth (生产环境必须)
NEXTAUTH_SECRET="run: openssl rand -base64 32"  # 生成随机密钥
```

**首次使用建议**: 设置 `MOCK_AI="true"` 体验完整流程，无需配置 API Key。

### 数据库管理

```bash
npm run db:setup      # 初始化数据库 (generate + migrate)
npm run db:generate    # 重新生成 Prisma Client
npm run db:push       # 推送 schema 到数据库 (开发环境)
npm run db:migrate    # 创建并运行迁移
npm run db:studio      # 打开 Prisma Studio (数据库可视化)
```

## 项目结构

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   │   ├── briefs/        # Brief 创建、查询
│   │   ├── content/        # 内容管理、状态更新
│   │   │   └── [id]/      # 内容详情
│   │   │       ├── quality/ # 质量评估
│   │   │       └── schedule/ # 发布调度
│   │   ├── generate/      # AI 生成接口
│   │   ├── projects/      # 项目管理
│   │   ├── workspaces/     # 工作空间
│   │   ├── invites/        # 邀请协作
│   │   ├── brand-voices/  # 品牌调性管理
│   │   ├── templates/     # 内容模板
│   │   ├── calendar/      # 日历事件
│   │   ├── notifications/ # 通知系统
│   │   └── cron/          # 定时任务
│   ├── brief/             # Brief 表单
│   ├── content/           # 内容编辑器
│   ├── calendar/          # 日历视图
│   ├── templates/         # 模板管理
│   ├── login/             # 登录页面
│   └── settings/         # 设置页面
│       └── brand-voice/  # 品牌调性设置
├── components/            # React 组件
│   ├── brand-voice-client.tsx    # 品牌调性组件
│   ├── templates-client.tsx       # 模板管理组件
│   ├── quality-panel.tsx          # 质量评估面板
│   ├── seo-scorer.tsx             # SEO 分析组件
│   ├── calendar-client.tsx        # 日历视图
│   ├── schedule-dialog.tsx        # 调度对话框
│   ├── notification-bell.tsx      # 通知铃铛
│   └── content-editor.tsx         # 内容编辑器（含质量/SEO面板）
├── lib/                   # 核心逻辑
│   ├── ai/               # AI 生成、prompts
│   │   └── prompts/      # 平台特定 prompt（含品牌调性注入）
│   ├── auth/             # 认证配置
│   ├── notifications/    # 通知触发器
│   ├── dates.ts          # 日期工具函数
│   └── db.ts             # Prisma 客户端
└── types/                 # TypeScript 类型定义
```

## 开发指南

### 创建 Brief

```bash
curl -X POST http://localhost:3000/api/briefs \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{
    "projectId": "project_id",
    "topic": "2024 年企业数字化转型趋势",
    "keyPoints": ["要点1", "要点2"],
    "platforms": ["wechat", "weibo"],
    "references": "参考资料",
    "notes": "品牌调性"
  }'
```

### AI 生成内容

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{
    "contentPieceId": "content_id",
    "platform": "wechat"
  }'
```

### 添加新的 AI 平台

1. 在 `src/types/index.ts` 添加平台类型:
```typescript
export type Platform = "wechat" | "weibo" | "xiaohongshu" | "douyin" | "your_platform";
```

2. 在 `src/lib/ai/prompts/` 创建 prompt builder:
```typescript
export function buildYourPlatformPrompt(brief: Brief): string {
  return `...prompt template...`;
}
```

3. 在 `src/lib/ai/client.ts` 的 BUILDERS 对象注册:
```typescript
const BUILDERS: Record<string, (brief: Brief) => string> = {
  // ...
  your_platform: buildYourPlatformPrompt,
};
```

### API 错误格式

所有 API 错误返回统一的结构化格式 (遵循 Stripe API 风格):

```json
{
  "error": {
    "type": "invalid_request_error",
    "code": "missing_parameter",
    "message": "缺少必需参数: projectId",
    "param": "projectId",
    "doc_url": "https://docs.contentos.dev/errors/missing_parameter"
  }
}
```

**错误类型 (type)**:
- `authentication_error`: 认证失败 (401)
- `invalid_request_error`: 无效参数 (400)
- `not_found_error`: 资源不存在 (404)
- `api_error`: 内部 API 错误 (500)
- `rate_limit_error`: 请求频率限制 (429)

**常见错误代码**:
- `missing_session`: 未登录
- `no_workspace`: 未加入工作区
- `project_not_found`: 项目不存在
- `llm_api_error`: AI 服务暂时不可用
- `rate_limit_exceeded`: 请求过于频繁

## 故障排查

### Prisma Client 未生成
```bash
npm run db:generate
```

### NextAuth Secret 错误
在 `.env.local` 添加:
```bash
NEXTAUTH_SECRET=$(openssl rand -base64 32)
```

### AI 生成失败
检查 `.env.local` 中的 `DEEPSEEK_API_KEY` 是否配置，或设置 `MOCK_AI="true"` 使用 Mock 模式。

### 数据库迁移失败
```bash
# 删除数据库重新开始
rm prisma/dev.db
npm run db:setup
```

## 更新日志

查看 [CHANGELOG.md](CHANGELOG.md) 了解版本历史和迁移指南。

当前版本: `v0.3.0`

## 隐私与分析

ContentOS 使用隐私优先的分析来改进 DX。详见 [隐私政策](docs/analytics.md)。

## 文档

- **[快速开始](README.md)** — 3 分钟上手指南
- **[API 文档](docs/api.md)** — 完整的 API 参考
- **[架构设计](ARCHITECTURE.md)** — 系统架构和数据流
- **[贡献指南](CONTRIBUTING.md)** — 开发者参与指南
- **[设计系统](DESIGN.md)** — UI 组件和设计规范

## 测试

```bash
# 运行所有测试
npm test

# 监听模式
npm run test:watch

# 测试覆盖率
npm run test:coverage

# UI 模式
npm run test:ui
```

测试框架: Vitest + Testing Library + jsdom

## 技术栈

- **框架**: Next.js 16 (App Router)
- **认证**: NextAuth v5
- **数据库**: Prisma + SQLite (可切换 PostgreSQL)
- **UI**: React 19 + Tailwind CSS + Shadcn UI
- **编辑器**: TipTap
- **日历**: Schedule-X
- **通知**: Sonner (UI), 自定义通知系统
- **测试**: Vitest + Testing Library

## 部署

### Vercel 部署 (推荐)

```bash
npm run build
vercel
```

### Docker 部署

```bash
docker build -t contentos .
docker run -p 3000:3000 --env-file .env.production contentos
```

### 环境变量

生产环境必须配置:
- `DATABASE_URL` (PostgreSQL 连接字符串)
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL` (生产域名)
- `DEEPSEEK_API_KEY`

## 开源协议

[MIT License](LICENSE) — 开源，可自由使用和修改

欢迎贡献！请查看 [贡献指南](CONTRIBUTING.md)

## 社区

- 📋 [问题反馈](https://github.com/yourusername/marketing/issues) — Bug 报告和功能建议
- 💬 [讨论区](https://github.com/yourusername/marketing/discussions) — 交流和问答
- 📖 [文档](https://docs.contentos.dev) — 完整文档

## 支持

- GitHub Issues: [提交问题](https://github.com/yourusername/marketing/issues)
- 邮件: support@yourcompany.com
