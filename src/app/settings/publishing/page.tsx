import { auth } from "@/lib/auth/config";
import { buildGeniLinkLoginUrl } from "@/lib/auth/genilink-login";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { PublishingDashboardClient } from "@/components/publishing-dashboard-client";
import type { Platform } from "@/types";

const ALL_PLATFORMS: Platform[] = ["douyin", "wechat", "weibo", "xiaohongshu"];

/**
 * Publishing Settings Page
 * Platform connections, publish history, and token management
 */
export default async function PublishingSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(buildGeniLinkLoginUrl("/settings/publishing"));
  }

  const cookieStore = await cookies();
  const workspaceId = session.user.workspaceId ?? cookieStore.get("genilink-workspace")?.value;
  if (!workspaceId) {
    redirect(buildGeniLinkLoginUrl("/settings/publishing"));
  }

  // Ensure all platforms have a config row
  for (const platform of ALL_PLATFORMS) {
    await prisma.platformApiConfig.upsert({
      where: { workspaceId_platform: { workspaceId, platform } },
      create: { workspaceId, platform },
      update: {},
    });
  }

  // Fetch platform configs
  const platformConfigs = await prisma.platformApiConfig.findMany({
    where: { workspaceId },
    orderBy: { platform: "asc" },
  });

  // Fetch recent publish history
  const publishHistory = await prisma.publishHistory.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground tracking-tight mb-6">
        鍙戝竷璁剧疆
      </h1>

      <PublishingDashboardClient
        workspaceId={workspaceId}
        platformConfigs={platformConfigs.map((config) => ({
          id: config.id,
          platform: config.platform as Platform,
          appId: config.appId,
          hasAppSecret: !!config.appSecret,
          hasRefreshToken: !!config.refreshTokn,
          enabled: config.enabled,
          hasAccessToken: !!config.accessToken,
          tokenExpiresAt: config.tokenExpiresAt?.toISOString() || null,
          lastRefreshedAt: config.lastRefreshedAt?.toISOString() || null,
        }))}
        publishHistory={publishHistory.map((h) => ({
          id: h.id,
          platform: h.platform as Platform,
          title: h.title,
          status: h.status as "success" | "failed" | "pending",
          publishedUrl: h.publishedUrl,
          errorMessage: h.errorMessage,
          attemptCount: h.attemptCount,
          createdAt: h.createdAt.toISOString(),
          completedAt: h.completedAt?.toISOString() || null,
        }))}
      />
    </div>
  );
}
