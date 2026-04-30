/**
 * Structure Analysis Utilities
 *
 * Provides content structure analysis including:
 * - Heading hierarchy analysis (H1-H6)
 * - Paragraph length analysis
 * - Content structure scoring
 * - List and bullet point detection
 */

import type { StructureAnalysis } from "@/types";

/**
 * Extract heading hierarchy from HTML content
 */
export interface HeadingInfo {
  level: number;  // 1-6 for H1-H6
  text: string;
  position: number;
  hierarchy: string[];  // e.g., ["H1", "H2", "H2", "H3"]
}

export function extractHeadings(content: string): HeadingInfo[] {
  const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h\1>/gi;
  const headings: HeadingInfo[] = [];
  let position = 0;

  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(content)) !== null) {
    const level = parseInt(match[1], 10);
    const text = match[2].replace(/<[^>]*>/g, "").trim();
    headings.push({ level, text, position });
    position++;
  }

  return headings;
}

/**
 * Analyze heading hierarchy quality
 */
export function analyzeHeadingHierarchy(headings: HeadingInfo[]): {
  hasH1: boolean;
  h1Count: number;
  hierarchy: string[];
  issues: string[];
} {
  const h1Headings = headings.filter((h) => h.level === 1);
  const hasH1 = h1Headings.length > 0;
  const h1Count = h1Headings.length;

  const issues: string[] = [];

  if (!hasH1) {
    issues.push("缺少 H1 标题");
  } else if (h1Count > 1) {
    issues.push(`检测到 ${h1Count} 个 H1 标题，建议每页只使用一个`);
  }

  // Check for proper hierarchy (should not skip levels)
  let lastLevel = 0;
  const hierarchy: string[] = [];

  for (const heading of headings) {
    const levelName = `H${heading.level}`;
    hierarchy.push(levelName);

    if (heading.level > lastLevel + 1 && lastLevel > 0) {
      issues.push(`标题层级跳跃: H${lastLevel} → H${heading.level} (${heading.text})`);
    }

    lastLevel = heading.level;
  }

  return { hasH1, h1Count, hierarchy, issues };
}

/**
 * Extract paragraphs from content
 */
export interface ParagraphInfo {
  text: string;
  wordCount: number;
  characterCount: number;
  position: number;
}

export function extractParagraphs(content: string): ParagraphInfo[] {
  // Remove HTML tags and split by double newlines
  const textContent = content.replace(/<[^>]*>/g, "");
  const paragraphs = textContent.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  return paragraphs.map((text, index) => {
    // Count words (support both Chinese and English)
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = text.split(/\s+/).filter((w) => w.length > 0 && w.match(/^[a-zA-Z]+$/)).length;
    const wordCount = chineseChars + englishWords;

    return {
      text,
      wordCount,
      characterCount: text.length,
      position: index,
    };
  });
}

/**
 * Analyze paragraph structure
 */
export interface ParagraphAnalysis {
  paragraphCount: number;
  averageLength: number;  // in words
  longParagraphs: number;   // paragraphs > 150 words
  shortParagraphs: number;  // paragraphs < 30 words
  veryLongParagraphs: number; // paragraphs > 300 words
}

export function analyzeParagraphs(paragraphs: ParagraphInfo[]): ParagraphAnalysis {
  if (paragraphs.length === 0) {
    return {
      paragraphCount: 0,
      averageLength: 0,
      longParagraphs: 0,
      shortParagraphs: 0,
      veryLongParagraphs: 0,
    };
  }

  const totalWords = paragraphs.reduce((sum, p) => sum + p.wordCount, 0);
  const averageLength = totalWords / paragraphs.length;

  const longParagraphs = paragraphs.filter((p) => p.wordCount > 150).length;
  const shortParagraphs = paragraphs.filter((p) => p.wordCount < 30).length;
  const veryLongParagraphs = paragraphs.filter((p) => p.wordCount > 300).length;

  return {
    paragraphCount: paragraphs.length,
    averageLength: Math.round(averageLength * 10) / 10,
    longParagraphs,
    shortParagraphs,
    veryLongParagraphs,
  };
}

/**
 * Detect lists and bullet points in content
 */
export interface ListAnalysis {
  unorderedLists: number;
  orderedLists: number;
  totalItems: number;
}

export function analyzeLists(content: string): ListAnalysis {
  const ulMatches = content.match(/<ul[^>]*>/gi) || [];
  const olMatches = content.match(/<ol[^>]*>/gi) || [];

  const liMatches = content.match(/<li[^>]*>/gi) || [];

  return {
    unorderedLists: ulMatches.length,
    orderedLists: olMatches.length,
    totalItems: liMatches.length,
  };
}

