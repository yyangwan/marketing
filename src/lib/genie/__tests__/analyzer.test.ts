/**
 * Genie Analyzer Tests
 */

import { describe, it, expect, vi } from "vitest";
import {
  analyzeContent,
  mergeAnalyses,
  parseAIResponse,
  type BusinessInsights,
  type AnalysisResult,
} from "../analyzer";

// Mock fetch
global.fetch = vi.fn();

describe("parseAIResponse", () => {
  it("should parse valid JSON response", () => {
    const json = JSON.stringify({
      businessType: "电商",
      keyProducts: ["Product A", "Product B"],
      brandTone: "专业",
      targetAudience: "职场人士",
      recurringTopics: ["效率提升", "行业趋势"],
      contentThemes: ["教程", "案例研究"],
      suggestedContentTypes: ["产品介绍", "使用教程"],
    });

    const result = parseAIResponse(json);

    expect(result.businessType).toBe("电商");
    expect(result.keyProducts).toEqual(["Product A", "Product B"]);
    expect(result.brandTone).toBe("专业");
  });

  it("should handle JSON in markdown code block", () => {
    const response = `\`\`\`json
{
  "businessType": "SaaS",
  "keyProducts": ["Software X"],
  "brandTone": "科技感",
  "targetAudience": "企业主",
  "recurringTopics": ["数字化转型"],
  "contentThemes": ["技术分享"],
  "suggestedContentTypes": ["白皮书"]
}
\`\`\``;

    const result = parseAIResponse(response);
    expect(result.businessType).toBe("SaaS");
  });

  it("should throw on missing required field", () => {
    const json = JSON.stringify({
      businessType: "电商",
      // Missing other required fields
    });

    expect(() => parseAIResponse(json)).toThrow();
  });
});

describe("mergeAnalyses", () => {
  it("should return single analysis unchanged", () => {
    const analysis: AnalysisResult = {
      url: "https://example.com",
      insights: {
        businessType: "电商",
        keyProducts: ["Product A"],
        brandTone: "专业",
        targetAudience: "职场人士",
        recurringTopics: ["效率"],
        contentThemes: ["教程"],
        suggestedContentTypes: ["产品介绍"],
      },
      confidence: 0.8,
      analyzedAt: new Date(),
      sampleContent: "...",
    };

    const result = mergeAnalyses([analysis]);
    expect(result).toEqual(analysis.insights);
  });

  it("should merge multiple analyses by taking most common values", () => {
    const analysis1: AnalysisResult = {
      url: "https://example.com/1",
      insights: {
        businessType: "电商",
        keyProducts: ["Product A", "Product B"],
        brandTone: "专业",
        targetAudience: "职场人士",
        recurringTopics: ["话题1", "话题2"],
        contentThemes: ["主题1"],
        suggestedContentTypes: ["类型1"],
      },
      confidence: 0.8,
      analyzedAt: new Date(),
      sampleContent: "...",
    };

    const analysis2: AnalysisResult = {
      url: "https://example.com/2",
      insights: {
        businessType: "电商",
        keyProducts: ["Product C", "Product D"],
        brandTone: "亲切",
        targetAudience: "宝妈",
        recurringTopics: ["话题1", "话题3"],
        contentThemes: ["主题2"],
        suggestedContentTypes: ["类型2"],
      },
      confidence: 0.7,
      analyzedAt: new Date(),
      sampleContent: "...",
    };

    const result = mergeAnalyses([analysis1, analysis2]);

    // Most common businessType
    expect(result.businessType).toBe("电商");

    // All unique products
    expect(result.keyProducts).toHaveLength(4);

    // Should pick one of the tones
    expect(["专业", "亲切"]).toContain(result.brandTone);
  });
});
