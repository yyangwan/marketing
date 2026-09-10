/**
 * LLM 提炼：提示词构建与合并优先级（设计 §8.5/§11.3）。
 *
 * LLM 只接收：规范建议快照、项目快照、规则版 Brief、平台能力、
 * 明确的 JSON 输出结构与不可覆盖的事实与合规规则。
 * 合并时 locked 约束与来源永不来自 LLM。
 */

import type {
  ContentCreationBriefV1,
  ProjectSnapshotV1,
  VisibilitySuggestionSnapshotV1,
} from "@/contracts/content-creation-brief-v1";
import type { PlatformCapabilitiesV1 } from "@/contracts/content-platform-capabilities-v1";
import type { RefinementCandidateV1 } from "./quality-gates";

export const REFINEMENT_PROMPT_VERSION = "refinement-v1";
export const REFINEMENT_MODEL = "deepseek-chat";
export const REFINEMENT_TIMEOUT_MS = 45_000;
export const REFINEMENT_MAX_TOKENS = 2_000;
export const REFINEMENT_TEMPERATURE = 0.2;

export function buildRefinementPrompt(params: {
  baseline: ContentCreationBriefV1;
  snapshot: VisibilitySuggestionSnapshotV1;
  projectSnapshot: ProjectSnapshotV1;
  capabilities: PlatformCapabilitiesV1;
}): { system: string; user: string } {
  const { baseline, snapshot, projectSnapshot, capabilities } = params;

  const system = [
    "你是一名中文内容编辑。你的任务是把内部优化任务的语言改写成面向读者的创作方案表达。",
    "必须遵守：",
    "1. 输出仅是一个 JSON 对象，不包含解释文字。",
    '2. 只允许这些字段：topic（字符串）、titleCandidates（≤5 个字符串）、outline（4-12 项，每项 {heading, purpose}）、keywords（≤20 个字符串）、notes（字符串）、audience（字符串）。不得输出平台、约束、来源或元数据字段。',
    "3. 不得复制建议原文、审计发现、验收标准等内部话术；主题与小节必须用读者语言。",
    "4. 不得新增来源中不存在的数字、案例、认证、价格或客户名称。",
    "5. 不得删除品牌名称与产品关键词；不得偏离规则版的业务目标。",
    "6. 禁止联网补充来源；不得建议任何 URL。",
  ].join("\n");

  const capabilityLines = Object.entries(capabilities.platforms)
    .map(([platform, cap]) => `${platform}: ${cap.enabled ? "支持" : `不支持（${cap.reason ?? ""}）`}`)
    .join("；");

  const user = JSON.stringify(
    {
      说明: "在规则版创作方案的基础上提炼表达质量。保持事实与业务目标不变，只改进面向读者的清晰度与结构。",
      项目快照: {
        名称: projectSnapshot.name,
        行业: projectSnapshot.industry ?? "",
        产品名: projectSnapshot.productName ?? "",
        产品关键词: projectSnapshot.productKeywords,
        产品描述: projectSnapshot.productDescription ?? "",
      },
      规范建议快照: {
        建议标题: snapshot.text,
        描述: snapshot.description ?? "",
        类型标签: snapshot.typeTags,
        关键词: snapshot.keywords,
        内容大纲线索: snapshot.contentOutline ?? "",
      },
      规则版创作方案: {
        主题: baseline.editorial.topic,
        候选标题: baseline.editorial.titleCandidates,
        大纲: baseline.editorial.outline.map((s) => ({ 标题: s.heading, 目的: s.purpose })),
        关键词: baseline.editorial.keywords,
        备注: baseline.editorial.notes ?? "",
        内容类型: baseline.strategy.contentType,
      },
      平台能力: capabilityLines,
      输出结构: {
        topic: "字符串，≤200 字",
        titleCandidates: "字符串数组，≤5 项，每项 ≤120 字",
        outline: "对象数组，4-12 项，每项 {heading: ≤120 字, purpose: ≤800 字}",
        keywords: "字符串数组，≤20 项",
        notes: "字符串，≤4000 字",
        audience: "字符串，目标读者",
      },
    },
    null,
    0,
  );

  return { system, user };
}

/**
 * 按 §8.5 优先级合并：服务端锁定 > 用户编辑 > 通过质量门的 LLM 候选 > 规则版。
 * LLM 结果只能覆盖 editorial 的表达字段与 audience；locked/来源/平台计划不动。
 */
export function mergeRefined(
  baseline: ContentCreationBriefV1,
  candidate: RefinementCandidateV1,
  meta: { model: string; promptVersion: string }
): ContentCreationBriefV1 {
  const now = new Date().toISOString();
  return {
    ...baseline,
    revision: baseline.revision, // 由调用方在条件更新中处理
    status: "ready",
    strategy: {
      ...baseline.strategy,
      ...(candidate.audience ? { audience: candidate.audience } : {}),
    },
    editorial: {
      ...baseline.editorial,
      ...(candidate.topic ? { topic: candidate.topic } : {}),
      ...(candidate.titleCandidates ? { titleCandidates: candidate.titleCandidates } : {}),
      ...(candidate.outline
        ? {
            outline: candidate.outline.map((section, index) => ({
              id: `section_${index + 1}`,
              heading: section.heading,
              purpose: section.purpose,
              evidenceRefs: [],
            })),
          }
        : {}),
      ...(candidate.keywords ? { keywords: candidate.keywords } : {}),
      ...(candidate.notes !== undefined ? { notes: candidate.notes } : {}),
    },
    // platformPlan、source、constraints 保持规则版/用户版不动。
    generationMeta: {
      effectiveSource: "llm",
      rulesVersion: baseline.generationMeta.rulesVersion,
      promptVersion: meta.promptVersion,
      model: meta.model,
      refinementBaseRevision: baseline.revision,
    },
    updatedAt: now,
  };
}
