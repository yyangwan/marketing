import { prisma } from "@/lib/db";

type NotificationType =
  | "content_review"
  | "content_approved"
  | "content_published"
  | "schedule_reminder"
  | "mention";

/**
 * Create a notification for a user
 */
export async function createNotification(params: {
  userId: string;
  workspaceId: string;
  type: NotificationType;
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

function getNotificationPayload(newStatus: string, contentTitle: string) {
  switch (newStatus) {
    case "review":
    case "in_review":
      return {
        type: "content_review" as const,
        title: "Content ready for review",
        message: `"${contentTitle}" is ready for review`,
      };
    case "approved":
      return {
        type: "content_approved" as const,
        title: "Content approved",
        message: `"${contentTitle}" has been approved`,
      };
    case "scheduled":
      return {
        type: "schedule_reminder" as const,
        title: "Content scheduled",
        message: `"${contentTitle}" has been scheduled for publishing`,
      };
    case "published":
      return {
        type: "content_published" as const,
        title: "Content published",
        message: `"${contentTitle}" has been published successfully`,
      };
    default:
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
  const contentPiece = await prisma.contentPiece.findUnique({
    where: { id: contentPieceId },
    include: { project: true },
  });

  if (!contentPiece) {
    return;
  }

  const payload = getNotificationPayload(newStatus, contentPiece.title);
  if (!payload) {
    return;
  }

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    select: { userId: true },
  });

  for (const member of members) {
    await createNotification({
      userId: member.userId,
      workspaceId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
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
