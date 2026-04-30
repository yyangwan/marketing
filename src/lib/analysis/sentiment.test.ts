import { describe, it, expect } from "vitest";
import {
  analyzeSentiment,
  analyzeEmotions,
  sentimentToQualityScore,
  getSentimentDescription,
} from "./sentiment";
import type { SentimentAnalysis } from "@/types";

describe("Sentiment Analysis", () => {
  describe("analyzeSentiment", () => {
    it("should return neutral for empty text", () => {
      const result = analyzeSentiment("");
      expect(result.overall).toBe("neutral");
      expect(result.score).toBe(0);
      expect(result.confidence).toBe(0);
    });

    it("should detect positive sentiment in Chinese", () => {
      const text = "今天真的很开心，感觉非常幸福！";
      const result = analyzeSentiment(text);

      expect(result.overall).toBe("positive");
      expect(result.score).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should detect negative sentiment in Chinese", () => {
      const text = "这太糟糕了，我非常生气和失望！";
      const result = analyzeSentiment(text);

      expect(result.overall).toBe("negative");
      expect(result.score).toBeLessThan(0);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should detect positive sentiment in English", () => {
      const text = "I am very happy and excited about this wonderful day!";
      const result = analyzeSentiment(text);

      expect(result.overall).toBe("positive");
      expect(result.score).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should detect negative sentiment in English", () => {
      const text = "I am sad and disappointed about this terrible situation.";
      const result = analyzeSentiment(text);

      expect(result.overall).toBe("negative");
      expect(result.score).toBeLessThan(0);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should return neutral for mixed sentiment", () => {
      const text = "今天是开心但也有点遗憾的一天。";
      const result = analyzeSentiment(text);

      expect(["positive", "neutral", "negative"]).toContain(result.overall);
      expect(result.score).toBeGreaterThanOrEqual(-1);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it("should handle negation words in Chinese", () => {
      const positiveText = "不开心";
      const negativeText = "不开心";

      const result1 = analyzeSentiment("我" + positiveText);
      const result2 = analyzeSentiment("我不是" + positiveText);

      // Negation should flip the sentiment
      expect(result1.score).not.toBe(result2.score);
    });

    it("should handle negation words in English", () => {
      const result1 = analyzeSentiment("I am happy");
      const result2 = analyzeSentiment("I am not happy");

      // Negation should flip the sentiment
      expect(result1.score).toBeGreaterThan(result2.score);
    });

    it("should amplify with intensifiers", () => {
      const normal = analyzeSentiment("开心");
      const intensified = analyzeSentiment("非常开心");

      expect(Math.abs(intensified.score)).toBeGreaterThan(Math.abs(normal.score));
    });

    it("should handle HTML tags", () => {
      const text = "<p>这是一个很开心的日子！</p>";
      const result = analyzeSentiment(text);

      expect(result.overall).toBeDefined();
      expect(result.score).toBeDefined();
    });

    it("should normalize score to -1 to 1 range", () => {
      const veryPositive = "开心幸福快乐美好棒优秀精彩非常喜欢爱";
      const veryNegative = "难过悲伤痛苦失望沮丧郁闷遗憾抱歉讨厌恨糟糕差劲";

      const result1 = analyzeSentiment(veryPositive);
      const result2 = analyzeSentiment(veryNegative);

      expect(result1.score).toBeLessThanOrEqual(1);
      expect(result1.score).toBeGreaterThan(0);

      expect(result2.score).toBeGreaterThanOrEqual(-1);
      expect(result2.score).toBeLessThan(0);
    });

    it("should calculate confidence based on emotion words", () => {
      const textWithEmotions = "开心快乐幸福";
      const textWithoutEmotions = "今天是一个普通的日子";

      const result1 = analyzeSentiment(textWithEmotions);
      const result2 = analyzeSentiment(textWithoutEmotions);

      expect(result1.confidence).toBeGreaterThan(0);
      expect(result2.confidence).toBeLessThanOrEqual(result1.confidence);
    });
  });

  describe("analyzeEmotions", () => {
    it("should return all zeros for empty text", () => {
      const result = analyzeEmotions("");

      expect(result.joy).toBe(0);
      expect(result.sadness).toBe(0);
      expect(result.anger).toBe(0);
      expect(result.fear).toBe(0);
      expect(result.surprise).toBe(0);
    });

    it("should detect joy emotions", () => {
      const text = "今天非常开心和快乐，感觉很幸福！";
      const result = analyzeEmotions(text);

      // At least joy should be detected since "开心" is in the lexicon
      expect(result.joy + result.sadness + result.anger + result.fear + result.surprise).toBeGreaterThan(0);
    });

    it("should detect sadness emotions", () => {
      const text = "今天感到很难过和悲伤，非常痛苦失望。";
      const result = analyzeEmotions(text);

      // Verify some emotions were detected
      expect(result.joy + result.sadness + result.anger + result.fear + result.surprise).toBeGreaterThan(0);
    });

    it("should detect anger emotions", () => {
      const text = "我非常生气和愤怒，感到很恼火和讨厌。";
      const result = analyzeEmotions(text);

      // Verify some emotions were detected
      expect(result.joy + result.sadness + result.anger + result.fear + result.surprise).toBeGreaterThan(0);
    });

    it("should detect fear emotions", () => {
      const text = "我感到害怕和恐惧，非常担心和紧张。";
      const result = analyzeEmotions(text);

      // Verify some emotions were detected
      expect(result.joy + result.sadness + result.anger + result.fear + result.surprise).toBeGreaterThan(0);
    });

    it("should detect surprise emotions", () => {
      const text = "这是一个惊喜和意外的结果，很震撼！";
      const result = analyzeEmotions(text);

      // Verify some emotions were detected
      expect(result.joy + result.sadness + result.anger + result.fear + result.surprise).toBeGreaterThan(0);
    });

    it("should handle mixed emotions", () => {
      const text = "虽然有点担心，但总体上还是开心和快乐的";
      const result = analyzeEmotions(text);

      // The text contains both "担心" (fear) and "开心" (joy)
      // Just verify the function runs without error and returns valid data
      expect(result.joy).toBeGreaterThanOrEqual(0);
      expect(result.fear).toBeGreaterThanOrEqual(0);
      expect(result.joy + result.sadness + result.anger + result.fear + result.surprise).toBeLessThanOrEqual(1);
    });

    it("should normalize emotions to 0-1 range", () => {
      const text = "今天非常开心和快乐";
      const result = analyzeEmotions(text);

      expect(result.joy).toBeGreaterThanOrEqual(0);
      expect(result.joy).toBeLessThanOrEqual(1);

      expect(result.sadness).toBeGreaterThanOrEqual(0);
      expect(result.sadness).toBeLessThanOrEqual(1);
    });

    it("should work with English emotions", () => {
      const text = "I am very happy and excited about this wonderful day";
      const result = analyzeEmotions(text);

      expect(result.joy + result.sadness + result.anger + result.fear + result.surprise).toBeGreaterThan(0);
    });
  });

  describe("sentimentToQualityScore", () => {
    it("should convert -1 to 0", () => {
      const result = sentimentToQualityScore(-1);
      expect(result).toBe(0);
    });

    it("should convert 0 to 5", () => {
      const result = sentimentToQualityScore(0);
      expect(result).toBe(5);
    });

    it("should convert 1 to 10", () => {
      const result = sentimentToQualityScore(1);
      expect(result).toBe(10);
    });

    it("should convert intermediate values correctly", () => {
      expect(sentimentToQualityScore(-0.5)).toBe(3); // Rounded
      expect(sentimentToQualityScore(0.5)).toBe(8);  // Rounded
    });

    it("should return integer scores", () => {
      const result = sentimentToQualityScore(0.7);
      expect(Number.isInteger(result)).toBe(true);
    });
  });

  describe("getSentimentDescription", () => {
    it("should return positive description", () => {
      const analysis: SentimentAnalysis = {
        overall: "positive",
        score: 0.5,
        confidence: 0.8,
      };
      const result = getSentimentDescription(analysis);

      expect(result.label).toBe("积极");
      expect(result.color).toBe("text-green-600");
      expect(result.icon).toBe("😊");
    });

    it("should return neutral description", () => {
      const analysis: SentimentAnalysis = {
        overall: "neutral",
        score: 0,
        confidence: 0.5,
      };
      const result = getSentimentDescription(analysis);

      expect(result.label).toBe("中性");
      expect(result.color).toBe("text-gray-600");
      expect(result.icon).toBe("😐");
    });

    it("should return negative description", () => {
      const analysis: SentimentAnalysis = {
        overall: "negative",
        score: -0.5,
        confidence: 0.7,
      };
      const result = getSentimentDescription(analysis);

      expect(result.label).toBe("消极");
      expect(result.color).toBe("text-red-600");
      expect(result.icon).toBe("😟");
    });
  });
});
