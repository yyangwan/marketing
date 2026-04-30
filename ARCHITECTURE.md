# ContentOS 架构文档

ContentOS 是一个多租户 SaaS 平台，使用 Next.js 16 (App Router)、Prisma、NextAuth 和 AI 服务为中文代理商提供内容创作和协作功能。

## 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │  看板视图  │  │ Brief表单 │  │ 内容编辑器 │  │ 日历视图  │      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ 品牌调性  │  │ 模板管理  │  │ 质量面板  │  │ 通知铃铛  │      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Layer (Next.js)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ /api/briefs│ │ /api/content│ │ /api/projects│ │ /api/workspaces│  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │/api/brand│ │ /api/templates│ │/api/calendar │ │/api/notifications││
│  │ _voices  │  │             │  │  /events   │  │                │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                       │
│  │/api/content│ │ /api/cron/publish│ │ /api/quality│            │
│  │/[id]/schedule│ │              │  │              │             │
│  └──────────┘  └──────────┘  └──────────┘                       │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ NextAuth v5  │    │  Prisma ORM  │    │   AI Client  │
│  认证中间件    │    │  数据访问层   │    │  LLM 集成    │
└──────────────┘    └──────────────┘    └──────────────┘
                            │
                            ▼
                  ┌──────────────────┐
                  │   SQLite / PG    │
                  │    数据库         │
                  └──────────────────┘
```

## 核心模块

### 1. 认证与授权 (Auth)

**技术栈**: NextAuth v5 (Credentials Provider)

**数据流**:
```
用户输入邮箱密码
    ↓
POST /api/auth/callback/credentials
    ↓
验证用户 (bcrypt.compare)
    ↓
创建 JWT Token
    ↓
存储工作区角色 (workspaceMember)
    ↓
设置 Session Cookie
```

**关键文件**:
- `src/lib/auth/config.ts` — NextAuth 配置
- `src/lib/auth/workspace.ts` — 工作区上下文管理

**会话结构**:
```typescript
{
  user: {
    id: string;
    email: string;
    name: string;
    workspaceId?: string;  // 当前工作区
    role?: string;          // 在工作区中的角色
  }
}
```

### 2. 多租户 (Multi-Tenancy)

**租户模型**: Workspace (工作区) 为租户边界

**数据隔离**:
- 每个 `ContentPiece` 属于一个 `Project`
- 每个 `Project` 属于一个 `Workspace`
- 用户通过 `WorkspaceMember` 关联到工作区

**权限检查**:
```typescript
const ws = getCurrentWorkspace(session);
if (!ws) {
  return responses.forbidden(errors.noWorkspace());
}

// 查询时自动过滤
where: {
  project: { workspaceId: ws.workspaceId }
}
```

**角色定义**:
- `admin`: 工作区管理员（完全访问权限）
- `member`: 普通成员（受限访问权限）

### 3. 内容生成 (AI Generation)

**工作流**:
```
用户填写 Brief
    ↓
POST /api/briefs
    ↓
创建 ContentPiece (draft)
    ↓
为每个选定的平台创建 PlatformContent
    ↓
调用 AI 生成 (generateForAllPlatforms)
    ↓
品牌调性注入 (Brand Voice)
    ↓
更新 PlatformContent.content
    ↓
质量评估 (Quality Panel)
    ↓
SEO 分析 (SEO Scorer)
    ↓
返回完整 ContentPiece
```

**AI 集成**:
- **主要**: DeepSeek API (`https://api.deepseek.com/v1`)
- **回退**: Mock 模式（开发/测试）
- **Prompt**: 平台特定 prompt builders (`src/lib/ai/prompts/`)
- **品牌调性**: 自动注入品牌调性上下文到所有平台 prompts

**平台适配**:
```typescript
interface PlatformConfig {
  maxLength: number;
  tone: string;
  format: string;
  hashtags: boolean;
  emojis: boolean;
}

// 品牌调性注入
interface BrandVoice {
  name: string;
  description: string;
  guidelines: string;
  sampleContent: string;
}
```

