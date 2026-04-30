/**
 * Local Quality Metrics
 *
 * Instant quality metrics computed locally without AI:
 * - Vocabulary diversity (unique word ratio)
 * - Sentence complexity (average clause length)
 * - Consistency score (style variance)
 * - Format quality (paragraphs, lists, headers)
 *
 * These metrics provide immediate feedback while AI assessment runs in background.
 */

import type { LocalQualityMetrics } from "@/types";
import { calculateReadability } from "./readability";
import { extractHeadings, extractParagraphs } from "./structure";

/**
 * Calculate vocabulary diversity
 * Ratio of unique words to total words (0-1)
 * Higher values indicate more varied vocabulary
 */
export function calculateVocabularyDiversity(text: string): number {
  // Remove HTML tags
  const cleanText = text.replace(/<[^>]*>/g, "").toLowerCase();

  // Extract words
  const chineseChars = cleanText.match(/[\u4e00-\u9fa5]/g) || [];
  const englishWords = cleanText.match(/[a-z]{3,}/g) || [];

  // For Chinese, count unique characters
  const uniqueChinese = new Set(chineseChars).size;
  const totalChinese = chineseChars.length;

  // For English, count unique words (excluding common stop words)
  const STOP_WORDS = new Set([
    "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
    "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
  ]);

  const filteredEnglish = englishWords.filter((w) => !STOP_WORDS.has(w));
  const uniqueEnglish = new Set(filteredEnglish).size;
  const totalEnglish = filteredEnglish.length;

  // Calculate diversity for each language
  const zhDiversity = totalChinese > 0 ? uniqueChinese / Math.min(totalChinese, 1000) : 0;
  const enDiversity = totalEnglish > 0 ? uniqueEnglish / totalEnglish : 0;

  // Weight by language presence
  const totalTokens = totalChinese + totalEnglish;
  if (totalTokens === 0) return 0.5;

  const zhWeight = totalChinese / totalTokens;
  const enWeight = totalEnglish / totalTokens;

  return zhDiversity * zhWeight + enDiversity * enWeight;
}

/**
 * Calculate sentence complexity
 * Average words per sentence (normalized to 0-1)
 * Too simple or too complex both score lower
 */
