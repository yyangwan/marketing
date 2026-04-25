# 贡献指南

感谢您对 ContentOS 的关注！我们欢迎各种形式的贡献。

## 开发环境设置

### 前置要求

- Node.js 18+
- npm / yarn / pnpm / bun
- Git

### 一键启动

```bash
# 1. Fork 并克隆仓库
git clone https://github.com/YOUR_USERNAME/marketing.git
cd marketing

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env.local

# 4. 初始化数据库
npm run db:setup

# 5. 启动开发服务器
npm run dev
```

访问 http://localhost:3000

### 开发工具推荐

- **IDE**: VS Code + ESLint + Prettier 扩展
- **API 测试**: Postman 或 Insomnia
- **数据库管理**: Prisma Studio (`npm run db:studio`)

## 项目结构

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   │   ├── briefs/        # Brief 创建、查询
│   │   ├── content/        # 内容管理、状态更新
│   │   ├── generate/      # AI 生成接口
│   │   ├── projects/      # 项目管理
│   │   ├── workspaces/     # 工作空间
│   │   └── invites/        # 邀请协作
│   ├── brief/             # Brief 表单
│   ├── content/           # 内容编辑器
│   ├── login/             # 登录页面
│   ├── playground/        # 交互式教程
│   └── settings/         # 设置页面
├── components/            # React 组件
├── lib/                   # 核心逻辑
│   ├── ai/               # AI 生成、prompts
│   ├── auth/             # 认证配置
│   ├── errors.ts         # 标准化错误格式
│   └── db.ts             # Prisma 客户端
└── types/                 # TypeScript 类型定义
```

## 开发工作流

### 1. 创建功能分支

```bash
git checkout -b feature/your-feature-name
# 或
git checkout -b fix/your-bug-fix
```

分支命名规范:
- `feature/` — 新功能
- `fix/` — Bug 修复
- `refactor/` — 代码重构
- `docs/` — 文档更新
- `test/` — 测试相关

### 2. 进行开发

遵循以下代码规范:

#### TypeScript
- 使用类型注解，避免 `any`
- 接口命名使用 PascalCase (`ContentPiece`)
- 类型别名用于联合类型 (`Platform = "wechat" | "weibo"`)

#### React
- 函数组件优于类组件
- 使用 hooks (`useState`, `useEffect`)
- Props 接口定义在组件文件顶部

#### API 设计
- 使用标准化错误格式 (`src/lib/errors.ts`)
- 返回类型明确的响应
- 包含适当的错误处理

#### 错误处理
```typescript
// ✅ 正确
import { responses, errors } from "@/lib/errors";

if (!project) {
  return responses.notFound(errors.projectNotFound(projectId));
}

// ❌ 错误
return NextResponse.json({ error: "not found" }, { status: 404 });
```

### 3. 测试变更

```bash
# 运行类型检查
npm run build

# 运行 linter
npm run lint

# 手动测试功能
# 访问 http://localhost:3000 测试 UI
# 使用 Prisma Studio 检查数据
```

### 4. 提交变更

使用清晰的 commit message:

```
feat: 添加小红书平台支持

- 在 Platform 类型中添加 xiaohongshu
- 实现小红书特定的 prompt builder
- 更新文档说明

Closes #123
```

Commit message 类型:
- `feat:` — 新功能
- `fix:` — Bug 修复
- `docs:` — 文档更新
- `style:` — 代码格式（不影响功能）
- `refactor:` — 重构
- `test:` — 测试相关
- `chore:` — 构建/工具相关

### 5. 推送并创建 Pull Request

```bash
git push origin feature/your-feature-name
```

然后在 GitHub 上创建 Pull Request。

## Pull Request 模板

### PR 标题格式

```
[类型] 简短描述
```

例如:
- `[feat] 添加批量导出功能`
- `[fix] 修复登录后 session 不持久化问题`

### PR 描述模板

```markdown
## 变更内容
<!-- 描述这个 PR 做了什么 -->

## 变更原因
<!-- 为什么需要这个变更 -->

## 测试方法
<!-- 如何测试这些变更 -->

1. 步骤一
2. 步骤二

## 截图（如适用）
<!-- UI 变更请提供截图 -->

## 检查清单
- [ ] 代码遵循项目规范
- [ ] 测试了变更功能
- [ ] 更新了相关文档
- [ ] 没有 console.log 或调试代码
- [ ] Commit message 清晰
```

## 代码审查准则

### 必须通过的检查

1. **类型安全**: 没有 TypeScript 错误
2. **错误处理**: 所有 API 调用有错误处理
3. **用户体验**: 加载状态、错误提示完整
4. **代码质量**: 遵循项目规范，无冗余代码

### 常见问题

#### ❌ 避免使用 `any` 类型
```typescript
// ❌ 错误
function processData(data: any) { ... }

// ✅ 正确
interface DataInput {
  id: string;
  value: number;
}
function processData(data: DataInput) { ... }
```

#### ❌ 避免 console.log 调试
```typescript
// ❌ 错误
console.log(data);

// ✅ 正确
toast.error("操作失败: " + error.message);
```

#### ❌ 避免硬编码字符串
```typescript
// ❌ 错误
throw new Error("project not found");

// ✅ 正确
return responses.notFound(errors.projectNotFound(projectId));
```

## 文档贡献

文档是产品的重要组成部分。提交代码变更时，请同时更新相关文档:

- **API 变更**: 更新 `docs/api.md`
- **新功能**: 在 README.md 添加使用说明
- **设计变更**: 更新 DESIGN.md
- **错误代码**: 在 `src/lib/errors.ts` 添加注释

## 获取帮助

- **文档**: 查看项目 README 和 `docs/` 目录
- **Issues**: 在 GitHub 提问或搜索类似问题
- **讨论**: 参与 GitHub Discussions

## 许可证

提交贡献即表示您同意您的贡献将根据项目的 MIT 许可证进行许可。

## 致谢

感谢所有贡献者！您的参与让 ContentOS 变得更好。
