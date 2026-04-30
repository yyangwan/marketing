/**
 * WeChat Official Account Platform Rules
 *
 * WeChat articles are long-form content with emphasis on:
 * - Quality over quantity (1500-2500 characters ideal)
 * - Clear structure with headings
 * - Engaging opening to capture readers
 * - Professional tone
 *
 * Source: 微信公众平台运营规范
 */

import type { PlatformRules } from "./base";

export const wechatRules: PlatformRules = {
  platform: "wechat",

  content: {
    minChars: 300,
    maxChars: 10000,
    idealChars: { min: 1500, max: 2500 },
    requiresTitle: true,
    titleMaxChars: 64,
  },

  seo: {
    keywordDensity: { min: 1, max: 3 }, // WeChat SEO is relatively lenient
    requiresH1: true,
    maxH1Count: 1,
  },

  format: {
    allowImages: true,
    allowLinks: true,
    allowHtml: true,
    paragraphStyle: "medium",
  },

  optimization: {
    promptTemplate: `针对微信公众号优化内容：
- 标题：吸引点击但不标题党，简洁有力
- 开头：前150字必须抓住读者注意力
- 结构：段落清晰有层次，使用小标题
- 结尾：引导关注或行动呼吁
- 语气：专业但不生硬，有温度`,
    focusAreas: ["title", "opening", "structure", "call-to-action"],
  },
};