/**
 * Calculate overall structure score
 */
export function calculateStructureScore(
  headings: HeadingInfo[],
  paragraphAnalysis: ParagraphAnalysis,
  listAnalysis: ListAnalysis
): number {
  let score = 0;

  // H1 presence (30 points)
  const hasH1 = headings.some((h) => h.level === 1);
  if (hasH1) score += 30;

  // Heading hierarchy (20 points)
  const hierarchyResult = analyzeHeadingHierarchy(headings);
  if (hierarchyResult.issues.length === 0 && headings.length > 0) {
    score += 20;
  } else if (hierarchyResult.issues.length <= 1) {
    score += 10;
  }

  // Paragraph structure (20 points)
  if (paragraphAnalysis.averageLength >= 30 && paragraphAnalysis.averageLength <= 150) {
    score += 20;
  } else if (paragraphAnalysis.averageLength >= 20 && paragraphAnalysis.averageLength <= 200) {
    score += 10;
  }

  // No very long paragraphs (10 points)
  if (paragraphAnalysis.veryLongParagraphs === 0) {
    score += 10;
  }

  // List usage (10 points)
  if (listAnalysis.totalItems > 0) {
    score += 10;
  }

  // Content variety (10 points)
  if (paragraphAnalysis.paragraphCount >= 2) {
    score += 10;
  }

  return Math.min(100, score);
}

/**
 * Complete structure analysis
 */
export function analyzeContentStructure(content: string): StructureAnalysis {
  const headings = extractHeadings(content);
  const hierarchyResult = analyzeHeadingHierarchy(headings);
  const paragraphs = extractParagraphs(content);
  const paragraphAnalysis = analyzeParagraphs(paragraphs);
  const listAnalysis = analyzeLists(content);

  const structureScore = calculateStructureScore(
    headings,
    paragraphAnalysis,
    listAnalysis
  );

  return {
    hasH1: hierarchyResult.hasH1,
    h1Count: hierarchyResult.h1Count,
    headingHierarchy: hierarchyResult.hierarchy,
    paragraphCount: paragraphs.length,
    averageParagraphLength: paragraphAnalysis.averageLength,
    longParagraphs: paragraphAnalysis.longParagraphs,
    structureScore,
  };
}

/**
 * Get structure improvement suggestions
 */
export function getStructureSuggestions(analysis: StructureAnalysis): string[] {
  const suggestions: string[] = [];

  if (!analysis.hasH1) {
    suggestions.push("建议添加 H1 标题来概括内容主题");
  } else if (analysis.h1Count > 1) {
    suggestions.push("建议只保留一个 H1 标题，其他标题降级为 H2");
  }

  if (analysis.averageParagraphLength > 200) {
    suggestions.push("段落较长（平均 " + analysis.averageParagraphLength.toFixed(0) + " 词），建议拆分为更短的段落");
  }

  if (analysis.longParagraphs > 0) {
    suggestions.push(`有 ${analysis.longParagraphs} 个长段落（>150 词），建议拆分以提高可读性`);
  }

  if (analysis.paragraphCount < 2 && analysis.averageParagraphLength > 500) {
    suggestions.push("建议将长文本拆分为多个段落");
  }

  if (analysis.headingHierarchy.length < 2 && analysis.hasH1) {
    suggestions.push("建议添加副标题（H2）来组织内容结构");
  }

  if (analysis.structureScore < 70) {
    suggestions.push("内容结构评分较低，建议优化标题层级和段落结构");
  }

  return suggestions;
}

/**
 * Generate table of contents from headings
 */
export function generateTableOfContents(
  content: string,
  options: {
    maxDepth?: number;
    minLevel?: number;
  } = {}
): Array<{ level: number; text: string; position: number }> {
  const { maxDepth = 6, minLevel = 1 } = options;

  const headings = extractHeadings(content);

  return headings
    .filter((h) => h.level >= minLevel && h.level <= maxDepth)
    .map((h) => ({
      level: h.level,
      text: h.text,
      position: h.position,
    }));
}

/**
 * Check if content has proper heading hierarchy
 */
export function hasProperHierarchy(content: string): boolean {
  const headings = extractHeadings(content);
  if (headings.length === 0) return true;

  let lastLevel = 0;

  for (const heading of headings) {
    // Allow same level or next level
    // But not skipping levels (H1 -> H3 is bad)
    if (heading.level > lastLevel + 1) {
      return false;
    }
    lastLevel = heading.level;
  }

  return true;
}
