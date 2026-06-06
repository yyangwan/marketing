import { NextRequest, NextResponse } from "next/server";
import { getServiceSession } from "@/lib/auth/service-auth";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { getServiceWorkspace } from "@/lib/auth/service-context";
import { prisma } from "@/lib/db";
import { ERROR_CODES, apiError, errors, responses } from "@/lib/errors";

const DEFAULT_PLATFORM = "wechat";
const VALID_PLATFORMS = new Set(["wechat", "weibo", "xiaohongshu", "douyin"]);

function normalizePlatforms(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const platforms = raw.filter(
    (item): item is string => typeof item === "string" && VALID_PLATFORMS.has(item)
  );
  return platforms.length > 0 ? [...new Set(platforms)] : [DEFAULT_PLATFORM];
}

// GET /api/content?workspaceId=xxx&status=draft&unscheduled=true
export async function GET(req: NextRequest) {
  try {
    const session = await getServiceSession();
    if (!session?.user?.id) {
      return responses.unauthorized();
    }

    const ws = (await getServiceWorkspace()) ?? getCurrentWorkspace(session);
    if (!ws) {
      return responses.forbidden(errors.noWorkspace());
    }

    const { searchParams } = req.nextUrl;
    const requestedWorkspaceId = searchParams.get("workspaceId");
    const status = searchParams.get("status");
    const unscheduled = searchParams.get("unscheduled") === "true";

    if (requestedWorkspaceId && requestedWorkspaceId !== ws.workspaceId) {
      return responses.forbidden(errors.workspaceMismatch());
    }

    const where = {
      workspaceId: ws.workspaceId,
      ...(status ? { status } : {}),
      ...(unscheduled ? { schedules: { none: {} } } : {}),
    };

    const contentPieces = await prisma.contentPiece.findMany({
      where,
      include: {
        platformContents: {
          select: { platform: true },
          take: 1,
        },
        ...(!unscheduled
          ? {
              schedules: {
                orderBy: { scheduledAt: "desc" as const },
                take: 1,
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    const items = contentPieces.map((piece) => ({
      id: piece.id,
      title: piece.title,
      type: piece.type,
      platform: piece.platformContents[0]?.platform || "generic",
      status: piece.status,
      createdAt: piece.createdAt.toISOString(),
    }));

    return NextResponse.json(items);
  } catch (error) {
    console.error("Error fetching content:", error);
    return responses.serverError(
      apiError(
        "api_error",
        ERROR_CODES.DATABASE_ERROR,
        "Failed to fetch content"
      )
    );
  }
}

// POST /api/content - Create a content draft for the current service project.
export async function POST(req: NextRequest) {
  try {
    const session = await getServiceSession();
    if (!session?.user?.id) {
      return responses.unauthorized();
    }

    const ws = (await getServiceWorkspace()) ?? getCurrentWorkspace(session);
    if (!ws) {
      return responses.forbidden(errors.noWorkspace());
    }

    const body = await req.json();
    const requestedWorkspaceId = typeof body.workspaceId === "string" ? body.workspaceId : null;
    const requestedProjectId = typeof body.projectId === "string" ? body.projectId : null;
    const projectId = requestedProjectId || ws.projectId;

    if (requestedWorkspaceId && requestedWorkspaceId !== ws.workspaceId) {
      return responses.forbidden(errors.workspaceMismatch());
    }

    if (!projectId) {
      return responses.badRequest(errors.missingParam("projectId"));
    }

    if (requestedProjectId && ws.projectId && requestedProjectId !== ws.projectId) {
      return responses.forbidden(errors.workspaceMismatch());
    }

    const topic =
      typeof body.topic === "string" && body.topic.trim().length > 0
        ? body.topic.trim()
        : typeof body.title === "string" && body.title.trim().length > 0
          ? body.title.trim()
          : "Untitled content";
    const title =
      typeof body.title === "string" && body.title.trim().length > 0
        ? body.title.trim()
        : topic.slice(0, 80);
    const platforms = normalizePlatforms(body.platforms ?? body.platform);

    const brief = {
      topic,
      keyPoints: Array.isArray(body.keyPoints)
        ? body.keyPoints.filter(
            (item: unknown): item is string => typeof item === "string" && item.trim().length > 0
          )
        : [],
      platforms,
      references: typeof body.references === "string" ? body.references : "",
      notes: typeof body.notes === "string" ? body.notes : "",
      templateId: typeof body.templateId === "string" ? body.templateId : undefined,
      brandVoiceId: typeof body.brandVoiceId === "string" ? body.brandVoiceId : undefined,
    };

    const piece = await prisma.contentPiece.create({
      data: {
        workspaceId: ws.workspaceId,
        projectId,
        brandId: ws.brandId,
        createdByUserId: session.user.id,
        title,
        type: typeof body.type === "string" ? body.type : "blog_post",
        brief: JSON.stringify(brief),
        brandVoiceId: typeof body.brandVoiceId === "string" ? body.brandVoiceId : undefined,
        status: "draft",
        platformContents: {
          create: platforms.map((platform) => ({ platform, status: "draft" })),
        },
      },
      include: { platformContents: true },
    });

    return NextResponse.json(piece, { status: 201 });
  } catch (error) {
    console.error("Error creating content:", error);
    return responses.serverError(
      apiError(
        "api_error",
        ERROR_CODES.DATABASE_ERROR,
        "Failed to create content"
      )
    );
  }
}

