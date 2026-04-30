/**
 * Sentiment Analysis Utilities
 *
 * Provides dictionary-based sentiment analysis for both Chinese and English text:
 * - Polarity scoring (-1 to +1)
 * - Emotion detection (joy, sadness, anger, fear, surprise)
 * - Overall sentiment classification
 *
 * Note: This is a lightweight, local implementation using emotion dictionaries.
 * For production use, consider integrating with an AI service for higher accuracy.
 */

import type { SentimentAnalysis } from "@/types";

/**
 * English emotion lexicon (simplified)
 * Each word maps to a polarity score and primary emotion
 */
const EN_EMOTION_LEXICON: Record<string, { score: number; emotion: string }> = {
  // Positive - Joy
  "happy": { score: 0.8, emotion: "joy" },
  "joy": { score: 0.9, emotion: "joy" },
  "delighted": { score: 0.85, emotion: "joy" },
  "pleased": { score: 0.7, emotion: "joy" },
  "excited": { score: 0.75, emotion: "joy" },
  "wonderful": { score: 0.8, emotion: "joy" },
  "amazing": { score: 0.85, emotion: "joy" },
  "great": { score: 0.7, emotion: "joy" },
  "good": { score: 0.5, emotion: "joy" },
  "excellent": { score: 0.8, emotion: "joy" },
  "love": { score: 0.85, emotion: "joy" },
  "enjoy": { score: 0.7, emotion: "joy" },

  // Positive - Surprise
  "surprised": { score: 0.5, emotion: "surprise" },
  "astonished": { score: 0.6, emotion: "surprise" },
  "shocked": { score: 0.4, emotion: "surprise" },
  "unexpected": { score: 0.3, emotion: "surprise" },

  // Negative - Sadness
  "sad": { score: -0.6, emotion: "sadness" },
  "unhappy": { score: -0.65, emotion: "sadness" },
  "disappointed": { score: -0.5, emotion: "sadness" },
  "depressed": { score: -0.7, emotion: "sadness" },
  "miserable": { score: -0.75, emotion: "sadness" },
  "grief": { score: -0.8, emotion: "sadness" },
  "regret": { score: -0.5, emotion: "sadness" },
  "sorry": { score: -0.4, emotion: "sadness" },

  // Negative - Anger
  "angry": { score: -0.7, emotion: "anger" },
  "furious": { score: -0.8, emotion: "anger" },
  "rage": { score: -0.85, emotion: "anger" },
  "annoyed": { score: -0.5, emotion: "anger" },
  "irritated": { score: -0.55, emotion: "anger" },
  "frustrated": { score: -0.6, emotion: "anger" },
  "hate": { score: -0.8, emotion: "anger" },
  "terrible": { score: -0.7, emotion: "anger" },
  "awful": { score: -0.75, emotion: "anger" },

  // Negative - Fear
  "afraid": { score: -0.6, emotion: "fear" },
  "fear": { score: -0.7, emotion: "fear" },
  "scared": { score: -0.65, emotion: "fear" },
  "terrified": { score: -0.8, emotion: "fear" },
  "anxious": { score: -0.55, emotion: "fear" },
  "worried": { score: -0.5, emotion: "fear" },
  "nervous": { score: -0.45, emotion: "fear" },
  "panic": { score: -0.75, emotion: "fear" },
};

/**
 * Chinese emotion lexicon (simplified)
 */
