/**
 * Douyin (抖音) Platform Rules
 *
 * Douyin is a short-video platform with emphasis on:
 * - Script-driven video content (15-60 seconds typical)
 * - Hook in first 3 seconds to retain viewers
 * - Trending audio and challenges
 * - Clear narrative or entertainment value
 * - Call-to-action for engagement (follow, like, share)
 *
 * Content style: Energetic, entertaining, concise, visually-driven
 *
 * Note: This covers script generation. Video creation is separate.
 *
 * Source: 抖音创作者平台
 */

import type { PlatformRules } from "./base";

export const douyinRules: PlatformRules = {
  platform: "douyin",

  content: {
    minChars: 50,
    maxChars: 2000,
    idealChars: { min: 150, max: 500 },
    requiresTitle: false, // Title displayed separately in UI
    titleMaxChars: 50,
  },

  seo: {
    keywordDensity: { min: 0.5, max: 2 },
    requiresH1: false,
    maxH1Count: 0,
  },

  format: {
    allowImages: false, // Video-only platform
    allowLinks: false,
    allowHtml: false,
    paragraphStyle: "short",
  },

  optimization: {
    promptTemplate: `针对抖音视频脚本优化：
- 开头（前3秒）：必须有强钩子，抓住眼球
- 结构：冲突/问题 → 行动/解决 → 反转/结果
- 长度：30-60秒最佳（约150-300字口播）
- 对话：使用口语化表达，生动有趣
- 节奏：每2-3秒一个变化点，保持注意力
- 结尾：引导互动（关注、点赞、评论）
- BGM：建议搭配热门音乐提升完播率`,
    focusAreas: ["hook", "structure", "engagement", "rhythm"],
  },
};
