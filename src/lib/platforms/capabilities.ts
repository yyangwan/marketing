/**
 * 平台生成能力声明（设计 §10.9）。
 *
 * enabled 集合从真实的提示词构建器推导：构建器被删除或改名时本模块
 * 编译失败，能力接口不可能与实现漂移。
 */

import type { PlatformCapabilitiesV1 } from "@/contracts/content-platform-capabilities-v1";
import { FALLBACK_CAPABILITIES } from "@/contracts/content-platform-capabilities-v1";
import { buildWeChatPrompt } from "@/lib/ai/prompts/wechat";
import { buildWeiboPrompt } from "@/lib/ai/prompts/weibo";
import { buildXiaohongshuPrompt } from "@/lib/ai/prompts/xiaohongshu";
import { buildDouyinPrompt } from "@/lib/ai/prompts/douyin";

/** 已实现的提示词构建器：能力接口的 enabled 集合必须等于这四个键。 */
export const IMPLEMENTED_PROMPT_BUILDERS = {
  wechat: buildWeChatPrompt,
  weibo: buildWeiboPrompt,
  xiaohongshu: buildXiaohongshuPrompt,
  douyin: buildDouyinPrompt,
} as const;

/** 每个平台的默认并发上限（设计 §7.4：每个工作流 2 个平台并发）。 */
export const PLATFORM_MAX_CONCURRENT = 2 as const;

export function getGenerationCapabilities(): PlatformCapabilitiesV1 {
  const platforms: PlatformCapabilitiesV1["platforms"] = {};
  for (const platform of Object.keys(IMPLEMENTED_PROMPT_BUILDERS)) {
    platforms[platform] = { enabled: true, maxConcurrent: PLATFORM_MAX_CONCURRENT };
  }
  platforms.zhihu = { enabled: false, reason: "generator_not_implemented" };
  platforms.toutiao = { enabled: false, reason: "generator_not_implemented" };
  return { schemaVersion: 1, platforms };
}

/** 测试与降级用：能力接口与编译期保守快照必须一致。 */
export function capabilitiesMatchFallback(caps: PlatformCapabilitiesV1): boolean {
  return JSON.stringify(caps) === JSON.stringify(FALLBACK_CAPABILITIES);
}
