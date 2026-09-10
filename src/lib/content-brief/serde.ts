/**
 * ContentBrief 表 JSON 字段的序列化/解析。
 * MySQL MediumText 存字符串（仓库惯例），损坏数据回退到调用方提供的默认值。
 */

import type {
  ContentCreationBriefV1,
  GenerationMetaView,
  ProjectSnapshotV1,
  VisibilitySuggestionSnapshotV1,
} from "./types";

export function parseJsonField<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function parseBrief(raw: string | null | undefined): ContentCreationBriefV1 | null {
  const value = parseJsonField<ContentCreationBriefV1 | null>(raw, null);
  return value && typeof value === "object" && value.schemaVersion === 1 ? value : null;
}

export function parseSourceSnapshot(
  raw: string | null | undefined,
): VisibilitySuggestionSnapshotV1 | null {
  const value = parseJsonField<VisibilitySuggestionSnapshotV1 | null>(raw, null);
  return value && typeof value === "object" && value.schemaVersion === 1 ? value : null;
}

export function parseProjectSnapshot(
  raw: string | null | undefined,
): ProjectSnapshotV1 | null {
  const value = parseJsonField<ProjectSnapshotV1 | null>(raw, null);
  return value && typeof value === "object" && value.schemaVersion === 1 ? value : null;
}

export function parseGenerationMeta(
  raw: string | null | undefined,
): GenerationMetaView | null {
  return parseJsonField<GenerationMetaView | null>(raw, null);
}

export function stringify(value: unknown): string {
  return JSON.stringify(value);
}
