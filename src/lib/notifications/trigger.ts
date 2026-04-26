import { prisma } from "@/lib/db";

/**
 * Create a notification for a user
 */
export async function createNotification(params: {
  userId: string;
  workspaceId: string;
  type: "content_review" | "content_approved" | "content_published" | "schedule_reminder" | "mention";
  title: string;
  message: string;
  link?: string;
}) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: params.userId,
        workspaceId: params.workspaceId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link,
      },
    });
    return notification;
  } catch (error) {
    console.error("Failed to create notification:", error);
    return null;
  }
}

/**
 * Notify users when content status changes
 */
export async function notifyContentStatus(
  contentPieceId: string,
  newStatus: string,
  workspaceId: string
) {
  // Get content piece details
  const contentPiece = await prisma.contentPiece.findUnique({
    where: { id: contentPieceId },
    include: { project: true },
  });

  if (!contentPiece) return;

  // Get workspace members to notify
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: true },
  });

  let title = "";
  let message = "";
  let type = "";

  switch (newStatus) {
    case "review":
      title = "Content ready for review";
      message = `"${contentPiece.title}" is ready for review`;
      type = "content_review";
      break;
    case "approved":
      title = "Content approved";
      message = `"${contentPiece.title}" has been approved`;
      type = "content_approved";
      break;
    case "scheduled":
      title = "Content scheduled";
      message = `"${contentPiece.title}" has been scheduled for publishing`;
      type = "schedule_reminder";
      break;
    case "published":
      title = "Content published";
      message = `"${contentPiece.title}" has been published successfully`;
      type = "content_published";
      break;
    default:
      return;
  }

  // Create notifications for all project members
  for (const member of members) {
    await createNotification({
      userId: member.userId,
      workspaceId,
      type: type as any,
      title,
      message,
      link: `/content/${contentPieceId}`,
    });
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string, workspaceId: string) {
  try {
    await prisma.notification.updateMany({
      where: {
        userId,
        workspaceId,
        isRead: false,
      },
      data: { isRead: true },
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to mark all as read:", error);
    return { success: false };
  }
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string, workspaceId: string) {
  try {
    const count = await prisma.notification.count({
      where: {
        userId,
        workspaceId,
        isRead: false,
      },
    });
    return count;
  } catch (error) {
    console.error("Failed to get unread count:", error);
    return 0;
  }
}
