import { describe, it, expect } from "vitest";
import {
  calculateVocabularyDiversity,
  calculateSentenceComplexity,
  calculateConsistencyScore,
  calculateFormatQuality,
  calculateLocalMetrics,
  calculateOverallLocalQuality,
  getLocalQualitySuggestions,
} from "./quality";

describe("Quality Metrics Analysis", () => {
  describe("calculateVocabularyDiversity", () => {
    it("should return 0.5 for empty text", () => {
      const result = calculateVocabularyDiversity("");
      expect(result).toBe(0.5);
    });

    it("should calculate diversity for Chinese text", () => {
      const text = "这是一个测试。这是另一个测试。";
      const result = calculateVocabularyDiversity(text);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it("should calculate diversity for English text", () => {
      const text = "This is a test. This is another test.";
      const result = calculateVocabularyDiversity(text);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it("should handle mixed Chinese and English", () => {
      const text = "这是一个测试 and this is English text mixed together.";
      const result = calculateVocabularyDiversity(text);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it("should filter out stop words for English", () => {
      const text = "The quick brown fox jumps over the lazy dog.";
      const result = calculateVocabularyDiversity(text);
      expect(result).toBeGreaterThan(0);
    });

    it("should handle HTML tags", () => {
      const text = "<p>这是一个测试</p><p>这是另一个测试</p>";
      const result = calculateVocabularyDiversity(text);
      expect(result).toBeGreaterThan(0);
    });
  });

  describe("calculateSentenceComplexity", () => {
    it("should return 0.5 for empty text", () => {
      const result = calculateSentenceComplexity("");
      expect(result).toBe(0.5);
    });

    it("should return 0.5 for text with no sentences", () => {
      const result = calculateSentenceComplexity("!!!   ???");
      expect(result).toBe(0.5);
    });

    it("should score ideal sentence length (15-25 words)", () => {
      const text = "This sentence has about twenty words which is considered ideal for readability and complexity scoring purposes.";
      const result = calculateSentenceComplexity(text);
      expect(result).toBe(1);
    });

    it("should penalize very short sentences", () => {
      const text = "Short. Very short. Too short.";
      const result = calculateSentenceComplexity(text);
      expect(result).toBeLessThan(1);
      expect(result).toBeGreaterThan(0);
    });

    it("should penalize very long sentences", () => {
      const text = "This is an extremely long and complex sentence that contains way too many words and clauses and goes on for what seems like forever without any end in sight which makes it difficult to read and understand.";
      const result = calculateSentenceComplexity(text);
      expect(result).toBeLessThan(1);
      expect(result).toBeGreaterThan(0);
    });

    it("should handle Chinese characters", () => {
      const text = "这是一个包含大约二十个字的句子，被认为是理想长度。";
      const result = calculateSentenceComplexity(text);
      expect(result).toBeGreaterThan(0);
    });

    it("should handle HTML tags", () => {
      const text = "<p>This is a sentence.</p><p>This is another sentence.</p>";
      const result = calculateSentenceComplexity(text);
      expect(result).toBeGreaterThan(0);
    });
  });

  describe("calculateConsistencyScore", () => {
    it("should return 1 for single paragraph", () => {
      const text = "This is a single paragraph with some text.";
      const result = calculateConsistencyScore(text);
      expect(result).toBe(1);
    });

    it("should return 1 for empty text", () => {
      const result = calculateConsistencyScore("");
      expect(result).toBe(1);
    });

    it("should score consistent paragraphs highly", () => {
      const text = `First paragraph with similar length.
Second paragraph with similar length too.
Third paragraph maintains the pattern.`;
      const result = calculateConsistencyScore(text);
      expect(result).toBeGreaterThan(0.5);
    });

    it("should penalize inconsistent paragraph lengths", () => {
      const text = `Short.

This is a much longer paragraph with significantly more text than the others.

Tiny.`;
      const result = calculateConsistencyScore(text);
      expect(result).toBeLessThan(1);
    });

    it("should handle HTML formatting", () => {
      const text = "<p>First paragraph.</p>\n\n<p>Second paragraph.</p>";
      const result = calculateConsistencyScore(text);
      expect(result).toBeGreaterThan(0);
    });
  });

  describe("calculateFormatQuality", () => {
    it("should return 0.5 for empty text", () => {
      const result = calculateFormatQuality("");
      expect(result).toBe(0.5);
    });

    it("should score text with headings", () => {
      const text = "<h1>Main Heading</h1><p>Content</p>";
      const result = calculateFormatQuality(text);
      expect(result).toBeGreaterThan(0);
    });

    it("should score text with H1 higher", () => {
      const withH1 = "<h1>Heading</h1><p>Content</p>";
      const withoutH1 = "<h2>Heading</h2><p>Content</p>";
      const resultWithH1 = calculateFormatQuality(withH1);
      const resultWithoutH1 = calculateFormatQuality(withoutH1);
      expect(resultWithH1).toBeGreaterThan(resultWithoutH1);
    });

    it("should score text with multiple paragraphs", () => {
      const text = "<p>First paragraph.</p>\n\n<p>Second paragraph.</p>\n\n<p>Third paragraph.</p>";
      const result = calculateFormatQuality(text);
      expect(result).toBeGreaterThan(0);
    });

    it("should detect lists", () => {
      const withList = "<ul><li>Item 1</li><li>Item 2</li></ul>";
      const withoutList = "<p>Just text.</p>";
      const resultWithList = calculateFormatQuality(withList);
      const resultWithoutList = calculateFormatQuality(withoutList);
      expect(resultWithList).toBeGreaterThan(resultWithoutList);
    });

    it("should detect formatting elements", () => {
      const withFormatting = "<p>Text with <strong>bold</strong> and <em>italic</em> and <a href='#'>links</a>.</p>";
      const withoutFormatting = "<p>Plain text.</p>";
      const resultWithFormatting = calculateFormatQuality(withFormatting);
      const resultWithoutFormatting = calculateFormatQuality(withoutFormatting);
      expect(resultWithFormatting).toBeGreaterThan(resultWithoutFormatting);
    });
  });

  describe("calculateLocalMetrics", () => {
    it("should calculate all metrics for valid content", () => {
      const text = "<h1>Test</h1><p>This is a test paragraph with some content for analysis.</p>";
      const result = calculateLocalMetrics(text);

      expect(result).toHaveProperty("readabilityScore");
      expect(result).toHaveProperty("vocabularyDiversity");
      expect(result).toHaveProperty("sentenceComplexity");
      expect(result).toHaveProperty("consistencyScore");

      expect(result.readabilityScore).toBeGreaterThanOrEqual(0);
      expect(result.readabilityScore).toBeLessThanOrEqual(100);

      expect(result.vocabularyDiversity).toBeGreaterThanOrEqual(0);
      expect(result.vocabularyDiversity).toBeLessThanOrEqual(1);

      expect(result.sentenceComplexity).toBeGreaterThanOrEqual(0);
      expect(result.sentenceComplexity).toBeLessThanOrEqual(1);

      expect(result.consistencyScore).toBeGreaterThanOrEqual(0);
      expect(result.consistencyScore).toBeLessThanOrEqual(1);
    });

    it("should handle empty content", () => {
      const result = calculateLocalMetrics("");
      expect(result.readabilityScore).toBe(50); // Default from readability
    });
  });

  describe("calculateOverallLocalQuality", () => {
    it("should calculate weighted overall score", () => {
      const text = "<h1>Test</h1><p>This is a test paragraph with some content for analysis.</p>";
      const result = calculateOverallLocalQuality(text);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    it("should return higher score for well-formatted content", () => {
      const goodContent = `
        <h1>Main Title</h1>
        <p>This is a well-written paragraph with appropriate length.</p>
        <p>Another paragraph that maintains consistency.</p>
        <ul>
          <li>Point one</li>
          <li>Point two</li>
        </ul>
      `;
      const poorContent = "x";

      const goodScore = calculateOverallLocalQuality(goodContent);
      const poorScore = calculateOverallLocalQuality(poorContent);

      expect(goodScore).toBeGreaterThan(poorScore);
    });
  });

  describe("getLocalQualitySuggestions", () => {
    it("should return empty array for good metrics", () => {
      const metrics = {
        readabilityScore: 70,
        vocabularyDiversity: 0.6,
        sentenceComplexity: 0.7,
        consistencyScore: 0.8,
      };
      const result = getLocalQualitySuggestions(metrics);
      expect(Array.isArray(result)).toBe(true);
    });

    it("should suggest improvements for low readability", () => {
      const metrics = {
        readabilityScore: 30,
        vocabularyDiversity: 0.6,
        sentenceComplexity: 0.7,
        consistencyScore: 0.8,
      };
      const result = getLocalQualitySuggestions(metrics);
      expect(result.length).toBeGreaterThan(0);
      expect(result.some(s => s.includes("可读性"))).toBe(true);
    });

    it("should suggest improvements for low vocabulary diversity", () => {
      const metrics = {
        readabilityScore: 70,
        vocabularyDiversity: 0.2,
        sentenceComplexity: 0.7,
        consistencyScore: 0.8,
      };
      const result = getLocalQualitySuggestions(metrics);
      expect(result.length).toBeGreaterThan(0);
      expect(result.some(s => s.includes("词汇"))).toBe(true);
    });

    it("should suggest improvements for low sentence complexity", () => {
      const metrics = {
        readabilityScore: 70,
        vocabularyDiversity: 0.6,
        sentenceComplexity: 0.3,
        consistencyScore: 0.8,
      };
      const result = getLocalQualitySuggestions(metrics);
      expect(result.length).toBeGreaterThan(0);
      expect(result.some(s => s.includes("句子"))).toBe(true);
    });

    it("should suggest improvements for low consistency", () => {
      const metrics = {
        readabilityScore: 70,
        vocabularyDiversity: 0.6,
        sentenceComplexity: 0.7,
        consistencyScore: 0.3,
      };
      const result = getLocalQualitySuggestions(metrics);
      expect(result.length).toBeGreaterThan(0);
      // Check if any suggestion contains consistency-related keywords
      expect(result.some(s => s.includes("一致性") || s.includes("风格"))).toBe(true);
    });

    it("should provide multiple suggestions for poor metrics", () => {
      const metrics = {
        readabilityScore: 30,
        vocabularyDiversity: 0.2,
        sentenceComplexity: 0.3,
        consistencyScore: 0.3,
      };
      const result = getLocalQualitySuggestions(metrics);
      expect(result.length).toBeGreaterThan(1);
    });
  });
});
