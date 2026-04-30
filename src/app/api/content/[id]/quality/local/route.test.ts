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
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";

describe("Local Quality API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/content/[id]/quality/local", () => {
    it("should return unauthorized without auth", async () => {
      const { auth } = await import("@/lib/auth/config");
      vi.mocked(auth).mockResolvedValueOnce(null as any);

      const response = await GET(
        {} as Request,
        { params: Promise.resolve({ id: "test-id" }) } as any
      );

      expect(response.status).toBe(401);
    });

    it("should return 404 for non-existent content", async () => {
      (prisma.contentPiece.findUnique as any).mockResolvedValueOnce(null);

      const response = await GET(
        {} as Request,
        { params: Promise.resolve({ id: "nonexistent" }) } as any
      );

      expect(response.status).toBe(404);
    });

    it("should return 404 for content in different workspace", async () => {
      (prisma.contentPiece.findUnique as any).mockResolvedValueOnce({
        id: "other-id",
        project: { workspaceId: "other-workspace-id" },
        platformContents: [{ content: "test" }],
      });

      const response = await GET(
        {} as Request,
        { params: Promise.resolve({ id: "other-id" }) } as any
      );

      expect(response.status).toBe(404);
    });

    it("should return default metrics for empty content", async () => {
      (prisma.contentPiece.findUnique as any).mockResolvedValueOnce({
        id: "test-id",
        project: { workspaceId: "test-workspace-id" },
        platformContents: [{}], // Empty content
      });

      const response = await GET(
        {} as Request,
        { params: Promise.resolve({ id: "test-id" }) } as any
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.localMetrics.readabilityScore).toBe(0);
      expect(data.overallScore).toBe(0);
      expect(data.sentiment.overall).toBe("neutral");
      expect(data.suggestions).toContain("内容为空，无法分析");
    });

    it("should calculate local metrics for valid content", async () => {
      const testContent = "<p>这是一段测试内容。This is test content with some meaningful text for analysis.</p>";

      (prisma.contentPiece.findUnique as any).mockResolvedValueOnce({
        id: "test-id",
        project: { workspaceId: "test-workspace-id" },
        platformContents: [{ content: testContent }],
      });

      const response = await GET(
        {} as Request,
        { params: Promise.resolve({ id: "test-id" }) } as any
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.localMetrics).toBeDefined();
      expect(data.localMetrics.readabilityScore).toBeGreaterThan(0);
      expect(data.overallScore).toBeGreaterThan(0);
      expect(data.sentiment).toHaveProperty("overall");
      expect(data.sentiment).toHaveProperty("score");
      expect(data.sentiment).toHaveProperty("confidence");
      expect(data.emotions).toHaveProperty("joy");
      expect(data.emotions).toHaveProperty("sadness");
      expect(data.emotions).toHaveProperty("anger");
      expect(data.emotions).toHaveProperty("fear");
      expect(data.emotions).toHaveProperty("surprise");
      expect(data.structure).toHaveProperty("hasH1");
      expect(data.structure).toHaveProperty("paragraphCount");
      expect(Array.isArray(data.keywords)).toBe(true);
    });

    it("should analyze sentiment correctly", async () => {
      const positiveContent = "<p>这是一个非常开心和美好的日子！大家都很喜欢这个结果。</p>";

      (prisma.contentPiece.findUnique as any).mockResolvedValueOnce({
        id: "test-id",
        project: { workspaceId: "test-workspace-id" },
        platformContents: [{ content: positiveContent }],
      });

      const response = await GET(
        {} as Request,
        { params: Promise.resolve({ id: "test-id" }) } as any
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.sentiment.overall).toBeDefined();
      expect(["positive", "neutral", "negative"]).toContain(data.sentiment.overall);
    });

    it("should analyze content structure", async () => {
      const contentWithStructure = "<h1>标题</h1><p>第一段</p><h2>副标题</h2><p>第二段内容很长，包含更多的文字来进行结构分析测试。</p>";

      (prisma.contentPiece.findUnique as any).mockResolvedValueOnce({
        id: "test-id",
        project: { workspaceId: "test-workspace-id" },
        platformContents: [{ content: contentWithStructure }],
      });

      const response = await GET(
        {} as Request,
        { params: Promise.resolve({ id: "test-id" }) } as any
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.structure.hasH1).toBe(true);
      expect(data.structure.h1Count).toBe(1);
      expect(data.structure.headingHierarchy.length).toBeGreaterThan(0);
      expect(data.structure.paragraphCount).toBeGreaterThanOrEqual(1);
    });

    it("should extract keywords from content", async () => {
      const contentWithKeywords = "<p>人工智能和机器学习是未来的发展方向。AI技术将改变世界。</p>";

      (prisma.contentPiece.findUnique as any).mockResolvedValueOnce({
        id: "test-id",
        project: { workspaceId: "test-workspace-id" },
        platformContents: [{ content: contentWithKeywords }],
      });

      const response = await GET(
        {} as Request,
        { params: Promise.resolve({ id: "test-id" }) } as any
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(Array.isArray(data.keywords)).toBe(true);
      expect(data.keywords.length).toBeGreaterThan(0);
      if (data.keywords.length > 0) {
        expect(data.keywords[0]).toHaveProperty("keyword");
        expect(data.keywords[0]).toHaveProperty("relevance");
        expect(data.keywords[0]).toHaveProperty("frequency");
      }
    });

    it("should generate suggestions based on metrics", async () => {
      const simpleContent = "简单的文本";

      (prisma.contentPiece.findUnique as any).mockResolvedValueOnce({
        id: "test-id",
        project: { workspaceId: "test-workspace-id" },
        platformContents: [{ content: simpleContent }],
      });

      const response = await GET(
        {} as Request,
        { params: Promise.resolve({ id: "test-id" }) } as any
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(Array.isArray(data.suggestions)).toBe(true);
    });

    it("should handle calculation errors gracefully", async () => {
      (prisma.contentPiece.findUnique as any).mockResolvedValueOnce({
        id: "test-id",
        project: { workspaceId: "test-workspace-id" },
        platformContents: [{ content: "test" }],
      });

      // Mock the analysis functions to throw errors
      const qualityModule = await import("@/lib/analysis/quality");
      vi.spyOn(qualityModule, "calculateLocalMetrics").mockImplementationOnce(() => {
        throw new Error("Calculation error");
      });

      const response = await GET(
        {} as Request,
        { params: Promise.resolve({ id: "test-id" }) } as any
      );

      expect(response.status).toBe(500);
      const data = await response.json();

      expect(data.error).toBeDefined();
    });
  });
});
