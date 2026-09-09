/**
 * LLM 提炼输出质量门（设计 §11.4）。
 *
 * 候选只能为 editable 范围（editorial + audience）提供值：
 * 不接受平台计划、约束、来源、生成元数据等越权字段；
 * 不允许复制内部来源原文、出现内部执行话术、
 * 新增来源中不存在的数字/价格/百分比，或偏离规则版的业务目标。
 */

import {
  BRIEF_LIMITS,
  type ContentCreationBriefV1,
  type ProjectSnapshotV1,
  type VisibilitySuggestionSnapshotV1,
} from "@/contracts/content-creation-brief-v1";

export interface RefinementCandidateV1 {
  topic?: string;
  titleCandidates?: string[];
  outline?: Array<{ heading: string; purpose: string }>;
  keywords?: string[];
  notes?: string;
  audience?: string;
}

export interface QualityGateContext {
  baseline: ContentCreationBriefV1;
  snapshot: VisibilitySuggestionSnapshotV1;
  projectSnapshot: ProjectSnapshotV1;
}

export interface QualityGateResult {
  ok: boolean;
  /** 命中的门禁 ID 列表（gate-1 … gate-10）。 */
  violations: string[];
  candidate: RefinementCandidateV1 | null;
}

/** 规范化：全角→半角、去空白与标点、拉丁转小写（设计 §11.4 来源重叠检测前置）。 */
export function normalizeForOverlap(value: string): string {
  return value
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[\s　]/g, "")
    .replace(/[。，、；：？！“”‘’（）《》【】…—·,.;:?!"'()\[\]<>#*_~`|\\/{}-]/g, "")
    .toLowerCase();
}

const INTERNAL_JARGON =
  /(优化建议|审计发现|审计结论|验收标准|任务完成|建议稿|内部观察|工单|执行任务|本期任务|待办事项|口径对齐)/;

const ALLOWED_CANDIDATE_KEYS = new Set([
  "topic",
  "titleCandidates",
  "outline",
  "keywords",
  "notes",
  "audience",
]);

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/** 从任意文本中提取数字/百分比/价格记号，用于“不新增数字”检测。 */
function extractNumbers(value: string): Set<string> {
  const normalized = value.replace(/[！-～]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
  const tokens = normalized.match(/\d+(?:\.\d+)?%?|[¥$]\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?\s*[元万亿]/g) ?? [];
  return new Set(tokens.map((t) => t.replace(/\s+/g, "")));
}

/** 长度 ≥12 规范化字符的连续片段重叠检测。 */
export function hasLongOverlap(a: string, b: string, minLength = 12): boolean {
  const na = normalizeForOverlap(a);
  const nb = normalizeForOverlap(b);
  if (na.length < minLength || nb.length < minLength) return false;
  for (let i = 0; i + minLength <= na.length; i++) {
    if (nb.includes(na.slice(i, i + minLength))) return true;
  }
  return false;
}

function sourceTexts(ctx: QualityGateContext): string[] {
  const s = ctx.snapshot;
  return [
    s.text,
    s.description ?? "",
    s.evidenceSummary ?? "",
    s.contentOutline ?? "",
    s.expectedResult ?? "",
    s.successMetric ?? "",
    s.measurementPlan ?? "",
    ...s.auditFindings,
    ...s.acceptanceCriteria,
  ].filter(Boolean);
}

function candidateTexts(candidate: RefinementCandidateV1): string[] {
  return [
    candidate.topic ?? "",
    ...(candidate.titleCandidates ?? []),
    ...(candidate.outline ?? []).flatMap((s) => [s.heading, s.purpose]),
    candidate.notes ?? "",
  ].filter(Boolean);
}

export function validateRefinementCandidate(
  raw: unknown,
  ctx: QualityGateContext
): QualityGateResult {
  const violations: string[] = [];

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, violations: ["gate-1-structure"], candidate: null };
  }
  const input = raw as Record<string, unknown>;
  const unknownKeys = Object.keys(input).filter((key) => !ALLOWED_CANDIDATE_KEYS.has(key));
  if (unknownKeys.length > 0) {
    // 越权字段（平台、约束、来源等）一律拒绝（设计 §8.5）。
    return { ok: false, violations: ["gate-1-structure"], candidate: null };
  }

  const candidate: RefinementCandidateV1 = {};
  if (input.topic !== undefined) {
    if (typeof input.topic !== "string" || !input.topic.trim()) {
      return { ok: false, violations: ["gate-2-topic-outline"], candidate: null };
    }
    candidate.topic = input.topic.trim().slice(0, BRIEF_LIMITS.topicMaxLength);
  }
  if (input.audience !== undefined) {
    if (typeof input.audience !== "string" || input.audience.length > 500) {
      return { ok: false, violations: ["gate-1-structure"], candidate: null };
    }
    candidate.audience = input.audience.trim();
  }
  if (input.titleCandidates !== undefined) {
    if (!isStringArray(input.titleCandidates)) {
      return { ok: false, violations: ["gate-1-structure"], candidate: null };
    }
    candidate.titleCandidates = input.titleCandidates
      .filter((t) => t.trim())
      .slice(0, BRIEF_LIMITS.titleCandidateMaxCount)
      .map((t) => t.trim().slice(0, BRIEF_LIMITS.titleCandidateMaxLength));
  }
  if (input.keywords !== undefined) {
    if (!isStringArray(input.keywords)) {
      return { ok: false, violations: ["gate-1-structure"], candidate: null };
    }
    candidate.keywords = input.keywords
      .filter((k) => k.trim())
      .slice(0, BRIEF_LIMITS.keywordMaxCount)
      .map((k) => k.trim().slice(0, BRIEF_LIMITS.keywordMaxLength));
  }
  if (input.notes !== undefined) {
    if (typeof input.notes !== "string") {
      return { ok: false, violations: ["gate-1-structure"], candidate: null };
    }
    candidate.notes = input.notes.slice(0, BRIEF_LIMITS.notesMaxLength);
  }
  if (input.outline !== undefined) {
    if (
      !Array.isArray(input.outline) ||
      input.outline.length < BRIEF_LIMITS.outlineMinItems ||
      input.outline.length > BRIEF_LIMITS.outlineMaxItems
    ) {
      return { ok: false, violations: ["gate-2-topic-outline"], candidate: null };
    }
    const outline: Array<{ heading: string; purpose: string }> = [];
    for (const section of input.outline) {
      if (!section || typeof section !== "object") {
        return { ok: false, violations: ["gate-1-structure"], candidate: null };
      }
      const record = section as Record<string, unknown>;
      if (
        typeof record.heading !== "string" ||
        !record.heading.trim() ||
        typeof record.purpose !== "string" ||
        !record.purpose.trim()
      ) {
        return { ok: false, violations: ["gate-2-topic-outline"], candidate: null };
      }
      outline.push({
        heading: record.heading.trim().slice(0, BRIEF_LIMITS.outlineHeadingMaxLength),
        purpose: record.purpose.trim().slice(0, BRIEF_LIMITS.outlinePurposeMaxLength),
      });
    }
    candidate.outline = outline;
  }

  // Gate 5：不完整复制任何内部来源字段。
  const sources = sourceTexts(ctx);
  for (const text of candidateTexts(candidate)) {
    for (const source of sources) {
      if (hasLongOverlap(text, source)) {
        violations.push("gate-5-source-copy");
        break;
      }
    }
    if (violations.includes("gate-5-source-copy")) break;
  }

  // Gate 6：不包含内部执行话术。
  if (candidateTexts(candidate).some((text) => INTERNAL_JARGON.test(text))) {
    violations.push("gate-6-internal-jargon");
  }

  // Gate 7：不删除项目名称、产品关键词（候选文本需保留品牌或核心关键词）。
  const brand = ctx.projectSnapshot.name;
  const productKeywords = ctx.projectSnapshot.productKeywords;
  const mustKeep = [brand, ...productKeywords].filter(Boolean);
  const topicText = normalizeForOverlap(candidate.topic ?? ctx.baseline.editorial.topic);
  if (
    mustKeep.length > 0 &&
    !mustKeep.some((token) => topicText.includes(normalizeForOverlap(token)))
  ) {
    violations.push("gate-7-removed-anchors");
  }

  // Gate 8：不新增来源中不存在的数字/价格/百分比。
  const allowedNumbers = new Set<string>();
  for (const text of [...sources, ctx.baseline.editorial.topic, ctx.baseline.editorial.notes ?? ""]) {
    for (const n of extractNumbers(text)) allowedNumbers.add(n);
  }
  const candidateNumbers = new Set<string>();
  for (const text of candidateTexts(candidate)) {
    for (const n of extractNumbers(text)) candidateNumbers.add(n);
  }
  for (const n of candidateNumbers) {
    if (!allowedNumbers.has(n)) {
      violations.push("gate-8-new-numbers");
      break;
    }
  }

  // Gate 9：主题与大纲之间不存在明显重复。
  if (candidate.outline) {
    const headings = candidate.outline.map((s) => normalizeForOverlap(s.heading));
    for (let i = 0; i < headings.length; i++) {
      for (let j = i + 1; j < headings.length; j++) {
        if (headings[i].length >= 4 && headings[i] === headings[j]) {
          violations.push("gate-9-duplicate-sections");
        }
      }
    }
    if (candidate.topic) {
      const normalizedTopic = normalizeForOverlap(candidate.topic);
      if (headings.some((h) => h.length >= 12 && (h === normalizedTopic || normalizedTopic.includes(h)))) {
        violations.push("gate-9-duplicate-sections");
      }
    }
  }

  // Gate 10：与规则版保持相同业务目标（共享核心词或品牌，不做无关行业泛文）。
  const baselineKeywords = ctx.baseline.editorial.keywords.map(normalizeForOverlap).filter(Boolean);
  const newTopic = normalizeForOverlap(candidate.topic ?? "");
  if (newTopic) {
    const sharesKeyword =
      baselineKeywords.some((k) => k.length >= 2 && newTopic.includes(k)) ||
      (brand && newTopic.includes(normalizeForOverlap(brand)));
    const overlap = hasLongOverlap(newTopic, ctx.baseline.editorial.topic, 8);
    if (!sharesKeyword && !overlap) {
      violations.push("gate-10-off-topic");
    }
  }

  return { ok: violations.length === 0, violations, candidate };
}
