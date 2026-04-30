/**
 * Platform Analyzer Tests
 */

import { describe, it, expect } from "vitest";
import { analyzeForPlatform } from "../platform-analyzer";

describe("Platform Analyzer", () => {
  const sampleContent = `
    <h1>如何提升团队协作效率</h1>
    <p>在当今数字化快速发展的时代，企业面临的竞争日益激烈。如何在这个充满挑战的环境中脱颖而出，成为每个企业管理者需要思考的核心问题。</p>
    <p>首先，我们需要认识到创新不仅仅是技术层面的突破，更是思维方式的革新。企业需要建立鼓励创新的内部机制，让每一位员工都能成为创新的参与者。</p>
    <p>其次，客户体验的提升是推动业务增长的关键因素。通过深入了解客户需求，提供个性化的服务和产品，可以有效提升客户满意度和忠诚度。</p>
  `;

  describe("WeChat Analysis", () => {
    it("should analyze content for WeChat platform", () => {
      const result = analyzeForPlatform(sampleContent, "wechat");

      expect(result).toHaveProperty("score");
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);

      expect(result).toHaveProperty("checks");
      expect(result.checks).toHaveProperty("contentLength");
      expect(result.checks).toHaveProperty("title");
      expect(result.checks).toHaveProperty("seo");
      expect(result.checks).toHaveProperty("format");

      expect(result).toHaveProperty("suggestions");
      expect(Array.isArray(result.suggestions)).toBe(true);

      expect(result).toHaveProperty("rules");
      expect(result.rules.platform).toBe("wechat");
    });

    it("should detect short content for WeChat", () => {
      const result = analyzeForPlatform(sampleContent, "wechat");
      // Sample content is ~200 chars, below WeChat's ideal 1500-2500 range
      expect(result.checks.contentLength.passed).toBe(false);
      expect(result.checks.contentLength.score).toBeLessThan(70);
    });

    it("should require title for WeChat", () => {
      const result = analyzeForPlatform(sampleContent, "wechat");
      expect(result.checks.title.passed).toBe(true); // Has H1
    });
  });

  describe("Weibo Analysis", () => {
    it("should analyze content for Weibo platform", () => {
      const result = analyzeForPlatform(sampleContent, "weibo");

      expect(result).toHaveProperty("score");
      expect(result.rules.platform).toBe("weibo");
    });

    it("should not require title for Weibo", () => {
      const noTitleContent = "<p>简短微博内容</p>";
      const result = analyzeForPlatform(noTitleContent, "weibo");
      expect(result.checks.title.passed).toBe(true);
    });
  });

  describe("Xiaohongshu Analysis", () => {
    it("should analyze content for Xiaohongshu platform", () => {
      const result = analyzeForPlatform(sampleContent, "xiaohongshu");
      expect(result.rules.platform).toBe("xiaohongshu");
    });
  });

  describe("Douyin Analysis", () => {
    it("should analyze content for Douyin platform", () => {
      const result = analyzeForPlatform(sampleContent, "douyin");
      expect(result.rules.platform).toBe("douyin");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty content", () => {
      const result = analyzeForPlatform("", "wechat");
      expect(result.score).toBeLessThan(100);
      expect(result.checks.contentLength.passed).toBe(false);
    });

    it("should handle content without title", () => {
      const noTitleContent = "<p>Content without heading</p>";
      const result = analyzeForPlatform(noTitleContent, "wechat");
      expect(result.checks.title.passed).toBe(false);
    });
  });
});
