/**
 * Keyword Extraction Utilities
 *
 * Provides automatic keyword extraction using TF-IDF algorithm:
 * - TF (Term Frequency): How often a word appears
 * - IDF (Inverse Document Frequency): How unique the word is
 * - Stop word filtering (Chinese + English)
 * - N-gram extraction (bigrams, trigrams)
 */

import type { ExtractedKeyword } from "@/types";
import { STOP_WORDS_ZH, STOP_WORDS_EN } from "@/types";

/**
 * Simple tokenizer that handles both Chinese and English text
 */
export function tokenizeText(text: string): string[] {
  // Remove HTML tags
  const cleanText = text.replace(/<[^>]*>/g, "");

  // Extract Chinese characters and English words
  const chineseMatches = cleanText.match(/[\u4e00-\u9fa5]{2,}/g) || [];
  const englishMatches = cleanText.match(/[a-zA-Z]{3,}/g) || [];

  return [...chineseMatches, ...englishMatches];
}

/**
 * Filter out stop words from tokens
 */
export function filterStopWords(tokens: string[]): string[] {
  return tokens.filter((token) => {
    const lower = token.toLowerCase();
    return !STOP_WORDS_ZH.has(lower) && !STOP_WORDS_EN.has(lower);
  });
}

/**
 * Calculate term frequency (TF) for a document
 */
export function calculateTermFrequency(tokens: string[]): Map<string, number> {
  const frequency = new Map<string, number>();

  for (const token of tokens) {
    const count = frequency.get(token) || 0;
    frequency.set(token, count + 1);
  }

  return frequency;
}

/**
 * Calculate term frequency (TF) score
 * TF = (number of times term appears) / (total number of terms)
 */
export function getTFScore(termFrequency: number, totalTerms: number): number {
  return totalTerms > 0 ? termFrequency / totalTerms : 0;
}

/**
 * Simple IDF approximation for single document
 * Uses log(1 + totalDocs / (1 + docFreq))
 *
 * For single document analysis, we use a simplified approach:
 * - Rare terms (appear few times) get higher IDF
 * - Common terms get lower IDF
 */
export function calculateIDF(token: string, tokens: string[]): number {
  const frequency = tokens.filter((t) => t === token).length;
  const total = tokens.length;

  // Simplified IDF: log(total / frequency)
  // We add smoothing to avoid division by zero
  return Math.log((total + 1) / (frequency + 1));
}

/**
 * Calculate TF-IDF score for each token
 */
export function calculateTFIDF(tokens: string[]): Map<string, number> {
  const filteredTokens = filterStopWords(tokens);
  const termFreq = calculateTermFrequency(filteredTokens);
  const totalTerms = filteredTokens.length;

  const tfidfScores = new Map<string, number>();

  for (const [token, frequency] of termFreq) {
    const tf = getTFScore(frequency, totalTerms);
    const idf = calculateIDF(token, filteredTokens);
    tfidfScores.set(token, tf * idf);
  }

  return tfidfScores;
}

/**
 * Extract top N keywords by TF-IDF score
 */
export function extractKeywords(
  text: string,
  options: {
    topN?: number;
    minLength?: number;
    minFreq?: number;
  } = {}
): ExtractedKeyword[] {
  const { topN = 10, minLength = 2, minFreq = 1 } = options;

  // Tokenize
  const tokens = tokenizeText(text);

  if (tokens.length === 0) {
    return [];
  }

  // Calculate TF-IDF scores
  const tfidfScores = calculateTFIDF(tokens);

  // Convert to array and sort by score
  const sortedKeywords = Array.from(tfidfScores.entries())
    .filter(([token]) => token.length >= minLength)
    .filter(([, score]) => score >= minFreq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, topN);

  // Normalize scores to 0-1 range
  const maxScore = sortedKeywords[0]?.[1] || 1;

  return sortedKeywords.map(([keyword, rawScore]) => ({
    keyword,
    relevance: rawScore / maxScore,
    frequency: tokens.filter((t) => t === keyword).length,
  }));
}

/**
 * Extract bigrams (two-word phrases) from text
 */
export function extractBigrams(text: string, topN = 10): ExtractedKeyword[] {
  const tokens = tokenizeText(text);
  const bigrams: string[] = [];

  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = tokens[i] + tokens[i + 1];
    // Filter out bigrams that cross language boundaries
    const isChinese = /^[\u4e00-\u9fa5]+$/.test(tokens[i]) &&
                   /^[\u4e00-\u9fa5]+$/.test(tokens[i + 1]);
    const isEnglish = /^[a-zA-Z]+$/.test(tokens[i]) &&
                   /^[a-zA-Z]+$/.test(tokens[i + 1]);

    if (isChinese || isEnglish) {
      bigrams.push(bigram);
    }
  }

  // Count bigram frequency
  const frequency = new Map<string, number>();
  for (const bigram of bigrams) {
    const count = frequency.get(bigram) || 0;
    frequency.set(bigram, count + 1);
  }

  // Sort by frequency and return top N
  const sorted = Array.from(frequency.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, topN);

  const maxFreq = sorted[0]?.[1] || 1;

  return sorted.map(([bigram, freq]) => ({
    keyword: bigram,
    relevance: freq / maxFreq,
    frequency: freq,
  }));
}

