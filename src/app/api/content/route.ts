import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { prisma } from "@/lib/db";
import { ERROR_CODES, apiError, errors, responses } from "@/lib/errors";

// GET /api/content?workspaceId=xxx&status=draft&unscheduled=true
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return responses.unauthorized();
    }

    const ws = getCurrentWorkspace(session);
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
      project: { workspaceId: ws.workspaceId },
      ...(status ? { status } : {}),
      ...(unscheduled ? { schedules: { none: {} } } : {}),
    };

    const contentPieces = await prisma.contentPiece.findMany({
      where,
      include: {
        project: {
          select: { name: true },
        },
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
