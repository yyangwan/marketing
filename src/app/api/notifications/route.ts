import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { ERROR_CODES, apiError, errors, responses } from "@/lib/errors";

const VALID_NOTIFICATION_TYPES = [
  "content_review",
  "content_approved",
  "content_published",
  "schedule_reminder",
  "mention",
] as const;

// GET /api/notifications - List user's notifications
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return responses.unauthorized();
  }

  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return responses.forbidden(errors.noWorkspace());
  }

  const url = new URL(req.url);
  const requestedWorkspaceId = url.searchParams.get("workspaceId");
  const rawLimit = Number.parseInt(url.searchParams.get("limit") || "50", 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 50;
  const includeRead = url.searchParams.get("includeRead") === "true";

  if (requestedWorkspaceId && requestedWorkspaceId !== ws.workspaceId) {
    return responses.forbidden(errors.workspaceMismatch());
  }

  try {
    const notifications = await prisma.notification.findMany({
      where: {
        userId: session.user.id,
        workspaceId: ws.workspaceId,
        ...(!includeRead ? { isRead: false } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json(notifications);
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    return responses.serverError(
      apiError(
        "api_error",
        ERROR_CODES.DATABASE_ERROR,
        "Failed to fetch notifications"
      )
    );
  }
}

// POST /api/notifications - Create a notification (for testing or triggers)
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return responses.unauthorized();
  }

  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return responses.forbidden(errors.noWorkspace());
  }

  const body = await req.json();
  const { type, title, message, link } = body;

  if (!type) {
    return responses.badRequest(errors.missingParam("type"));
  }
  if (!title) {
    return responses.badRequest(errors.missingParam("title"));
  }
  if (!message) {
    return responses.badRequest(errors.missingParam("message"));
  }
  if (!VALID_NOTIFICATION_TYPES.includes(type)) {
    return responses.badRequest(
      errors.invalidParam(
        "type",
        `Invalid type. Must be one of: ${VALID_NOTIFICATION_TYPES.join(", ")}`
      )
    );
  }

  try {
    const notification = await prisma.notification.create({
      data: {
        userId: session.user.id,
        workspaceId: ws.workspaceId,
        type,
        title,
        message,
        link,
      },
    });

    return NextResponse.json(notification, { status: 201 });
  } catch (error) {
    console.error("Failed to create notification:", error);
    return responses.serverError(
      apiError(
        "api_error",
        ERROR_CODES.DATABASE_ERROR,
        "Failed to create notification"
      )
    );
  }
}