/**
 * Extract keywords from HTML content specifically
 * Gives more weight to keywords in headings (H1-H6)
 */
export function extractKeywordsFromHTML(
  html: string,
  options: {
    topN?: number;
    minLength?: number;
  } = {}
): ExtractedKeyword[] {
  const { topN = 10, minLength = 2 } = options;

  // Extract and weight by tag importance
  const tagWeights: Record<string, number> = {
    "h1": 5.0,
    "h2": 4.0,
    "h3": 3.0,
    "h4": 2.5,
    "h5": 2.0,
    "h6": 1.5,
    "title": 5.0,
    "strong": 1.5,
    "b": 1.3,
    "em": 1.2,
    "p": 1.0,
    "a": 1.0,
    "li": 1.0,
  };

  const tokenScores = new Map<string, number>();

  // Simple HTML parser to extract text with weights
  let currentWeight = 1.0;
  const tagStack: string[] = [];

  // Process HTML character by character (simplified)
  let i = 0;
  while (i < html.length) {
    if (html[i] === "<") {
      // Tag opening or closing
      const tagMatch = html.substr(i).match(/<\/?([a-z0-9]+)/i);
      if (tagMatch) {
        const tag = tagMatch[1].toLowerCase();
        if (html[i + 1] === "/") {
          // Closing tag
          const lastTag = tagStack.pop();
          if (lastTag) {
            currentWeight = tagStack.length > 0
              ? (tagWeights[tagStack[tagStack.length - 1]] || 1.0)
              : 1.0;
          }
        } else {
          // Opening tag
          tagStack.push(tag);
          currentWeight = tagWeights[tag] || 1.0;
        }
        i += tagMatch[0].length;
      } else {
        i++; // Invalid tag, move on
      }
    } else if (html[i] === ">") {
      i++; // Tag closing
    } else {
      // Text content
      const textMatch = html.substr(i).match(/[a-zA-Z\u4e00-\u9fa5]+/);
      if (textMatch) {
        const word = textMatch[0];
        if (word.length >= minLength) {
          const current = tokenScores.get(word) || 0;
          tokenScores.set(word, current + currentWeight * word.length);
        }
        i += textMatch[0].length;
      } else {
        i++;
      }
    }
  }

  // Convert to array and sort
  const sortedKeywords = Array.from(tokenScores.entries())
    .filter(([token]) => {
      const lower = token.toLowerCase();
      return !STOP_WORDS_ZH.has(lower) && !STOP_WORDS_EN.has(lower);
    })
    .sort(([, a], [, b]) => b - a)
    .slice(0, topN);

  // Normalize scores
  const maxScore = sortedKeywords[0]?.[1] || 1;

  return sortedKeywords.map(([keyword, rawScore]) => ({
    keyword,
    relevance: rawScore / maxScore,
    frequency: 1, // Not tracked for HTML extraction
  }));
}

/**
 * Generate keyword suggestions based on extracted keywords
 */
export function generateKeywordSuggestions(keywords: ExtractedKeyword[]): string[] {
  if (keywords.length === 0) {
    return ["无法提取关键词，内容可能过短"];
  }

  const suggestions: string[] = [];

  const topKeyword = keywords[0];
  if (topKeyword.relevance > 0.5) {
    suggestions.push(`主要关键词: "${topKeyword.keyword}"`);
  }

  if (keywords.length >= 3) {
    const topKeywords = keywords.slice(0, 3).map((k) => k.keyword).join("、");
    suggestions.push(`核心主题: ${topKeywords}`);
  }

  if (keywords.length < 5) {
    suggestions.push("提取的关键词较少，内容可能缺乏焦点");
  }

  return suggestions;
}

/**
 * Calculate keyword density for multiple keywords
 */
export function calculateMultipleKeywordDensity(
  content: string,
  keywords: string[]
): Map<string, { count: number; density: number; rating: "good" | "low" | "stuffed" }> {
  const textContent = content.replace(/<[^>]*>/g, "").toLowerCase();
  const words = textContent.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;

  const results = new Map();

  for (const keyword of keywords) {
    if (!keyword.trim()) continue;

    const keywordLower = keyword.toLowerCase();
    const regex = new RegExp(keywordLower, "g");
    const matches = (textContent.match(regex) || []).length;
    const density = wordCount > 0 ? (matches / wordCount) * 100 : 0;

    let rating: "good" | "low" | "stuffed" = "good";
    if (density < 2) rating = "low";
    else if (density > 5) rating = "stuffed";

    results.set(keyword, { count: matches, density, rating });
  }

  return results;
}
