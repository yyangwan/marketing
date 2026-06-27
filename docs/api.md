# ContentOS 后端 API 文档

## 概述

所有 API 基于 Next.js App Router，基础路径为 `/api`。使用 NextAuth v5 JWT Session 认证。

**认证方式**: httpOnly Cookie (`next-auth.session-token`)

**通用请求头**:
```
Content-Type: application/json
Cookie: next-auth.session-token=<token>
```

## 通用响应格式

### 成功响应

单个资源:
```json
{
  "id": "clxxx...",
  "field": "value"
}
```

列表:
```json
[
  { "id": "clxxx...", "field": "value" }
]
```

### 错误响应

```json
{
  "error": {
    "type": "validation_error | unauthorized | forbidden | not_found | conflict | rate_limit | server_error | llm_error",
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "param": "field_name (optional)",
    "doc_url": "https://docs.contentos.dev/errors/ERROR_CODE"
  }
}
```

### HTTP 状态码

| 状态码 | 含义 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 409 | 冲突 (如重复创建) |
| 429 | 请求频率限制 |
| 500 | 服务器内部错误 |

---

## 1. 认证 (Auth)

### POST `/api/auth/register`

注册新用户，自动创建工作区。

**认证**: 无需

**请求体**:
```json
{
  "workspaceName": "我的工作区",
  "name": "张三",
  "email": "zhangsan@example.com",
  "password": "password123"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| workspaceName | string | 是 | 工作区名称 |
| name | string | 是 | 用户名 |
| email | string | 是 | 邮箱 (唯一) |
| password | string | 是 | 密码 (>= 8 字符) |

**响应** `201`:
```json
{
  "success": true,
  "userId": "clxxx...",
  "workspaceId": "clxxx..."
}
```

**错误**:
- `400` — 字段缺失或密码太短
- `409` — 邮箱已注册

---

### GET `/api/auth/[...nextauth]`
### POST `/api/auth/[...nextauth]`

NextAuth v5 的统一处理入口，负责凭证登录、会话签发、CSRF、回调和 session 查询。
**认证**: 无需，由 NextAuth 中间件处理

**说明**:
- `GET` 处理 OAuth / callback / session / CSRF 等标准 NextAuth 流程
- `POST` 处理 credentials 登录和其他 NextAuth 提交动作
- 该路由不定义业务请求体，具体 payload 由 NextAuth provider 决定

---

### GET `/api/auth/sso/callback`

GeniLink SSO 回调端点。

**认证**: 无需

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| code | string | 是 | OAuth2 授权码 |
| state | string | 否 | CSRF state |

**响应**: 重定向到仪表板 (`/`) 或登录页 (`/login?error=sso_failed`)

---

## 2. 用户管理 (User)

### GET `/api/user/profile`

获取/更新当前用户资料。

**认证**: 需要

### PATCH `/api/user/profile`

更新用户资料。

**认证**: 需要

**请求体**:
```json
{
  "name": "新名字"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 显示名称 (非空, <= 50 字符) |

**响应** `200`:
```json
{
  "id": "clxxx...",
  "name": "新名字",
  "email": "zhangsan@example.com"
}
```

---

### POST `/api/user/password`

修改密码。

**认证**: 需要

**请求体**:
```json
{
  "currentPassword": "old_password",
  "newPassword": "new_password"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| currentPassword | string | 是 | 当前密码 |
| newPassword | string | 是 | 新密码 (>= 6 字符) |

**响应** `200`:
```json
{ "success": true }
```

**错误**:
- `400` — 新密码太短
- `401` — 当前密码错误

---

### GET `/api/user/onboarding`

获取引导流程状态。

**认证**: 需要

**响应** `200`:
```json
{
  "onboardingStep": "welcome",
  "onboardingCompleted": false
}
```

### POST `/api/user/onboarding`

更新引导流程状态。

**认证**: 需要

**请求体**:
```json
{
  "step": "create_project",
  "completed": true
}
```

**响应** `200`:
```json
{
  "onboardingStep": "create_project",
  "onboardingCompleted": true
}
```

---

## 3. 工作区 (Workspaces)

### PUT `/api/workspaces/[id]`

更新工作区名称。

**认证**: 需要 (owner/admin)

**请求体**:
```json
{
  "name": "新工作区名称"
}
```

**响应** `200`:
```json
{
  "id": "clxxx...",
  "name": "新工作区名称",
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

---

### PATCH `/api/workspaces/[id]/members/[memberId]`

修改成员角色。

**认证**: 需要 (owner/admin)

**请求体**:
```json
{
  "role": "admin"
}
```

| 角色值 | 说明 |
|--------|------|
| admin | 管理员 |
| member | 普通成员 |

**注意**: 不能修改 owner 角色；只有 owner 可以修改 admin 角色。

**响应** `200`:
```json
{
  "id": "clxxx...",
  "name": "张三",
  "email": "zhangsan@example.com",
  "role": "admin",
  "joinedAt": "2026-01-01T00:00:00.000Z"
}
```

---

### DELETE `/api/workspaces/[id]/members/[memberId]`

移除成员。

**认证**: 需要 (owner/admin)

**响应** `200`:
```json
{ "success": true }
```

**注意**: 不能移除 owner；不能移除自己。

---

### GET `/api/workspaces/[id]/invites`

获取待处理邀请列表。

**认证**: 需要 (owner/admin)

**响应** `200`:
```json
[
  {
    "id": "clxxx...",
    "token": "clxxx...",
    "email": "newuser@example.com",
    "role": "member",
    "expiresAt": "2026-01-08T00:00:00.000Z",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "isExpired": false
  }
]
```

---

### POST `/api/workspaces/[id]/invites`

创建邀请。

**认证**: 需要 (owner/admin)

**请求体**:
```json
{
  "email": "newuser@example.com"
}
```

**响应** `201`:
```json
{
  "id": "clxxx...",
  "inviteUrl": "https://app.contentos.dev/invite/clxxx...",
  "expiresAt": "2026-01-08T00:00:00.000Z"
}
```

**错误**:
- `409` — 用户已是工作区成员

---

### DELETE `/api/workspaces/[id]/invites/[inviteId]`

撤销邀请。

**认证**: 需要 (owner/admin)

**响应** `200`:
```json
{ "success": true }
```

---

## 4. 邀请 (Invites)

### GET `/api/invites/[token]`

查看邀请详情。

**认证**: 无需

**响应** `200`:
```json
{
  "workspaceName": "我的工作区",
  "inviterName": "张三",
  "email": "newuser@example.com",
  "role": "member"
}
```

**错误**:
- `404` — 邀请不存在
- `410` — 邀请已使用或已过期

---

### POST `/api/invites/[token]/accept`

接受邀请并注册。

**认证**: 无需

**请求体**:
```json
{
  "name": "新用户",
  "password": "password123"
}
```

**响应** `200`:
```json
{
  "success": true,
  "email": "newuser@example.com"
}
```

**错误**:
- `409` — 该邮箱用户已存在
- `410` — 邀请已使用或已过期

---

## 5. 项目 (Projects)

### GET `/api/projects`

获取工作区项目列表。

**认证**: 需要

**响应** `200`:
```json
[
  {
    "id": "clxxx...",
    "name": "项目A",
    "clientName": "客户A",
    "workspaceId": "clxxx...",
    "brandVoiceId": null,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "_count": {
      "contentPieces": 12
    }
  }
]
```

---

### POST `/api/projects`

创建项目。

**认证**: 需要

**请求体**:
```json
{
  "name": "新项目",
  "clientName": "客户名 (可选)"
}
```

**响应** `201`:
```json
{
  "id": "clxxx...",
  "name": "新项目",
  "clientName": "客户名",
  "workspaceId": "clxxx...",
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

**错误**:
- `400` — 项目名称为空
- `409` — 同名项目已存在

---

## 6. 内容 (Content)

### GET `/api/content`

获取内容列表。

**认证**: 需要

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| workspaceId | string | 否 | 工作区过滤 |
| status | string | 否 | 状态过滤 |
| unscheduled | string | 否 | 设为 "true" 过滤未调度内容 |

**响应** `200`:
```json
[
  {
    "id": "clxxx...",
    "title": "内容标题",
    "type": "blog_post",
    "platform": "wechat",
    "status": "draft",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "project": { "id": "clxxx...", "name": "项目A" },
    "platformContents": [
      { "id": "clxxx...", "platform": "wechat", "status": "draft", "content": "..." }
    ]
  }
]
```

---

### POST `/api/content`

创建内容（从 Brief 生成）。

**认证**: 需要

**请求体**:
```json
{
  "projectId": "clxxx...",
  "brandVoiceId": "clxxx...",
  "topic": "文章主题",
  "keyPoints": ["要点1", "要点2"],
  "platforms": ["wechat", "weibo"],
  "references": "参考内容",
  "notes": "备注"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| projectId | string | 是 | 所属项目 |
| brandVoiceId | string | 否 | 品牌调性 (默认使用项目设置) |
| topic | string | 是 | 内容主题 |
| keyPoints | string[] | 否 | 核心要点 |
| platforms | string[] | 否 | 目标平台 |
| references | string | 否 | 参考资料 |
| notes | string | 否 | 备注 |

**响应** `201`:
```json
{
  "id": "clxxx...",
  "title": "文章主题",
  "status": "draft",
  "platformContents": [
    { "id": "clxxx...", "platform": "wechat", "content": "生成的内容..." },
    { "id": "clxxx...", "platform": "weibo", "content": "生成的内容..." }
  ],
  "project": { "id": "clxxx...", "name": "项目A" }
}
```

---

### GET `/api/content/[id]`

获取单条内容详情。

**认证**: 需要

**响应** `200`: ContentPiece + platformContents + project

---

### PUT `/api/content/[id]`

更新内容。

**认证**: 需要

**请求体**:
```json
{
  "title": "新标题",
  "status": "editing",
  "platformContent": {
    "platform": "wechat",
    "content": "编辑后的内容..."
  }
}
```

**响应** `200`: 更新后的 ContentPiece + platformContents

---

### PATCH `/api/content/[id]/status`

变更内容状态。

**认证**: 需要

**请求体**:
```json
{
  "status": "review"
}
```

**有效状态值**: `draft`, `genie_draft`, `editing`, `review`, `approved`, `revision_requested`, `scheduled`, `publishing`, `published`, `failed`

**响应** `200`: 更新后的 ContentPiece

**注意**: 从 `scheduled` 转为其他状态时，会自动删除调度记录。状态变更会触发通知。

---

### POST `/api/content/[id]/review-link`

生成审阅链接。

**认证**: 需要

**响应** `200`:
```json
{
  "reviewToken": "uuid-token",
  "reviewExpiresAt": "2026-01-08T00:00:00.000Z",
  "reviewUrl": "https://app.contentos.dev/review/uuid-token"
}
```

**注意**: 有效期 7 天，自动将状态设为 `review`。

---

### GET `/api/content/[id]/review-link`

获取审阅链接信息和评论。

**认证**: 需要

**响应** `200`:
```json
{
  "reviewToken": "uuid-token",
  "reviewExpiresAt": "2026-01-08T00:00:00.000Z",
  "reviewUrl": "https://app.contentos.dev/review/uuid-token",
  "comments": [
    {
      "id": "clxxx...",
      "authorName": "审阅者",
      "comment": "请修改第二段",
      "action": "revision_requested",
      "createdAt": "2026-01-02T00:00:00.000Z"
    }
  ]
}
```

---

## 7. 内容调度 (Scheduling)

### GET `/api/content/[id]/schedule`

获取调度信息。

**认证**: 需要

**响应** `200`:
```json
{
  "id": "clxxx...",
  "contentId": "clxxx...",
  "scheduledAt": "2026-01-05T10:00:00.000Z",
  "status": "scheduled",
  "publishedAt": null
}
```

---

### POST `/api/content/[id]/schedule`

创建或更新调度。

**认证**: 需要

**请求体**:
```json
{
  "scheduledAt": "2026-01-05T10:00:00.000Z"
}
```

**响应** `201`:
```json
{
  "id": "clxxx...",
  "contentId": "clxxx...",
  "scheduledAt": "2026-01-05T10:00:00.000Z",
  "status": "scheduled"
}
```

**注意**: 自动将内容状态设为 `scheduled`，并发送通知。

---

### DELETE `/api/content/[id]/schedule`

取消调度。

**认证**: 需要

**响应** `200`:
```json
{ "success": true }
```

**注意**: 自动将内容状态回退为 `approved`。

---

## 8. 内容质量 (Quality)

### GET `/api/content/[id]/quality`

获取 AI 质量评估结果。

**认证**: 需要

**响应** `200`:
```json
{
  "id": "clxxx...",
  "contentPieceId": "clxxx...",
  "quality": 8,
  "engagement": 7,
  "brandVoice": 9,
  "platformFit": 8,
  "sentiment": 7,
  "topicConsistency": 8,
  "originality": 6,
  "suggestions": "[\"建议1\", \"建议2\"]",
  "evaluationCount": 3,
  "evaluatedAt": "2026-01-02T00:00:00.000Z"
}
```

---

### POST `/api/content/[id]/quality`

触发 AI 质量评估。

**认证**: 需要

**请求体**:
```json
{
  "platform": "wechat"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| platform | string | 否 | 指定评估的平台内容 |

**响应** `200`: 同 GET 响应 (upsert)

**注意**: 调用 DeepSeek API 进行评估，包含品牌调性上下文。7 维度 0-10 评分 + 改进建议。

---

### GET `/api/content/[id]/quality/local`

获取本地即时质量指标（无 AI 调用）。

**认证**: 需要

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| platform | string | 否 | 指定平台内容 |

**响应** `200`:
```json
{
  "localMetrics": {
    "readabilityScore": 75.5,
    "vocabularyDiversity": 0.82,
    "sentenceComplexity": 0.45,
    "consistencyScore": 0.9
  },
  "overallScore": 7.5,
  "sentiment": { "positive": 0.7, "negative": 0.1, "neutral": 0.2 },
  "emotions": { "joy": 0.5, "trust": 0.6 },
  "structure": { "paragraphs": 3, "sentences": 12, "avgSentenceLength": 25 },
  "keywords": ["关键词1", "关键词2"],
  "suggestions": ["建议1"]
}
```

---

## 9. 内容优化 (Optimize)

### POST `/api/content/[id]/optimize`

AI 驱动的平台内容优化。

**请求体**:
```json
{
  "platform": "wechat",
  "content": "原始内容..."
}
```

**响应** `200`: 优化后的内容

---

### POST `/api/content/[id]/optimize-seo`

SEO 优化建议。

**请求体**:
```json
{
  "content": "<p>HTML内容...</p>",
  "keyword": "目标关键词"
}
```

**响应** `200`:
```json
{
  "original": { "wordCount": 500, "keywordDensity": 0.02 },
  "optimized": "<p>优化后的HTML内容...</p>",
  "diff": "...",
  "applied": false
}
```

**注意**: 返回优化建议供预览，不会自动应用。

---

### GET `/api/content/[id]/analyze`

平台内容分析。

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| platform | string | 是 | wechat/weibo/xiaohongshu/douyin |

**响应** `200`: 平台分析结果

---

## 10. 内容生成 (Generate)

### POST `/api/generate`

为指定平台重新生成内容。

**认证**: 需要

**请求体**:
```json
{
  "contentPieceId": "clxxx...",
  "platform": "wechat"
}
```

**响应** `200`:
```json
{
  "id": "clxxx...",
  "contentPieceId": "clxxx...",
  "platform": "wechat",
  "content": "重新生成的内容...",
  "status": "draft"
}
```

---

## 11. Briefs

> `/api/briefs` 是 `/api/content` 的别名端点，功能完全一致。

### GET `/api/briefs`

同 `GET /api/content`。

### POST `/api/briefs`

同 `POST /api/content`。

---

## 12. 品牌调性 (Brand Voices)

### GET `/api/brand-voices`

获取工作区品牌调性列表。

**认证**: 需要

**响应** `200`:
```json
[
  {
    "id": "clxxx...",
    "name": "专业商务",
    "description": "专业、可靠的品牌调性",
    "guidelines": "使用正式用语，避免口语化表达",
    "samples": "[\"示例内容1\", \"示例内容2\"]",
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
]
```

---

### POST `/api/brand-voices`

创建品牌调性。

**认证**: 需要

**请求体**:
```json
{
  "name": "专业商务",
  "description": "品牌调性描述",
  "guidelines": "品牌调性指南",
  "samples": ["示例内容1", "示例内容2"]
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 名称 |
| description | string | 否 | 描述 |
| guidelines | string | 否 | 调性指南 |
| samples | string[] | 是 | 样例内容 (1-5条, 总计 <= 2500 字符) |

**响应** `201`: BrandVoice 对象

---

### GET `/api/brand-voices/[id]`

获取单个品牌调性。

**认证**: 需要

---

### PUT `/api/brand-voices/[id]`

更新品牌调性。

**认证**: 需要

**请求体**: 同创建，所有字段可选。

---

### DELETE `/api/brand-voices/[id]`

删除品牌调性。

**认证**: 需要

**响应** `200`:
```json
{ "success": true }
```

**错误**:
- `409` — 品牌调性正在被项目或内容使用

---

## 13. AI 模板 (Templates)

### GET `/api/templates`

获取工作区模板列表。

**认证**: 需要

---

### POST `/api/templates`

创建模板。

**认证**: 需要

**请求体**:
```json
{
  "name": "产品推广模板",
  "description": "适用于产品推广内容",
  "template": "为{product_name}撰写一篇{platform}推广文案，目标受众是{target_audience}",
  "variables": [
    { "name": "product_name", "type": "text" },
    { "name": "platform", "type": "text" },
    { "name": "target_audience", "type": "text" }
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 模板名称 |
| description | string | 否 | 描述 |
| template | string | 是 | 模板内容 (用 `{var}` 占位) |
| variables | object[] | 是 | 变量定义 |

**变量定义**:
| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | 变量名 (小写字母+数字+下划线) |
| type | string | "text" / "number" / "textarea" |

**响应** `201`: AITemplate 对象

---

### GET `/api/templates/[id]`

获取单个模板。

**认证**: 需要

---

### PUT `/api/templates/[id]`

更新模板。所有字段可选。

**认证**: 需要

---

### DELETE `/api/templates/[id]`

删除模板。

**认证**: 需要

**响应** `200`:
```json
{ "success": true }
```

---

## 14. 日历 (Calendar)

### GET `/api/calendar/events`

获取日历事件（调度列表）。

**认证**: 需要

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| start | string | 是 | 开始日期 |
| end | string | 是 | 结束日期 |
| projectId | string | 否 | 项目过滤 |
| status | string | 否 | 状态过滤 |

**响应** `200`:
```json
[
  {
    "id": "clxxx...",
    "contentId": "clxxx...",
    "scheduledAt": "2026-01-05T10:00:00.000Z",
    "status": "scheduled",
    "contentPiece": {
      "id": "clxxx...",
      "title": "内容标题",
      "status": "scheduled",
      "project": { "id": "clxxx...", "name": "项目A" }
    }
  }
]
```

---

## 15. 通知 (Notifications)

### GET `/api/notifications`

获取通知列表。

**认证**: 需要

**查询参数**:
| 参数 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| workspaceId | string | 否 | — | 工作区 |
| limit | number | 否 | 50 | 数量 (1-100) |
| includeRead | boolean | 否 | false | 包含已读 |

**响应** `200`:
```json
[
  {
    "id": "clxxx...",
    "type": "content_review",
    "title": "内容待审核",
    "message": "「文章标题」已提交审核",
    "link": "/content/clxxx...",
    "isRead": false,
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
]
```

---

### POST `/api/notifications`

创建通知。

**认证**: 需要

**请求体**:
```json
{
  "type": "content_review",
  "title": "内容待审核",
  "message": "「文章标题」已提交审核",
  "link": "/content/clxxx..."
}
```

**type 有效值**: `content_review`, `content_approved`, `content_published`, `schedule_reminder`, `mention`

**响应** `201`: Notification 对象

---

### POST `/api/notifications/mark-all-read`

标记所有通知为已读。

**认证**: 需要

**响应** `200`:
```json
{ "count": 5 }
```

---

### POST `/api/notifications/[id]/read`

标记单条通知为已读。

**认证**: 需要

**响应** `200`: 更新后的 Notification 对象

---

## 16. 数据分析 (Analytics)

### GET `/api/analytics`

获取工作区分析数据。

**认证**: 需要

**查询参数**:
| 参数 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| timeRange | string | 否 | "30" | 时间范围 (天数) |

**响应** `200`:
```json
{
  "summary": {
    "totalContent": 120,
    "publishedCount": 85,
    "scheduledCount": 15,
    "draftCount": 20,
    "publishSuccessRate": 94.1
  },
  "distributions": {
    "byStatus": { "draft": 20, "published": 85, "scheduled": 15 },
    "byPlatform": { "wechat": 50, "weibo": 30, "xiaohongshu": 25, "douyin": 15 }
  },
  "trends": {
    "content": [
      { "date": "2026-01-01", "count": 5 }
    ],
    "quality": [
      { "date": "2026-01-01", "avgQuality": 7.5 }
    ]
  },
  "recentActivity": [
    {
      "id": "clxxx...",
      "title": "最近的内容",
      "status": "published",
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "topProjects": [
    {
      "id": "clxxx...",
      "name": "热门项目",
      "_count": { "contentPieces": 45 }
    }
  ]
}
```

---

## 17. Genie 自动内容工厂

### GET `/api/genie/sources`

获取工作区信息源列表。

**认证**: 需要

**响应** `200`:
```json
{
  "sources": [
    {
      "id": "clxxx...",
      "url": "https://example.com",
      "businessType": "电商",
      "keyProducts": "[\"产品A\", \"产品B\"]",
      "brandTone": "专业",
      "targetAudience": "职场人士",
      "recurringTopics": "[\"行业趋势\"]",
      "enabled": true,
      "lastAnalyzedAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### POST `/api/genie/sources`

添加信息源。

**认证**: 需要

**请求体**:
```json
{
  "url": "https://example.com/blog"
}
```

**响应** `201`:
```json
{
  "source": { "id": "clxxx...", "url": "https://example.com/blog", "enabled": true },
  "analysis": {
    "confidence": 0.85,
    "insights": {
      "businessType": "电商",
      "keyProducts": ["产品A", "产品B"],
      "brandTone": "专业",
      "targetAudience": "职场人士",
      "recurringTopics": ["行业趋势", "产品更新"]
    }
  }
}
```

**注意**: 自动抓取 URL 内容并使用 AI 分析提取商业洞察。

---

### GET `/api/genie/sources/[id]`

获取单个信息源详情。

**认证**: 需要

**响应** `200`:
```json
{
  "source": {
    "id": "clxxx...",
    "url": "https://example.com/blog",
    "keyProducts": ["产品A", "产品B"],
    "recurringTopics": ["行业趋势"],
    "enabled": true
  }
}
```

---

### PUT `/api/genie/sources/[id]`

更新信息源。

**认证**: 需要

**请求体**:
```json
{
  "enabled": false
}
```

---

### DELETE `/api/genie/sources/[id]`

删除信息源。

**认证**: 需要

**响应** `200`:
```json
{ "success": true }
```

---

### POST `/api/genie/sources/[id]`

重新分析信息源。

**认证**: 需要

**响应** `200`: 同添加时的响应格式，重新抓取并分析。

---

### POST `/api/genie/generate`

基于信息源生成内容创意。

**认证**: 需要

**请求体**:
```json
{
  "projectId": "clxxx...",
  "count": 5,
  "platforms": ["wechat", "weibo"]
}
```

| 字段 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| projectId | string | 是 | — | 目标项目 |
| count | number | 否 | 5 | 生成数量 |
| platforms | string[] | 否 | — | 目标平台 |

**响应** `200`:
```json
{
  "success": true,
  "ideas": [
    { "id": "clxxx...", "title": "内容创意1", "status": "genie_draft" }
  ],
  "confidence": 0.8,
  "sourceCount": 3,
  "generatedAt": "2026-01-01T00:00:00.000Z"
}
```

---

### GET `/api/genie/generate`

获取 Genie 生成的内容草稿。

**认证**: 需要

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| projectId | string | 是 | 项目 ID |

**响应** `200`:
```json
{
  "drafts": [
    { "id": "clxxx...", "title": "内容创意1", "status": "genie_draft", "createdAt": "..." }
  ],
  "count": 5
}
```

**注意**: 返回最近 20 条 `genie_draft` 状态的内容。

---

## 18. 平台配置 (Platform Config)

### GET `/api/platform-config/[platform]`

获取平台 API 配置。

**认证**: 需要

**platform 值**: `wechat`, `weibo`, `xiaohongshu`, `douyin`

**响应** `200`:
```json
{
  "config": {
    "id": "clxxx...",
    "platform": "wechat",
    "appId": "wx...",
    "hasAccessToken": true,
    "tokenExpiresAt": "2026-02-01T00:00:00.000Z",
    "enabled": true,
    "extraConfig": null
  }
}
```

**注意**: 敏感字段 (`appSecret`, `accessToken`, `refreshTokn`) 不会暴露，仅返回 `hasAccessToken: boolean`。

---

### POST `/api/platform-config/[platform]`

创建或更新平台配置。

**认证**: 需要

**请求体**:
```json
{
  "appId": "wx1234567890",
  "appSecret": "secret123",
  "accessToken": "token123",
  "refreshToken": "refresh123",
  "enabled": true,
  "extraConfig": "{\"note\": \"测试配置\"}"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| appId | string | 否 | 应用 ID |
| appSecret | string | 否 | 应用密钥 |
| accessToken | string | 否 | 访问令牌 |
| refreshToken | string | 否 | 刷新令牌 |
| enabled | boolean | 否 | 是否启用 |
| extraConfig | string | 否 | 额外配置 (JSON) |

**注意**: 至少需要 `appId` 或 `accessToken`。

**响应** `200`: 同 GET 响应 (脱敏)

---

### DELETE `/api/platform-config/[platform]`

删除平台配置。

**认证**: 需要

**响应** `200`:
```json
{ "success": true }
```

---

### POST `/api/platform-config/[platform]/refresh`

刷新平台访问令牌。

**认证**: 需要

**响应** `200`:
```json
{
  "success": true,
  "tokenExpiresAt": "2026-02-01T00:00:00.000Z"
}
```

---

## 19. 平台 OAuth

### POST `/api/platform-oauth/callback`

生成 OAuth 授权 URL。

**认证**: 需要

**请求体**:
```json
{
  "platform": "wechat",
  "redirect_uri": "https://app.contentos.dev/api/platform-oauth/callback",
  "state": "csrf_token"
}
```

**响应** `200`:
```json
{
  "platform": "wechat",
  "oauthUrl": "https://open.weixin.qq.com/connect/oauth2/authorize?..."
}
```

---

### GET `/api/platform-oauth/callback`

OAuth 回调处理。

**认证**: 需要

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| platform | string | 是 | 平台标识 |
| code | string | 是 | 授权码 |
| state | string | 否 | CSRF state |
| redirect_uri | string | 否 | 重定向地址 |

**响应**: JSON 成功/失败，或重定向到成功/错误页面。

---

## 20. 发布 (Publish)

### POST `/api/publish/[id]`

发布平台内容。

**认证**: 需要

**注意**: `[id]` 是 PlatformContent ID (非 ContentPiece ID)。

**响应** `200`:
```json
{
  "id": "clxxx...",
  "platform": "wechat",
  "status": "published",
  "publishedUrl": "https://mp.weixin.qq.com/s/xxx",
  "platformPostId": "post_123",
  "publishedAt": "2026-01-05T10:00:00.000Z"
}
```

**错误响应** `200`:
```json
{
  "error": "Publish failed",
  "needsAuth": true
}
```

**注意**: 如果所有平台内容都已发布，自动将 ContentPiece 状态设为 `published`。

---

### GET `/api/publish/[id]`

获取发布状态和历史。

**认证**: 需要

**响应** `200`:
```json
{
  "platformContent": {
    "id": "clxxx...",
    "platform": "wechat",
    "status": "published",
    "publishedUrl": "https://mp.weixin.qq.com/s/xxx"
  },
  "publishHistory": [
    {
      "id": "clxxx...",
      "status": "success",
      "publishedUrl": "https://mp.weixin.qq.com/s/xxx",
      "platformPostId": "post_123",
      "attemptCount": 1,
      "completedAt": "2026-01-05T10:00:00.000Z"
    }
  ]
}
```

---

## 21. 定时任务 (Cron)

### GET `/api/cron/publish`

定时发布任务。

**认证**: Bearer Token (`CRON_SECRET`)

**请求头**:
```
Authorization: Bearer <CRON_SECRET>
```

**响应** `200`:
```json
{
  "success": true,
  "processed": 5,
  "published": 4,
  "failed": 1,
  "errors": [
    { "contentId": "clxxx...", "error": "Token expired" }
  ],
  "message": "Published 4/5 items"
}
```

**工作流**:
1. 查询 `scheduledAt <= now` 的调度记录
2. 乐观锁抢占 (`updateMany` 原子更新状态)
3. 指数退避重试 (1s, 2s, 4s, 最多 3 次)
4. 记录 PublishHistory
5. 发送通知

---

### GET `/api/cron/genie`

Genie 定时生成任务。

**认证**: Bearer Token (`CRON_SECRET`) 或 `?secret=` 查询参数

**响应** `200`:
```json
{
  "success": true,
  "results": {
    "totalWorkspaces": 10,
    "activeWorkspaces": 5,
    "ideasGenerated": 15,
    "piecesCreated": 15,
    "errors": []
  }
}
```

**工作流**:
1. 遍历所有工作区
2. 查找有已启用 GenieSource 的工作区
3. 为每个工作区生成 3-5 个内容创意
4. 创建 ContentPiece (status: `genie_draft`)

---

## 22. 外部集成 (Integration)

### GET `/api/integration/summary`

GeniLink Portal 数据摘要。

**认证**: JWT Bearer Token (GeniLink Federation, JWKS 验证)

**请求头**:
```
Authorization: Bearer <genilink_jwt>
```

**响应** `200`:
```json
{
  "totalContent": 120,
  "publishedCount": 85,
  "recentContent": [
    {
      "id": "clxxx...",
      "title": "最近内容",
      "status": "published",
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "qualityAvg": 7.8
}
```

**注意**: 通过 JWT 中的 `genilinkUserId` 查找用户和工作区，返回聚合统计数据。未找到用户时返回零值。

---

## 附录: 枚举值参考

### ContentStatus

| 值 | 说明 |
|----|------|
| `draft` | 草稿 |
| `genie_draft` | Genie 自动生成草稿 |
| `editing` | 人工编辑中 |
| `review` | 客户审核中 |
| `approved` | 已批准 |
| `revision_requested` | 需修改 |
| `scheduled` | 已调度 |
| `publishing` | 发布中 |
| `published` | 已发布 |
| `failed` | 发布失败 |

### Platform

| 值 | 说明 |
|----|------|
| `wechat` | 微信公众号 |
| `weibo` | 微博 |
| `xiaohongshu` | 小红书 |
| `douyin` | 抖音 |

### NotificationType

| 值 | 说明 |
|----|------|
| `content_review` | 内容审核 |
| `content_approved` | 内容批准 |
| `content_published` | 内容发布 |
| `schedule_reminder` | 调度提醒 |
| `mention` | @提及 |

### WorkspaceRole

| 值 | 说明 |
|----|------|
| `owner` | 拥有者 |
| `admin` | 管理员 |
| `member` | 普通成员 |
