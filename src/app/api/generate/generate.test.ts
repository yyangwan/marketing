import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";

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
    platformContent: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/ai/client", () => ({
  callLLM: vi.fn(() => Promise.resolve("Generated content about AI and machine learning")),
}));

vi.mock("@/lib/ai/prompts/wechat", () => ({
  buildWeChatPrompt: vi.fn((brief, brandVoice) => {
    if (brandVoice) {
      return `BRAND: ${brandVoice.name} - ${brief.topic}`;
    }
    return `PROMPT: ${brief.topic}`;
  }),
}));

vi.mock("@/lib/ai/prompts/weibo", () => ({
  buildWeiboPrompt: vi.fn((brief) => `WEIBO: ${brief.topic}`),
}));

vi.mock("@/lib/ai/prompts/xiaohongshu", () => ({
  buildXiaohongshuPrompt: vi.fn((brief, brandVoice) => {
    if (brandVoice) {
      return `XIAOHONGSHU BRAND: ${brandVoice.name} - ${brief.topic}`;
    }
    return `XIAOHONGSHU: ${brief.topic}`;
  }),
}));

vi.mock("@/lib/ai/prompts/douyin", () => ({
  buildDouyinPrompt: vi.fn((brief, brandVoice) => {
    if (brandVoice) {
      return `DOUYIN BRAND: ${brandVoice.name} - ${brief.topic}`;
    }
    return `DOUYIN: ${brief.topic}`;
  }),
}));

import { prisma } from "@/lib/db";
import { buildWeChatPrompt } from "@/lib/ai/prompts/wechat";
import { buildWeiboPrompt } from "@/lib/ai/prompts/weibo";
import { buildXiaohongshuPrompt } from "@/lib/ai/prompts/xiaohongshu";
import { buildDouyinPrompt } from "@/lib/ai/prompts/douyin";

