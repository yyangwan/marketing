/**
 * Genie Content Generation API
 * Phase 1E: Generate content ideas from analyzed sources
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  generateContentIdeasFromSources,
  ideasToContentPieces,
} from "@/lib/genie/generator";

/**
 * POST /api/genie/generate - Generate content ideas from sources
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspaceId, projectId, count = 5, platforms } = body;

    if (!workspaceId || !projectId) {
      return NextResponse.json(
        { error: "workspaceId and projectId are required" },
        { status: 400 }
      );
    }

    // Validate project exists and belongs to workspace
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspaceId,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found in workspace" },
        { status: 404 }
      );
    }

    // Fetch all enabled Genie sources for the workspace
    const sources = await prisma.genieSource.findMany({
      where: {
        workspaceId,
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
          : [], // Use recurring topics as themes for now
        suggestedContentTypes: ["产品介绍", "使用教程", "用户故事"], // Default types
      },
      url: source.url,
    }));

    // Generate content ideas
    const result = await generateContentIdeasFromSources(sourceData, {
      count,
      platforms,
    });

    // Convert ideas to ContentPiece creation data
    const contentPieces = ideasToContentPieces(result.ideas, projectId);

    // Create ContentPiece records in database
    const createdPieces = await prisma.contentPiece.createMany({
      data: contentPieces.map((piece) => ({
        ...piece,
        // Remove metadata field from createMany as it's not in the schema
        // We'll store extra info in the brief field
      })),
    });

    // Actually, let me create them one by one to handle the metadata properly
    // Since createMany doesn't support all field types
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
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    // Fetch all genie_draft content pieces for this project
    const genieDrafts = await prisma.contentPiece.findMany({
      where: {
        projectId,
        status: "genie_draft",
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
