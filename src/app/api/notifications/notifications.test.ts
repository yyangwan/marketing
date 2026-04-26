import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "./route";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  prisma: {
    notification: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/config", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/auth/workspace", () => ({
  getCurrentWorkspace: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";

describe("/api/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET - List notifications", () => {
    it("should list unread notifications", async () => {
      const mockSession = { user: { id: "user1" } };
      const mockWs = { workspaceId: "ws1" };
      const mockNotifications = [
        { id: "n1", type: "content_review", title: "Review needed", isRead: false },
        { id: "n2", type: "schedule_reminder", title: "Content scheduled", isRead: false },
      ];

      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue(mockWs);
      (prisma.notification.findMany as any).mockResolvedValue(mockNotifications);

      const response = await GET(
        { url: "http://localhost:3000/api/notifications" } as Request
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual(mockNotifications);
      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user1",
          workspaceId: "ws1",
          isRead: false,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    });

    it("should list all notifications when includeRead is true", async () => {
      const mockSession = { user: { id: "user1" } };
      const mockWs = { workspaceId: "ws1" };
      const mockNotifications = [
        { id: "n1", type: "content_review", title: "Review needed", isRead: true },
        { id: "n2", type: "schedule_reminder", title: "Content scheduled", isRead: false },
      ];

      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue(mockWs);
      (prisma.notification.findMany as any).mockResolvedValue(mockNotifications);

      const response = await GET(
        { url: "http://localhost:3000/api/notifications?includeRead=true" } as Request
      );

      expect(response.status).toBe(200);
      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user1",
          workspaceId: "ws1",
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    });

    it("should respect custom limit", async () => {
      const mockSession = { user: { id: "user1" } };
      const mockWs = { workspaceId: "ws1" };
      const mockNotifications = [{ id: "n1", isRead: false }];

      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue(mockWs);
      (prisma.notification.findMany as any).mockResolvedValue(mockNotifications);

      const response = await GET(
        { url: "http://localhost:3000/api/notifications?limit=10" } as Request
      );

      expect(response.status).toBe(200);
      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user1",
          workspaceId: "ws1",
          isRead: false,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
    });

    it("should return 401 for unauthorized requests", async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const response = await GET(
        { url: "http://localhost:3000/api/notifications" } as Request
      );

      expect(response.status).toBe(401);
    });

    it("should return 403 when workspace is not found", async () => {
      const mockSession = { user: { id: "user1" } };
      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue(null);

      const response = await GET(
        { url: "http://localhost:3000/api/notifications" } as Request
      );

      expect(response.status).toBe(403);
    });

    it("should return 500 on database error", async () => {
      const mockSession = { user: { id: "user1" } };
      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1" });
      (prisma.notification.findMany as any).mockRejectedValue(new Error("DB error"));

      const response = await GET(
        { url: "http://localhost:3000/api/notifications" } as Request
      );

      expect(response.status).toBe(500);
    });
  });

  describe("POST - Create notification", () => {
    it("should create a valid notification", async () => {
      const mockSession = { user: { id: "user1" } };
      const mockWs = { workspaceId: "ws1" };
      const mockNotification = {
        id: "n1",
        type: "content_review",
        title: "Review needed",
        message: "Please review this content",
      };

      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue(mockWs);
      (prisma.notification.create as any).mockResolvedValue(mockNotification);

      const request = {
        json: async () => ({
          type: "content_review",
          title: "Review needed",
          message: "Please review this content",
        }),
      } as Request;

      const response = await POST(request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data).toEqual(mockNotification);
    });

    it("should create notification with link", async () => {
      const mockSession = { user: { id: "user1" } };
      const mockWs = { workspaceId: "ws1" };
      const mockNotification = {
        id: "n1",
        type: "content_approved",
        title: "Approved",
        message: "Content approved",
        link: "/content/c1",
      };

      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue(mockWs);
      (prisma.notification.create as any).mockResolvedValue(mockNotification);

      const request = {
        json: async () => ({
          type: "content_approved",
          title: "Approved",
          message: "Content approved",
          link: "/content/c1",
        }),
      } as Request;

      const response = await POST(request);

      expect(response.status).toBe(201);
    });

    it("should return 400 when type is missing", async () => {
      const mockSession = { user: { id: "user1" } };
      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1" });

      const request = {
        json: async () => ({
          title: "Test",
          message: "Test message",
        }),
      } as Request;

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("invalid_input");
    });

    it("should return 400 when title is missing", async () => {
      const mockSession = { user: { id: "user1" } };
      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1" });

      const request = {
        json: async () => ({
          type: "content_review",
          message: "Test message",
        }),
      } as Request;

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it("should return 400 when message is missing", async () => {
      const mockSession = { user: { id: "user1" } };
      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1" });

      const request = {
        json: async () => ({
          type: "content_review",
          title: "Test",
        }),
      } as Request;

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it("should return 400 for invalid type", async () => {
      const mockSession = { user: { id: "user1" } };
      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1" });

      const request = {
        json: async () => ({
          type: "invalid_type",
          title: "Test",
          message: "Test message",
        }),
      } as Request;

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("invalid_input");
      expect(data.message).toContain("Must be one of:");
    });

    it("should accept all valid notification types", async () => {
      const mockSession = { user: { id: "user1" } };
      const mockWs = { workspaceId: "ws1" };
      const mockNotification = { id: "n1" };

      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue(mockWs);
      (prisma.notification.create as any).mockResolvedValue(mockNotification);

      const validTypes = [
        "content_review",
        "content_approved",
        "content_published",
        "schedule_reminder",
        "mention",
      ];

      for (const type of validTypes) {
        const request = {
          json: async () => ({
            type,
            title: "Test",
            message: "Test message",
          }),
        } as Request;

        const response = await POST(request);
        expect(response.status).toBe(201);
      }
    });

    it("should return 401 for unauthorized requests", async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const request = {
        json: async () => ({
          type: "content_review",
          title: "Test",
          message: "Test message",
        }),
      } as Request;

      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it("should return 403 when workspace is not found", async () => {
      const mockSession = { user: { id: "user1" } };
      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue(null);

      const request = {
        json: async () => ({
          type: "content_review",
          title: "Test",
          message: "Test message",
        }),
      } as Request;

      const response = await POST(request);

      expect(response.status).toBe(403);
    });

    it("should return 500 on database error", async () => {
      const mockSession = { user: { id: "user1" } };
      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1" });
      (prisma.notification.create as any).mockRejectedValue(new Error("DB error"));

      const request = {
        json: async () => ({
          type: "content_review",
          title: "Test",
          message: "Test message",
        }),
      } as Request;

      const response = await POST(request);

      expect(response.status).toBe(500);
    });
  });
});