export function calculateSentenceComplexity(text: string): number {
  // Remove HTML tags
  const cleanText = text.replace(/<[^>]*>/g, "");

  // Split into sentences
  const sentences = cleanText.split(/[.!?。！？]+/).filter((s) => s.trim().length > 0);
  if (sentences.length === 0) return 0.5;

  // Count words in each sentence
  const lengths = sentences.map((s) => {
    const chineseChars = (s.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = s.split(/\s+/).filter((w) => w.length > 0 && w.match(/^[a-zA-Z]+$/)).length;
    return chineseChars + englishWords;
  });

  const avgLength = lengths.reduce((sum, len) => sum + len, 0) / lengths.length;

  // Ideal range: 15-25 words/sentence (for mixed content)
  // Score higher for being in this range
  const idealMin = 15;
  const idealMax = 25;

  if (avgLength < idealMin) {
    // Too simple - penalize
    return Math.max(0, 1 - (idealMin - avgLength) / idealMin);
  } else if (avgLength > idealMax) {
    // Too complex - penalize
    return Math.max(0, 1 - (avgLength - idealMax) / idealMax);
  } else {
    // In ideal range - full score
    return 1;
  }
}

/**
 * Calculate consistency score
 * Measures variance in writing style (0-1)
 * Higher is more consistent
 */
export function calculateConsistencyScore(text: string): number {
  // Remove HTML tags
  const cleanText = text.replace(/<[^>]*>/g, "");

  // Split into paragraphs
  const paragraphs = cleanText.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  if (paragraphs.length < 2) return 1; // Single paragraph is consistent

  // Calculate metrics for each paragraph
  const metrics = paragraphs.map((p) => {
    const sentences = p.split(/[.!?。！？]+/).filter((s) => s.trim().length > 0);
    const sentenceCount = sentences.length || 1;

    const chineseChars = (p.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = p.split(/\s+/).filter((w) => w.length > 0 && w.match(/^[a-zA-Z]+$/)).length;
    const wordCount = chineseChars + englishWords;

    return {
      avgSentenceLength: wordCount / sentenceCount,
      wordCount,
    };
  });

  // Calculate variance
  const avgLengths = metrics.map((m) => m.avgSentenceLength);
  const meanAvgLength = avgLengths.reduce((sum, val) => sum + val, 0) / avgLengths.length;
  const variance = avgLengths.reduce((sum, val) => sum + Math.pow(val - meanAvgLength, 2), 0) / avgLengths.length;

  // Normalize: lower variance = higher consistency
  // Typical standard deviation for consistent writing is 5-10 words
  const maxAcceptableVariance = 100; // ~10 words SD squared
  return Math.max(0, 1 - variance / maxAcceptableVariance);
}

/**
 * Calculate format quality score
 * Checks for proper formatting (0-1)
 */
export function calculateFormatQuality(text: string): number {
  // Handle empty text - return neutral score
  if (!text || text.trim().length === 0) {
    return 0.5;
  }

  let score = 0;
  let maxScore = 0;

  // Check for headings (20 points)
  maxScore += 20;
  const headings = extractHeadings(text);
  if (headings.length > 0) {
    score += 10;
    if (headings.some((h) => h.level === 1)) score += 10;
  }

  // Check for paragraph structure (30 points)
  maxScore += 30;
  const paragraphs = extractParagraphs(text);
  if (paragraphs.length >= 2) {
    score += 15;
    // Check for varied paragraph lengths (not all identical)
    const lengths = paragraphs.map((p) => p.wordCount);
    const uniqueLengths = new Set(lengths).size;
    if (uniqueLengths > lengths.length / 2) score += 15;
  }

  // Check for lists (20 points)
  maxScore += 20;
  const hasLists = /<[ou]l[^>]*>/i.test(text);
  if (hasLists) score += 20;

  // Check for formatting elements (30 points)
  maxScore += 30;
  const hasBold = /<strong[^>]*>|<b[^>]*>/i.test(text);
  const hasItalic = /<em[^>]*>|<i[^>]*>/i.test(text);
  const hasLinks = /<a[^>]*>/i.test(text);

  if (hasBold) score += 10;
  if (hasItalic) score += 10;
  if (hasLinks) score += 10;

  return maxScore > 0 ? score / maxScore : 0.5;
}

/**
 * Calculate all local quality metrics
 */
export function calculateLocalMetrics(text: string): LocalQualityMetrics {
  // Handle empty text - return neutral scores
  if (!text || text.trim().length === 0) {
    return {
      readabilityScore: 50,
      vocabularyDiversity: 0.5,
      sentenceComplexity: 0.5,
      consistencyScore: 1,
    };
  }

  // Get readability score
  const readability = calculateReadability(text);
  const readabilityScore = "score" in readability ? readability.score : 50;

  return {
    readabilityScore,
    vocabularyDiversity: calculateVocabularyDiversity(text),
    sentenceComplexity: calculateSentenceComplexity(text),
    consistencyScore: calculateConsistencyScore(text),
  };
}

/**
 * Calculate overall local quality score (0-100)
 * Combines all metrics with weights
 */
export function calculateOverallLocalQuality(text: string): number {
  const metrics = calculateLocalMetrics(text);
  const formatQuality = calculateFormatQuality(text);

  // Weighted average
  const weights = {
    readability: 0.3,
    vocabulary: 0.2,
    complexity: 0.2,
    consistency: 0.15,
    format: 0.15,
  };

  const score =
    metrics.readabilityScore * weights.readability +
    metrics.vocabularyDiversity * 100 * weights.vocabulary +
    metrics.sentenceComplexity * 100 * weights.complexity +
    metrics.consistencyScore * 100 * weights.consistency +
    formatQuality * 100 * weights.format;

  return Math.round(score);
}

/**
 * Get quality suggestions based on local metrics
 */
export function getLocalQualitySuggestions(metrics: LocalQualityMetrics): string[] {
  const suggestions: string[] = [];

  // Readability
  if (metrics.readabilityScore < 50) {
    suggestions.push("可读性评分较低，建议使用更简单的词汇和更短的句子");
  } else if (metrics.readabilityScore > 90) {
    suggestions.push("内容过于简单，可能缺少深度，建议增加专业词汇和复杂句式");
  }

  // Vocabulary diversity
  if (metrics.vocabularyDiversity < 0.3) {
    suggestions.push("词汇多样性较低，建议使用更多样的词汇表达");
  }

  // Sentence complexity
  if (metrics.sentenceComplexity < 0.4) {
    suggestions.push("句子过于简单或过于复杂，建议调整句子长度使其更易读");
  }

  // Consistency
  if (metrics.consistencyScore < 0.5) {
    suggestions.push("写作风格不够一致，建议统一段落长度和句子结构");
  }

  return suggestions;
}
