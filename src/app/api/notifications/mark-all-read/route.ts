import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { ERROR_CODES, apiError, errors, responses } from "@/lib/errors";

// POST /api/notifications/mark-all-read - Mark all user notifications as read
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return responses.unauthorized();
  }

  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return responses.forbidden(errors.noWorkspace());
  }

  try {
    const result = await prisma.notification.updateMany({
      where: {
        userId: session.user.id,
        workspaceId: ws.workspaceId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return NextResponse.json({ count: result.count });
  } catch (error) {
    console.error("Failed to mark all notifications as read:", error);
    return responses.serverError(
      apiError(
        "api_error",
        ERROR_CODES.DATABASE_ERROR,
        "Failed to mark all notifications as read"
      )
    );
  }
}
