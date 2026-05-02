import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { ERROR_CODES, apiError, errors, responses } from "@/lib/errors";

// POST /api/notifications/[id]/read - Mark notification as read
export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return responses.unauthorized();
  }

  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return responses.forbidden(errors.noWorkspace());
  }

  const { id } = await context.params;

  const notification = await prisma.notification.findFirst({
    where: {
      id,
      userId: session.user.id,
      workspaceId: ws.workspaceId,
    },
  });

  if (!notification) {
    return responses.notFound(
      apiError("not_found_error", "notification_not_found", "Notification not found", {
        param: "id",
      })
    );
  }

  try {
    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to mark notification as read:", error);
    return responses.serverError(
      apiError(
        "api_error",
        ERROR_CODES.DATABASE_ERROR,
        "Failed to mark notification as read"
      )
    );
  }
}
