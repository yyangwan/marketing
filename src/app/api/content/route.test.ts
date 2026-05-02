import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/db", () => ({
  prisma: {
    contentPiece: {
      findMany: vi.fn(),
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

describe("/api/content", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET - Fetch content", () => {
    it("should return content for the current workspace", async () => {
      const mockContent = [
        {
          id: "c1",
          title: "Content 1",
          type: "post",
          platformContents: [{ platform: "wechat" }],
          status: "draft",
          createdAt: new Date("2025-01-01T10:00:00Z"),
          project: { name: "Project 1" },
        },
      ];

      vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1", role: "member" });
      (prisma.contentPiece.findMany as any).mockResolvedValue(mockContent);

      const response = await GET(
        { nextUrl: new URL("http://localhost:3000/api/content?workspaceId=ws1") } as any
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({
        id: "c1",
        title: "Content 1",
        platform: "wechat",
      });
      expect(prisma.contentPiece.findMany).toHaveBeenCalledWith({
        where: {
          project: { workspaceId: "ws1" },
        },
        include: {
          project: { select: { name: true } },
          platformContents: {
            select: { platform: true },
            take: 1,
          },
          schedules: {
            orderBy: { scheduledAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      });
    });

    it("should filter by unscheduled=true", async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1", role: "member" });
      (prisma.contentPiece.findMany as any).mockResolvedValue([]);

      const response = await GET(
        { nextUrl: new URL("http://localhost:3000/api/content?unscheduled=true") } as any
      );

      expect(response.status).toBe(200);
      expect(prisma.contentPiece.findMany).toHaveBeenCalledWith({
        where: {
          project: { workspaceId: "ws1" },
          schedules: { none: {} },
        },
        include: {
          project: { select: { name: true } },
          platformContents: {
            select: { platform: true },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      });
    });

    it("should filter by status", async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1", role: "member" });
      (prisma.contentPiece.findMany as any).mockResolvedValue([]);

      const response = await GET(
        { nextUrl: new URL("http://localhost:3000/api/content?status=published") } as any
      );

      expect(response.status).toBe(200);
      expect(prisma.contentPiece.findMany).toHaveBeenCalledWith({
        where: {
          project: { workspaceId: "ws1" },
          status: "published",
        },
        include: {
          project: { select: { name: true } },
          platformContents: {
            select: { platform: true },
            take: 1,
          },
          schedules: {
            orderBy: { scheduledAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      });
    });

    it("should fallback to 'generic' platform when platform contents are empty", async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1", role: "member" });
      (prisma.contentPiece.findMany as any).mockResolvedValue([
        {
          id: "c1",
          title: "Content No Platform",
          type: "post",
          platformContents: [],
          status: "draft",
          createdAt: new Date("2025-01-01T10:00:00Z"),
          project: { name: "Project 1" },
        },
      ]);

      const response = await GET(
        { nextUrl: new URL("http://localhost:3000/api/content") } as any
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data[0].platform).toBe("generic");
    });

    it("should return 401 for unauthorized requests", async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const response = await GET(
        { nextUrl: new URL("http://localhost:3000/api/content") } as any
      );

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error.code).toBe("missing_session");
    });

    it("should return 403 when workspace is missing", async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
      vi.mocked(getCurrentWorkspace).mockReturnValue(null);

      const response = await GET(
        { nextUrl: new URL("http://localhost:3000/api/content") } as any
      );

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error.code).toBe("no_workspace");
    });

    it("should reject mismatched workspace ids from the query string", async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1", role: "member" });

      const response = await GET(
        { nextUrl: new URL("http://localhost:3000/api/content?workspaceId=ws2") } as any
      );

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error.code).toBe("insufficient_permissions");
    });

    it("should return 500 on database error", async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
      vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws1", role: "member" });
      (prisma.contentPiece.findMany as any).mockRejectedValue(new Error("DB error"));

      const response = await GET(
        { nextUrl: new URL("http://localhost:3000/api/content") } as any
      );

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error.code).toBe("database_error");
    });
  });
});
