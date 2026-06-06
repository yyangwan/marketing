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

    it("should return 400 for invalid platform parameter", async () => {
      const response = await GET(
        new Request("http://localhost/api/content/test-id/quality/local?platform=invalid"),
        { params: Promise.resolve({ id: "test-id" }) } as any
      );

      expect(response.status).toBe(400);
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
      expect(data.suggestions).toContain("鍐呭涓虹┖锛屾棤娉曞垎鏋?);
    });

    it("should calculate local metrics for valid content", async () => {
      const testContent = "<p>杩欐槸涓€娈垫祴璇曞唴瀹广€俆his is test content with some meaningful text for analysis.</p>";

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

    it("should analyze the requested platform content when platform is provided", async () => {
      (prisma.contentPiece.findUnique as any).mockResolvedValueOnce({
        id: "test-id",
        project: { workspaceId: "test-workspace-id" },
        platformContents: [
          { platform: "wechat", content: "<p>寰俊鍐呭</p>" },
          { platform: "weibo", content: "<p>寰崥鍐呭鏇寸煭</p>" },
        ],
      });

      const response = await GET(
        new Request("http://localhost/api/content/test-id/quality/local?platform=weibo"),
        { params: Promise.resolve({ id: "test-id" }) } as any
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.localMetrics).toBeDefined();
      expect(data.overallScore).toBeGreaterThanOrEqual(0);
    });

    it("should analyze sentiment correctly", async () => {
      const positiveContent = "<p>杩欐槸涓€涓潪甯稿紑蹇冨拰缇庡ソ鐨勬棩瀛愶紒澶у閮藉緢鍠滄杩欎釜缁撴灉銆?/p>";

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
      const contentWithStructure = "<h1>鏍囬</h1><p>绗竴娈?/p><h2>鍓爣棰?/h2><p>绗簩娈靛唴瀹瑰緢闀匡紝鍖呭惈鏇村鐨勬枃瀛楁潵杩涜缁撴瀯鍒嗘瀽娴嬭瘯銆?/p>";

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
      const contentWithKeywords = "<p>浜哄伐鏅鸿兘鍜屾満鍣ㄥ涔犳槸鏈潵鐨勫彂灞曟柟鍚戙€侫I鎶€鏈皢鏀瑰彉涓栫晫銆?/p>";

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
      const simpleContent = "绠€鍗曠殑鏂囨湰";

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

