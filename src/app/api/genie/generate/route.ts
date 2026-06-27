/**
 * Genie Content Generation API
 * Phase 1E: Generate content ideas from analyzed sources
 */

import { NextRequest, NextResponse } from "next/server";
import { getServiceSession } from "@/lib/auth/service-auth";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { getServiceWorkspace } from "@/lib/auth/service-context";
import { prisma } from "@/lib/db";
import {
  generateContentIdeasFromSources,
  ideasToContentPieces,
} from "@/lib/genie/generator";
import { errors, responses } from "@/lib/errors";
import type { GenerationContext } from "@/types";

function parseStringArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function firstValue(values: Array<string | null | undefined>): string | undefined {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

/**
 * POST /api/genie/generate - Generate content ideas from sources
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServiceSession();
    if (!session?.user?.id) {
      return responses.unauthorized();
    }

    const ws = (await getServiceWorkspace()) ?? getCurrentWorkspace(session);
    if (!ws) {
      return responses.forbidden(errors.noWorkspace());
    }

    const body = await request.json();
    const { workspaceId: requestedWorkspaceId, projectId: requestedProjectId, count = 5, platforms } = body;
    const projectId = requestedProjectId || ws.projectId;

    if (requestedWorkspaceId && requestedWorkspaceId !== ws.workspaceId) {
      return responses.forbidden(errors.workspaceMismatch());
    }

    if (!projectId) {
      return responses.badRequest(errors.missingParam("projectId"));
    }

    // Fetch all enabled Genie sources for the workspace
    const sources = await prisma.genieSource.findMany({
      where: {
        workspaceId: ws.workspaceId,
        enabled: true,
        lastAnalyzedAt: { not: null }, // Only use analyzed sources
      },
    });

    if (sources.length === 0) {
      return NextResponse.json(
        { error: "No analyzed sources found. Add and analyze sources first." },
        { status: 400 }
      );
    }

    // Prepare source data for generation
    const sourceData = sources.map((source) => ({
      insights: {
        businessType: source.businessType || "",
        keyProducts: parseStringArray(source.keyProducts),
        brandTone: source.brandTone || "",
        targetAudience: source.targetAudience || "",
        recurringTopics: parseStringArray(source.recurringTopics),
        contentThemes: parseStringArray(source.contentThemes).length > 0
          ? parseStringArray(source.contentThemes)
          : parseStringArray(source.recurringTopics),
        suggestedContentTypes: parseStringArray(source.suggestedContentTypes).length > 0
          ? parseStringArray(source.suggestedContentTypes)
          : ["产品介绍", "使用教程", "用户故事"],
      },
      url: source.url,
    }));

    const generationContext: GenerationContext = {
      project: {
        projectId,
        brandId: ws.brandId,
      },
      insights: {
        businessType: firstValue(sourceData.map((source) => source.insights.businessType)),
        keyProducts: unique(sourceData.flatMap((source) => source.insights.keyProducts)).slice(0, 8),
        brandTone: firstValue(sourceData.map((source) => source.insights.brandTone)),
        targetAudience: firstValue(sourceData.map((source) => source.insights.targetAudience)),
        recurringTopics: unique(sourceData.flatMap((source) => source.insights.recurringTopics)).slice(0, 8),
        contentThemes: unique(sourceData.flatMap((source) => source.insights.contentThemes)).slice(0, 8),
        suggestedContentTypes: unique(sourceData.flatMap((source) => source.insights.suggestedContentTypes)).slice(0, 8),
        sourceUrls: sources.map((source) => source.url),
      },
      boundaries: {
        forbiddenClaims: [
          "未在信息源或品牌资料中出现的产品功能",
          "未经验证的客户案例、数据、价格、认证或排名",
        ],
      },
    };

    // Generate content ideas
    const result = await generateContentIdeasFromSources(sourceData, {
      count,
      platforms,
    });

    // Convert ideas to ContentPiece creation data
    const contentPieces = ideasToContentPieces(result.ideas, projectId, generationContext);

    const brandVoice = ws.brandId
      ? await prisma.brandVoice.findFirst({
          where: { workspaceId: ws.workspaceId, brandId: ws.brandId },
          orderBy: { updatedAt: "desc" },
        })
      : null;

    // Create ContentPiece records in database
    for (const piece of contentPieces) {
      await prisma.contentPiece.create({
        data: {
          workspaceId: ws.workspaceId,
          projectId: piece.projectId,
          brandId: ws.brandId,
          createdByUserId: session.user.id,
          title: piece.title,
          brief: piece.brief,
          type: piece.type,
          status: "genie_draft",
          brandVoiceId: brandVoice?.id || null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      ideas: result.ideas.length,
      confidence: result.confidence,
      sourceCount: result.sourceCount,
      generatedAt: result.generatedAt,
    });
  } catch (e) {
    console.error("Failed to generate content ideas:", e);
    return NextResponse.json(
      { error: "Failed to generate content ideas" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/genie/generate - Get generation status/history
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServiceSession();
    if (!session?.user?.id) {
      return responses.unauthorized();
    }

    const ws = (await getServiceWorkspace()) ?? getCurrentWorkspace(session);
    if (!ws) {
      return responses.forbidden(errors.noWorkspace());
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return responses.badRequest(errors.missingParam("projectId"));
    }

    // Fetch all genie_draft content pieces for this project
    const genieDrafts = await prisma.contentPiece.findMany({
      where: {
        projectId,
        status: "genie_draft",
        workspaceId: ws.workspaceId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
    });

    return NextResponse.json({
      drafts: genieDrafts,
      count: genieDrafts.length,
    });
  } catch (e) {
    console.error("Failed to fetch generation history:", e);
    return NextResponse.json(
      { error: "Failed to fetch generation history" },
      { status: 500 }
    );
  }
}
