import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";

// Mock the auth and workspace functions
vi.mock("@/lib/auth/config", () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: "test-user-id", workspaceId: "test-workspace-id" },
    })
  ),
}));

vi.mock("@/lib/auth/workspace", () => ({
  getCurrentWorkspace: vi.fn(() => ({ workspaceId: "test-workspace-id" })),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    contentPiece: {
      count: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    platformContent: {
      groupBy: vi.fn(),
    },
    contentQuality: {
      aggregate: vi.fn(),
    },
    publishHistory: {
      groupBy: vi.fn(),
    },
    contentSchedule: {
      groupBy: vi.fn(),
    },
    project: {
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from "@/lib/db";

describe("Analytics API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/analytics", () => {
    it("should return analytics summary successfully", async () => {
      // Mock all the database calls
      (prisma.contentPiece.count as any).mockResolvedValue(42);

      (prisma.contentPiece.groupBy as any)
        .mockResolvedValueOnce([
          { status: "draft", _count: 15 },
          { status: "reviewing", _count: 8 },
          { status: "approved", _count: 12 },
          { status: "published", _count: 7 },
        ]);

      (prisma.platformContent.groupBy as any).mockResolvedValue([
        { platform: "wechat", _count: 20 },
        { platform: "weibo", _count: 12 },
        { platform: "xiaohongshu", _count: 10 },
      ]);

      (prisma.contentQuality.aggregate as any).mockResolvedValue({
        _avg: {
          quality: 7.5,
          engagement: 7.2,
          brandVoice: 8.0,
          platformFit: 7.8,
        },
      });

      (prisma.publishHistory.groupBy as any).mockResolvedValue([
        { status: "success", _count: 35 },
        { status: "failed", _count: 2 },
      ]);

      (prisma.contentSchedule.groupBy as any).mockResolvedValue([
        { status: "scheduled", _count: 10 },
        { status: "published", _count: 30 },
      ]);

      (prisma.contentPiece.findMany as any).mockResolvedValue([
        {
          id: "c1",
          title: "Test Content 1",
          status: "published",
          createdAt: new Date(),
          project: { name: "Project A" },
        },
      ]);

      (prisma.project.findMany as any).mockResolvedValue([
        { id: "p1", name: "Project A", contentPieces: Array(25).fill({ id: "x" }) },
        { id: "p2", name: "Project B", contentPieces: Array(17).fill({ id: "y" }) },
      ]);

      (prisma.$queryRaw as any)
        .mockResolvedValueOnce([
          { date: "2026-04-01", count: 5 },
          { date: "2026-04-02", count: 8 },
        ])
        .mockResolvedValueOnce([
          { date: "2026-04-01", avgQuality: 7.2 },
          { date: "2026-04-02", avgQuality: 7.8 },
        ]);

      const response = await GET(
        { url: "http://localhost:3000/api/analytics?timeRange=30" } as Request
      );

      expect(response.status).toBe(200);

      const data = await response.json();

      // Verify summary
      expect(data.summary.totalContent).toBe(42);
      expect(data.summary.avgQualityScore).toBe(7.5);
      expect(data.summary.publishSuccessRate).toBe(95); // 35/37

      // Verify distributions
      expect(data.distributions.byStatus).toEqual({
        draft: 15,
        reviewing: 8,
        approved: 12,
        published: 7,
      });

      expect(data.distributions.byPlatform).toEqual({
        wechat: 20,
        weibo: 12,
        xiaohongshu: 10,
      });

      // Verify trends
      expect(data.trends.contentOverTime).toHaveLength(2);
      expect(data.trends.qualityOverTime).toHaveLength(2);

      // Verify recent activity
      expect(data.recentActivity).toHaveLength(1);
      expect(data.recentActivity[0].title).toBe("Test Content 1");

      // Verify top projects
      expect(data.topProjects).toHaveLength(2);
      expect(data.topProjects[0].name).toBe("Project A");
    });

    it("should support custom time range", async () => {
      (prisma.contentPiece.count as any).mockResolvedValue(0);
      (prisma.contentPiece.groupBy as any).mockResolvedValue([]);
      (prisma.platformContent.groupBy as any).mockResolvedValue([]);
      (prisma.contentQuality.aggregate as any).mockResolvedValue({
        _avg: { quality: 0, engagement: 0, brandVoice: 0, platformFit: 0 },
      });
      (prisma.publishHistory.groupBy as any).mockResolvedValue([]);
      (prisma.contentSchedule.groupBy as any).mockResolvedValue([]);
      (prisma.contentPiece.findMany as any).mockResolvedValue([]);
      (prisma.project.findMany as any).mockResolvedValue([]);
      (prisma.$queryRaw as any).mockResolvedValue([]).mockResolvedValue([]);

      const response = await GET(
        { url: "http://localhost:3000/api/analytics?timeRange=7" } as Request
      );

      expect(response.status).toBe(200);

      // Verify the count was called with a date 7 days ago
      const countCall = (prisma.contentPiece.count as any).mock.calls[0][0];
      expect(countCall.where.createdAt.gte).toBeInstanceOf(Date);
    });

    it("should return 401 for unauthorized requests", async () => {
      const { auth } = await import("@/lib/auth/config");
      vi.mocked(auth).mockResolvedValueOnce(null);

      const response = await GET(
        { url: "http://localhost:3000/api/analytics" } as Request
      );

      expect(response.status).toBe(401);
    });

    it("should return 403 when workspace is not found", async () => {
      const { getCurrentWorkspace } = await import("@/lib/auth/workspace");
      vi.mocked(getCurrentWorkspace).mockReturnValueOnce(null);

      const response = await GET(
        { url: "http://localhost:3000/api/analytics" } as Request
      );

      expect(response.status).toBe(403);
    });

    it("should return 500 on database error", async () => {
      (prisma.contentPiece.count as any).mockRejectedValue(
        new Error("Database error")
      );

      const response = await GET(
        { url: "http://localhost:3000/api/analytics" } as Request
      );

      expect(response.status).toBe(500);
    });

    it("should calculate publish success rate correctly", async () => {
      (prisma.contentPiece.count as any).mockResolvedValue(0);
      (prisma.contentPiece.groupBy as any).mockResolvedValue([]);
      (prisma.platformContent.groupBy as any).mockResolvedValue([]);
      (prisma.contentQuality.aggregate as any).mockResolvedValue({
        _avg: { quality: 0, engagement: 0, brandVoice: 0, platformFit: 0 },
      });
      (prisma.publishHistory.groupBy as any).mockResolvedValue([
        { status: "success", _count: 80 },
        { status: "failed", _count: 20 },
      ]);
      (prisma.contentSchedule.groupBy as any).mockResolvedValue([]);
      (prisma.contentPiece.findMany as any).mockResolvedValue([]);
      (prisma.project.findMany as any).mockResolvedValue([]);
      (prisma.$queryRaw as any).mockResolvedValue([]).mockResolvedValue([]);

      const response = await GET(
        { url: "http://localhost:3000/api/analytics" } as Request
      );

      const data = await response.json();
      expect(data.summary.publishSuccessRate).toBe(80); // 80/100
    });

    it("should handle zero publishes gracefully", async () => {
      (prisma.contentPiece.count as any).mockResolvedValue(0);
      (prisma.contentPiece.groupBy as any).mockResolvedValue([]);
      (prisma.platformContent.groupBy as any).mockResolvedValue([]);
      (prisma.contentQuality.aggregate as any).mockResolvedValue({
        _avg: { quality: 0, engagement: 0, brandVoice: 0, platformFit: 0 },
      });
      (prisma.publishHistory.groupBy as any).mockResolvedValue([]);
      (prisma.contentSchedule.groupBy as any).mockResolvedValue([]);
      (prisma.contentPiece.findMany as any).mockResolvedValue([]);
      (prisma.project.findMany as any).mockResolvedValue([]);
      (prisma.$queryRaw as any).mockResolvedValue([]).mockResolvedValue([]);

      const response = await GET(
        { url: "http://localhost:3000/api/analytics" } as Request
      );

      const data = await response.json();
      expect(data.summary.publishSuccessRate).toBe(0);
    });
  });
});
