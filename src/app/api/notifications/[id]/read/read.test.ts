import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  prisma: {
    notification: {
      findFirst: vi.fn(),
      update: vi.fn(),
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

describe("/api/notifications/[id]/read", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST - Mark notification as read", () => {
    it("should mark notification as read", async () => {
      const mockSession = { user: { id: "user1" } };
      const mockWs = { workspaceId: "ws1" };
      const mockNotification = {
        id: "n1",
        userId: "user1",
        workspaceId: "ws1",
        isRead: false,
      };
      const updatedNotification = {
        id: "n1",
        userId: "user1",
        workspaceId: "ws1",
        isRead: true,
      };

      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue(mockWs);
      (prisma.notification.findFirst as any).mockResolvedValue(mockNotification);
      (prisma.notification.update as any).mockResolvedValue(updatedNotification);

      const response = await POST(
        {} as Request,
        { params: Promise.resolve({ id: "n1" }) }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.isRead).toBe(true);
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: "n1" },
        data: { isRead: true },
      });
    });

    it("should return 401 for unauthorized requests", async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const response = await POST(
        {} as Request,
        { params: Promise.resolve({ id: "n1" }) }
      );

      expect(response.status).toBe(401);
    });

    it("should return 403 when workspace is not found", async () => {
      const mockSession = { user: { id: "user1" } };
      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue(null);

      const response = await POST(
        {} as Request,
        { params: Promise.resolve({ id: "n1" }) }
      );

      expect(response.status).toBe(403);
    });

    it("should return 404 when notification not found", async () => {
      const mockSession = { user: { id: "user1" } };
      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1" });
      (prisma.notification.findFirst as any).mockResolvedValue(null);

      const response = await POST(
        {} as Request,
        { params: Promise.resolve({ id: "n1" }) }
      );

      expect(response.status).toBe(404);
    });

    it("should return 404 when notification belongs to different user", async () => {
      const mockSession = { user: { id: "user1" } };
      const mockWs = { workspaceId: "ws1" };

      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue(mockWs);
      (prisma.notification.findFirst as any).mockResolvedValue(null);

      const response = await POST(
        {} as Request,
        { params: Promise.resolve({ id: "n1" }) }
      );

      expect(response.status).toBe(404);
    });

    it("should return 500 on database error", async () => {
      const mockSession = { user: { id: "user1" } };
      const mockWs = { workspaceId: "ws1" };
      const mockNotification = {
        id: "n1",
        userId: "user1",
        workspaceId: "ws1",
        isRead: false,
      };

      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue(mockWs);
      (prisma.notification.findFirst as any).mockResolvedValue(mockNotification);
      (prisma.notification.update as any).mockRejectedValue(new Error("DB error"));

      const response = await POST(
        {} as Request,
        { params: Promise.resolve({ id: "n1" }) }
      );

      expect(response.status).toBe(500);
    });
  });
});
