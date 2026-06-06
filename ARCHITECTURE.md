# ContentOS 架构文档

ContentOS 是一个多租户 SaaS 平台，使用 Next.js 16 (App Router)、Prisma、NextAuth 和 AI 服务为中文代理商提供内容创作和协作功能。

## 系统架构

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Client Layer                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │  看板视图  │ │ Brief表单 │ │ 内容编辑器 │ │ 日历视图  │ │ 数据分析  │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ 品牌调性  │ │ 模板管理  │ │ 质量面板  │ │ 通知铃铛  │ │ Genie工厂 │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
└──────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       API Layer (Next.js)                            │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐      │
│  │ /api/auth  │ │ /api/content│ │ /api/projects│ │/api/workspaces│  │
│  │   +SSO     │ │   +quality │ │             │ │  +invites    │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘      │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐      │
│  │/api/brand  │ │/api/templates│ │/api/calendar│ │/api/notif   │   │
│  │  _voices   │ │             │ │  /events    │ │  ications   │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘      │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐      │
│  │/api/genie  │ │/api/analytics│ │/api/publish │ │/api/platform│  │
│  │ sources+gen│ │             │ │             │ │  -config    │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘      │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                       │
│  │/api/cron   │ │/api/user   │ │/api/integr │                       │
│  │publish+genie│ │profile+pwd │ │  ation     │                       │
│  └────────────┘ └────────────┘ └────────────┘                       │
└──────────────────────────────────────────────────────────────────────┘
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ NextAuth v5  │   │  Prisma ORM  │   │   AI Client  │
│  认证+SSO     │   │  MySQL       │   │ DeepSeek API │
└──────────────┘   └──────────────┘   └──────────────┘
                           │
                           ▼
                 ┌──────────────────┐
                 │     MySQL 8      │
                 │      数据库       │
                 └──────────────────┘
```

## 核心模块

### 1. 认证与授权 (Auth)

**技术栈**: NextAuth v5 (Credentials Provider) + GeniLink SSO

**认证方式**:
- **邮箱密码**: 标准注册/登录，bcrypt 哈希
- **GeniLink SSO**: OAuth2 授权码流程，自动开通用户

**数据流**:
```
用户输入邮箱密码                    GeniLink门户点击SSO登录
    ↓                                      ↓
POST /api/auth/callback/credentials    GET /api/auth/sso/callback?code=xxx
    ↓                                      ↓
验证用户 (bcrypt.compare)              exchangeCodeForToken → JWT验证
    ↓                                      ↓
创建 JWT Token                          自动开通/关联用户
    ↓                                      ↓
存储工作区角色 (workspaceMember)         签发NextAuth Session
    ↓                                      ↓
设置 Session Cookie                     设置 Session Cookie
```

**关键文件**:
- `src/lib/auth/config.ts` — NextAuth 配置 (含 SSO bypass)
- `src/lib/auth/workspace.ts` — 工作区上下文管理
- `src/lib/auth/genilink.ts` — GeniLink SSO 客户端

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
- `owner`: 工作区拥有者（可管理工作区与成员）
- `admin`: 工作区管理员（完全访问权限）
- `member`: 普通成员（受限访问权限）

### 3. 内容生成 (AI Generation)

**工作流**:
```
用户填写 Brief
    ↓
POST /api/content
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

// 支持平台: wechat, weibo, xiaohongshu, douyin
```

**质量评估**:
- AI 评估: 质量、互动性、品牌匹配度、平台适配度、情感分析、话题一致性、原创性 (0-10)
- 本地即时指标: 可读性、词汇多样性、句子复杂度、一致性（无AI调用）
- 历史追踪: QualityHistory 记录每次评估变化
- SEO 分析: 字符数、词数、关键词密度 + AI优化建议

### 4. 内容审核 (Review Workflow)

**Kanban 状态流转**:
```
draft (草稿) / genie_draft (Genie 草稿)
    ↓
editing (人工编辑) → review (客户审核) → approved (已批准) → scheduled (已调度) → publishing (发布中) → published (已发布)
         ↑                    ↓                                                         ↓
         └──── revision_requested (需修改) ───────────────────────────────────────────→ failed (发布失败)
```

**审核链接**:
- 生成唯一 `reviewToken`，7天有效期
- 外部审阅者可通过链接查看内容并添加评论
- 支持评论类型: approved / revision_requested / comment

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
GET /api/cron/publish
    ↓
乐观锁抢占 → 指数退避重试(1s, 2s, 4s, 最多3次) → 发布到各平台
    ↓
状态变更为 published / failed
    ↓
触发通知
```

### 6. 通知系统 (Notifications)

