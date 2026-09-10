/**
 * ContentCreationBriefV1 → 既有 Brief（ContentPiece.brief / 提示词构建器输入）。
 *
 * 现有编辑器与 4 个平台 buildXPrompt 不改造：把 V1 的约束完整灌入
 * GenerationContext.boundaries（src/lib/ai/prompts/context.ts 已消费）。
 * 生成时使用 locked 与 editable 数组规范化去重后的并集（设计 §8.5）。
 */

import type { Brief } from "@/types";
import type { Platform } from "@/types";
import {
  SUPPORTED_GENERATION_PLATFORMS,
  type ContentCreationBriefV1,
  type ProjectSnapshotV1,
} from "@/contracts/content-creation-brief-v1";

function mergeConstraints(locked: string[], editable: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of [...locked, ...editable]) {
    const v = value.trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

export function effectiveBriefToGenerationBrief(
  brief: ContentCreationBriefV1,
  opts: {
    projectSnapshot?: ProjectSnapshotV1 | null;
    brandVoiceId?: string | null;
  } = {},
): Brief {
  const supported = new Set<string>(SUPPORTED_GENERATION_PLATFORMS);
  const platforms = brief.platformPlan
    .filter((p) => p.selected && p.capability === "supported" && supported.has(p.platform))
    .map((p) => p.platform as Platform);

  const project = opts.projectSnapshot;
  const projectContext = project
    ? {
        projectId: project.projectId,
        productName: project.productName,
        productDescription: project.productDescription,
        positioning: project.industry,
      }
    : { projectId: brief.projectId };

  return {
    topic: brief.editorial.topic,
    keyPoints: brief.editorial.outline.map((section) =>
      section.purpose ? `${section.heading}——${section.purpose}` : section.heading,
    ),
    platforms: platforms.length > 0 ? platforms : ["wechat"],
    references: brief.editorial.references.map((r) => r.url).join("\n"),
    notes: brief.editorial.notes ?? "",
    ...(opts.brandVoiceId ? { brandVoiceId: opts.brandVoiceId } : {}),
    context: {
      project: projectContext,
      boundaries: {
        mustMention: mergeConstraints(
          brief.constraints.locked.mustMention,
          brief.constraints.editable.mustMention,
        ),
        avoidMention: mergeConstraints(
          brief.constraints.locked.avoidMention,
          brief.constraints.editable.avoidMention,
        ),
        allowedClaims: brief.constraints.locked.allowedClaims,
        forbiddenClaims: brief.constraints.locked.forbiddenClaims,
        competitors: [],
      },
      idea: {
        title: brief.editorial.topic,
        angle: brief.strategy.objective,
        contentType: brief.strategy.contentType,
        keywords: brief.editorial.keywords,
      },
    },
  };
}
