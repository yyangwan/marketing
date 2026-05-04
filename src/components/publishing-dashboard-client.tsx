"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PlatformBadge } from "@/components/platform-badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, BookOpen, ChevronDown, ChevronUp, Link2, RefreshCw, Trash2 } from "lucide-react";
import type { Platform } from "@/types";

const PLATFORM_GUIDES: Record<Platform, { title: string; steps: string[]; note?: string }> = {
  wechat: {
    title: "微信公众号",
    steps: [
      "登录微信公众平台 mp.weixin.qq.com",
      "进入「设置与开发」→「基本配置」",
      "在「开发者ID(AppID)」处复制 App ID 填入",
      "点击「重置」获取 AppSecret，填入下方（仅显示一次，请妥善保存）",
      "如需接口调用，在「基本配置」页获取 Access Token",
      "将服务器 IP 加入「IP 白名单」以允许接口调用",
    ],
    note: "公众号需完成微信认证才能使用大部分接口能力。测试号可在 mp.weixin.qq.com/debug/cgi-bin/sandbox 申请。",
  },
  weibo: {
    title: "微博",
    steps: [
      "访问微博开放平台 open.weibo.com 并登录",
      "进入「我的应用」，点击「创建应用」",
      "填写应用名称和回调地址，提交后获得 App Key 和 App Secret",
      "将 App Key 填入下方 App ID 字段",
      "将 App Secret 填入下方对应字段",
      "在「应用信息」→「高级信息」中配置授权回调页地址",
    ],
    note: "应用需通过审核才能获得完整接口权限。开发阶段可使用测试状态的应用进行调试。",
  },
  xiaohongshu: {
    title: "小红书",
    steps: [
      "访问小红书开放平台 open.xiaohongshu.com",
      "注册并完成开发者资质认证",
      "创建应用，选择「笔记发布」等所需权限",
      "在应用详情页获取 App ID（即 App Key）和 App Secret",
      "配置回调地址（OAuth 授权回调页）",
      "提交应用审核，审核通过后方可正常使用",
    ],
    note: "小红书开放平台目前对个人开发者开放有限，建议使用企业资质申请。部分接口可能需要额外申请白名单权限。",
  },
  douyin: {
    title: "抖音",
    steps: [
      "访问抖音开放平台 open.douyin.com 并登录",
      "进入「控制台」→「应用管理」→「创建应用」",
      "选择「短视频」或「图文」能力，填写应用信息",
      "创建完成后在应用详情获取 Client Key（即 App ID）和 Client Secret",
      "在「能力管理」中申请「视频发布」「图文发布」等所需接口",
      "配置回调地址，提交审核等待通过",
    ],
    note: "抖音开放平台要求应用上线前必须通过平台审核。建议先使用沙盒环境测试接口调用流程。",
  },
};

interface PlatformConfigStatus {
  id: string;
  platform: Platform;
  appId: string | null;
  hasAppSecret: boolean;
  hasRefreshToken: boolean;
  enabled: boolean;
  hasAccessToken: boolean;
  tokenExpiresAt: string | null;
  lastRefreshedAt: string | null;
}

interface PublishHistoryEntry {
  id: string;
  platform: Platform;
  title: string;
  status: "success" | "failed" | "pending";
  publishedUrl: string | null;
  errorMessage: string | null;
  attemptCount: number;
  createdAt: string;
  completedAt: string | null;
}

interface PublishingDashboardClientProps {
  workspaceId: string;
  platformConfigs: PlatformConfigStatus[];
  publishHistory: PublishHistoryEntry[];
}

const STATUS_LABELS: Record<string, string> = {
  success: "成功",
  failed: "失败",
  pending: "进行中",
};

