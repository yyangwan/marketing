/**
 * Genie Generator Tests
 */

import { describe, it, expect, vi } from "vitest";
import {
  generateContentIdeas,
  ideasToContentPieces,
  ideaToContentPiece,
  type BusinessInsights,
} from "../generator";

// Mock fetch
global.fetch = vi.fn();

describe("ideaToContentPiece", () => {
  it("should convert ContentIdea to ContentPiece format", () => {
    const idea = {
      title: "5款提升工作效率的神器",
      brief: "介绍5款帮助职场人士提升工作效率的工具，包括AI助手、时间管理应用等。",
      contentType: "产品介绍",
      targetPlatform: "xiaohongshu",
      estimatedWordCount: 800,
      keywords: ["效率", "工具", "职场"],
      reason: "结合目标受众（职场人士）和常见话题（效率提升）",
      sourceUrl: "https://example.com/article",
    };

    const result = ideaToContentPiece(idea, "project-123");

    expect(result.projectId).toBe("project-123");
    expect(result.title).toBe(idea.title);
    expect(result.type).toBe(idea.contentType);
    expect(result.status).toBe("genie_draft");
    const brief = JSON.parse(result.brief);
    expect(brief.topic).toBe(idea.title);
    expect(brief.platforms).toEqual(["xiaohongshu"]);
    expect(brief.notes).toContain("800");
    expect(brief.context.idea.keywords).toEqual(["效率", "工具", "职场"]);
    expect(brief.context.insights.sourceUrls).toEqual(["https://example.com/article"]);
  });

  it("should include all metadata in structured brief context", () => {
    const idea = {
      title: "Test",
      brief: "Test brief",
      contentType: "教程",
      targetPlatform: "wechat",
      estimatedWordCount: 1500,
      keywords: ["test", "keyword"],
      reason: "Test reason",
    };

    const result = ideaToContentPiece(idea, "project-123");
    const brief = JSON.parse(result.brief);

    expect(brief.platforms).toEqual(["wechat"]);
    expect(brief.notes).toContain("目标平台：wechat");
    expect(brief.context.project.projectId).toBe("project-123");
    expect(brief.context.idea.estimatedWordCount).toBe(1500);
    expect(brief.context.idea.keywords).toEqual(["test", "keyword"]);
    expect(brief.context.idea.reason).toBe("Test reason");
  });
});

describe("ideasToContentPieces", () => {
  it("should convert multiple ideas to ContentPieces", () => {
    const ideas = [
      {
        title: "Idea 1",
        brief: "Brief 1",
        contentType: "产品介绍",
        targetPlatform: "wechat",
        estimatedWordCount: 1500,
        keywords: ["k1"],
        reason: "Reason 1",
      },
      {
        title: "Idea 2",
        brief: "Brief 2",
        contentType: "教程",
        targetPlatform: "weibo",
        estimatedWordCount: 200,
        keywords: ["k2"],
        reason: "Reason 2",
      },
    ];

    const results = ideasToContentPieces(ideas, "project-123");

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe("genie_draft");
    expect(results[1].status).toBe("genie_draft");
    expect(results[0].title).toBe("Idea 1");
    expect(results[1].title).toBe("Idea 2");
  });
});

describe("generateContentIdeas", () => {
  it("should call AI API with proper prompt", async () => {
    const insights: BusinessInsights = {
      businessType: "电商",
      keyProducts: ["Product A"],
      brandTone: "专业",
      targetAudience: "职场人士",
      recurringTopics: ["效率"],
      contentThemes: ["教程"],
      suggestedContentTypes: ["产品介绍"],
    };

    // Mock successful AI response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify([
                {
                  title: "Test Idea",
                  brief: "Test Brief",
                  contentType: "产品介绍",
                  targetPlatform: "wechat",
                  estimatedWordCount: 1500,
                  keywords: ["test"],
                  reason: "Test reason",
                },
              ]),
            },
          },
        ],
      }),
    });

    const result = await generateContentIdeas(insights, { count: 3 });

    expect(result.ideas).toHaveLength(1);
    expect(result.ideas[0].title).toBe("Test Idea");
    expect(result.sourceCount).toBe(1);
  });
});
