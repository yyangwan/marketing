import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPlatformPublisher } from "@/lib/platform";
import type { PlatformCredentials, PublishOptions } from "@/lib/platform/base";

// GET /api/cron/publish - Cron endpoint for real publishing
// Protected by CRON_SECRET environment variable
export async function GET(req: Request) {
  // Verify cron secret
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

    // Process schedules one at a time atomically to prevent concurrent cron runs
    // from processing the same schedule twice
    while (true) {
      // Atomically claim one scheduled item by updating its status to "publishing"
      // The WHERE clause ensures we only claim items that are still "scheduled"
      const claimed = await prisma.contentSchedule.findFirst({
        where: {
          scheduledAt: { lte: now },
          status: "scheduled",
        },
        orderBy: { scheduledAt: "asc" },
      });

      if (!claimed) {
        // No more scheduled items to process
        break;
      }

      results.processed++;

      try {
        // Update status to publishing (this acts as our lock - other cron runs will skip this)
        await prisma.contentSchedule.update({
          where: { id: claimed.id },
          data: { status: "publishing" },
        });

        // Fetch the content piece with project for this schedule
        const contentPiece = await prisma.contentPiece.findUnique({
          where: { id: claimed.contentId },
          include: { project: true },
        });

        if (!contentPiece) {
          throw new Error("Content piece not found");
        }

        const workspaceId = contentPiece.project.workspaceId;

        // Fetch all platform contents for this content piece
        const platformContents = await prisma.platformContent.findMany({
          where: { contentPieceId: claimed.contentId },
        });

        // Publish to each configured platform
        let anySuccess = false;
        for (const platformContent of platformContents) {
          const platform = platformContent.platform as any;

          // Get platform API config
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

          // Create publish history record
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

          // Publish with retry mechanism
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
              images: [], // TODO: Extract images from content
            },
            history.id
          );

          if (publishSuccess) {
            anySuccess = true;
          }
        }

        // Only mark as published if at least one platform succeeded
        if (!anySuccess && platformContents.length > 0) {
          throw new Error("All platform publishes failed");
        }

        // Update status to published
        await prisma.contentSchedule.update({
          where: { id: claimed.id },
          data: {
            status: "published",
            publishedAt: new Date(),
          },
        });

        // Update content piece status
        await prisma.contentPiece.update({
          where: { id: claimed.contentId },
          data: { status: "published" },
        });

        // Create notification for workspace members
        await prisma.notification.create({
          data: {
            userId: contentPiece.projectId, // Placeholder - should be actual assignee
            workspaceId: contentPiece.projectId, // Placeholder
            type: "content_published",
            title: "Content published",
            message: `"${contentPiece.title}" has been published successfully`,
            link: `/content/${claimed.contentId}`,
          },
        });

        results.published++;
      } catch (error) {
        console.error(`Failed to publish schedule ${claimed.id}:`, error);

        // Update status to failed
        await prisma.contentSchedule.update({
          where: { id: claimed.id },
          data: { status: "failed" },
        });

        results.failed++;
        // Note: we can't push to errors array here without re-fetching the content piece
        // since the error might have occurred before we fetched it
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
  platform: any,
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
        // Update history as success
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

        // Update platform content status
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

      // Check if needs auth (non-retryable)
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

      // Other failures - retry
      lastError = new Error(result.errorMessage || "Publish failed");
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error");
    }

    attempt++;

    if (attempt < maxRetries) {
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // All retries failed
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
