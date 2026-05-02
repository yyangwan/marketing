import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  prisma: {
    notification: {
      updateMany: vi.fn(),
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

describe("/api/notifications/mark-all-read", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST - Mark all notifications as read", () => {
    it("should mark all unread notifications as read", async () => {
      const mockSession = { user: { id: "user1" } };
      const mockWs = { workspaceId: "ws1" };
      const mockResult = { count: 5 };

      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue(mockWs);
      (prisma.notification.updateMany as any).mockResolvedValue(mockResult);

      const response = await POST({} as Request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ count: 5 });
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          userId: "user1",
          workspaceId: "ws1",
          isRead: false,
        },
        data: { isRead: true },
      });
    });

    it("should return 401 for unauthorized requests", async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const response = await POST({} as Request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error.code).toBe("missing_session");
    });

    it("should return 403 when workspace is not found", async () => {
      const mockSession = { user: { id: "user1" } };
      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue(null);

      const response = await POST({} as Request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error.code).toBe("no_workspace");
    });

    it("should handle zero notifications gracefully", async () => {
      const mockSession = { user: { id: "user1" } };
      const mockWs = { workspaceId: "ws1" };
      const mockResult = { count: 0 };

      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue(mockWs);
      (prisma.notification.updateMany as any).mockResolvedValue(mockResult);

      const response = await POST({} as Request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ count: 0 });
    });

    it("should return 500 on database error", async () => {
      const mockSession = { user: { id: "user1" } };
      const mockWs = { workspaceId: "ws1" };

      vi.mocked(auth).mockResolvedValue(mockSession);
      vi.mocked(getCurrentWorkspace).mockReturnValue(mockWs);
      (prisma.notification.updateMany as any).mockRejectedValue(new Error("DB error"));

      const response = await POST({} as Request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error.code).toBe("database_error");
    });
  });
});
