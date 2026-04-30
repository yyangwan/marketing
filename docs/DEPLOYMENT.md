# CI/CD 部署指南

本文档介绍如何配置 ContentOS 的 CI/CD 流水线，实现自动部署到阿里云 ECS。

## 前置要求

- GitHub 仓库
- 阿里云 ECS 服务器
- 域名（可选，用于配置 Nginx）

## 服务器环境准备

### 1. 连接到 ECS 服务器

```bash
ssh root@your-ecs-ip
```

### 2. 安装必要软件

```bash
# 安装 Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# 安装 PM2
bun pm -g pm2

# 安装 Git（如果没有）
sudo apt-get update
sudo apt-get install -y git

# 安装 Nginx
sudo apt-get install -y nginx
```

### 3. 克隆代码仓库

```bash
# 创建项目目录
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www

# 克隆代码
cd /var/www
git clone <your-github-repo-url> contentos
cd contentos

# 安装依赖
bun install
```

### 4. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，填入真实配置
nano .env
```

必需的环境变量：

```env
# NextAuth
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=https://your-domain.com

# 数据库
DATABASE_URL="file:./dev.db"

# Cron 安全
CRON_SECRET=your-cron-secret-here

# AI API（可选，如果 MOCK_AI=false）
OPENAI_API_KEY=your-key-here
# 或其他 AI API 配置
```

### 5. 创建 PM2 配置

```bash
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'contentos',
    script: 'node_modules/next/dist/bin/next',
    args: 'start',
    cwd: '/var/www/contentos',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
EOF
```

### 6. 启动应用

```bash
# 构建应用
bun run build

# 启动 PM2 服务
pm2 start ecosystem.config.js

# 保存 PM2 配置
pm2 save

# 设置 PM2 开机自启
pm2 startup
# 按照输出的命令执行 sudo 命令
```

### 7. 配置 Nginx 反向代理

```bash
sudo nano /etc/nginx/sites-available/contentos
```

添加以下配置：

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名或 ECS IP

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用站点：

```bash
sudo ln -s /etc/nginx/sites-available/contentos /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## GitHub Secrets 配置

在 GitHub 仓库中配置以下 Secrets：

### 1. 生成 SSH 密钥对（如果没有）

在本地机器上：

```bash
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions
```

### 2. 将公钥复制到 ECS 服务器

```bash
ssh-copy-id -i ~/.ssh/github_actions.pub user@your-ecs-ip
```

或手动复制：

```bash
# 在本地查看公钥
cat ~/.ssh/github_actions.pub

# 在 ECS 服务器的 ~/.ssh/authorized_keys 中添加公钥内容
```

### 3. 在 GitHub 中添加 Secrets

1. 进入 GitHub 仓库
2. 点击 Settings → Secrets and variables → Actions
3. 点击 "New repository secret"
4. 添加以下 secrets：

| Secret 名称 | 描述 | 示例值 |
|-------------|------|--------|
| `ECS_HOST` | ECS 服务器 IP 或域名 | `47.99.xxx.xxx` 或 `contentos.example.com` |
| `ECS_USER` | SSH 登录用户名 | `root` 或 `ubuntu` |
| `ECS_SSH_PRIVATE_KEY` | SSH 私钥内容 | 本地 `cat ~/.ssh/github_actions` 的完整输出 |

### 4. 测试 SSH 连接（可选）

在 GitHub Actions 调试之前，可以先在本地测试 SSH：

```bash
ssh -i ~/.ssh/github_actions user@your-ecs-ip
```

## 验证部署

### 1. 检查 PM2 状态

```bash
pm2 status
pm2 logs contentos
```

### 2. 检查 Nginx 状态

```bash
sudo systemctl status nginx
```

### 3. 访问应用

在浏览器中访问 `http://your-ecs-ip` 或 `http://your-domain.com`

### 4. 测试自动部署

1. 在 GitHub 上创建一个分支并修改代码
2. 推送并创建 PR
3. 查看 Actions 标签页，确认 CI 运行
4. 合并 PR 到 master
5. 确认部署作业运行成功
6. 等待几秒后刷新页面，验证更新

## 常见问题

### SSH 连接失败

- 检查 ECS 安全组是否开放 22 端口
- 确认 SSH 密钥已正确添加到服务器的 `authorized_keys`
- 检查 GitHub Secrets 中的私钥格式是否正确

### PM2 进程无法启动

```bash
# 查看 PM2 日志
pm2 logs contentos --lines 100

# 重启 PM2
pm2 restart contentos

# 重新加载配置
pm2 reload contentos
```

### Nginx 502 错误

- 确认 Next.js 应用正在运行（`pm2 status`）
- 检查端口 3000 是否被占用
- 查看 Nginx 错误日志：`sudo tail -f /var/log/nginx/error.log`

### 构建内存不足

ECS 服务器至少需要 1GB 内存。如果遇到内存不足：

```bash
# 创建 swap 文件
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### GitHub Actions 超时

在 `.github/workflows/ci.yml` 中添加超时设置：

```yaml
- name: 部署到服务器
  timeout-minutes: 10
  run: |
    ...
```

## 更新应用

手动更新应用（不通过 CI/CD）：

```bash
ssh user@your-ecs-ip
cd /var/www/contentos
git pull origin master
bun install --frozen-lockfile
bun run build
pm2 restart contentos
```

## 回滚部署

如果新版本有问题，可以快速回滚：

```bash
ssh user@your-ecs-ip
cd /var/www/contentos
git log --oneline -5  # 查看最近提交
git revert HEAD       # 回滚最后一次提交
# 或
git reset --hard <commit-hash>  # 回滚到指定提交

bun run build
pm2 restart contentos
```

## 监控和日志

### PM2 监控

```bash
# 实时监控
pm2 monit

# 查看日志
pm2 logs contentos

# 查看错误日志
pm2 logs contentos --err

# 清空日志
pm2 flush
```

### Nginx 日志

```bash
# 访问日志
sudo tail -f /var/log/nginx/access.log

# 错误日志
sudo tail -f /var/log/nginx/error.log
```

### 应用日志

```bash
# Next.js 应用日志
pm2 logs contentos --lines 100
```

## 安全建议

1. **配置防火墙**：只开放必要的端口（80, 443, 22）
2. **使用密钥认证**：禁用密码登录
3. **定期更新**：保持系统和依赖包最新
4. **备份数据库**：定期备份 SQLite 数据库
5. **监控资源**：设置 CPU 和内存告警

## 下一步

- 配置 HTTPS（使用 Let's Encrypt 和 Certbot）
- 设置数据库备份策略
- 配置监控和告警
- 添加 CDN 加速
