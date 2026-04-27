import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  prisma: {
    project: {
      findMany: vi.fn(),
    },
    contentPiece: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/config", () => ({
  auth: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";

describe("/api/content", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET - Fetch content", () => {
    it("should return content for workspace", async () => {
      const mockSession = { user: { id: "user1" } };
      const mockProjects = [{ id: "p1" }, { id: "p2" }];
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

      vi.mocked(auth).mockResolvedValue(mockSession);
      (prisma.project.findMany as any).mockResolvedValue(mockProjects);
      (prisma.contentPiece.findMany as any).mockResolvedValue(mockContent);

      const response = await GET(
        { url: "http://localhost:3000/api/content?workspaceId=ws1" } as Request
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe("c1");
      expect(data[0].title).toBe("Content 1");
      expect(data[0].platform).toBe("wechat");
    });

    it("should filter by unscheduled=true", async () => {
      const mockSession = { user: { id: "user1" } };
      const mockProjects = [{ id: "p1" }];
      const mockContent = [
        {
          id: "c1",
          title: "Unscheduled Content",
          type: "post",
          platformContents: [{ platform: "weibo" }],
          status: "draft",
          createdAt: new Date("2025-01-01T10:00:00Z"),
          project: { name: "Project 1" },
        },
      ];

      vi.mocked(auth).mockResolvedValue(mockSession);
      (prisma.project.findMany as any).mockResolvedValue(mockProjects);
      (prisma.contentPiece.findMany as any).mockResolvedValue(mockContent);

      const response = await GET(
        { url: "http://localhost:3000/api/content?workspaceId=ws1&unscheduled=true" } as Request
      );

      expect(response.status).toBe(200);
      expect(prisma.contentPiece.findMany).toHaveBeenCalledWith({
        where: {
          projectId: { in: ["p1"] },
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
      const mockSession = { user: { id: "user1" } };
      const mockProjects = [{ id: "p1" }];
      const mockContent = [
        {
          id: "c1",
          title: "Published Content",
          type: "post",
          platformContents: [{ platform: "xiaohongshu" }],
          status: "published",
          createdAt: new Date("2025-01-01T10:00:00Z"),
          project: { name: "Project 1" },
        },
      ];

      vi.mocked(auth).mockResolvedValue(mockSession);
      (prisma.project.findMany as any).mockResolvedValue(mockProjects);
      (prisma.contentPiece.findMany as any).mockResolvedValue(mockContent);

      const response = await GET(
        { url: "http://localhost:3000/api/content?workspaceId=ws1&status=published" } as Request
      );

      expect(response.status).toBe(200);
      expect(prisma.contentPiece.findMany).toHaveBeenCalledWith({
        where: {
          projectId: { in: ["p1"] },
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

    it("should fallback to 'generic' platform when platformContents is empty", async () => {
      const mockSession = { user: { id: "user1" } };
      const mockProjects = [{ id: "p1" }];
      const mockContent = [
        {
          id: "c1",
          title: "Content No Platform",
          type: "post",
          platformContents: [], // Empty array
          status: "draft",
          createdAt: new Date("2025-01-01T10:00:00Z"),
          project: { name: "Project 1" },
        },
      ];

      vi.mocked(auth).mockResolvedValue(mockSession);
      (prisma.project.findMany as any).mockResolvedValue(mockProjects);
      (prisma.contentPiece.findMany as any).mockResolvedValue(mockContent);

      const response = await GET(
        { url: "http://localhost:3000/api/content?workspaceId=ws1" } as Request
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data[0].platform).toBe("generic");
    });

    it("should return 401 for unauthorized requests", async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const response = await GET(
        { url: "http://localhost:3000/api/content?workspaceId=ws1" } as Request
      );

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized");
    });

    it("should return 400 when workspaceId is missing", async () => {
      const mockSession = { user: { id: "user1" } };
      vi.mocked(auth).mockResolvedValue(mockSession);

      const response = await GET(
        { url: "http://localhost:3000/api/content" } as Request
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("workspaceId is required");
    });

    it("should return 500 on database error", async () => {
      const mockSession = { user: { id: "user1" } };
      vi.mocked(auth).mockResolvedValue(mockSession);
      (prisma.project.findMany as any).mockRejectedValue(new Error("DB error"));

      const response = await GET(
        { url: "http://localhost:3000/api/content?workspaceId=ws1" } as Request
      );

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Failed to fetch content");
    });

    it("should include schedules when unscheduled is false", async () => {
      const mockSession = { user: { id: "user1" } };
      const mockProjects = [{ id: "p1" }];
      const mockContent = [
        {
          id: "c1",
          title: "Scheduled Content",
          type: "post",
          platformContents: [{ platform: "douyin" }],
          status: "scheduled",
          createdAt: new Date("2025-01-01T10:00:00Z"),
          project: { name: "Project 1" },
        },
      ];

      vi.mocked(auth).mockResolvedValue(mockSession);
      (prisma.project.findMany as any).mockResolvedValue(mockProjects);
      (prisma.contentPiece.findMany as any).mockResolvedValue(mockContent);

      const response = await GET(
        { url: "http://localhost:3000/api/content?workspaceId=ws1&unscheduled=false" } as Request
      );

      expect(response.status).toBe(200);
      expect(prisma.contentPiece.findMany).toHaveBeenCalledWith({
        where: {
          projectId: { in: ["p1"] },
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
  });
});
