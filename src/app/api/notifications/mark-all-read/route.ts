import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";

// POST /api/notifications/mark-all-read - Mark all user notifications as read
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return NextResponse.json({ error: "no_workspace" }, { status: 403 });
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
    return NextResponse.json(
      { error: "Failed to mark all notifications as read" },
      { status: 500 }
    );
  }
}