const ZH_EMOTION_LEXICON: Record<string, { score: number; emotion: string }> = {
  // Positive - Joy (开心/喜悦)
  "开心": { score: 0.8, emotion: "joy" },
  "快乐": { score: 0.85, emotion: "joy" },
  "高兴": { score: 0.75, emotion: "joy" },
  "愉快": { score: 0.7, emotion: "joy" },
  "幸福": { score: 0.85, emotion: "joy" },
  "喜欢": { score: 0.7, emotion: "joy" },
  "爱": { score: 0.8, emotion: "joy" },
  "棒": { score: 0.6, emotion: "joy" },
  "优秀": { score: 0.7, emotion: "joy" },
  "精彩": { score: 0.8, emotion: "joy" },
  "美好": { score: 0.7, emotion: "joy" },

  // Positive - Surprise (惊喜)
  "惊喜": { score: 0.75, emotion: "surprise" },
  "惊讶": { score: 0.5, emotion: "surprise" },
  "意外": { score: 0.3, emotion: "surprise" },
  "震撼": { score: 0.6, emotion: "surprise" },

  // Negative - Sadness (悲伤)
  "难过": { score: -0.6, emotion: "sadness" },
  "悲伤": { score: -0.7, emotion: "sadness" },
  "痛苦": { score: -0.75, emotion: "sadness" },
  "失望": { score: -0.55, emotion: "sadness" },
  "沮丧": { score: -0.65, emotion: "sadness" },
  "郁闷": { score: -0.5, emotion: "sadness" },
  "遗憾": { score: -0.5, emotion: "sadness" },
  "抱歉": { score: -0.4, emotion: "sadness" },
  "可惜": { score: -0.45, emotion: "sadness" },

  // Negative - Anger (愤怒)
  "生气": { score: -0.65, emotion: "anger" },
  "愤怒": { score: -0.75, emotion: "anger" },
  "恼火": { score: -0.6, emotion: "anger" },
  "烦": { score: -0.5, emotion: "anger" },
  "讨厌": { score: -0.7, emotion: "anger" },
  "恨": { score: -0.8, emotion: "anger" },
  "糟糕": { score: -0.6, emotion: "anger" },
  "差劲": { score: -0.65, emotion: "anger" },

  // Negative - Fear (恐惧)
  "害怕": { score: -0.6, emotion: "fear" },
  "恐惧": { score: -0.7, emotion: "fear" },
  "担心": { score: -0.5, emotion: "fear" },
  "紧张": { score: -0.45, emotion: "fear" },
  "焦虑": { score: -0.55, emotion: "fear" },
  "恐慌": { score: -0.75, emotion: "fear" },
  "惊恐": { score: -0.7, emotion: "fear" },
};

/**
 * Negation words that flip sentiment
 */
const NEGATION_WORDS = new Set([
  "not", "no", "never", "neither", "nor", "none",
  "不", "不是", "没", "没有", "别", "无", "非", "未",
]);

/**
 * Intensifiers that amplify sentiment
 */
const INTENSIFIERS: Record<string, number> = {
  "very": 1.5, "really": 1.4, "extremely": 1.6,
  "非常": 1.5, "很": 1.3, "特别": 1.4, "极其": 1.6,
};

/**
 * Tokenize text into words for sentiment analysis
 * For Chinese: extract emotion words + negation words + intensifiers
 * For English: extract words (3+ chars)
 */
function tokenizeForSentiment(text: string): string[] {
  const cleanText = text.replace(/<[^>]*>/g, "").toLowerCase();

  // Check if text contains Chinese characters
  const hasChinese = /[\u4e00-\u9fa5]/.test(cleanText);

  if (hasChinese) {
    const tokens: string[] = [];
    const seen = new Set<string>();

    // First, extract emotion words from the lexicon (n-gram approach)
    // Check for 4-char phrases first (longer matches take priority)
    for (let i = 0; i <= cleanText.length - 4; i++) {
      const ngram = cleanText.substring(i, i + 4);
      if (ZH_EMOTION_LEXICON[ngram] && !seen.has(ngram)) {
        tokens.push(ngram);
        seen.add(ngram);
      }
    }

    // Check for 3-char phrases
    for (let i = 0; i <= cleanText.length - 3; i++) {
      const ngram = cleanText.substring(i, i + 3);
      if (ZH_EMOTION_LEXICON[ngram] && !seen.has(ngram)) {
        tokens.push(ngram);
        seen.add(ngram);
      }
    }

    // Check for 2-char words (including negation and intensifiers)
    for (let i = 0; i <= cleanText.length - 2; i++) {
      const ngram = cleanText.substring(i, i + 2);
      if ((ZH_EMOTION_LEXICON[ngram] || NEGATION_WORDS.has(ngram) || INTENSIFIERS[ngram]) && !seen.has(ngram)) {
        tokens.push(ngram);
        seen.add(ngram);
      }
    }

    // Also extract English tokens (mixed text)
    const enTokens = cleanText.match(/[a-z]{3,}/g) || [];
    for (const token of enTokens) {
      if (!seen.has(token)) {
        tokens.push(token);
        seen.add(token);
      }
    }

    return tokens;
  }

  // For English-only text, extract words (3+ chars)
  const enTokens = cleanText.match(/[a-z]{3,}/g) || [];
  return enTokens;
}

/**
 * Analyze sentiment of text using dictionary-based approach
 */
