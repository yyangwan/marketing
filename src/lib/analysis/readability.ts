/**
 * Readability Analysis Utilities
 *
 * Provides readability scoring including:
 * - Flesch Reading Ease score
 * - Flesch-Kincaid Grade Level
 * - Average sentence length
 * - Average syllables per word
 * - Chinese text complexity analysis
 */

import type { ReadabilityLevel } from "@/types";

/**
 * Flesch Reading Ease Score
 * Formula: 206.835 - (1.015 × ASL) - (84.6 × ASW)
 * ASL = Average Sentence Length (words per sentence)
 * ASW = Average Syllables per Word
 *
 * Score Interpretation:
 * - 90-100: Very Easy (5th grade)
 * - 80-89: Easy (6th grade)
 * - 70-79: Fairly Easy (7th grade)
 * - 60-69: Standard (8th-9th grade)
 * - 50-59: Fairly Difficult (10th-12th grade)
 * - 30-49: Difficult (College)
 * - 0-29: Very Difficult (Professional)
 */

export interface ReadabilityResult {
  score: number;  // 0-100
  level: ReadabilityLevel;
  averageSentenceLength: number;
  averageSyllablesPerWord: number;
  sentenceCount: number;
  wordCount: number;
  syllableCount: number;
  longSentences: number;  // Number of sentences with >30 words
}

/**
 * Count syllables in an English word
 */
