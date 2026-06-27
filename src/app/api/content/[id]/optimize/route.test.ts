import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";

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
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/analysis/optimizer", () => ({
  optimizeForPlatform: vi.fn(() =>
    Promise.resolve({
      original: "<p>原文</p>",
      optimized: "<p>优化后</p>",
      diff: "diff",
      applied: false,
    })
  ),
}));

import { prisma } from "@/lib/db";
import { optimizeForPlatform } from "@/lib/analysis/optimizer";

describe("Content Optimize API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should pass project and brand context into platform optimization", async () => {
    (prisma.contentPiece.findUnique as any).mockResolvedValue({
      id: "pc1",
      workspaceId: "test-workspace-id",
      title: "Product launch draft",
      projectId: "proj1",
      brandId: "brand1",
      brief: JSON.stringify({
        topic: "AI and Machine Learning",
        keyPoints: ["Point 1", "Point 2"],
        context: {
          project: {
            projectId: "proj1",
            brandId: "brand1",
            productName: "Marketing Platform",
            productDescription: "A content marketing platform",
            positioning: "Workflow automation",
          },
        },
      }),
      brandVoice: null,
      platformContents: [{ platform: "wechat", content: "<p>原文</p>" }],
    });

    const response = await POST(
      {
        json: async () => ({ platform: "wechat", content: "<p>原文</p>" }),
      } as Request,
      { params: Promise.resolve({ id: "pc1" }) } as any
    );

    expect(response.status).toBe(200);
    expect(optimizeForPlatform).toHaveBeenCalledWith(
      "<p>原文</p>",
      "wechat",
      expect.stringContaining("内容上下文")
    );
    expect(optimizeForPlatform).toHaveBeenCalledWith(
      "<p>原文</p>",
      "wechat",
      expect.stringContaining("项目ID: proj1")
    );
    expect(optimizeForPlatform).toHaveBeenCalledWith(
      "<p>原文</p>",
      "wechat",
      expect.stringContaining("品牌ID: brand1")
    );
  });
});
