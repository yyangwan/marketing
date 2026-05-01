/**
 * Platform Analyzer
 *
 * Analyzes content against platform-specific rules and provides
 * actionable suggestions for optimization.
 */

import type { Platform } from "@/types";
import {
  getPlatformRules,
  type PlatformAnalysisResult,
  type RuleCheck,
} from "./platform-rules/base";

/**
 * Extract plain text from HTML content
 */
function extractPlainText(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

/**
 * Count characters in Chinese and English
 */
function countChars(text: string): number {
  // Count Chinese characters
  const zhChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  // Count English words and other characters
  const enChars = text.replace(/[\u4e00-\u9fa5]/g, "").length;
  return zhChars + enChars;
}

/**
 * Check content length against rules
 */
function checkContentLength(
  html: string,
  rules: typeof import("./platform-rules/base").PlatformRules
): RuleCheck {
  const plainText = extractPlainText(html);
  const charCount = countChars(plainText);
  const { content } = rules;

  const issues: string[] = [];
  let score = 100;

  if (charCount < content.minChars) {
    issues.push(`内容过短 (${charCount}/${content.minChars}字符)，建议增加内容深度`);
    score -= 50;
  } else if (charCount < content.idealChars.min) {
    issues.push(`内容偏短 (${charCount}/${content.idealChars.min}字符)，建议扩展`);
    score -= 20;
  } else if (charCount > content.maxChars) {
    issues.push(`内容过长 (${charCount}/${content.maxChars}字符)，需要精简`);
    score -= 50;
  } else if (charCount > content.idealChars.max) {
    issues.push(`内容偏长 (${charCount}/${content.idealChars.max}字符)，可以适当精简`);
    score -= 10;
  }

  return {
    passed: score >= 70,
    score,
    issues,
  };
}

/**
 * Check title against rules
 */
function checkTitle(
  html: string,
  rules: typeof import("./platform-rules/base").PlatformRules
): RuleCheck {
  const { content, seo } = rules;
  const issues: string[] = [];
  let score = 100;

  if (!content.requiresTitle) {
    return { passed: true, score: 100, issues: [] };
  }

  // Extract title from h1 or first heading
  const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  const hasTitle = !!titleMatch;

  if (!hasTitle) {
    issues.push("缺少标题，建议添加吸引人的标题");
    score -= 100;
  } else {
    const title = extractPlainText(titleMatch![1]);
    const titleLength = countChars(title);

    if (titleLength > content.titleMaxChars) {
      issues.push(`标题过长 (${titleLength}/${content.titleMaxChars}字符)，建议精简`);
      score -= 30;
    }

    // Check H1 count
    const h1Count = (html.match(/<h1[^>]*>/gi) || []).length;
    if (h1Count > seo.maxH1Count) {
      issues.push(`发现${h1Count}个H1标题，建议只保留1个主标题`);
      score -= 20;
    }
  }

  return {
    passed: score >= 70,
    score,
    issues,
  };
}

/**
 * Check SEO against rules
 */
function checkSEO(
  html: string,
  rules: typeof import("./platform-rules/base").PlatformRules
): RuleCheck {
  const { seo } = rules;
  const issues: string[] = [];
  let score = 100;

  if (!seo.requiresH1) {
    return { passed: true, score: 100, issues: [] };
  }

  // Check for H1
  const hasH1 = /<h1[^>]*>/i.test(html);
  if (!hasH1) {
    issues.push("缺少H1标题，建议添加主标题");
    score -= 50;
  }

  // Check for headings structure
  const hasHeadings = /<h[1-6][^>]*>/i.test(html);
  if (!hasHeadings) {
    issues.push("缺少标题结构，建议添加小标题分层内容");
    score -= 20;
  }

  return {
    passed: score >= 70,
    score,
    issues,
  };
}

/**
 * Check format against rules
 */
function checkFormat(
  html: string,
  rules: typeof import("./platform-rules/base").PlatformRules
): RuleCheck {
  const { format } = rules;
  const issues: string[] = [];
  let score = 100;

  // Check for images if not allowed
  if (!format.allowImages) {
    const hasImages = /<img[^>]*>/i.test(html);
    if (hasImages) {
      issues.push("此平台不支持图片内容");
      score -= 100;
    }
  }

  // Check for links if not allowed
  if (!format.allowLinks) {
    const hasLinks = /<a[^>]*>/i.test(html);
    if (hasLinks) {
      issues.push("此平台不支持链接内容");
      score -= 50;
    }
  }

  // Check for paragraphs
  const paragraphs = html.split(/<p[^>]*>/i).filter((p) => p.trim().length > 0);
  if (paragraphs.length < 2) {
    issues.push("内容缺少分段，建议使用多个段落");
    score -= 20;
  }

  return {
    passed: score >= 70,
    score,
    issues,
  };
}

/**
 * Generate suggestions from rule checks
 */
function generateSuggestions(
  checks: PlatformAnalysisResult["checks"]
): string[] {
  const suggestions: string[] = [];

  if (!checks.contentLength.passed) {
    suggestions.push(...checks.contentLength.issues);
  }
  if (!checks.title.passed) {
    suggestions.push(...checks.title.issues);
  }
  if (!checks.seo.passed) {
    suggestions.push(...checks.seo.issues);
  }
  if (!checks.format.passed) {
    suggestions.push(...checks.format.issues);
  }

  return suggestions;
}

/**
 * Calculate overall platform score
 */
function calculatePlatformScore(
  checks: PlatformAnalysisResult["checks"]
): number {
  // Weighted average
  const weights = {
    contentLength: 0.35,
    title: 0.25,
    seo: 0.2,
    format: 0.2,
  };

  const score =
    checks.contentLength.score * weights.contentLength +
    checks.title.score * weights.title +
    checks.seo.score * weights.seo +
    checks.format.score * weights.format;

  return Math.round(score);
}

/**
 * Analyze content for a specific platform
 */
export function analyzeForPlatform(
  contentHtml: string,
  platform: Platform
): PlatformAnalysisResult {
  const rules = getPlatformRules(platform);

  const checks = {
    contentLength: checkContentLength(contentHtml, rules),
    title: checkTitle(contentHtml, rules),
    seo: checkSEO(contentHtml, rules),
    format: checkFormat(contentHtml, rules),
  };

  const score = calculatePlatformScore(checks);
  const suggestions = generateSuggestions(checks);

  return {
    score,
    checks,
    suggestions,
    rules,
  };
}

/**
 * Get platform-specific optimization prompt
 */
export function getOptimizationPrompt(
  contentHtml: string,
  platform: Platform
): string {
  const rules = getPlatformRules(platform);
  const analysis = analyzeForPlatform(contentHtml, platform);

  let prompt = rules.optimization.promptTemplate + "\n\n";

  if (analysis.suggestions.length > 0) {
    prompt += "当前内容问题:\n";
    analysis.suggestions.forEach((s, i) => {
      prompt += `${i + 1}. ${s}\n`;
    });
    prompt += "\n";
  }

  prompt += `请根据以上${getPlatformName(platform)}平台规则，优化以下内容。

原始内容（HTML格式）：
${contentHtml}

【重要】请遵循以下格式要求：
1. 必须返回 HTML 格式的内容
2. 保留段落结构，使用 <p> 标签
3. 保留文本格式，如 <strong> 加粗</strong>、<em> 斜体</em> 等
4. 不要使用 Markdown 格式（如 # 标题、**加粗**）
5. 直接输出优化后的 HTML，不要包含任何解释

优化后的内容：`;

  return prompt;
}

/**
 * Get platform display name
 */
function getPlatformName(platform: Platform): string {
  const names: Record<Platform, string> = {
    wechat: "微信",
    weibo: "微博",
    xiaohongshu: "小红书",
    douyin: "抖音",
  };
  return names[platform] || platform;
}
