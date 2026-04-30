/**
 * Genie Cron Job
 * Phase 1E: Scheduled task for automatic content generation
 *
 * This endpoint is designed to be called by a cron service (Vercel Cron, etc.)
 * Set up cron schedule to run this endpoint weekly:
 * Example Vercel Cron: "0 9 * * 1" (Every Monday at 9 AM UTC)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/generated/prisma";
import {
  generateContentIdeasFromSources,
  ideasToContentPieces,
} from "@/lib/genie/generator";

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET || "";

export async function GET(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get("authorization");
  const urlToken = new URL(request.url).searchParams.get("secret");

  const isValidToken =
    authHeader === `Bearer ${CRON_SECRET}` || urlToken === CRON_SECRET;

  if (CRON_SECRET && !isValidToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const results = {
    totalWorkspaces: 0,
    activeWorkspaces: 0,
    ideasGenerated: 0,
    piecesCreated: 0,
    errors: [] as Array<{ workspaceId: string; error: string }>,
  };

  try {
    // Get all workspaces with enabled Genie sources
    const workspaces = await prisma.workspace.findMany({
      include: {
        genieSources: {
          where: {
            enabled: true,
            lastAnalyzedAt: { not: null },
          },
        },
        projects: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    results.totalWorkspaces = workspaces.length;

    // Process each workspace
    for (const workspace of workspaces) {
      // Skip if no Genie sources or no projects
      if (workspace.genieSources.length === 0 || workspace.projects.length === 0) {
        continue;
      }

      results.activeWorkspaces++;

      // Use the first project (or could be configured per workspace)
      const project = workspace.projects[0];

      try {
        // Prepare source data
        const sourceData = workspace.genieSources.map((source) => ({
          insights: {
            businessType: source.businessType || "",
            keyProducts: source.keyProducts
              ? JSON.parse(source.keyProducts)
              : [],
            brandTone: source.brandTone || "",
            targetAudience: source.targetAudience || "",
            recurringTopics: source.recurringTopics
              ? JSON.parse(source.recurringTopics)
              : [],
            contentThemes: source.recurringTopics
              ? JSON.parse(source.recurringTopics)
              : [],
            suggestedContentTypes: ["产品介绍", "使用教程", "用户故事"],
          },
          url: source.url,
        }));

        // Generate 3-5 ideas per workspace per week
        const result = await generateContentIdeasFromSources(sourceData, {
          count: Math.min(5, Math.max(3, workspace.genieSources.length)),
          platforms: ["wechat", "weibo", "xiaohongshu", "douyin"],
        });

        const contentPieces = ideasToContentPieces(result.ideas, project.id);

        // Create content pieces
        for (const piece of contentPieces) {
          await prisma.contentPiece.create({
            data: {
              projectId: piece.projectId,
              title: piece.title,
              brief: piece.brief,
              type: piece.type,
              status: "genie_draft",
            },
          });
        }

        results.ideasGenerated += result.ideas.length;
        results.piecesCreated += contentPieces.length;
      } catch (e) {
        console.error(`Failed to process workspace ${workspace.id}:`, e);
        results.errors.push({
          workspaceId: workspace.id,
          error: (e as Error).message,
        });
      }
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      results: {
        ...results,
        duration: `${duration}ms`,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Genie cron job failed:", e);
    return NextResponse.json(
      {
        success: false,
        error: (e as Error).message,
        results,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
