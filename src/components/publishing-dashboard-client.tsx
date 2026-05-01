"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PlatformBadge } from "@/components/platform-badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Link2, RefreshCw } from "lucide-react";
import type { Platform } from "@/types";

interface PlatformConfigStatus {
  id: string;
  platform: Platform;
  appId: string | null;
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

export function PublishingDashboardClient({
  workspaceId,
  platformConfigs: initialConfigs,
  publishHistory: initialHistory,
}: PublishingDashboardClientProps) {
  const [configs, setConfigs] = useState(initialConfigs);
  const [history, setHistory] = useState(initialHistory);
  const [connectingPlatform, setConnectingPlatform] = useState<Platform | null>(null);
  const [refreshingToken, setRefreshingToken] = useState<Platform | null>(null);

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