**质量评估**:
- 4 维度评分: 质量、互动性、品牌匹配度、平台适配度
- AI 驱动的改进建议
- 实时 SEO 分析（字符数、词数、关键词密度）

### 4. 内容审核 (Review Workflow)

**Kanban 状态流转**:
```
draft (草稿) → in_review (审核中) → approved (已批准) → scheduled (已调度) → publishing (发布中) → published (已发布)
                    ↓                                           ↓
              revision_requested (需修改)                   failed (发布失败)
```

**审核评论**:
```typescript
interface ReviewComment {
  action: "approved" | "revision_requested" | "comment";
  content: string;
  authorId: string;
  createdAt: Date;
}
```

### 5. 日历与调度 (Calendar & Scheduling)

**日历系统**:
- 月视图/周视图切换
- 拖拽重新调度内容
- 状态颜色编码
- 日期范围导航

**调度工作流**:
```
用户设置发布时间
    ↓
POST /api/content/[id]/schedule
    ↓
创建/更新 ContentSchedule (原子 upsert)
    ↓
状态变更为 scheduled
    ↓
Cron job 定期检查到期内容
    ↓
POST /api/cron/publish
    ↓
状态变更为 publishing → published/failed
    ↓
触发通知
```

**数据模型**:
```typescript
interface ContentSchedule {
  contentPieceId: string;
  scheduledFor: DateTime;
  status: "scheduled" | "publishing" | "published" | "failed";
  publishedAt?: DateTime;
  error?: string;
}
```

### 6. 通知系统 (Notifications)

**通知类型**:
- `content_review`: 内容审核状态变更
- `schedule_reminder`: 即将发布的内容提醒
- `content_published`: 内容发布成功/失败

**通知流**:
```
事件触发 (trigger.ts)
    ↓
创建 Notification 记录
    ↓
关联到用户/工作区
    ↓
实时推送 (30s 轮询)
    ↓
前端显示通知铃铛 + 下拉列表
    ↓
用户标记已读/删除
```

**数据模型**:
```typescript
interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  actionUrl?: string;
  userId: string;
  workspaceId: string;
  read: boolean;
  createdAt: DateTime;
}
```

## 数据模型

### Entity Relationships

```
User ────< WorkspaceMember >──── Workspace
                                     │
                                     │ has many
                                     ├── Project
                                     │    │
                                     │    │ has many
                                     │    ▼
                                     │  ContentPiece
                                     │    │
                                     │    │ has many
                                     │    ├── PlatformContent
                                     │    │    │
                                     │    │    │ has many
                                     │    │    ▼
                                     │    │  ReviewComment
                                     │    │
                                     │    ├── BrandVoice (per-project)
                                     │    └── AITemplate (per-project)
                                     │
                                     ├── Notification
                                     │
                                     ├── Invite
                                     │
                                     └── ContentSchedule
                                          │
                                          └── ContentPiece (one-to-one)
```

### 关键表结构

**Workspace**:
```typescript
{
  id: string;
  name: string;
  createdAt: DateTime;
}
```

**Project**:
```typescript
{
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  createdAt: DateTime;
}
```

**ContentPiece**:
```typescript
{
  id: string;
  projectId: string;
  title: string;
  brief: string;              // JSON 序列化的 Brief
  status: ContentStatus;
  createdAt: DateTime;
}
```

**PlatformContent**:
```typescript
{
  id: string;
  contentPieceId: string;
  platform: Platform;
  content: string;            // HTML 格式
  status: ContentStatus;
}
```

## API 设计

### 错误格式标准化

所有 API 错误遵循统一格式:
```typescript
{
  error: {
    type: ErrorType;
    code: string;
    message: string;
    param?: string;
    doc_url: string;
  }
}
```

### 响应格式

**成功响应**:
```typescript
{
  id: string;
  // ... 资源字段
}
```

