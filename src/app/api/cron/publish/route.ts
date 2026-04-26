import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/cron/publish - Cron endpoint for mock publishing
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

        // Fetch the content piece for this schedule
        const contentPiece = await prisma.contentPiece.findFirst({
          where: { id: claimed.contentId },
        });

        if (!contentPiece) {
          throw new Error("Content piece not found");
        }

        // Mock publishing (in real implementation, this would call platform APIs)
        // For now, we'll just simulate a brief delay and mark as published
        await simulatePublish({ ...claimed, contentPiece });

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

// Mock publishing function - simulates platform API call
async function simulatePublish(schedule: any): Promise<void> {
  // In a real implementation, this would:
  // 1. Call WeChat API to publish the article
  // 2. Call Weibo API to post the content
  // 3. Call Xiaohongshu API to create the note
  // 4. Call Douyin API to upload the video

  // For now, just simulate a brief delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Log what would happen
  console.log(
    `[MOCK PUBLISH] Content "${schedule.contentPiece.title}" would be published to platform`
  );
}
