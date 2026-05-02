import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPlatformPublisher } from "@/lib/platform";
import type { PlatformCredentials, PublishOptions } from "@/lib/platform/base";
import { notifyContentStatus } from "@/lib/notifications/trigger";
import type { Platform } from "@/types";

async function claimNextSchedule(now: Date) {
  while (true) {
    const candidate = await prisma.contentSchedule.findFirst({
      where: {
        scheduledAt: { lte: now },
        status: "scheduled",
      },
      orderBy: { scheduledAt: "asc" },
    });

    if (!candidate) {
      return null;
    }

    const claim = await prisma.contentSchedule.updateMany({
      where: {
        id: candidate.id,
        status: "scheduled",
      },
      data: { status: "publishing" },
    });

    if (claim.count === 1) {
      return candidate;
    }
  }
}

// GET /api/cron/publish - Cron endpoint for real publishing
// Protected by CRON_SECRET environment variable
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET not configured");
    return NextResponse.json(
      { error: "cron_not_configured" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();

  try {
    const results = {
      processed: 0,
      published: 0,
      failed: 0,
      errors: [] as Array<{ id: string; title: string; error: string }>,
    };

    while (true) {
      const claimed = await claimNextSchedule(now);
      if (!claimed) {
        break;
      }

      results.processed++;
      let contentTitle = claimed.contentId;

      try {
        const contentPiece = await prisma.contentPiece.findUnique({
          where: { id: claimed.contentId },
          include: { project: true },
        });

        if (!contentPiece) {
          throw new Error("Content piece not found");
        }

        contentTitle = contentPiece.title;

        await prisma.contentPiece.update({
          where: { id: claimed.contentId },
          data: { status: "publishing" },
        });

        const workspaceId = contentPiece.project.workspaceId;

        const platformContents = await prisma.platformContent.findMany({
          where: { contentPieceId: claimed.contentId },
        });

        let anySuccess = false;
        for (const platformContent of platformContents) {
          const platform = platformContent.platform as Platform;

          const apiConfig = await prisma.platformApiConfig.findUnique({
            where: {
              workspaceId_platform: {
                workspaceId,
                platform,
              },
            },
          });

          if (!apiConfig || !apiConfig.enabled || !apiConfig.accessToken) {
            console.warn(`Platform ${platform} not configured or no access token`);
            continue;
          }

          const history = await prisma.publishHistory.create({
            data: {
              workspaceId,
              platform,
              platformContentId: platformContent.id,
              title: contentPiece.title,
              content: platformContent.content || "",
              status: "pending",
              attemptCount: 0,
              lastAttemptAt: new Date(),
            },
          });

          const publishSuccess = await publishWithRetry(
            platform,
            {
              appId: apiConfig.appId || undefined,
              appSecret: apiConfig.appSecret || undefined,
              accessToken: apiConfig.accessToken || undefined,
              refreshToken: apiConfig.refreshTokn || undefined,
              tokenExpiresAt: apiConfig.tokenExpiresAt || undefined,
            },
            {
              title: contentPiece.title,
              content: platformContent.content || "",
              images: [],
            },
            history.id
          );

          if (publishSuccess) {
            anySuccess = true;
          }
        }

        if (platformContents.length > 0 && !anySuccess) {
          throw new Error("All platform publishes failed");
        }

        await prisma.contentSchedule.update({
          where: { id: claimed.id },
          data: {
            status: "published",
            publishedAt: new Date(),
          },
        });

        await prisma.contentPiece.update({
          where: { id: claimed.contentId },
          data: { status: "published" },
        });

        try {
          await notifyContentStatus(claimed.contentId, "published", workspaceId);
        } catch (notificationError) {
          console.error(
            `Failed to send publish notifications for ${claimed.contentId}:`,
            notificationError
          );
        }

        results.published++;
      } catch (error) {
        console.error(`Failed to publish schedule ${claimed.id}:`, error);

        await prisma.contentSchedule.update({
          where: { id: claimed.id },
          data: { status: "failed" },
        });

        await prisma.contentPiece
          .update({
            where: { id: claimed.contentId },
            data: { status: "failed" },
          })
          .catch((updateError) => {
            console.error(
              `Failed to update content status to failed for ${claimed.contentId}:`,
              updateError
            );
          });

        results.failed++;
        results.errors.push({
          id: claimed.contentId,
          title: contentTitle,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      message: `Processed ${results.processed} items: ${results.published} published, ${results.failed} failed`,
    });
  } catch (error) {
    console.error("Cron job failed:", error);
    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 }
    );
  }
}

/**
 * Publish to platform with retry mechanism
 * Implements exponential backoff: 1s, 2s, 4s delays
 */
async function publishWithRetry(
  platform: Platform,
  credentials: PlatformCredentials,
  options: PublishOptions,
  historyId: string,
  maxRetries = 3
): Promise<boolean> {
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt < maxRetries) {
    try {
      const result = await getPlatformPublisher(platform, credentials).publish(options);

      if (result.success) {
        await prisma.publishHistory.update({
          where: { id: historyId },
          data: {
            status: "success",
            publishedUrl: result.publishedUrl || null,
            platformPostId: result.platformPostId || null,
            completedAt: new Date(),
            attemptCount: attempt + 1,
          },
        });

        const history = await prisma.publishHistory.findUnique({
          where: { id: historyId },
        });

        if (history) {
          await prisma.platformContent.update({
            where: { id: history.platformContentId },
            data: {
              status: "published",
              publishedUrl: result.publishedUrl || null,
            },
          });
        }

        return true;
      }

      if (result.needsAuth) {
        await prisma.publishHistory.update({
          where: { id: historyId },
          data: {
            status: "failed",
            errorMessage: "Authentication required. Please re-authenticate.",
            attemptCount: attempt + 1,
          },
        });
        return false;
      }

      lastError = new Error(result.errorMessage || "Publish failed");
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error");
    }

    attempt++;

    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  await prisma.publishHistory.update({
    where: { id: historyId },
    data: {
      status: "failed",
      errorMessage: lastError?.message || "Max retries exceeded",
      attemptCount: maxRetries,
    },
  });

  return false;
}
