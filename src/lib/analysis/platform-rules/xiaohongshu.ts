/**
 * Xiaohongshu (小红书) Platform Rules
 *
 * Xiaohongshu is a lifestyle-focused platform with emphasis on:
 * - Authentic personal experiences and reviews
 * - Visual-first content (high-quality images required)
 * - Detailed, informative product/service reviews
 * - Community engagement through comments
 * - Hashtags for categorization
 *
 * Content style: Personal, authentic, helpful, lifestyle-oriented
 *
 * Source: 小红书创作者平台
 */

import type { PlatformRules } from "./base";

export const xiaohongshuRules: PlatformRules = {
  platform: "xiaohongshu",

  content: {
    minChars: 50,
    maxChars: 5000,
    idealChars: { min: 300, max: 1500 },
    requiresTitle: true,
    titleMaxChars: 50,
  },

  seo: {
    keywordDensity: { min: 1, max: 4 }, // Moderate keyword usage
    requiresH1: false,
    maxH1Count: 0,
  },

  format: {
    allowImages: true, // Required - min 1 image
    allowLinks: false, // Links not allowed in posts
    allowHtml: false,
    paragraphStyle: "short",
  },

  optimization: {
    promptTemplate: `针对小红书优化内容：
- 标题：吸引眼球，突出核心价值（20-50字）
- 正文：真实体验分享，使用"我"的视角
- 结构：总分总结构，开头说结论，中间分点展开
- 细节：描述具体使用场景、效果感受
- 话题：添加3-5个相关标签 #话题#
- 语气：亲切真诚，像朋友推荐好东西
- 配图：建议1-5张高质量图片`,
    focusAreas: ["title", "authenticity", "details", "visuals"],
  },
};