**列表响应**:
```typescript
[
  {
    id: string;
    // ... 资源字段
    _count: { /* 关联计数 */ };
    _lastReviewAction: { /* 最新审核 */ };
  }
]
```

## 前端架构

### 组件层次

```
layout.tsx (根布局)
    │
    ├── Sidebar (导航)
    └── {children} (页面内容)
            │
            ├── BriefForm (Brief 创建表单)
            ├── KanbanBoard (内容看板)
            ├── ContentEditor (TipTap 编辑器)
            └── SettingsPage (设置页面)
```

### 状态管理

- **服务端状态**: 通过 API 调用获取
- **客户端状态**: React hooks (useState)
- **全局状态**: NextAuth Session (服务端管理)

### UI 组件

**设计系统**: Shadcn UI + Tailwind CSS

**基础组件**:
- `Button`, `Input`, `Select` — 表单控件
- `Card`, `Badge` — 内容展示
- `Toaster` (Sonner) — 通知提示

**自定义组件**:
- `Navigation` — 导航侧边栏（含项目列表、活跃状态）
- `BriefForm` — Brief 创建表单
- `KanbanColumn` — 看板列
- `PlatformSelector` — 平台选择器
- `NotificationBell` — 通知铃铛（含下拉列表）
- `CalendarClient` — 日历视图（月/周切换、拖拽调度）
- `QualityPanel` — 质量评估面板
- `SEOScorer` — SEO 分析组件
- `ScheduleDialog` — 调度对话框

## 安全考虑

### 认证
- 密码使用 bcrypt 哈希
- JWT Token 存储在 httpOnly cookie
- Session 过期后自动登出

### 授权
- 所有 API 路由检查 session
- 工作区级别数据隔离
- 项目归属验证

### 输入验证
- API 参数类型检查
- Prisma 参数化查询（防 SQL 注入）
- 内容长度限制

### CORS
- 同站请求（无需 CORS）
- API 密钥管理（环境变量）

## 性能优化

### 数据库
- Prisma 查询优化（select, include）
- 索引（id, workspaceId, projectId）
- 连接池（better-sqlite3）

### 前端
- Next.js 自动代码分割
- 图片优化（next/image）
- 字体优化（next/font）

### AI 生成
- 并行生成多平台内容
- Mock 模式避免 API 调用
- 错误重试机制

## 部署架构

### 开发环境
```
本地机器 → SQLite → Next.js Dev Server → DeepSeek API (可选)
```

### 生产环境
```
用户 → CDN (Vercel) → Next.js Server → PostgreSQL → DeepSeek API
                                            ↓
                                      Prisma ORM
```

### 环境变量
```bash
# 必需
DATABASE_URL=           # PostgreSQL 连接字符串
NEXTAUTH_SECRET=        # JWT 签名密钥
NEXTAUTH_URL=           # 生产域名

# 可选
DEEPSEEK_API_KEY=       # AI 服务密钥
DEEPSEEK_BASE_URL=      # API 自定义端点
MOCK_AI=                # Mock 模式开关
```

## 扩展点

### 添加新平台

1. 在 `src/types/index.ts` 添加平台类型
2. 在 `src/lib/ai/prompts/` 创建 prompt builder
3. 在 `src/types/index.ts` 的 `PLATFORM_CONFIG` 添加配置
4. 更新 UI 中的平台选择器

### 添加新 AI 服务

1. 在 `src/lib/ai/` 创建新的客户端
2. 实现统一接口 (`callLLM`)
3. 添加环境变量配置
4. 更新错误处理

### Webhook 集成（计划中）

```typescript
// 未来将支持 Webhook 通知
interface WebhookEvent {
  type: "content.created" | "content.status_changed";
  data: ContentPiece;
  timestamp: Date;
}
```

## 监控与日志

### 错误跟踪
- 结构化错误响应
- 错误代码分类
- 文档链接

### 日志（计划中）
- API 请求日志
- AI 生成日志
- 用户操作审计

## 贡献者指南

详见 [CONTRIBUTING.md](./CONTRIBUTING.md)

## 许可证

MIT
