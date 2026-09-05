# ContentOS 发布标准

ContentOS 的生产发布由 `.github/workflows/ci.yml` 统一执行。生产目录是
`/opt/marketing`，PM2 服务名是 `genilink-content`，监听端口为 4002。

## 标准流程

1. 本地运行一次 `npm run release:check`。源码不变时不得重复执行；该命令只输出每个门禁的结果，失败时才展开日志。
2. 推送一个功能分支并创建一个 PR。普通分支 push 不触发 CI，避免与 PR 校验重复。
3. PR 的单个 `验证与构建` 作业完成依赖安装、Prisma 生成、类型检查、Lint、完整测试和生产构建。
4. CI 通过后合并。`master` 上只产生一次发布工作流，生产机以 `git pull --ff-only` 更新源码，迁移、构建并重启 `genilink-content`。
5. 发布后只验收一次：确认生产提交、PM2 在线、4002 端口响应、近期错误日志、磁盘和内存。

## GitHub Secrets

- `ECS_HOST`
- `ECS_USER`
- `ECS_SSH_PRIVATE_KEY`

## 安全约束

- 不在生产机直接修改受 Git 跟踪的文件。
- 不绕过 PR 或 CI，不使用强制推送。
- 生产更新必须是 `origin/master` 的 fast-forward。
- `.env` 和生产机上的未跟踪运行配置不得进入仓库、日志或 Actions 产物。

## 联合发布顺序

当智链前端与 ContentOS 同时变更时，两个仓库各运行一次本地门禁、各建立一个 PR；先完成 ContentOS 发布并确认服务在线，再发布智链前端，最后做一次联合验收。
