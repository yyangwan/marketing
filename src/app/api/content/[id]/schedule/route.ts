import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { notifyContentStatus } from "@/lib/notifications/trigger";
import { ERROR_CODES, apiError, errors, responses } from "@/lib/errors";

async function findWorkspaceContent(contentId: string, workspaceId: string) {
  return prisma.contentPiece.findFirst({
    where: {
      id: contentId,
      project: { workspaceId },
    },
    include: { schedules: true },
  });
}

// GET /api/content/[id]/schedule - Get schedule for a content piece
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return responses.unauthorized();
  }

  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return responses.forbidden(errors.noWorkspace());
  }

  const { id } = await context.params;
  const contentPiece = await findWorkspaceContent(id, ws.workspaceId);

  if (!contentPiece) {
    return responses.notFound(errors.contentNotFound(id));
  }

  return NextResponse.json(contentPiece.schedules[0] || null);
}

// POST /api/content/[id]/schedule - Create or update schedule
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return responses.unauthorized();
  }

  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return responses.forbidden(errors.noWorkspace());
  }

  const { id } = await context.params;
  const body = await req.json();
  const { scheduledAt } = body;

  if (!scheduledAt) {
    return responses.badRequest(errors.missingParam("scheduledAt"));
  }

  const scheduledDate = new Date(scheduledAt);
  if (Number.isNaN(scheduledDate.getTime())) {
    return responses.badRequest(
      errors.invalidParam("scheduledAt", "Invalid date format")
    );
  }

  const contentPiece = await findWorkspaceContent(id, ws.workspaceId);
  if (!contentPiece) {
    return responses.notFound(errors.contentNotFound(id));
  }

  try {
    const schedule = await prisma.contentSchedule.upsert({
      where: { contentId: id },
      create: {
        contentId: id,
        scheduledAt: scheduledDate,
        status: "scheduled",
      },
      update: {
        scheduledAt: scheduledDate,
        status: "scheduled",
      },
    });

    await prisma.contentPiece.update({
      where: { id },
      data: { status: "scheduled" },
    });

    await notifyContentStatus(id, "scheduled", ws.workspaceId);

    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    console.error("Failed to create schedule:", error);
    return responses.serverError(
      apiError("api_error", ERROR_CODES.DATABASE_ERROR, "Failed to create schedule")
    );
  }
}

// DELETE /api/content/[id]/schedule - Remove schedule
export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return responses.unauthorized();
  }

  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return responses.forbidden(errors.noWorkspace());
  }

  const { id } = await context.params;
  const contentPiece = await findWorkspaceContent(id, ws.workspaceId);

  if (!contentPiece) {
    return responses.notFound(errors.contentNotFound(id));
  }

  try {
    await prisma.contentSchedule.deleteMany({
      where: { contentId: id },
    });

    await prisma.contentPiece.update({
      where: { id },
      data: { status: "approved" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete schedule:", error);
    return responses.serverError(
      apiError("api_error", ERROR_CODES.DATABASE_ERROR, "Failed to delete schedule")
    );
  }
}
