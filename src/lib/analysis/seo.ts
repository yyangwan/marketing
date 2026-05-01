/**
 * SEO Analysis Utilities
 *
 * Provides SEO metrics calculation including:
 * - Keyword density analysis
 * - Link detection (internal/external)
 * - Image alt text analysis
 * - Meta tag evaluation
 */

import type { LinkAnalysis, ImageAnalysis, KeywordMetric } from "@/types";

/**
 * Extract plain text from HTML content
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

/**
 * Calculate keyword density for a given keyword
 */
export function calculateKeywordDensity(
  content: string,
  keyword: string
): KeywordMetric {
  if (!keyword.trim()) {
    throw new Error("Keyword cannot be empty");
  }

  const textContent = stripHtml(content);
  const words = textContent.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;

  if (wordCount === 0) {
    return {
      keyword,
      count: 0,
      density: 0,
      rating: "good",
    };
  }

  const keywordLower = keyword.toLowerCase();
  const regex = new RegExp(keywordLower, "gi");
  const matches = (textContent.match(regex) || []).length;
  const density = (matches / wordCount) * 100;

  let rating: "good" | "low" | "stuffed" = "good";
  if (density < 2) rating = "low";
  else if (density > 5) rating = "stuffed";

  return {
    keyword,
    count: matches,
    density,
    rating,
  };
}

/**
 * Analyze links in content
 */
export function analyzeLinks(content: string, baseUrl?: string): LinkAnalysis {
  const linkRegex = /<a\s+(?:[^>]*?\s+)?href=["']([^"']+)["']/gi;
  const matches = [...content.matchAll(linkRegex)];

  const internalLinks: string[] = [];
  const externalLinks: string[] = [];

  for (const match of matches) {
    const url = match[1];
    try {
      const urlObj = new URL(url, baseUrl);

      // Check if internal (same origin)
      if (baseUrl) {
        const baseObj = new URL(baseUrl);
        if (urlObj.origin === baseObj.origin) {
          internalLinks.push(url);
        } else {
          externalLinks.push(url);
        }
      } else {
        // No base URL provided, use heuristic
        if (url.startsWith("/") || url.startsWith("./") || url.startsWith("../")) {
          internalLinks.push(url);
        } else if (url.startsWith("http")) {
          externalLinks.push(url);
        }
      }
    } catch {
      // Invalid URL, skip
      continue;
    }
  }

  const textContent = stripHtml(content);
  const words = textContent.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;

  return {
    internalLinks: internalLinks.length,
    externalLinks: externalLinks.length,
    totalLinks: matches.length,
    linkDensity: wordCount > 0 ? (matches.length / wordCount) * 100 : 0,
    brokenLinks: [], // Would need HTTP requests to check
  };
}

/**
 * Analyze images in content
 */
export function analyzeImages(content: string): ImageAnalysis {
  const imgRegex = /<img[^>]*>/gi;
  const images = [...content.matchAll(imgRegex)];

  let totalImages = images.length;
  let imagesWithAlt = 0;
  let imagesWithoutAlt = 0;

  for (const img of images) {
    const imgStr = img[0]; // Get the matched string
    const altMatch = /alt=["']([^"']*)["']/i.exec(imgStr);
    const srcMatch = /src=["']([^"']*)["']/i.exec(imgStr);

    // Only count images with src (not spacer/loading images)
    if (srcMatch && srcMatch[1] && !srcMatch[1].match(/\b(spacer|loading|placeholder)\b/i)) {
      if (altMatch && altMatch[1].trim() !== "") {
        imagesWithAlt++;
      } else {
        imagesWithoutAlt++;
      }
    }
  }

  const countedImages = imagesWithAlt + imagesWithoutAlt;
  const altCoverage = countedImages > 0 ? (imagesWithAlt / countedImages) * 100 : 100;

  return {
    totalImages: countedImages,
    imagesWithAlt,
    imagesWithoutAlt,
    altCoverage,
  };
}

/**
 * Check if content has proper meta tags (for evaluation purposes)
 */
export interface MetaTagAnalysis {
  hasTitle: boolean;
  titleLength: number;
  hasDescription: boolean;
  descriptionLength: number;
  hasH1: boolean;
  h1Count: number;
  score: number;  // 0-100
}

