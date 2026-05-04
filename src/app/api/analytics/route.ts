import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { apiError, errors, ERROR_CODES, responses } from "@/lib/errors";

// GET /api/analytics - Fetch analytics data for dashboard
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return responses.unauthorized();
  }

  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return responses.forbidden(errors.noWorkspace());
  }

  const url = new URL(req.url);
  const timeRange = url.searchParams.get("timeRange") || "30"; // days

  // Calculate date range
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(timeRange));
  startDate.setHours(0, 0, 0, 0);

  try {
    // Fetch all data in parallel for better performance
    const [
      totalContent,
      contentByStatus,
      contentByPlatform,
      qualityScores,
      publishStats,
      scheduleStats,
      recentContent,
      topProjectsRaw,
    ] = await Promise.all([
      // Total content count in time range
      prisma.contentPiece.count({
        where: {
          project: { workspaceId: ws.workspaceId },
          createdAt: { gte: startDate },
        },
      }),

      // Content by status
      prisma.contentPiece.groupBy({
        by: ["status"],
        where: {
          project: { workspaceId: ws.workspaceId },
          createdAt: { gte: startDate },
        },
        _count: true,
      }),

      // Content by platform (from PlatformContent)
      prisma.platformContent.groupBy({
        by: ["platform"],
        where: {
          contentPiece: {
            project: { workspaceId: ws.workspaceId },
          },
          createdAt: { gte: startDate },
        },
        _count: true,
      }),

      // Quality score averages
      prisma.contentQuality.aggregate({
        _avg: {
          quality: true,
          engagement: true,
          brandVoice: true,
          platformFit: true,
        },
        where: {
          contentPiece: {
            project: { workspaceId: ws.workspaceId },
          },
          evaluatedAt: { gte: startDate },
        },
      }),

      // Publish statistics
      prisma.publishHistory.groupBy({
        by: ["status"],
        where: {
          workspaceId: ws.workspaceId,
          createdAt: { gte: startDate },
        },
        _count: true,
      }),

      // Schedule statistics
      prisma.contentSchedule.groupBy({
        by: ["status"],
        where: {
          contentPiece: {
            project: { workspaceId: ws.workspaceId },
          },
          createdAt: { gte: startDate },
        },
        _count: true,
      }),

      // Recent content for activity feed
      prisma.contentPiece.findMany({
        where: {
          project: { workspaceId: ws.workspaceId },
        },
        include: {
          project: {
            select: { name: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),

      // Top projects by content count in time range
      prisma.project.findMany({
        where: { workspaceId: ws.workspaceId },
        include: {
          contentPieces: {
            where: { createdAt: { gte: startDate } },
            select: { id: true },
          },
        },
      }),
    ]);

    // Content trend over time (daily buckets)
    const contentTrend = await prisma.$queryRaw<Array<{ date: string; count: number }>>`
      SELECT
        TO_CHAR("createdAt", 'YYYY-MM-DD') as date,
        COUNT(*) as count
      FROM "ContentPiece"
      WHERE "projectId" IN (
        SELECT id FROM "Project" WHERE "workspaceId" = ${ws.workspaceId}
      )
      AND "createdAt" >= ${startDate}
      GROUP BY TO_CHAR("createdAt", 'YYYY-MM-DD')
      ORDER BY date ASC
    `;

    // Quality trend over time
    const qualityTrend = await prisma.$queryRaw<Array<{ date: string; avgQuality: number }>>`
      SELECT
        TO_CHAR("evaluatedAt", 'YYYY-MM-DD') as date,
        AVG(quality) as "avgQuality"
      FROM "ContentQuality"
      WHERE "contentPieceId" IN (
        SELECT id FROM "ContentPiece" WHERE "projectId" IN (
          SELECT id FROM "Project" WHERE "workspaceId" = ${ws.workspaceId}
        )
      )
      AND "evaluatedAt" >= ${startDate}
      GROUP BY TO_CHAR("evaluatedAt", 'YYYY-MM-DD')
      ORDER BY date ASC
    `;

    // Format status distribution
    const statusDistribution = contentByStatus.reduce((acc, item) => {
      acc[item.status] = item._count;
      return acc;
    }, {} as Record<string, number>);

    // Format platform distribution
    const platformDistribution = contentByPlatform.reduce((acc, item) => {
      acc[item.platform] = item._count;
      return acc;
    }, {} as Record<string, number>);

    // Calculate publish success rate
    const publishSuccessCount = publishStats.find((s) => s.status === "success")?._count || 0;
    const publishFailedCount = publishStats.find((s) => s.status === "failed")?._count || 0;
    const publishTotal = publishSuccessCount + publishFailedCount;
    const publishSuccessRate = publishTotal > 0 ? (publishSuccessCount / publishTotal) * 100 : 0;

    // Calculate scheduled vs published
    const scheduledCount = scheduleStats.find((s) => s.status === "scheduled")?._count || 0;
    const publishedCount = scheduleStats.find((s) => s.status === "published")?._count || 0;

    // Sort top projects by content count in time range
    const topProjects = topProjectsRaw
      .map((project) => ({
        id: project.id,
        name: project.name,
        contentCount: project.contentPieces.length,
      }))
      .filter((p) => p.contentCount > 0)
      .sort((a, b) => b.contentCount - a.contentCount)
      .slice(0, 5);

    return NextResponse.json({
      summary: {
        totalContent,
        avgQualityScore: qualityScores._avg.quality || 0,
        avgEngagementScore: qualityScores._avg.engagement || 0,
        avgBrandVoiceScore: qualityScores._avg.brandVoice || 0,
        avgPlatformFitScore: qualityScores._avg.platformFit || 0,
        publishSuccessRate: Math.round(publishSuccessRate),
        scheduledCount,
        publishedCount,
      },
      distributions: {
        byStatus: statusDistribution,
        byPlatform: platformDistribution,
      },
      trends: {
        contentOverTime: contentTrend.map((t) => ({
          date: t.date,
          count: Number(t.count),
        })),
        qualityOverTime: qualityTrend.map((t) => ({
          date: t.date,
          score: Number(t.avgQuality),
        })),
      },
      recentActivity: recentContent.map((content) => ({
        id: content.id,
        title: content.title,
        status: content.status,
        projectName: content.project.name,
        createdAt: content.createdAt,
      })),
      topProjects,
    });
  } catch (error) {
    console.error("Failed to fetch analytics:", error);
    return responses.serverError(
      apiError("api_error", ERROR_CODES.DATABASE_ERROR, "获取统计数据失败，请稍后重试")
    );
  }
}
