# ContentOS API 文档

ContentOS 提供 RESTful API 用于内容创作和管理。所有 API 端点需要认证 (除登录接口外)。

## 认证

ContentOS 使用 NextAuth session-based 认证。在请求中包含 session cookie 即可。

```typescript
// 客户端请求示例
fetch("/api/briefs", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include", // 包含 session cookie
  body: JSON.stringify({ projectId: "xxx", topic: "..." }),
});
```

## 错误处理

所有 API 错误返回统一的结构化格式:

```typescript
interface APIError {
  error: {
    type: ErrorType;
    code: string;
    message: string;
    param?: string;
    doc_url: string;
  };
}

type ErrorType =
  | "authentication_error"    // 401 - 未认证
  | "invalid_request_error"   // 400 - 参数错误
  | "not_found_error"         // 404 - 资源不存在
  | "api_error"               // 500 - 服务器错误
  | "rate_limit_error";       // 429 - 频率限制
```

### 错误代码参考

| 代码 | 类型 | HTTP | 说明 |
|------|------|------|------|
| `missing_session` | authentication_error | 401 | 未登录或 session 过期 |
| `no_workspace` | authentication_error | 403 | 未加入任何工作区 |
| `insufficient_permissions` | authentication_error | 403 | 权限不足 |
| `missing_parameter` | invalid_request_error | 400 | 缺少必需参数 |
| `invalid_parameter` | invalid_request_error | 400 | 参数格式错误 |
| `project_not_found` | not_found_error | 404 | 项目不存在 |
| `workspace_not_found` | not_found_error | 404 | 工作区不存在 |
| `content_not_found` | not_found_error | 404 | 内容不存在 |
| `llm_api_error` | api_error | 500 | AI 服务暂时不可用 |
| `rate_limit_exceeded` | rate_limit_error | 429 | 请求过于频繁 |

### 错误处理最佳实践

```typescript
// 推荐的错误处理方式
const res = await fetch("/api/briefs", { ... });

if (!res.ok) {
  const errorData = await res.json();

  if (errorData.error) {
    const { type, code, message, param, doc_url } = errorData.error;

    // 根据错误类型处理
    switch (type) {
      case "authentication_error":
        // 跳转到登录页
        router.push("/login");
        break;
      case "invalid_request_error":
        // 显示验证错误
        showFieldError(param, message);
        break;
      case "not_found_error":
        // 显示资源不存在提示
        toast.error(message, { action: { label: "查看文档", onClick: () => window.open(doc_url) } });
        break;
      default:
        // 显示通用错误
        toast.error(message);
    }
  }
}
```

## API 端点

### Briefs

#### 创建 Brief

`POST /api/briefs`

创建新的内容 Brief 并生成内容。

**请求体**:
```typescript
{
  projectId: string;              // 必需 - 项目 ID
  topic: string;                  // 必需 - 主题
  keyPoints?: string[];           // 可选 - 要点列表
  platforms?: Platform[];         // 可选 - 目标平台，默认 ["wechat"]
  references?: string;            // 可选 - 参考资料
  notes?: string;                 // 可选 - 品牌调性
}
```

**成功响应** (200):
```typescript
{
  id: string;
  title: string;
  brief: string;                  // JSON 序列化的 Brief
  status: "draft" | "in_review" | "approved" | "published";
  project: { id: string; name: string };
  platformContents: PlatformContent[];
  // ...
}
```

**错误响应**:
```typescript
// 401 - 未登录
{ error: { type: "authentication_error", code: "missing_session", message: "请先登录", doc_url: "..." } }

// 400 - 缺少 projectId
{ error: { type: "invalid_request_error", code: "missing_parameter", message: "缺少必需参数: projectId", param: "projectId", doc_url: "..." } }

// 404 - 项目不存在
{ error: { type: "not_found_error", code: "project_not_found", message: "项目不存在: xxx", param: "projectId", doc_url: "..." } }

// 500 - AI 服务错误
{ error: { type: "api_error", code: "llm_api_error", message: "AI 生成服务暂时不可用，请稍后重试。原始错误: ...", doc_url: "..." } }
```

#### 查询 Briefs

`GET /api/briefs?projectId={projectId}`

**查询参数**:
- `projectId` (可选): 过滤特定项目的内容

**成功响应** (200):
```typescript
Array<{
  id: string;
  title: string;
  status: string;
  project: { id: string; name: string };
  _count: { reviewComments: number };
  _lastReviewAction: { action: string; createdAt: string } | null;
}>
```

### Content

#### 更新内容状态

`PATCH /api/content/{id}/status`

**请求体**:
```typescript
{
  status: "draft" | "in_review" | "approved" | "published";
}
```

#### 保存内容编辑

`PUT /api/content/{platformContentId}`

**请求体**:
```typescript
{
  content: string;  // HTML 格式的内容
}
```

### Projects

#### 创建项目

`POST /api/projects`

**请求体**:
```typescript
{
  name: string;
  description?: string;
}
```

#### 查询项目列表

`GET /api/projects`

**成功响应** (200):
```typescript
Array<{
  id: string;
  name: string;
  description?: string;
}>
```

### Workspaces

#### 创建工作区

`POST /api/workspaces`

**请求体**:
```typescript
{
  name: string;
}
```

#### 查询工作区

`GET /api/workspaces/{id}`

### Invites

#### 创建邀请

`POST /api/invites`

**请求体**:
```typescript
{
  email: string;
  workspaceId: string;
  role: "member" | "admin";
}
```

#### 接受邀请

`POST /api/invites/{token}/accept`

## SDK / 客户端库

虽然 ContentOS 不提供官方 SDK，但可以轻松创建一个辅助类:

```typescript
// lib/contentos-client.ts
class ContentOSClient {
  private baseUrl: string;

  constructor(baseUrl: string = "") {
    this.baseUrl = baseUrl;
  }

  async createBrief(data: CreateBriefInput): Promise<ContentPiece> {
    const res = await fetch(`${this.baseUrl}/api/briefs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new ContentOSError(error.error);
    }

    return res.json();
  }

  // ... 其他方法
}

interface ContentOSError extends Error {
  type: ErrorType;
  code: string;
  param?: string;
  doc_url: string;
}
```

## 速率限制

API 请求频率限制为每分钟 60 次请求。超出限制将返回:

```typescript
{
  error: {
    type: "rate_limit_error",
    code: "rate_limit_exceeded",
    message: "请求过于频繁，请稍后重试",
    doc_url: "https://docs.contentos.dev/errors/rate_limit_exceeded"
  }
}
```

响应头包含:
- `X-RateLimit-Limit`: 60
- `X-RateLimit-Remaining`: 剩余请求数
- `X-RateLimit-Reset`: 重置时间 (Unix timestamp)

## Webhooks (计划中)

ContentOS 将在内容状态变更时发送 webhook 通知。

**Webhook 事件类型**:
- `content.created`: 新内容创建
- `content.status_changed`: 状态变更
- `content.published`: 内容发布

**Payload 格式**:
```typescript
{
  id: string;           // Event ID
  type: string;         // Event type
  data: { ... };        // Event data
  timestamp: string;    // ISO 8601
}
```

## 版本管理

当前 API 版本: `v1`

未来 API 重大变更将引入新版本。可通过请求头指定版本:

```typescript
fetch("/api/briefs", {
  headers: {
    "ContentOS-API-Version": "v1"
  }
});
```

## 支持

- API 文档: https://docs.contentos.dev/api
- 错误代码参考: https://docs.contentos.dev/errors
- GitHub Issues: https://github.com/yourusername/marketing/issues
