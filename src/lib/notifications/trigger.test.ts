import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createNotification,
  notifyContentStatus,
  markAllAsRead,
  getUnreadCount,
} from "./trigger";

// Mock prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    notification: {
      create: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    contentPiece: {
      findUnique: vi.fn(),
    },
    workspaceMember: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";

describe("Notification Trigger Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createNotification", () => {
    it("should create a notification successfully", async () => {
      const mockNotification = {
        id: "n1",
        type: "content_review",
        title: "Test",
        message: "Test message",
      };

      (prisma.notification.create as any).mockResolvedValue(mockNotification);

      const result = await createNotification({
        userId: "user1",
        workspaceId: "ws1",
        type: "content_review",
        title: "Test",
        message: "Test message",
      });

      expect(result).toEqual(mockNotification);
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: "user1",
          workspaceId: "ws1",
          type: "content_review",
          title: "Test",
          message: "Test message",
          link: undefined,
        },
      });
    });

    it("should create notification with link", async () => {
      const mockNotification = { id: "n1" };

      (prisma.notification.create as any).mockResolvedValue(mockNotification);

      const result = await createNotification({
        userId: "user1",
        workspaceId: "ws1",
        type: "content_review",
        title: "Test",
        message: "Test message",
        link: "/content/c1",
      });

      expect(result).toEqual(mockNotification);
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          link: "/content/c1",
        }),
      });
    });

    it("should return null on database error", async () => {
      (prisma.notification.create as any).mockRejectedValue(new Error("DB error"));

      const result = await createNotification({
        userId: "user1",
        workspaceId: "ws1",
        type: "content_review",
        title: "Test",
        message: "Test message",
      });

      expect(result).toBeNull();
    });
  });

  describe("notifyContentStatus", () => {
    it("should notify members when content is ready for review", async () => {
      const mockContentPiece = {
        id: "c1",
        title: "Test Content",
        project: { id: "p1" },
      };
      const mockMembers = [
        { userId: "user1" },
        { userId: "user2" },
      ];

      (prisma.contentPiece.findUnique as any).mockResolvedValue(mockContentPiece);
      (prisma.workspaceMember.findMany as any).mockResolvedValue(mockMembers);
      (prisma.notification.create as any).mockResolvedValue({});

      await notifyContentStatus("c1", "review", "ws1");

      expect(prisma.notification.create).toHaveBeenCalledTimes(2);
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "content_review",
          title: "Content ready for review",
          message: `"Test Content" is ready for review`,
        }),
      });
    });

    it("should handle approved status", async () => {
      const mockContentPiece = {
        id: "c1",
        title: "Test Content",
        project: { id: "p1" },
      };
      const mockMembers = [{ userId: "user1" }];

      (prisma.contentPiece.findUnique as any).mockResolvedValue(mockContentPiece);
      (prisma.workspaceMember.findMany as any).mockResolvedValue(mockMembers);
      (prisma.notification.create as any).mockResolvedValue({});

      await notifyContentStatus("c1", "approved", "ws1");

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "content_approved",
          title: "Content approved",
        }),
      });
    });

    it("should handle scheduled status", async () => {
      const mockContentPiece = {
        id: "c1",
        title: "Test Content",
        project: { id: "p1" },
      };
      const mockMembers = [{ userId: "user1" }];

      (prisma.contentPiece.findUnique as any).mockResolvedValue(mockContentPiece);
      (prisma.workspaceMember.findMany as any).mockResolvedValue(mockMembers);
      (prisma.notification.create as any).mockResolvedValue({});

      await notifyContentStatus("c1", "scheduled", "ws1");

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "schedule_reminder",
          title: "Content scheduled",
        }),
      });
    });

    it("should handle published status", async () => {
      const mockContentPiece = {
        id: "c1",
        title: "Test Content",
        project: { id: "p1" },
      };
      const mockMembers = [{ userId: "user1" }];

      (prisma.contentPiece.findUnique as any).mockResolvedValue(mockContentPiece);
      (prisma.workspaceMember.findMany as any).mockResolvedValue(mockMembers);
      (prisma.notification.create as any).mockResolvedValue({});

      await notifyContentStatus("c1", "published", "ws1");

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "content_published",
          title: "Content published",
        }),
      });
    });

    it("should not create notifications for unsupported status", async () => {
      const mockContentPiece = {
        id: "c1",
        title: "Test Content",
        project: { id: "p1" },
      };

      (prisma.contentPiece.findUnique as any).mockResolvedValue(mockContentPiece);

      await notifyContentStatus("c1", "draft", "ws1");

      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it("should handle missing content piece gracefully", async () => {
      (prisma.contentPiece.findUnique as any).mockResolvedValue(null);

      const result = await notifyContentStatus("c1", "review", "ws1");

      expect(result).toBeUndefined();
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });
  });

  describe("markAllAsRead", () => {
    it("should mark all notifications as read", async () => {
      (prisma.notification.updateMany as any).mockResolvedValue({ count: 5 });

      const result = await markAllAsRead("user1", "ws1");

      expect(result).toEqual({ success: true });
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          userId: "user1",
          workspaceId: "ws1",
          isRead: false,
        },
        data: { isRead: true },
      });
    });

    it("should return success: false on database error", async () => {
      (prisma.notification.updateMany as any).mockRejectedValue(new Error("DB error"));

      const result = await markAllAsRead("user1", "ws1");

      expect(result).toEqual({ success: false });
    });
  });

  describe("getUnreadCount", () => {
    it("should return unread notification count", async () => {
      (prisma.notification.count as any).mockResolvedValue(5);

      const result = await getUnreadCount("user1", "ws1");

      expect(result).toBe(5);
      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: {
          userId: "user1",
          workspaceId: "ws1",
          isRead: false,
        },
      });
    });

    it("should return 0 on database error", async () => {
      (prisma.notification.count as any).mockRejectedValue(new Error("DB error"));

      const result = await getUnreadCount("user1", "ws1");

      expect(result).toBe(0);
    });

    it("should return 0 when no unread notifications", async () => {
      (prisma.notification.count as any).mockResolvedValue(0);

      const result = await getUnreadCount("user1", "ws1");

      expect(result).toBe(0);
    });
  });
});
