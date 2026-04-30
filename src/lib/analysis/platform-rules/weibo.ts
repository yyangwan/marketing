/**
 * Weibo Platform Rules
 *
 * Weibo posts are short-form microblog content with emphasis on:
 * - Brevity (2000 chars max for normal accounts, 140 for classic)
 * - Hashtags for discoverability
 * - @mentions for engagement
 * - Visual content (images)
 * - Trending topics integration
 *
 * Source: 微博开放平台
 */

import type { PlatformRules } from "./base";

export const weiboRules: PlatformRules = {
  platform: "weibo",

  content: {
    minChars: 10,
    maxChars: 2000, // Normal account limit
    idealChars: { min: 50, max: 500 },
    requiresTitle: false,
    titleMaxChars: 0,
  },

  seo: {
    keywordDensity: { min: 0.5, max: 2 }, // Hashtags replace keywords
    requiresH1: false,
    maxH1Count: 0,
  },

  format: {
    allowImages: true,
    allowLinks: true, // Shortened URLs preferred
    allowHtml: false, // WeChat uses rich text editor, not raw HTML
    paragraphStyle: "short",
  },

  optimization: {
    promptTemplate: `针对微博优化内容：
- 开头：简洁有力，第一句话就要吸引眼球
- 长度：控制在140字以内（经典账户）或500字以内
- 话题：使用2-3个相关话题标签 #话题#
- 互动：添加@提及相关账号或用户
- 语气：轻松活泼，贴近网络用语
- 配图：建议配1-9张图片增加吸引力`,
    focusAreas: ["opening", "length", "hashtags", "engagement"],
  },
};
