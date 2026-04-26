import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";

// GET /api/notifications - List user's notifications
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  }

  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const includeRead = url.searchParams.get("includeRead") === "true";

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
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

// POST /api/notifications - Create a notification (for testing or triggers)
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  }

  const body = await req.json();
  const { type, title, message, link } = body;

  // Validate
  if (!type || !title || !message) {
    return NextResponse.json(
      { error: "invalid_input", message: "type, title, and message are required" },
      { status: 400 }
    );
  }

  const validTypes = [
    "content_review",
    "content_approved",
    "content_published",
    "schedule_reminder",
    "mention",
  ];

  if (!validTypes.includes(type)) {
    return NextResponse.json(
      {
        error: "invalid_input",
        message: `Invalid type. Must be one of: ${validTypes.join(", ")}`,
      },
      { status: 400 }
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
    return NextResponse.json(
      { error: "Failed to create notification" },
      { status: 500 }
    );
  }
}
