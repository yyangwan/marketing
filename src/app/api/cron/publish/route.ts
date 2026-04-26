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
    // Find all scheduled content that is due
    const dueSchedules = await prisma.contentSchedule.findMany({
      where: {
        scheduledAt: { lte: now },
        status: "scheduled",
      },
      include: { contentPiece: true },
    });

    if (dueSchedules.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: "No due content found",
      });
    }

    const results = {
      processed: 0,
      published: 0,
      failed: 0,
      errors: [] as Array<{ id: string; title: string; error: string }>,
    };

    for (const schedule of dueSchedules) {
      results.processed++;

      try {
        // Update status to publishing
        await prisma.contentSchedule.update({
          where: { id: schedule.id },
          data: { status: "publishing" },
        });

        // Mock publishing (in real implementation, this would call platform APIs)
        // For now, we'll just simulate a brief delay and mark as published
        await simulatePublish(schedule);

        // Update status to published
        await prisma.contentSchedule.update({
          where: { id: schedule.id },
          data: {
            status: "published",
            publishedAt: new Date(),
          },
        });

        // Update content piece status
        await prisma.contentPiece.update({
          where: { id: schedule.contentId },
          data: { status: "published" },
        });

        // Create notification for workspace members
        const workspaceId = schedule.contentPiece.projectId; // This is simplified
        await prisma.notification.create({
          data: {
            userId: schedule.contentPiece.projectId, // Placeholder - should be actual assignee
            workspaceId: schedule.contentPiece.projectId, // Placeholder
            type: "content_published",
            title: "Content published",
            message: `"${schedule.contentPiece.title}" has been published successfully`,
            link: `/content/${schedule.contentId}`,
          },
        });

        results.published++;
      } catch (error) {
        console.error(`Failed to publish schedule ${schedule.id}:`, error);

        // Update status to failed
        await prisma.contentSchedule.update({
          where: { id: schedule.id },
          data: { status: "failed" },
        });

        results.failed++;
        results.errors.push({
          id: schedule.id,
          title: schedule.contentPiece.title,
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
