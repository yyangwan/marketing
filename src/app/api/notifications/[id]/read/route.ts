import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServiceSession } from "@/lib/auth/service-auth";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { getServiceWorkspace } from "@/lib/auth/service-context";
import { ERROR_CODES, apiError, errors, responses } from "@/lib/errors";

// POST /api/notifications/[id]/read - Mark notification as read
export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServiceSession();
  if (!session?.user?.id) {
    return responses.unauthorized();
  }

  const ws = (await headers()).get("x-genilink-project-id") ? await getServiceWorkspace() : getCurrentWorkspace(session);
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
