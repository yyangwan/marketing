import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServiceSession } from "@/lib/auth/service-auth";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { getServiceWorkspace } from "@/lib/auth/service-context";
import { ERROR_CODES, apiError, errors, responses } from "@/lib/errors";

// POST /api/notifications/mark-all-read - Mark all user notifications as read
export async function POST() {
  const session = await getServiceSession();
  if (!session?.user?.id) {
    return responses.unauthorized();
  }

  const ws = (await headers()).get("x-genilink-project-id") ? await getServiceWorkspace() : getCurrentWorkspace(session);
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