function countSyllables(word: string): number {
  word = word.toLowerCase();
  if (word.length <= 3) return 1;

  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  word = word.replace(/^y/, "");
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

/**
 * Calculate Flesch Reading Ease score for English text
 */
export function calculateFleschReadingEase(text: string): ReadabilityResult {
  // Remove HTML tags
  const cleanText = text.replace(/<[^>]*>/g, "");

  // Split into sentences (rough approximation)
  const sentences = cleanText.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const sentenceCount = sentences.length || 1;

  // Split into words
  const words = cleanText.split(/\s+/).filter((w) => w.length > 0 && w.match(/^[a-zA-Z]+$/));
  const wordCount = words.length || 1;

  // Count syllables
  let syllableCount = 0;
  for (const word of words) {
    syllableCount += countSyllables(word);
  }

  // Calculate averages
  const averageSentenceLength = wordCount / sentenceCount;
  const averageSyllablesPerWord = syllableCount / wordCount;

  // Count long sentences (>30 words)
  const longSentences = sentences.filter(s => {
    const wordsInSentence = s.split(/\s+/).filter(w => w.length > 0 && w.match(/^[a-zA-Z]+$/));
    return wordsInSentence.length > 30;
  }).length;

  // Flesch Reading Ease formula
  let score = 206.835 - 1.015 * averageSentenceLength - 84.6 * averageSyllablesPerWord;
  score = Math.max(0, Math.min(100, score));

  // Determine readability level
  let level: ReadabilityLevel;
  if (score >= 90) level = "easy";
  else if (score >= 70) level = "medium";
  else if (score >= 50) level = "hard";
  else level = "very-hard";

  return {
    score: Math.round(score),
    level,
    averageSentenceLength: Math.round(averageSentenceLength * 10) / 10,
    averageSyllablesPerWord: Math.round(averageSyllablesPerWord * 100) / 100,
    sentenceCount,
    wordCount,
    syllableCount,
    longSentences,
  };
}

/**
 * Calculate readability for Chinese text
 * Uses character and sentence counts as proxies
 */
export interface ChineseReadabilityResult {
  score: number;  // 0-100
  level: ReadabilityLevel;
  averageSentenceLength: number;  // characters per sentence
  sentenceCount: number;
  characterCount: number;
}

export function calculateChineseReadability(text: string): ChineseReadabilityResult {
  // Remove HTML tags
  const cleanText = text.replace(/<[^>]*>/g, "").trim();

  // Split into sentences (Chinese uses period, question mark, exclamation)
  const sentences = cleanText.split(/[。！？.?!?]/).filter((s) => s.trim().length > 0);
  const sentenceCount = sentences.length || 1;

  // Count characters (excluding spaces)
  const characters = cleanText.replace(/\s+/g, "");
  const characterCount = characters.length;

  // Average sentence length
  const averageSentenceLength = characterCount / sentenceCount;

  // Simple scoring based on sentence length
  // Shorter sentences are easier to read
  let score = 100;
  if (averageSentenceLength > 30) score -= 20;
  if (averageSentenceLength > 50) score -= 20;
  if (averageSentenceLength > 70) score -= 20;
  if (averageSentenceLength > 100) score -= 20;

  // Penalty for very short sentences (might be fragmented)
  if (averageSentenceLength < 5) score -= 10;

  score = Math.max(0, Math.min(100, score));

  let level: ReadabilityLevel;
  if (score >= 80) level = "easy";
  else if (score >= 60) level = "medium";
  else if (score >= 40) level = "hard";
  else level = "very-hard";

  return {
    score,
    level,
    averageSentenceLength: Math.round(averageSentenceLength * 10) / 10,
    sentenceCount,
    characterCount,
  };
}

/**
 * Auto-detect text language and calculate appropriate readability score
 */
export function calculateReadability(text: string): ReadabilityResult | ChineseReadabilityResult {
  // Detect if text is primarily Chinese
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const totalChars = text.replace(/\s+/g, "").length;
  const chineseRatio = totalChars > 0 ? chineseChars / totalChars : 0;

  if (chineseRatio > 0.3) {
    // Treat as Chinese text
    return calculateChineseReadability(text);
  } else {
    // Treat as English text
    return calculateFleschReadingEase(text);
  }
}

/**
 * Get readability description for display
 */
export function getReadabilityDescription(level: ReadabilityLevel, score: number): {
  label: string;
  description: string;
  color: string;
  advice: string;
} {
  const descriptions: Record<ReadabilityLevel, { label: string; description: string; color: string; advice: string }> = {
    easy: {
      label: "易读",
      description: "大多数读者都能轻松理解",
      color: "text-green-600",
      advice: "非常适合大众传播",
    },
    medium: {
      label: "中等",
      description: "需要一定的阅读能力",
      color: "text-amber-600",
      advice: "适合受过中等教育的读者",
    },
    hard: {
      label: "较难",
      description: "需要良好的阅读能力",
      color: "text-orange-600",
      advice: "适合受过高等教育的读者",
    },
    "very-hard": {
      label: "困难",
      description: "需要专业知识才能理解",
      color: "text-red-600",
      advice: "建议简化句子结构或使用通俗解释",
    },
  };

  return descriptions[level] || descriptions.medium;
}

/**
 * Analyze sentence complexity
 */
export interface SentenceComplexity {
  averageLength: number;
  maxLength: number;
  longSentences: number;  // sentences > 30 words
  complexSentences: number;  // sentences with multiple clauses
}

export function analyzeSentenceComplexity(text: string): SentenceComplexity {
  // Remove HTML tags
  const cleanText = text.replace(/<[^>]*>/g, "");

  // Split into sentences
  const sentences = cleanText.split(/[.!?。！？]+/).filter((s) => s.trim().length > 0);
  const sentenceCount = sentences.length || 1;

  const lengths = sentences.map((s) => {
    // Count words (split by spaces for English, characters for Chinese)
    const chineseChars = (s.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = s.split(/[\s]+/).filter((w) => w.length > 0 && w.match(/^[a-zA-Z]+$/)).length;
    return chineseChars + englishWords;
  });

  const totalLength = lengths.reduce((sum, len) => sum + len, 0);
  const averageLength = totalLength / sentenceCount;
  const maxLength = Math.max(...lengths, 0);
  const longSentences = lengths.filter((len) => len > 30).length;

  // Estimate complex sentences (contain commas, semicolons, etc.)
  const complexSentences = sentences.filter((s) =>
    /[,;:———\-]/.test(s) || (s.match(/[\u4e00-\u9fa5]/g) || []).length > 100
  ).length;

  return {
    averageLength: Math.round(averageLength * 10) / 10,
    maxLength,
    longSentences,
    complexSentences,
  };
}

/**
 * Get suggestions for improving readability
 */
export function getReadabilitySuggestions(
  result: ReadabilityResult | ChineseReadabilityResult
): string[] {
  const suggestions: string[] = [];

  if ("averageSentenceLength" in result) {
    const englishResult = result as ReadabilityResult;

    if (englishResult.averageSentenceLength > 25) {
      suggestions.push("句子较长（平均 " + englishResult.averageSentenceLength.toFixed(1) + " 词），建议拆分为更短的句子");
    }

    if (englishResult.longSentences > 0) {
      suggestions.push("有 " + englishResult.longSentences + " 个超长句子（>30词），建议拆分");
    }

    if (englishResult.averageSyllablesPerWord > 2) {
      suggestions.push("单词音节较多，考虑使用更简单的词汇");
    }

    if (englishResult.score < 50) {
      suggestions.push("可读性评分较低，建议使用更简单的词汇和更短的句子");
    }
  } else {
    const chineseResult = result as ChineseReadabilityResult;

    if (chineseResult.averageSentenceLength > 40) {
      suggestions.push("句子较长（平均 " + chineseResult.averageSentenceLength.toFixed(1) + " 字），建议拆分为更短的句子");
    }

    if (chineseResult.score < 60) {
      suggestions.push("可读性评分较低，建议使用更通俗的表达和更短的句子");
    }
  }

  return suggestions;
}
