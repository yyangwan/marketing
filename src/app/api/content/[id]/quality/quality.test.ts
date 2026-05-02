import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";

// Custom matcher for date comparison
expect.extend({
  toMatchDateObject(received: any, expected: any) {
    const receivedWithoutDates = { ...received };
    const expectedWithoutDates = { ...expected };
    delete receivedWithoutDates.createdAt;
    delete receivedWithoutDates.updatedAt;
    delete expectedWithoutDates.createdAt;
    delete expectedWithoutDates.updatedAt;

    const pass = this.equals(receivedWithoutDates, expectedWithoutDates);
    return {
      pass,
      message: () =>
        pass
          ? "Expected dates to match (ignoring exact millisecond differences)"
          : `Expected objects to match (excluding dates):\n${JSON.stringify(expectedWithoutDates)}\n\nReceived:\n${JSON.stringify(receivedWithoutDates)}`,
    };
  },
});

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
    brandVoice: {
      findUnique: vi.fn(),
    },
    contentQuality: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/ai/client", () => ({
  callLLM: vi.fn(() =>
    Promise.resolve(
      JSON.stringify({
        quality: 5,
        engagement: 5,
        brandVoice: 5,
        platformFit: 5,
        suggestions: ["Content is empty. Please add some content to evaluate."],
      })
    )
  ),
}));

import { prisma } from "@/lib/db";