export function analyzeSentiment(text: string): SentimentAnalysis {
  const tokens = tokenizeForSentiment(text);

  if (tokens.length === 0) {
    return {
      overall: "neutral",
      score: 0,
      confidence: 0,
    };
  }

  let totalScore = 0;
  let emotionCounts: Record<string, number> = {
    joy: 0,
    sadness: 0,
    anger: 0,
    fear: 0,
    surprise: 0,
  };

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    let lexicon = EN_EMOTION_LEXICON;

    // Determine which lexicon to use
    if (/[\u4e00-\u9fa5]/.test(token)) {
      lexicon = ZH_EMOTION_LEXICON;
    }

    // Check for negation
    let multiplier = 1;
    if (i > 0 && NEGATION_WORDS.has(tokens[i - 1])) {
      multiplier = -1;
    }

    // Check for intensifier
    if (i > 0 && INTENSIFIERS[tokens[i - 1]]) {
      multiplier *= INTENSIFIERS[tokens[i - 1]];
    }

    const entry = lexicon[token];
    if (entry) {
      totalScore += entry.score * multiplier;
      emotionCounts[entry.emotion as keyof typeof emotionCounts]++;
    }

    i++;
  }

  // Normalize score to -1 to 1 range
  // Use emotion word count for normalization to avoid penalizing short texts
  const emotionWordCount = Object.values(emotionCounts).reduce((sum, count) => sum + count, 0);
  const normalizedScore = emotionWordCount > 0
    ? Math.max(-1, Math.min(1, totalScore / Math.max(emotionWordCount, 1)))
    : 0;

  // Determine overall sentiment
  let overall: "positive" | "neutral" | "negative";
  if (normalizedScore > 0.15) {
    overall = "positive";
  } else if (normalizedScore < -0.15) {
    overall = "negative";
  } else {
    overall = "neutral";
  }

  // Calculate confidence based on how many emotion words were found
  const confidence = Math.min(1, emotionWordCount / Math.max(tokens.length * 0.1, 1));

  return {
    overall,
    score: normalizedScore,
    confidence,
  };
}

/**
 * Get detailed emotion breakdown
 */
export interface EmotionBreakdown {
  joy: number;      // 0-1
  sadness: number;  // 0-1
  anger: number;    // 0-1
  fear: number;     // 0-1
  surprise: number; // 0-1
}

export function analyzeEmotions(text: string): EmotionBreakdown {
  const tokens = tokenizeForSentiment(text);

  if (tokens.length === 0) {
    return {
      joy: 0,
      sadness: 0,
      anger: 0,
      fear: 0,
      surprise: 0,
    };
  }

  let emotionCounts: Record<string, number> = {
    joy: 0,
    sadness: 0,
    anger: 0,
    fear: 0,
    surprise: 0,
  };

  for (const token of tokens) {
    let lexicon = EN_EMOTION_LEXICON;

    if (/[\u4e00-\u9fa5]/.test(token)) {
      lexicon = ZH_EMOTION_LEXICON;
    }

    const entry = lexicon[token];
    if (entry) {
      emotionCounts[entry.emotion as keyof typeof emotionCounts]++;
    }
  }

  // Normalize to 0-1 range
  const totalEmotions = Object.values(emotionCounts).reduce((sum, count) => sum + count, 0) || 1;

  return {
    joy: emotionCounts.joy / totalEmotions,
    sadness: emotionCounts.sadness / totalEmotions,
    anger: emotionCounts.anger / totalEmotions,
    fear: emotionCounts.fear / totalEmotions,
    surprise: emotionCounts.surprise / totalEmotions,
  };
}

/**
 * Convert sentiment score to 0-10 scale for quality assessment
 * -1 (very negative) → 0
 * 0 (neutral) → 5
 * 1 (very positive) → 10
 */
export function sentimentToQualityScore(sentimentScore: number): number {
  return Math.round((sentimentScore + 1) * 5);
}

/**
 * Get sentiment description for display
 */
export function getSentimentDescription(analysis: SentimentAnalysis): {
  label: string;
  color: string;
  icon: string;
} {
  const descriptions: Record<SentimentAnalysis["overall"], { label: string; color: string; icon: string }> = {
    positive: {
      label: "积极",
      color: "text-green-600",
      icon: "😊",
    },
    neutral: {
      label: "中性",
      color: "text-gray-600",
      icon: "😐",
    },
    negative: {
      label: "消极",
      color: "text-red-600",
      icon: "😟",
    },
  };

  return descriptions[analysis.overall] || descriptions.neutral;
}
