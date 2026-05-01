/**
 * Content Optimizer
 *
 * AI-powered platform-specific content optimization using DeepSeek.
 */

import { callLLM } from "@/lib/ai/client";
import { getOptimizationPrompt } from "./platform-analyzer";
import type { Platform } from "@/types";

/**
 * Optimization result
 */
export interface OptimizationResult {
  original: string;
  optimized: string;
  diff: string;
  applied: boolean;
}

/**
 * Simple diff generator - shows line-by-line changes
 * For production, use a proper diff library like diff-match-patch
 */
function generateDiff(original: string, optimized: string): string {
  const origLines = original.split("\n");
  const optLines = optimized.split("\n");

  let diff = "";

  // Simple word-based diff for short content
  if (origLines.length < 10 && optLines.length < 10) {
    if (original === optimized) {
      return "无变化";
    }
    return `原文:\n${original}\n\n优化后:\n${optimized}`;
  }

  // Line-by-line comparison for longer content
  let i = 0;
  let j = 0;

  while (i < origLines.length || j < optLines.length) {
    const origLine = origLines[i] || "";
    const optLine = optLines[j] || "";

    if (origLine === optLine) {
      diff += `  ${origLine}\n`;
      i++;
      j++;
    } else {
      if (origLine) {
        diff += `- ${origLine}\n`;
        i++;
      }
      if (optLine) {
        diff += `+ ${optLine}\n`;
        j++;
      }
    }
  }

  return diff || "无变化";
}

/**
 * Ensure content is wrapped in HTML tags
 * If content is plain text, wrap in <p> tags
 */
function ensureHtmlFormat(content: string): string {
  const trimmed = content.trim();

  // Check if content already has HTML tags
  if (trimmed.includes('<') && trimmed.includes('>')) {
    return trimmed;
  }

  // Plain text - wrap in paragraph tags
  // Split by double newlines to preserve paragraphs
  const paragraphs = trimmed.split(/\n\n+/);
  return paragraphs
    .map(p => p.trim() ? `<p>${p.replace(/\n/g, '<br>')}</p>` : '')
    .join('');
}

/**
 * Optimize content for a specific platform using AI
 */
export async function optimizeForPlatform(
  contentHtml: string,
  platform: Platform
): Promise<OptimizationResult> {
  // Build optimization prompt
  const prompt = getOptimizationPrompt(contentHtml, platform);

  try {
    // Call AI for optimization
    const optimized = await callLLM(prompt);

    // Ensure the result is in HTML format
    const safeOptimized = ensureHtmlFormat(optimized);

    // Generate diff
    const diff = generateDiff(contentHtml, safeOptimized);

    return {
      original: contentHtml,
      optimized: safeOptimized,
      diff,
      applied: false,
    };
  } catch (error) {
    // If AI call fails, return original with error note
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return {
      original: contentHtml,
      optimized: contentHtml,
      diff: `优化失败: ${errorMessage}`,
      applied: false,
    };
  }
}

/**
 * Get human-readable platform name
 */
export function getPlatformName(platform: Platform): string {
  const names: Record<Platform, string> = {
    wechat: "微信",
    weibo: "微博",
    xiaohongshu: "小红书",
    douyin: "抖音",
  };
  return names[platform] || platform;
}