function PlatformConfigForm({
  platform,
  appId,
  hasAppSecret,
  hasAccessToken,
  hasRefreshToken,
  onSave,
  onDelete,
}: {
  platform: Platform;
  appId: string | null;
  hasAppSecret: boolean;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  onSave: (data: { appId?: string; appSecret?: string; accessToken?: string; refreshToken?: string }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [form, setForm] = useState({
    appId: appId || "",
    appSecret: "",
    accessToken: "",
    refreshToken: "",
  });
  const guide = PLATFORM_GUIDES[platform];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload: Record<string, string> = {};
    if (form.appId) payload.appId = form.appId;
    if (form.appSecret) payload.appSecret = form.appSecret;
    if (form.accessToken) payload.accessToken = form.accessToken;
    if (form.refreshToken) payload.refreshToken = form.refreshToken;
    try {
      await onSave(payload);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="pt-3 border-t border-border mt-3 space-y-3">
      {/* Guide section */}
      <div>
        <button
          type="button"
          onClick={() => setShowGuide(!showGuide)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>如何获取 {guide.title} 配置</span>
          {showGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        {showGuide && (
          <div className="mt-2 p-3 bg-muted/50 rounded-md text-xs text-muted-foreground space-y-2">
            <ol className="space-y-1.5">
              {guide.steps.map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-medium">
                    {i + 1}
                  </span>
                  <span className="leading-5">{step}</span>
                </li>
              ))}
            </ol>
            {guide.note && (
              <p className="pt-1 border-t border-border text-[11px] leading-4">
                {guide.note}
              </p>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">App ID</label>
          <input
            type="text"
            value={form.appId}
            onChange={(e) => setForm((f) => ({ ...f, appId: e.target.value }))}
            placeholder={appId || "输入 App ID"}
            className="w-full h-8 px-2.5 rounded-md border border-border bg-background text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">App Secret</label>
          <input
            type="password"
            value={form.appSecret}
            onChange={(e) => setForm((f) => ({ ...f, appSecret: e.target.value }))}
            placeholder={hasAppSecret ? "••••••••（已保存）" : "输入 App Secret"}
            className="w-full h-8 px-2.5 rounded-md border border-border bg-background text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Access Token</label>
          <input
            type="password"
            value={form.accessToken}
            onChange={(e) => setForm((f) => ({ ...f, accessToken: e.target.value }))}
            placeholder={hasAccessToken ? "••••••••（已保存）" : "输入 Access Token"}
            className="w-full h-8 px-2.5 rounded-md border border-border bg-background text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Refresh Token</label>
          <input
            type="password"
            value={form.refreshToken}
            onChange={(e) => setForm((f) => ({ ...f, refreshToken: e.target.value }))}
            placeholder={hasRefreshToken ? "••••••••（已保存）" : "输入 Refresh Token"}
            className="w-full h-8 px-2.5 rounded-md border border-border bg-background text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "保存中..." : "保存"}
        </Button>
        {(hasAppSecret || hasAccessToken || appId) && (
          <Button type="button" size="sm" variant="destructive" disabled={deleting} onClick={handleDelete}>
            <Trash2 className="w-3.5 h-3.5" />
            {deleting ? "删除中..." : "删除配置"}
          </Button>
        )}
      </div>
    </form>
    </div>
  );
}

export function PublishingDashboardClient({
  workspaceId,
  platformConfigs: initialConfigs,
  publishHistory: initialHistory,
}: PublishingDashboardClientProps) {
  const [configs, setConfigs] = useState(initialConfigs);
  const [history, setHistory] = useState(initialHistory);
  const [connectingPlatform, setConnectingPlatform] = useState<Platform | null>(null);
  const [refreshingToken, setRefreshingToken] = useState<Platform | null>(null);
  const [expandedPlatform, setExpandedPlatform] = useState<Platform | null>(null);

  const handleConnect = async (platform: Platform) => {
    setConnectingPlatform(platform);

    try {
      const response = await fetch(`/api/platform-oauth/callback?platform=${platform}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redirect_uri: `${window.location.origin}/settings/publishing`,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get OAuth URL");
      }

      const data = await response.json();
      window.location.href = data.oauthUrl;
    } catch (error) {
      toast.error("连接失败");
      setConnectingPlatform(null);
    }
  };

  const handleRefreshToken = async (platform: Platform) => {
    setRefreshingToken(platform);

    try {
      const response = await fetch(`/api/platform-config/${platform}/refresh`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Token refresh failed");
      }

      toast.success("Token 已刷新");
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Token 刷新失败");
    } finally {
      setRefreshingToken(null);
    }
  };

  const handleToggleEnabled = async (platform: Platform, currentEnabled: boolean) => {
    try {
      const response = await fetch(`/api/platform-config/${platform}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !currentEnabled }),
      });

      if (!response.ok) {
        throw new Error("Failed to update platform");
      }

      setConfigs(configs.map((c) =>
        c.platform === platform ? { ...c, enabled: !c.enabled } : c
      ));
      toast.success(currentEnabled ? "已禁用" : "已启用");
    } catch (error) {
      toast.error("操作失败");
    }
  };

  const isTokenExpiringSoon = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    const now = new Date();
    const expiryTime = new Date(expiresAt);
    const daysUntilExpiry = (expiryTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry < 7;
  };

  const handleSaveConfig = async (platform: Platform, data: Record<string, string>) => {
    const response = await fetch(`/api/platform-config/${platform}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "保存失败");
    }

    const { config: updated } = await response.json();
    setConfigs((prev) =>
      prev.map((c) =>
        c.platform === platform
          ? {
              ...c,
              appId: updated.appId,
              hasAppSecret: !!data.appSecret || c.hasAppSecret,
              hasAccessToken: !!data.accessToken || c.hasAccessToken,
              hasRefreshToken: !!data.refreshToken || c.hasRefreshToken,
              enabled: updated.enabled,
            }
          : c
      )
    );
    toast.success("配置已保存");
    setExpandedPlatform(null);
  };

  const handleDeleteConfig = async (platform: Platform) => {
    const response = await fetch(`/api/platform-config/${platform}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("删除失败");
    }

    setConfigs((prev) =>
      prev.map((c) =>
        c.platform === platform
          ? { ...c, appId: null, hasAppSecret: false, hasAccessToken: false, hasRefreshToken: false, enabled: true }
          : c
      )
    );
    toast.success("配置已删除");
    setExpandedPlatform(null);
  };

  return (
    <div className="space-y-8">
      {/* Platform Connections Section */}
      <section>
        <h2 className="text-base font-medium text-foreground mb-3">平台连接</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {configs.map((config) => {
            const isConnected = config.hasAccessToken && config.enabled;
            const isExpiring = isTokenExpiringSoon(config.tokenExpiresAt);

            return (
              <div
                key={config.id}
                className="border border-border rounded-lg p-4 bg-card"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <PlatformBadge platform={config.platform} />
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-sm ${
                        isConnected
                          ? "bg-primary/10 text-primary"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {isConnected ? "已连接" : "未连接"}
                    </span>
                  </div>

                  {/* Expiry warning */}
                  {isConnected && isExpiring && (
                    <div className="relative group">
                      <AlertCircle className="w-4 h-4 text-yellow-600" />
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">
                        Token 即将过期
                      </span>
                    </div>
                  )}
                </div>

                {/* Connection details */}
                <div className="space-y-1 text-sm text-muted-foreground mb-4">
                  <div>App ID: {config.appId || "未配置"}</div>
                  {config.lastRefreshedAt && (
                    <div>
                      最后更新: {new Date(config.lastRefreshedAt).toLocaleString("zh-CN")}
                    </div>
                  )}
                  {config.tokenExpiresAt && (
                    <div>
                      过期时间: {new Date(config.tokenExpiresAt).toLocaleString("zh-CN")}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  {!isConnected ? (
                    <Button
                      size="sm"
                      onClick={() => handleConnect(config.platform)}
                      disabled={connectingPlatform === config.platform}
                      className="flex items-center gap-2"
                    >
                      <Link2 className="w-4 h-4" />
                      {connectingPlatform === config.platform ? "连接中..." : "连接平台"}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRefreshToken(config.platform)}
                      disabled={refreshingToken === config.platform}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw
                        className={`w-4 h-4 ${
                          refreshingToken === config.platform ? "animate-spin" : ""
                        }`}
                      />
                      {refreshingToken === config.platform ? "刷新中..." : "刷新 Token"}
                    </Button>
                  )}

                  {/* Config toggle */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setExpandedPlatform(expandedPlatform === config.platform ? null : config.platform)
                    }
                    className="flex items-center gap-1"
                  >
                    {expandedPlatform === config.platform ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                    配置
                  </Button>

                  {/* Enable/disable toggle */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleToggleEnabled(config.platform, config.enabled)}
                    disabled={!config.hasAccessToken}
                  >
                    {config.enabled ? "禁用" : "启用"}
                  </Button>
                </div>

                {/* Expandable config form */}
                {expandedPlatform === config.platform && (
                  <PlatformConfigForm
                    platform={config.platform}
                    appId={config.appId}
                    hasAppSecret={config.hasAppSecret}
                    hasAccessToken={config.hasAccessToken}
                    hasRefreshToken={config.hasRefreshToken}
                    onSave={(data) => handleSaveConfig(config.platform, data)}
                    onDelete={() => handleDeleteConfig(config.platform)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Publish History Section */}
      <section>
        <h2 className="text-base font-medium text-foreground mb-3">发布历史</h2>
        <div className="border border-border rounded-lg overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">平台</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">标题</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">状态</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">重试次数</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">时间</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">操作</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-border last:border-b-0"
                >
                  <td className="px-4 py-2">
                    <PlatformBadge platform={entry.platform} />
                  </td>
                  <td className="px-4 py-2">{entry.title}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-sm ${
                        entry.status === "success"
                          ? "bg-green-600/10 text-green-600"
                          : entry.status === "failed"
                            ? "bg-red-600/10 text-red-600"
                            : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {STATUS_LABELS[entry.status] || entry.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">{entry.attemptCount}</td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">
                    {new Date(entry.createdAt).toLocaleString("zh-CN")}
                  </td>
                  <td className="px-4 py-2">
                    {entry.publishedUrl && (
                      <a
                        href={entry.publishedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-xs"
                      >
                        查看
                      </a>
                    )}
                    {entry.errorMessage && (
                      <span className="text-red-600 text-xs ml-2" title={entry.errorMessage}>
                        {entry.errorMessage.length > 30
                          ? entry.errorMessage.slice(0, 30) + "..."
                          : entry.errorMessage}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {history.length === 0 && (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              暂无发布历史
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