**通知类型**:
- `content_review`: 内容审核状态变更
- `content_approved`: 内容已批准
- `content_published`: 内容发布成功/失败
- `schedule_reminder`: 即将发布的内容提醒
- `mention`: @提及

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
用户标记已读/全部已读
```

### 7. Genie 自动内容工厂

**工作流**:
```
用户添加 URL 信息源
    ↓
POST /api/genie/sources — 抓取内容 + AI分析提取商业洞察
    ↓
提取: 业务类型、核心产品、品牌调性、目标受众、常驻话题
    ↓
POST /api/genie/generate — 基于所有已启用信息源生成内容创意
    ↓
创建 ContentPiece (genie_draft) — 3-5个内容创意
    ↓
Cron 周任务: GET /api/cron/genie 自动为活跃工作区生成内容
```

**数据模型**:
```typescript
interface GenieSource {
  url: string;
  businessType: string;      // "电商", "SaaS", "本地服务"
  keyProducts: string[];      // JSON array
  brandTone: string;          // "专业", "亲切", "幽默"
  targetAudience: string;     // "Z世代", "职场人士"
  recurringTopics: string[];  // JSON array
  enabled: boolean;
}
```

### 8. 平台发布 (Publishing)

**工作流**:
```
用户配置平台 API (OAuth / 手动凭证)
    ↓
POST /api/platform-config/[platform] — 存储加密凭证
    ↓
POST /api/publish/[platformContentId] — 发布到平台
    ↓
验证凭证 → 调用平台API → 记录 PublishHistory → 更新状态
    ↓
所有平台发布完成 → ContentPiece 状态变为 published
```

**平台 API 配置**:
- 支持 OAuth2 流程 (`/api/platform-oauth/callback`)
- 支持手动配置 AppID/AppSecret
- Token 自动刷新 (`/api/platform-config/[platform]/refresh`)

### 9. 数据分析 (Analytics)

**GET /api/analytics**:
- 8 个并行 Prisma 查询 + 2 个原生 SQL
- 内容总览: 总数、按状态分布、按平台分布
- 质量趋势: 平均分数变化
- 发布统计: 成功率、发布量
- 近期活动: 最新 10 条内容
- 热门项目: 按内容数量排序

### 10. 外部集成 (Integration)

**GeniLink Portal 对接**:
- JWT Bearer 认证 (JWKS 验证 genilink.cn)
- `GET /api/integration/summary` — 供 GeniLink 门户仪表板拉取内容统计数据

## 数据模型

### Entity Relationships

```
User ────< WorkspaceMember >──── Workspace
  │                                   │
  │                                   │ has many
  │                                   ├── Project
  │                                   │    │
  │                                   │    │ has many
  │                                   │    ▼
  │                                   │  ContentPiece
  │                                   │    │
  │                                   │    ├── PlatformContent (@@unique [contentPieceId, platform])
  │                                   │    │    └── PublishHistory
  │                                   │    ├── ReviewComment
  │                                   │    ├── ContentQuality (1:1)
  │                                   │    ├── QualityHistory
  │                                   │    ├── ContentSchedule (1:1)
  │                                   │    └── BrandVoice? (可选关联)
  │                                   │
  │                                   ├── BrandVoice
  │                                   │    ├── Project[] (默认品牌调性)
  │                                   │    └── ContentPiece[] (内容级品牌调性)
  │                                   │
  │                                   ├── AITemplate
  │                                   │
  │                                   ├── WorkspaceInvite
  │                                   │
  │                                   ├── GenieSource
  │                                   │
  │                                   ├── PlatformApiConfig (@@unique [workspaceId, platform])
  │                                   │
  │                                   └── Notification
  │
  └── genilinkUserId? (GeniLink SSO 关联)
```

### 关键表结构

**User**:
```typescript
{
  id: string;
  email: string;             // @unique
  passwordHash: string;
  name: string;
  genilinkUserId?: string;   // @unique, GeniLink SSO
  onboardingCompleted: boolean;
  onboardingStep: string;
}
```

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
  clientName: string;
  brandVoiceId?: string;       // 默认品牌调性
  defaultAssigneeId?: string;
  // @@unique([workspaceId, name])
}
```

**ContentPiece**:
```typescript
{
  id: string;
  projectId: string;
  title: string;
  type: string;                // "blog_post" 等
  brief: string;               // JSON 序列化的 Brief (MediumText)
  brandVoiceId?: string;
  status: ContentStatus;       // draft/genie_draft/editing/review/...
  reviewToken?: string;        // @unique
  reviewExpiresAt?: DateTime;
}
```

**PlatformContent**:
```typescript
{
  id: string;
  contentPieceId: string;
  platform: string;            // wechat/weibo/xiaohongshu/douyin
  status: string;
  content?: string;            // HTML 格式 (MediumText)
  publishedUrl?: string;
  // @@unique([contentPieceId, platform])
}
```

