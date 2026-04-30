/**
 * Genie Sources API
 * Phase 1E: Manage URL sources for auto-content generation
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/generated/prisma";
import { fetchURL, isContentSubstantial } from "@/lib/genie/url-fetcher";
import { analyzeContent } from "@/lib/genie/analyzer";

/**
 * GET /api/genie/sources - List all Genie sources for a workspace
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    const sources = await prisma.genieSource.findMany({
      where: {
        workspaceId,
        enabled: true,
      },
      orderBy: {
        lastAnalyzedAt: "desc",
      },
    });

    return NextResponse.json({ sources });
  } catch (e) {
    console.error("Failed to fetch Genie sources:", e);
    return NextResponse.json(
      { error: "Failed to fetch sources" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/genie/sources - Add a new URL source
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspaceId, url } = body;

    if (!workspaceId || !url) {
      return NextResponse.json(
        { error: "workspaceId and url are required" },
        { status: 400 }
      );
    }

    // Validate workspace exists
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // Check if URL already exists
    const existing = await prisma.genieSource.findUnique({
      where: { url },
    });

    if (existing) {
      return NextResponse.json(
        { error: "URL already exists as a source" },
        { status: 409 }
      );
    }

    // Fetch and validate content
    const content = await fetchURL(url);

    if (!isContentSubstantial(content)) {
      return NextResponse.json(
        { error: "URL content is not substantial enough for analysis" },
        { status: 400 }
      );
    }

    // Analyze content to extract insights
    const analysis = await analyzeContent(content);

    // Create Genie source with extracted insights
    const source = await prisma.genieSource.create({
      data: {
        workspaceId,
        url,
        businessType: analysis.insights.businessType,
        keyProducts: JSON.stringify(analysis.insights.keyProducts),
        brandTone: analysis.insights.brandTone,
        targetAudience: analysis.insights.targetAudience,
        recurringTopics: JSON.stringify(analysis.insights.recurringTopics),
        lastAnalyzedAt: analysis.analyzedAt,
        enabled: true,
      },
    });

    return NextResponse.json({
      source,
      analysis: {
        confidence: analysis.confidence,
        insights: analysis.insights,
      },
    });
  } catch (e) {
    console.error("Failed to create Genie source:", e);

    // Handle specific errors
    if (e instanceof Error) {
      if (e.message.includes("Invalid URL")) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      if (e.message.includes("Failed to fetch")) {
        return NextResponse.json(
          { error: "Failed to fetch URL content" },
          { status: 502 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to create source" },
      { status: 500 }
    );
  }
}