describe("Generate API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/generate", () => {
    const mockContentPiece = {
      id: "cp1",
      brief: JSON.stringify({
        topic: "AI and Machine Learning",
        keyPoints: ["Point 1", "Point 2"],
      }),
      project: {
        id: "proj1",
        workspaceId: "test-workspace-id",
        brandVoiceId: null,
        brandVoice: null,
      },
      brandVoice: null,
    };

    it("should generate content for wechat platform", async () => {
      (prisma.contentPiece.findUnique as any).mockResolvedValue(mockContentPiece);
      (prisma.platformContent.upsert as any).mockResolvedValue({
        id: "pc1",
        content: "Generated content",
      });

      const response = await POST({
        json: async () => ({ contentPieceId: "cp1", platform: "wechat" }),
      } as Request);

      expect(response.status).toBe(200);
      expect(buildWeChatPrompt).toHaveBeenCalled();
      expect(prisma.platformContent.upsert).toHaveBeenCalled();
    });

    it("should generate content for weibo platform", async () => {
      (prisma.contentPiece.findUnique as any).mockResolvedValue(mockContentPiece);
      (prisma.platformContent.upsert as any).mockResolvedValue({
        id: "pc1",
        content: "Generated content",
      });

      const response = await POST({
        json: async () => ({ contentPieceId: "cp1", platform: "weibo" }),
      } as Request);

      expect(response.status).toBe(200);
      expect(buildWeiboPrompt).toHaveBeenCalled();
    });

    it("should generate content for xiaohongshu platform", async () => {
      (prisma.contentPiece.findUnique as any).mockResolvedValue(mockContentPiece);
      (prisma.platformContent.upsert as any).mockResolvedValue({
        id: "pc1",
        content: "Generated content",
      });

      const response = await POST({
        json: async () => ({ contentPieceId: "cp1", platform: "xiaohongshu" }),
      } as Request);

      expect(response.status).toBe(200);
      expect(buildXiaohongshuPrompt).toHaveBeenCalled();
    });

    it("should generate content for douyin platform", async () => {
      (prisma.contentPiece.findUnique as any).mockResolvedValue(mockContentPiece);
      (prisma.platformContent.upsert as any).mockResolvedValue({
        id: "pc1",
        content: "Generated content",
      });

      const response = await POST({
        json: async () => ({ contentPieceId: "cp1", platform: "douyin" }),
      } as Request);

      expect(response.status).toBe(200);
      expect(buildDouyinPrompt).toHaveBeenCalled();
    });

    it("should use content piece's brand voice when available", async () => {
      const mockWithBrandVoice = {
        ...mockContentPiece,
        brandVoice: {
          id: "bv1",
          name: "Test Brand",
          description: "Test description",
          guidelines: "Test guidelines",
          samples: '["sample1"]',
        },
      };

      (prisma.contentPiece.findUnique as any).mockResolvedValue(mockWithBrandVoice);
      (prisma.platformContent.upsert as any).mockResolvedValue({
        id: "pc1",
        content: "Generated content with brand voice",
      });

      const response = await POST({
        json: async () => ({ contentPieceId: "cp1", platform: "wechat" }),
      } as Request);

      expect(response.status).toBe(200);
      // Verify brand voice was passed to the prompt builder
      expect(buildWeChatPrompt).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          name: "Test Brand",
        })
      );
    });

    it("should fall back to project's brand voice when content piece has none", async () => {
      const mockWithProjectBrandVoice = {
        ...mockContentPiece,
        project: {
          ...mockContentPiece.project,
          brandVoiceId: "bv1",
          brandVoice: {
            id: "bv1",
            name: "Project Brand",
            description: "Project brand description",
            guidelines: "Project guidelines",
            samples: '["sample1"]',
          },
        },
      };

      (prisma.contentPiece.findUnique as any).mockResolvedValue(mockWithProjectBrandVoice);
      (prisma.platformContent.upsert as any).mockResolvedValue({
        id: "pc1",
        content: "Generated content with project brand voice",
      });

      const response = await POST({
        json: async () => ({ contentPieceId: "cp1", platform: "wechat" }),
      } as Request);

      expect(response.status).toBe(200);
      expect(buildWeChatPrompt).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          name: "Project Brand",
        })
      );
    });

    it("should return 400 for invalid platform", async () => {
      (prisma.contentPiece.findUnique as any).mockResolvedValue(mockContentPiece);

      const response = await POST({
        json: async () => ({ contentPieceId: "cp1", platform: "invalid" }),
      } as Request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("No prompt for invalid");
    });

    it("should return 404 when content piece not found", async () => {
      (prisma.contentPiece.findUnique as any).mockResolvedValue(null);

      const response = await POST({
        json: async () => ({ contentPieceId: "nonexistent", platform: "wechat" }),
      } as Request);

      expect(response.status).toBe(404);
    });

    it("should return 404 when content piece belongs to different workspace", async () => {
      (prisma.contentPiece.findUnique as any).mockResolvedValue({
        ...mockContentPiece,
        project: {
          ...mockContentPiece.project,
          workspaceId: "different-workspace-id",
        },
      });

      const response = await POST({
        json: async () => ({ contentPieceId: "cp1", platform: "wechat" }),
      } as Request);

      expect(response.status).toBe(404);
    });

    it("should upsert platform content (create or update)", async () => {
      (prisma.contentPiece.findUnique as any).mockResolvedValue(mockContentPiece);
      (prisma.platformContent.upsert as any).mockResolvedValue({
        id: "pc1",
        contentPieceId: "cp1",
        platform: "wechat",
        content: "Generated content",
        status: "draft",
      });

      const response = await POST({
        json: async () => ({ contentPieceId: "cp1", platform: "wechat" }),
      } as Request);

      expect(response.status).toBe(200);
      expect(prisma.platformContent.upsert).toHaveBeenCalledWith({
        where: {
          contentPieceId_platform: { contentPieceId: "cp1", platform: "wechat" },
        },
        create: {
          contentPieceId: "cp1",
          platform: "wechat",
          content: expect.any(String),
          status: "draft",
        },
        update: {
          content: expect.any(String),
        },
      });
    });
  });

  describe("Brand Voice Integration", () => {
    it("should pass brand voice to xiaohongshu prompt builder", async () => {
      const mockWithBrandVoice = {
        id: "cp1",
        brief: JSON.stringify({ topic: "Test", keyPoints: [] }),
        project: {
          id: "proj1",
          workspaceId: "test-workspace-id",
          brandVoice: null,
        },
        brandVoice: {
          id: "bv1",
          name: "Xiaohongshu Brand",
          description: "Desc",
          guidelines: "Guidelines",
          samples: '["sample"]',
        },
      };

      (prisma.contentPiece.findUnique as any).mockResolvedValue(mockWithBrandVoice);
      (prisma.platformContent.upsert as any).mockResolvedValue({ id: "pc1" });

      await POST({
        json: async () => ({ contentPieceId: "cp1", platform: "xiaohongshu" }),
      } as Request);

      expect(buildXiaohongshuPrompt).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          name: "Xiaohongshu Brand",
        })
      );
    });

    it("should pass brand voice to douyin prompt builder", async () => {
      const mockWithBrandVoice = {
        id: "cp1",
        brief: JSON.stringify({ topic: "Test", keyPoints: [] }),
        project: {
          id: "proj1",
          workspaceId: "test-workspace-id",
          brandVoice: null,
        },
        brandVoice: {
          id: "bv1",
          name: "Douyin Brand",
          description: "Desc",
          guidelines: "Guidelines",
          samples: '["sample"]',
        },
      };

      (prisma.contentPiece.findUnique as any).mockResolvedValue(mockWithBrandVoice);
      (prisma.platformContent.upsert as any).mockResolvedValue({ id: "pc1" });

      await POST({
        json: async () => ({ contentPieceId: "cp1", platform: "douyin" }),
      } as Request);

      expect(buildDouyinPrompt).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          name: "Douyin Brand",
        })
      );
    });
  });
});
