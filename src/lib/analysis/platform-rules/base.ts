/**
 * Platform Rules Base Types
 *
 * Defines the structure for platform-specific content rules.
 * Each platform (WeChat, Weibo, Xiaohongshu, Douyin) has unique
 * requirements for content length, format, SEO, and style.
 */

import type { Platform } from "@/types";

/**
 * Platform-specific content rules
 */
export interface PlatformRules {
  platform: Platform;

  /** Content length and structure requirements */
  content: {
    minChars: number;
    maxChars: number;
    idealChars: { min: number; max: number };
    requiresTitle: boolean;
    titleMaxChars: number;
  };

  /** SEO and keyword requirements */
  seo: {
    keywordDensity: { min: number; max: number };
    requiresH1: boolean;
    maxH1Count: number;
  };

  /** Format and style requirements */
  format: {
    allowImages: boolean;
    allowLinks: boolean;
    allowHtml: boolean;
    paragraphStyle: "short" | "medium" | "long";
  };

  /** AI optimization settings */
  optimization: {
    promptTemplate: string;
    focusAreas: string[];
  };
}

/**
 * Platform analysis result
 */
export interface PlatformAnalysisResult {
  score: number; // 0-100
  checks: {
    contentLength: RuleCheck;
    title: RuleCheck;
    seo: RuleCheck;
    format: RuleCheck;
  };
  suggestions: string[];
  rules: PlatformRules;
}

/**
 * Individual rule check result
 */
export interface RuleCheck {
  passed: boolean;
  score: number; // 0-100
  issues: string[];
}

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
 * Get platform rules by platform key
 */
export function getPlatformRules(platform: Platform): PlatformRules {
  switch (platform) {
    case "wechat":
      return wechatRules;
    case "weibo":
      return weiboRules;
    case "xiaohongshu":
      return xiaohongshuRules;
    case "douyin":
      return douyinRules;
    default:
      return wechatRules; // fallback
  }
}

// Platform rule imports - will be defined in separate files
import { wechatRules } from "./wechat";
import { weiboRules } from "./weibo";
import { xiaohongshuRules } from "./xiaohongshu";
import { douyinRules } from "./douyin";
