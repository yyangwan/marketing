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
 * Multi-factor approach:
 * 1. Average sentence length (primary factor)
 * 2. Punctuation density (comma-to-period ratio — more commas = longer clauses)
 * 3. Sentence length variance (variety is good, monotone is not)
 * 4. Short vs long sentence balance
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

  // --- Factor 1: Average sentence length (0-40 pts) ---
  const sentenceLengths = sentences.map((s) => s.replace(/\s+/g, "").length);
  const averageSentenceLength = characterCount / sentenceCount;

  let lengthScore = 40;
  if (averageSentenceLength > 30) lengthScore -= 8;
  if (averageSentenceLength > 40) lengthScore -= 8;
  if (averageSentenceLength > 50) lengthScore -= 8;
  if (averageSentenceLength > 70) lengthScore -= 8;
  if (averageSentenceLength > 100) lengthScore -= 8;
  // Very short sentences might indicate fragmentation
  if (averageSentenceLength < 5) lengthScore -= 6;
  lengthScore = Math.max(0, lengthScore);

  // --- Factor 2: Punctuation density (0-20 pts) ---
  // Good writing uses a mix of commas, semicolons, colons for pacing
  // The ratio of clause-level punctuation to sentence-ending punctuation
  const clausePunctuation = (cleanText.match(/[，、；：,;:]/g) || []).length;
  const sentenceEndPunctuation = (cleanText.match(/[。！？.?!?]/g) || []).length;
  // Ideal ratio: 1.5-3.0 commas per period (enough rhythm, not run-on)
  const commaRatio = sentenceEndPunctuation > 0
    ? clausePunctuation / sentenceEndPunctuation
    : 0;

  let punctuationScore = 20;
  if (commaRatio < 0.5) punctuationScore -= 8;  // Too few pauses — run-on sentences
  else if (commaRatio < 1.0) punctuationScore -= 3;
  if (commaRatio > 4.0) punctuationScore -= 10;  // Too many clauses — over-complex
  else if (commaRatio > 3.0) punctuationScore -= 4;
  punctuationScore = Math.max(0, punctuationScore);

  // --- Factor 3: Sentence length variance (0-20 pts) ---
  // A healthy mix of short and long sentences is more readable
  let varianceScore = 20;
  if (sentenceLengths.length >= 2) {
    const mean = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
    const variance = sentenceLengths.reduce((sum, l) => sum + (l - mean) ** 2, 0) / sentenceLengths.length;
    const stdDev = Math.sqrt(variance);
    // Coefficient of variation: stdDev / mean
    const cv = mean > 0 ? stdDev / mean : 0;
    // Ideal CV range: 0.3-0.7 (good variety without being chaotic)
    if (cv < 0.15) varianceScore -= 12;  // Monotonous sentence lengths
    else if (cv < 0.25) varianceScore -= 4;
    if (cv > 1.0) varianceScore -= 8;  // Too chaotic
    varianceScore = Math.max(0, varianceScore);
  } else {
    varianceScore = 10;  // Single sentence — can't measure variance well
  }

  // --- Factor 4: Short vs long sentence balance (0-20 pts) ---
  // Count sentences in different ranges
  const shortSentences = sentenceLengths.filter((l) => l > 0 && l <= 20).length;
  const mediumSentences = sentenceLengths.filter((l) => l > 20 && l <= 50).length;
  const longSentences = sentenceLengths.filter((l) => l > 50).length;
  const total = shortSentences + mediumSentences + longSentences || 1;

  let balanceScore = 20;
  // Penalize if > 60% are long sentences
  const longRatio = longSentences / total;
  if (longRatio > 0.6) balanceScore -= 15;
  else if (longRatio > 0.4) balanceScore -= 6;
  // Reward having at least some short/medium sentences
  if (shortSentences + mediumSentences === 0 && total > 1) balanceScore -= 10;
  // Reward variety: having all 3 types
  if (shortSentences > 0 && mediumSentences > 0 && longSentences === 0) balanceScore += 0; // ideal: short+medium, no long
  balanceScore = Math.max(0, Math.min(20, balanceScore));

  // --- Combine ---
  let score = lengthScore + punctuationScore + varianceScore + balanceScore;
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
  result: ReadabilityResult | ChineseReadabilityResult,
  originalText?: string
): string[] {
  const suggestions: string[] = [];

  if ("averageSyllablesPerWord" in result) {
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

    // Advanced suggestions based on new factors
    if (originalText) {
      const cleanText = originalText.replace(/<[^>]*>/g, "").trim();

      // Punctuation density analysis
      const clausePunct = (cleanText.match(/[，、；：,;:]/g) || []).length;
      const endPunct = (cleanText.match(/[。！？.?!?]/g) || []).length;
      const commaRatio = endPunct > 0 ? clausePunct / endPunct : 0;

      if (commaRatio < 0.5 && chineseResult.averageSentenceLength > 30) {
        suggestions.push("长句中缺少逗号/顿号等断句标点，建议适当增加停顿让读者有呼吸空间");
      } else if (commaRatio > 4.0) {
        suggestions.push("单句中分句过多（逗号/分号占比高），建议拆分成多个独立句子");
      }

      // Sentence variety analysis
      const sentenceLengths = cleanText.split(/[。！？.?!?]/)
        .filter((s) => s.trim().length > 0)
        .map((s) => s.replace(/\s+/g, "").length);

      if (sentenceLengths.length >= 3) {
        const allSimilar = sentenceLengths.every((l) => {
          const avg = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
          return Math.abs(l - avg) / Math.max(avg, 1) < 0.15;
        });
        if (allSimilar) {
          suggestions.push("句子长度变化较少，建议穿插长短句来增加节奏感");
        }

        const longCount = sentenceLengths.filter((l) => l > 50).length;
        if (longCount / sentenceLengths.length > 0.5) {
          suggestions.push("长句（>50字）占比过高，建议拆分部分长句为短句");
        }
      }
    }
  }

  return suggestions;
}