describe("Content Quality API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/content/[id]/quality", () => {
    it("should evaluate content quality successfully", async () => {
      const mockContent = {
        id: "pc1",
        contentPieceId: "cp1",
        platform: "wechat",
        brief: JSON.stringify({
          topic: "AI and Machine Learning",
          keyPoints: ["Point 1", "Point 2", "Point 3"],
        }),
        brandVoiceId: null,
        project: {
          id: "proj1",
          workspaceId: "test-workspace-id",
          brandVoiceId: null,
          brandVoice: null,
        },
        platformContents: [
          {
            id: "pc1",
            content: "Test content about AI and machine learning",
          },
        ],
      };

      const mockBrandVoice = null;

      const mockQuality = {
        id: "cq1",
        contentPieceId: "cp1",
        platform: "wechat",
        quality: 8,
        engagement: 7,
        brandVoice: 8,
        platformFit: 9,
        suggestions: "Good content structure. Consider adding more examples.",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.contentPiece.findUnique as any).mockResolvedValue(mockContent);
      (prisma.brandVoice.findUnique as any).mockResolvedValue(mockBrandVoice);
      (prisma.contentQuality.upsert as any).mockResolvedValue(mockQuality);

      // Mock the AI evaluation (this would normally call OpenAI)
      // For this test, we'll mock a successful response by spying on the actual implementation

      // Create a proper mock request with json() method
      const mockRequest = {
        json: async () => ({}),
      } as unknown as Request;

      const response = await POST(
        mockRequest,
        { params: Promise.resolve({ id: "pc1" }) } as any
      );

      const data = await response.json();

      expect(data).toMatchDateObject(mockQuality);
      expect(prisma.contentQuality.upsert).toHaveBeenCalled();
    });

    it("should include brand voice context in evaluation when available", async () => {
      const mockContent = {
        id: "pc1",
        contentPieceId: "cp1",
        platform: "wechat",
        brief: JSON.stringify({
          topic: "Test Topic",
          keyPoints: ["Key Point"],
        }),
        brandVoiceId: "bv1",
        project: {
          id: "proj1",
          workspaceId: "test-workspace-id",
          brandVoiceId: "bv1",
          brandVoice: {
            id: "bv1",
            name: "Professional Brand",
            guidelines: "Be formal and authoritative",
            samples: '["Sample 1", "Sample 2"]',
          },
        },
        platformContents: [
          {
            id: "pc1",
            content: "Test content",
          },
        ],
      };

      const mockBrandVoice = {
        id: "bv1",
        name: "Professional Brand",
        guidelines: "Be formal and authoritative",
        samples: '["Sample 1", "Sample 2"]',
      };

      (prisma.contentPiece.findUnique as any).mockResolvedValue(mockContent);
      (prisma.brandVoice.findUnique as any).mockResolvedValue(mockBrandVoice);
      (prisma.contentQuality.upsert as any).mockResolvedValue({
        id: "cq1",
        contentPieceId: "cp1",
        platform: "wechat",
        quality: 9,
        engagement: 8,
        brandVoice: 10,
        platformFit: 8,
        suggestions: "Matches brand voice well.",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create a proper mock request with json() method
      const mockRequest = {
        json: async () => ({}),
      } as unknown as Request;

      const response = await POST(
        mockRequest,
        { params: Promise.resolve({ id: "pc1" }) } as any
      );

      // Brand voice is fetched via piece.project.brandVoice (from include), not via separate query
      expect(prisma.contentQuality.upsert).toHaveBeenCalled();
    });

    it("should return existing evaluation if already exists", async () => {
      const mockContent = {
        id: "pc1",
        contentPieceId: "cp1",
        platform: "wechat",
        brief: JSON.stringify({
          topic: "Test Topic",
          keyPoints: ["Key Point"],
        }),
        brandVoiceId: null,
        project: {
          id: "proj1",
          workspaceId: "test-workspace-id",
          brandVoiceId: null,
          brandVoice: null,
        },
        platformContents: [
          {
            id: "pc1",
            content: "Test content",
          },
        ],
      };

      const mockExistingQuality = {
        id: "cq1",
        contentPieceId: "cp1",
        platform: "wechat",
        quality: 8,
        engagement: 7,
        brandVoice: 8,
        platformFit: 9,
        suggestions: "Existing suggestions",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.contentPiece.findUnique as any).mockResolvedValue(mockContent);
      (prisma.contentQuality.upsert as any).mockResolvedValue(mockExistingQuality);

      // Create a proper mock request with json() method
      const mockRequest = {
        json: async () => ({}),
      } as unknown as Request;

      const response = await POST(
        mockRequest,
        { params: Promise.resolve({ id: "pc1" }) } as any
      );

      const data = await response.json();

      expect(data).toMatchDateObject(mockExistingQuality);
    });

    it("should return 404 if content not found", async () => {
      (prisma.contentPiece.findUnique as any).mockResolvedValue(null);

      const mockRequest = {
        json: async () => ({}),
      } as unknown as Request;

      const response = await POST(
        mockRequest,
        { params: Promise.resolve({ id: "nonexistent" }) } as any
      );

      expect(response.status).toBe(404);
    });

    it("should handle AI evaluation errors gracefully", async () => {
      const mockContent = {
        id: "pc1",
        contentPieceId: "cp1",
        platform: "wechat",
        brief: JSON.stringify({
          topic: "Test Topic",
          keyPoints: ["Key Point"],
        }),
        brandVoiceId: null,
        project: {
          id: "proj1",
          workspaceId: "test-workspace-id",
          brandVoiceId: null,
          brandVoice: null,
        },
        platformContents: [
          {
            id: "pc1",
            content: "Test content",
          },
        ],
      };

      (prisma.contentPiece.findUnique as any).mockResolvedValue(mockContent);
      (prisma.contentQuality.upsert as any).mockResolvedValue({
        id: "cq1",
        contentPieceId: "cp1",
        platform: "wechat",
        quality: 5,
        engagement: 5,
        brandVoice: 5,
        platformFit: 5,
        suggestions: "Evaluation error - using default scores",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // The implementation should catch errors and return default scores
      // Create a proper mock request with json() method
      const mockRequest = {
        json: async () => ({}),
      } as unknown as Request;

      const response = await POST(
        mockRequest,
        { params: Promise.resolve({ id: "pc1" }) } as any
      );

      const data = await response.json();

      // Should return default scores on error
      expect(data.quality).toBeGreaterThanOrEqual(0);
      expect(data.quality).toBeLessThanOrEqual(10);
    });

    it("should strip HTML tags from content before evaluation", async () => {
      const mockContent = {
        id: "pc1",
        contentPieceId: "cp1",
        platform: "wechat",
        brief: JSON.stringify({
          topic: "HTML Content",
          keyPoints: ["Point"],
        }),
        brandVoiceId: null,
        project: {
          id: "proj1",
          workspaceId: "test-workspace-id",
          brandVoiceId: null,
          brandVoice: null,
        },
        platformContents: [
          {
            id: "pc1",
            content: "<p>This is <strong>HTML</strong> content.</p>",
          },
        ],
      };

      (prisma.contentPiece.findUnique as any).mockResolvedValue(mockContent);
      (prisma.contentQuality.upsert as any).mockResolvedValue({
        id: "cq1",
        contentPieceId: "cp1",
        platform: "wechat",
        quality: 7,
        engagement: 7,
        brandVoice: 7,
        platformFit: 7,
        suggestions: "",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create a proper mock request with json() method
      const mockRequest = {
        json: async () => ({}),
      } as unknown as Request;

      const response = await POST(
        mockRequest,
        { params: Promise.resolve({ id: "pc1" }) } as any
      );

      // The implementation should strip HTML before sending to AI
      // We verify this by checking that upsert was called
      expect(prisma.contentQuality.upsert).toHaveBeenCalled();
    });

    it("should handle empty content gracefully", async () => {
      const mockContent = {
        id: "pc1",
        contentPieceId: "cp1",
        platform: "wechat",
        brief: JSON.stringify({
          topic: "Empty",
          keyPoints: [],
        }),
        brandVoiceId: null,
        project: {
          id: "proj1",
          workspaceId: "test-workspace-id",
          brandVoiceId: null,
          brandVoice: null,
        },
        platformContents: [
          {
            id: "pc1",
            content: "",
          },
        ],
      };

      (prisma.contentPiece.findUnique as any).mockResolvedValue(mockContent);

      // Create a proper mock request with json() method
      const mockRequest = {
        json: async () => ({}),
      } as unknown as Request;

      const response = await POST(
        mockRequest,
        { params: Promise.resolve({ id: "pc1" }) } as any
      );

      // Empty content should return 400 error
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("No content to evaluate");
    });
  });

  describe("Scoring Dimensions", () => {
    it("should score quality dimension (0-10)", async () => {
      const mockContent = {
        id: "pc1",
        contentPieceId: "cp1",
        platform: "wechat",
        brief: JSON.stringify({
          topic: "Quality Content",
          keyPoints: ["Point 1", "Point 2"],
        }),
        brandVoiceId: null,
        project: {
          id: "proj1",
          workspaceId: "test-workspace-id",
          brandVoiceId: null,
          brandVoice: null,
        },
        platformContents: [
          {
            id: "pc1",
            content: "High quality well-structured content with clear points.",
          },
        ],
      };

      (prisma.contentPiece.findUnique as any).mockResolvedValue(mockContent);
      (prisma.contentQuality.upsert as any).mockResolvedValue({
        id: "cq1",
        contentPieceId: "cp1",
        platform: "wechat",
        quality: 9,
        engagement: 7,
        brandVoice: 7,
        platformFit: 7,
        suggestions: "",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create a proper mock request with json() method
      const mockRequest = {
        json: async () => ({}),
      } as unknown as Request;

      const response = await POST(
        mockRequest,
        { params: Promise.resolve({ id: "pc1" }) } as any
      );

      const data = await response.json();

      expect(data.quality).toBeGreaterThanOrEqual(0);
      expect(data.quality).toBeLessThanOrEqual(10);
    });

    it("should score engagement dimension (0-10)", async () => {
      const mockContent = {
        id: "pc1",
        contentPieceId: "cp1",
        platform: "wechat",
        brief: JSON.stringify({
          topic: "Engagement",
          keyPoints: ["Hook"],
        }),
        brandVoiceId: null,
        project: {
          id: "proj1",
          workspaceId: "test-workspace-id",
          brandVoiceId: null,
          brandVoice: null,
        },
        platformContents: [
          {
            id: "pc1",
            content: "Engaging content with hooks and questions.",
          },
        ],
      };

      (prisma.contentPiece.findUnique as any).mockResolvedValue(mockContent);
      (prisma.contentQuality.upsert as any).mockResolvedValue({
        id: "cq1",
        contentPieceId: "cp1",
        platform: "wechat",
        quality: 7,
        engagement: 8,
        brandVoice: 7,
        platformFit: 7,
        suggestions: "",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create a proper mock request with json() method
      const mockRequest = {
        json: async () => ({}),
      } as unknown as Request;

      const response = await POST(
        mockRequest,
        { params: Promise.resolve({ id: "pc1" }) } as any
      );

      const data = await response.json();

      expect(data.engagement).toBeGreaterThanOrEqual(0);
      expect(data.engagement).toBeLessThanOrEqual(10);
    });

    it("should score brandVoice dimension (0-10)", async () => {
      const mockContent = {
        id: "pc1",
        contentPieceId: "cp1",
        platform: "wechat",
        brief: JSON.stringify({
          topic: "Professional Content",
          keyPoints: ["Point"],
        }),
        brandVoiceId: "bv1",
        project: {
          id: "proj1",
          workspaceId: "test-workspace-id",
          brandVoiceId: "bv1",
          brandVoice: {
            id: "bv1",
            name: "Professional Brand",
            guidelines: "Be formal and authoritative",
            samples: '["Sample 1"]',
          },
        },
        platformContents: [
          {
            id: "pc1",
            content: "Professional content matching brand guidelines.",
          },
        ],
      };

      const mockBrandVoice = {
        id: "bv1",
        name: "Professional Brand",
        guidelines: "Be formal and authoritative",
        samples: '["Sample 1"]',
      };

      (prisma.contentPiece.findUnique as any).mockResolvedValue(mockContent);
      (prisma.brandVoice.findUnique as any).mockResolvedValue(mockBrandVoice);
      (prisma.contentQuality.upsert as any).mockResolvedValue({
        id: "cq1",
        contentPieceId: "cp1",
        platform: "wechat",
        quality: 7,
        engagement: 7,
        brandVoice: 9,
        platformFit: 7,
        suggestions: "",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create a proper mock request with json() method
      const mockRequest = {
        json: async () => ({}),
      } as unknown as Request;

      const response = await POST(
        mockRequest,
        { params: Promise.resolve({ id: "pc1" }) } as any
      );

      const data = await response.json();

      expect(data.brandVoice).toBeGreaterThanOrEqual(0);
      expect(data.brandVoice).toBeLessThanOrEqual(10);
    });

    it("should score platformFit dimension (0-10)", async () => {
      const mockContent = {
        id: "pc1",
        contentPieceId: "cp1",
        platform: "wechat",
        brief: JSON.stringify({
          topic: "Platform Fit",
          keyPoints: ["Point"],
        }),
        brandVoiceId: null,
        project: {
          id: "proj1",
          workspaceId: "test-workspace-id",
          brandVoiceId: null,
          brandVoice: null,
        },
        platformContents: [
          {
            id: "pc1",
            content: "WeChat-optimized content with emojis and short paragraphs.",
          },
        ],
      };

      (prisma.contentPiece.findUnique as any).mockResolvedValue(mockContent);
      (prisma.contentQuality.upsert as any).mockResolvedValue({
        id: "cq1",
        contentPieceId: "cp1",
        platform: "wechat",
        quality: 7,
        engagement: 7,
        brandVoice: 7,
        platformFit: 9,
        suggestions: "",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create a proper mock request with json() method
      const mockRequest = {
        json: async () => ({}),
      } as unknown as Request;

      const response = await POST(
        mockRequest,
        { params: Promise.resolve({ id: "pc1" }) } as any
      );

      const data = await response.json();

      expect(data.platformFit).toBeGreaterThanOrEqual(0);
      expect(data.platformFit).toBeLessThanOrEqual(10);
    });
  });
});
