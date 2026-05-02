import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "./route";

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
      vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1", role: "member" });
      (prisma.notification.findMany as any).mockResolvedValue([
        { id: "n1", type: "content_review", title: "Review needed", isRead: false },
      ]);

      const response = await GET(
        { url: "http://localhost:3000/api/notifications" } as Request
      );

      expect(response.status).toBe(200);
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

    it("should include read notifications when requested", async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1", role: "member" });
      (prisma.notification.findMany as any).mockResolvedValue([]);

      const response = await GET(
        { url: "http://localhost:3000/api/notifications?includeRead=true&limit=10" } as Request
      );

      expect(response.status).toBe(200);
      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user1",
          workspaceId: "ws1",
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
    });

    it("should reject mismatched workspace ids", async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1", role: "member" });

      const response = await GET(
        { url: "http://localhost:3000/api/notifications?workspaceId=ws2" } as Request
      );

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error.code).toBe("insufficient_permissions");
    });

    it("should return 401 for unauthorized requests", async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const response = await GET(
        { url: "http://localhost:3000/api/notifications" } as Request
      );

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error.code).toBe("missing_session");
    });

    it("should return 500 on database error", async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1", role: "member" });
      (prisma.notification.findMany as any).mockRejectedValue(new Error("DB error"));

      const response = await GET(
        { url: "http://localhost:3000/api/notifications" } as Request
      );

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error.code).toBe("database_error");
    });
  });

  describe("POST - Create notification", () => {
    it("should create a valid notification", async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1", role: "member" });
      (prisma.notification.create as any).mockResolvedValue({
        id: "n1",
        type: "content_review",
        title: "Review needed",
        message: "Please review this content",
      });

      const request = {
        json: async () => ({
          type: "content_review",
          title: "Review needed",
          message: "Please review this content",
        }),
      } as Request;

      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: "user1",
          workspaceId: "ws1",
          type: "content_review",
          title: "Review needed",
          message: "Please review this content",
          link: undefined,
        },
      });
    });

    it("should return 400 for invalid notification types", async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1", role: "member" });

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
      expect(data.error.code).toBe("invalid_parameter");
    });

    it("should return 400 when required fields are missing", async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1", role: "member" });

      const request = {
        json: async () => ({
          title: "Test",
          message: "Test message",
        }),
      } as Request;

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.code).toBe("missing_parameter");
    });

    it("should return 500 on database error", async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1", role: "member" });
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
      const data = await response.json();
      expect(data.error.code).toBe("database_error");
    });
  });
});
