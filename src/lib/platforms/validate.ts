/**
 * 平台严格校验（设计 §17.2）：不支持的值一律失败，禁止默认回退微信。
 * 所有接受平台输入的入口（创建 ContentPiece、Brief、工作流）必须使用本模块。
 */

import {
  SUPPORTED_GENERATION_PLATFORMS,
  type SupportedGenerationPlatform,
} from "@/contracts/content-creation-brief-v1";

export type PlatformParseResult =
  | { ok: true; platforms: SupportedGenerationPlatform[] }
  | {
      ok: false;
      code: "PLATFORM_MISSING" | "PLATFORM_NOT_SUPPORTED";
      invalid: string[];
    };

const SUPPORTED_SET = new Set<string>(SUPPORTED_GENERATION_PLATFORMS);

/**
 * 解析平台输入：必须是数组（或单个字符串）且每一项都属于
 * SUPPORTED_GENERATION_PLATFORMS。空输入、混入未知平台的输入全部失败，
 * 不做部分采纳，也不提供默认值。
 */
export function parseSupportedPlatforms(value: unknown): PlatformParseResult {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const seen = new Set<string>();
  const invalid: string[] = [];

  for (const item of raw) {
    if (typeof item !== "string" || item.length === 0) {
      invalid.push(String(item));
      continue;
    }
    if (!SUPPORTED_SET.has(item)) {
      invalid.push(item);
      continue;
    }
    seen.add(item);
  }

  if (invalid.length > 0) {
    return { ok: false, code: "PLATFORM_NOT_SUPPORTED", invalid };
  }
  if (seen.size === 0) {
    return { ok: false, code: "PLATFORM_MISSING", invalid: [] };
  }
  return { ok: true, platforms: [...seen] as SupportedGenerationPlatform[] };
}