export function analyzeMetaTags(content: string): MetaTagAnalysis {
  // Check for title tag
  const titleMatch = /<title[^>]*>(.*?)<\/title>/is.exec(content);
  const hasTitle = !!titleMatch;
  const titleLength = titleMatch ? titleMatch[1].length : 0;

  // Check for meta description
  const descMatch = /<meta[^>]*name=["']description["'][^>]*>/i.exec(content);
  const hasDescription = !!descMatch;

  // Extract description length from content attribute
  let descriptionLength = 0;
  if (descMatch) {
    const contentMatch = /content=["']([^"']*)["']/i.exec(descMatch[0]);
    descriptionLength = contentMatch ? contentMatch[1].length : 0;
  }

  // Check for H1 tags
  const h1Matches = content.match(/<h1[^>]*>/gi);
  const hasH1 = h1Matches !== null && h1Matches.length > 0;
  const h1Count = h1Matches?.length || 0;

  // Calculate score
  let score = 0;
  if (hasTitle && titleLength >= 30 && titleLength <= 60) score += 25;
  else if (hasTitle) score += 10;

  if (hasDescription && descriptionLength >= 120 && descriptionLength <= 160) score += 25;
  else if (hasDescription) score += 10;

  if (hasH1 && h1Count === 1) score += 25;
  else if (hasH1 && h1Count > 1) score += 10;
  else score += 0;

  if (titleLength > 0) score += 25; // Has some content

  return {
    hasTitle,
    titleLength,
    hasDescription,
    descriptionLength,
    hasH1,
    h1Count,
    score: Math.min(100, score),
  };
}

/**
 * Calculate overall SEO score from multiple metrics
 */
export interface SEOScoreInput {
  hasContent: boolean;
  contentLength: number;
  wordCount: number;
  keywordDensity?: KeywordMetric[];
  structure?: {
    hasH1: boolean;
    h1Count: number;
  };
  links?: LinkAnalysis;
  images?: ImageAnalysis;
  metaTags?: MetaTagAnalysis;
}

export function calculateOverallSEOScore(input: SEOScoreInput): number {
  let score = 0;

  // Content exists (20 points)
  if (input.hasContent && input.contentLength > 0) {
    score += 20;

    // Good content length (20 points)
    if (input.contentLength >= 300 && input.contentLength <= 2000) {
      score += 20;
    } else if (input.contentLength >= 100) {
      score += 10;
    }
  }

  // Word count (10 points)
  if (input.wordCount >= 50) {
    score += 10;
  }

  // Structure/H1 (15 points)
  if (input.structure?.hasH1 && input.structure.h1Count === 1) {
    score += 15;
  } else if (input.structure?.hasH1) {
    score += 5;
  }

  // Keyword density (20 points)
  if (input.keywordDensity && input.keywordDensity.length > 0) {
    const kd = input.keywordDensity[0];
    if (kd.rating === "good") score += 20;
    else if (kd.rating === "low") score += 10;
    else score += 5;
  } else {
    score += 10; // Neutral if no keyword provided
  }

  // Links (10 points)
  if (input.links) {
    if (input.links.internalLinks > 0 || input.links.externalLinks > 0) {
      score += 10;
    }
  }

  // Images (5 points)
  if (input.images) {
    if (input.images.altCoverage >= 80) {
      score += 5;
    } else if (input.images.altCoverage >= 50) {
      score += 2;
    }
  }

  return Math.min(100, score);
}

/**
 * Suggest SEO improvements based on analysis
 */
export function generateSEOSuggestions(input: SEOScoreInput): string[] {
  const suggestions: string[] = [];

  // Content length
  if (input.contentLength < 300) {
    suggestions.push("内容长度偏短，建议增加至 300-2000 字符以获得更好的 SEO 效果");
  } else if (input.contentLength > 2000) {
    suggestions.push("内容较长，考虑分段或拆分为多篇内容");
  }

  // H1 check
  if (!input.structure?.hasH1) {
    suggestions.push("缺少 H1 标题，建议添加一个描述主题的 H1 标签");
  } else if (input.structure.h1Count > 1) {
    suggestions.push("检测到多个 H1 标题，建议每页只使用一个 H1");
  }

  // Keyword density
  if (input.keywordDensity && input.keywordDensity.length > 0) {
    const kd = input.keywordDensity[0];
    if (kd.rating === "low") {
      suggestions.push(`关键词 "${kd.keyword}" 密度偏低 (${kd.density.toFixed(1)}%)，建议增加到 2-5%`);
    } else if (kd.rating === "stuffed") {
      suggestions.push(`关键词 "${kd.keyword}" 密度过高 (${kd.density.toFixed(1)}%)，可能被搜索引擎视为关键词堆砌`);
    }
  }

  // Images alt text
  if (input.images && input.images.imagesWithoutAlt > 0) {
    suggestions.push(`有 ${input.images.imagesWithoutAlt} 张图片缺少 alt 属性，建议添加描述性 alt 文本`);
  }

  // Links
  if (input.links && input.links.internalLinks === 0 && input.links.externalLinks === 0) {
    suggestions.push("内容中没有链接，建议添加相关内链提升用户体验和 SEO");
  }

  return suggestions;
}
