import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "./route";

vi.mock("@/lib/db", () => ({
  prisma: {
    contentPiece: {
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
        where: { workspaceId: "ws1" },
        include: {
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
          workspaceId: "ws1",
          schedules: { none: {} },
        },
        include: {
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
          workspaceId: "ws1",
          status: "published",
        },
        include: {
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

  describe("POST - Create content", () => {
    it("should create a content draft using the current project context", async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
      vi.mocked(getCurrentWorkspace).mockReturnValue({
        workspaceId: "ws1",
        projectId: "project-1",
        brandId: "brand-1",
        role: "member",
      });

      const mockCreated = {
        id: "content-1",
        title: "Launch plan",
        workspaceId: "ws1",
        projectId: "project-1",
        platformContents: [{ platform: "wechat", status: "draft" }],
      };
      (prisma.contentPiece.create as any).mockResolvedValue(mockCreated);

      const response = await POST(
        {
          json: async () => ({
            topic: "Launch plan",
            keyPoints: ["Point A", ""],
            platforms: ["wechat", "unknown"],
          }),
        } as any
      );

      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toMatchObject({ id: "content-1" });
      expect(prisma.contentPiece.create).toHaveBeenCalledWith({
        data: {
          workspaceId: "ws1",
          projectId: "project-1",
          brandId: "brand-1",
          createdByUserId: "user1",
          title: "Launch plan",
          type: "blog_post",
          brief: JSON.stringify({
            topic: "Launch plan",
            keyPoints: ["Point A"],
            platforms: ["wechat"],
            references: "",
            notes: "",
            templateId: undefined,
            brandVoiceId: undefined,
          }),
          brandVoiceId: undefined,
          status: "draft",
          platformContents: {
            create: [{ platform: "wechat", status: "draft" }],
          },
        },
        include: { platformContents: true },
      });
    });
  });
});