**GenieSource**:
```typescript
{
  id: string;
  workspaceId: string;
  url: string;
  businessType?: string;
  keyProducts?: string;        // JSON array (MediumText)
  brandTone?: string;
  targetAudience?: string;
  recurringTopics?: string;    // JSON array (MediumText)
  lastAnalyzedAt?: DateTime;
  enabled: boolean;
  // @@unique([workspaceId, url])
}
```

**PlatformApiConfig**:
```typescript
{
  id: string;
  workspaceId: string;
  platform: string;
  appId?: string;
  appSecret?: string;
  accessToken?: string;
  refreshTokn?: string;
  tokenExpiresAt?: DateTime;
  extraConfig?: string;        // JSON (MediumText)
  enabled: boolean;
  // @@unique([workspaceId, platform])
}
```

**ContentQuality**:
```typescript
{
  id: string;
  contentPieceId: string;      // @unique (1:1)
  quality: number;             // 0-10
  engagement: number;
  brandVoice: number;
  platformFit: number;
  sentiment: number;
  topicConsistency: number;
  originality: number;
  localMetrics?: string;       // JSON
  suggestions?: string;        // JSON array
  previousScores?: string;     // JSON
  evaluationCount: number;
}
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
            ├── CalendarClient (日历视图)
            ├── QualityPanel (质量评估面板)
            ├── SEOScorer (SEO 分析)
            ├── AnalyticsDashboard (数据分析)
            ├── GenieSourceManager (Genie 信息源管理)
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
- `AnalyticsDashboard` — 数据分析仪表板

## 安全考虑

### 认证
- 密码使用 bcrypt 哈希 (12 rounds)
- JWT Token 存储在 httpOnly cookie
- Session 过期后自动登出
- SSO 通过 JWKS 验证 JWT 签名

### 授权
- 所有 API 路由检查 session（除公开端点）
- 工作区级别数据隔离
- 项目归属验证
- 角色检查: owner/admin 才能管理成员/邀请

### 输入验证
- API 参数类型检查
- Prisma 参数化查询（防 SQL 注入）
- 内容长度限制
- 平台凭证不暴露给前端（仅返回 `hasAccessToken: boolean`）

### Cron 安全
- `CRON_SECRET` Bearer token 验证
- 乐观锁防止并发重复执行

## 性能优化

### 数据库
- Prisma 查询优化（select, include）
- 索引（id, workspaceId, projectId, scheduledAt, status, evaluatedAt 等）
- MySQL 8 连接池

### 前端
- Next.js 自动代码分割
- 图片优化（next/image）
- 字体优化（next/font）

### AI 生成
- 并行生成多平台内容
- Mock 模式避免 API 调用
- 错误重试机制（指数退避）

### Analytics
- 8 个并行 Prisma 查询
- 原生 SQL 用于时间序列聚合

## 部署架构

### 开发环境
```
本地机器 → MySQL 8 → Next.js Dev Server → DeepSeek API (可选)
```

### 生产环境
```
用户 → CDN (Vercel) → Next.js Server → MySQL 8 → DeepSeek API
                              ↓
                        Prisma ORM
```

### 环境变量
```bash
# 必需
DATABASE_URL=           # MySQL 连接字符串
NEXTAUTH_SECRET=        # JWT 签名密钥
NEXTAUTH_URL=           # 生产域名

# AI 服务
DEEPSEEK_API_KEY=       # AI 服务密钥
DEEPSEEK_BASE_URL=      # API 自定义端点
MOCK_AI=                # Mock 模式开关

# SSO
GENILINK_SSO_CLIENT_ID=
GENILINK_SSO_CLIENT_SECRET=
GENILINK_SSO_WELL_KNOWN=

# Cron
CRON_SECRET=            # Cron job 认证密钥

# Platform OAuth
WECHAT_APP_ID=
WECHAT_APP_SECRET=
WEIBO_APP_KEY=
WEIBO_APP_SECRET=
# ... 各平台凭证
```

## 扩展点

### 添加新平台

1. 在 `src/types/index.ts` 添加平台类型
2. 在 `src/lib/ai/prompts/` 创建 prompt builder
3. 在 `src/types/index.ts` 的 `PLATFORM_CONFIG` 添加配置
4. 在 `src/lib/platforms/` 添加平台发布适配器
5. 更新 UI 中的平台选择器

### 添加新 AI 服务

1. 在 `src/lib/ai/` 创建新的客户端
2. 实现统一接口 (`callLLM`)
3. 添加环境变量配置
4. 更新错误处理

### Webhook 集成（计划中）

```typescript
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

## API 文档

详见 [API.md](./API.md)

## 许可证

MIT
