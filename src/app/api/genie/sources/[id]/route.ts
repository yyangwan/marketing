/**
 * Genie Source Detail API
 * Phase 1E: Individual source operations
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { prisma } from "@/lib/db";
import { fetchURL, analyzeContent } from "@/lib/genie";
import { apiError, errors, responses } from "@/lib/errors";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function findWorkspaceSource(id: string, workspaceId: string) {
  return prisma.genieSource.findFirst({
    where: { id, workspaceId },
  });
}

function sourceNotFoundError() {
  return apiError("not_found_error", "source_not_found", "Source not found");
}

/**
 * GET /api/genie/sources/[id] - Get a single source
 */
export async function GET(request: NextRequest, routeContext: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return responses.unauthorized();
    }

    const ws = getCurrentWorkspace(session);
    if (!ws) {
      return responses.forbidden(errors.noWorkspace());
    }

    const { id } = await routeContext.params;

    const source = await findWorkspaceSource(id, ws.workspaceId);

    if (!source) {
      return responses.notFound(sourceNotFoundError());
    }

    // Parse JSON fields
    const parsedSource = {
      ...source,
      keyProducts: source.keyProducts ? JSON.parse(source.keyProducts) : [],
      recurringTopics: source.recurringTopics
        ? JSON.parse(source.recurringTopics)
        : [],
    };

    return NextResponse.json({ source: parsedSource });
  } catch (e) {
    console.error("Failed to fetch Genie source:", e);
    return NextResponse.json(
      { error: "Failed to fetch source" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/genie/sources/[id] - Update a source
 */
export async function PUT(request: NextRequest, routeContext: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return responses.unauthorized();
    }

    const ws = getCurrentWorkspace(session);
    if (!ws) {
      return responses.forbidden(errors.noWorkspace());
    }

    const { id } = await routeContext.params;
    const body = await request.json();
    const { enabled } = body;

    const source = await findWorkspaceSource(id, ws.workspaceId);
    if (!source) {
      return responses.notFound(sourceNotFoundError());
    }

    const updatedSource = await prisma.genieSource.update({
      where: { id },
      data: {
        ...(enabled !== undefined && { enabled }),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ source: updatedSource });
  } catch (e) {
    console.error("Failed to update Genie source:", e);

    if ((e as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to update source" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/genie/sources/[id] - Delete a source
 */
export async function DELETE(request: NextRequest, routeContext: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return responses.unauthorized();
    }

    const ws = getCurrentWorkspace(session);
    if (!ws) {
      return responses.forbidden(errors.noWorkspace());
    }

    const { id } = await routeContext.params;

    const source = await findWorkspaceSource(id, ws.workspaceId);
    if (!source) {
      return responses.notFound(sourceNotFoundError());
    }

    await prisma.genieSource.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Failed to delete Genie source:", e);

    if ((e as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to delete source" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/genie/sources/[id]/analyze - Re-analyze a source
 */
export async function POST(
  request: NextRequest,
  routeContext: RouteContext
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return responses.unauthorized();
    }

    const ws = getCurrentWorkspace(session);
    if (!ws) {
      return responses.forbidden(errors.noWorkspace());
    }

    const { id } = await routeContext.params;

    const source = await findWorkspaceSource(id, ws.workspaceId);

    if (!source) {
      return responses.notFound(sourceNotFoundError());
    }

    // Re-fetch and analyze
    const content = await fetchURL(source.url);
    const analysis = await analyzeContent(content);

    // Update source with new analysis
    const updated = await prisma.genieSource.update({
      where: { id },
      data: {
        businessType: analysis.insights.businessType,
        keyProducts: JSON.stringify(analysis.insights.keyProducts),
        brandTone: analysis.insights.brandTone,
        targetAudience: analysis.insights.targetAudience,
        recurringTopics: JSON.stringify(analysis.insights.recurringTopics),
        lastAnalyzedAt: analysis.analyzedAt,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      source: updated,
      analysis: {
        confidence: analysis.confidence,
        insights: analysis.insights,
      },
    });
  } catch (e) {
    console.error("Failed to re-analyze Genie source:", e);

    if ((e as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to re-analyze source" },
      { status: 500 }
    );
  }
}
