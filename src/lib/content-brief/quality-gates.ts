/**
 * LLM 提炼输出质量门（设计 §11.4，评审 R5）。
 *
 * 候选只能为 editable 范围（editorial + audience）提供值：
 * 不接受平台计划、约束、来源、生成元数据等越权字段；
 * 不允许复制内部来源原文、出现内部执行话术、
 * 新增来源中不存在的数字/价格/百分比，或偏离规则版的业务目标；
 * 不允许出现允许来源之外的任何链接（gate-11），
 * 客户/认证/案例/合作等事实性声明必须可追溯到来源或项目语料（gate-12）。
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

/** 提取文本中的 URL（gate-11 链接白名单）。 */
const URL_PATTERN = /(https?:\/\/[^\s"'<>（）【】`]+|www\.[^\s"'<>（）【】`]+)/gi;

function extractUrls(texts: string[]): Set<string> {
  const out = new Set<string>();
  for (const text of texts) {
    for (const match of text.matchAll(URL_PATTERN)) {
      const url = match[1].replace(/[。，、；：？！”』）]…]+$/g, "").toLowerCase();
      if (url.length > 0) out.add(url);
    }
  }
  return out;
}

/**
 * 不可证实的声明检测语料（gate-12）：来源快照 + 项目快照 + 规则版全部
 * 编辑字段的规范化拼接，声明句中的实体必须能在其中找到。
 */
function allowedClaimCorpus(ctx: QualityGateContext): string {
  const project = ctx.projectSnapshot;
  const baseline = ctx.baseline;
  const parts = [
    ...sourceTexts(ctx),
    project.name,
    project.industry ?? "",
    project.productName ?? "",
    project.productDescription ?? "",
    ...project.productKeywords,
    baseline.editorial.topic,
    ...(baseline.editorial.titleCandidates ?? []),
    ...baseline.editorial.outline.flatMap((s) => [s.heading, s.purpose]),
    ...(baseline.editorial.keywords ?? []),
    baseline.editorial.notes ?? "",
    baseline.strategy.objective,
    baseline.strategy.audience ?? "",
  ].filter(Boolean);
  return normalizeForOverlap(parts.join(" "));
}

/** 声明句标记：出现即认为该句在新增事实性声明，需要逐实体追溯。 */
const CLAIM_SENTENCE_PATTERN =
  /(客户包括|客户有|客户涵盖|合作伙伴|案例包括|案例有|服务过的?客户|认证|专利|资质|获奖|斩获|跻身)/;

/** 声明限定词：本身必须可追溯（“权威认证”里的“权威”不允许凭空出现）。 */
const CLAIM_QUALIFIER_PATTERN = /(权威|国际|官方|国家级|行业级|顶级|知名|头部|一线|领先)/g;

/** 实体切分后的通用词，不作为待追溯实体。 */
const GENERIC_CLAIM_WORDS = new Set([
  "已获得", "获得", "包括", "涵盖", "多家", "众多", "等", "客户", "案例", "认证", "专利",
  "资质", "奖项", "奖励", "合作", "伙伴", "权威", "国际", "官方", "国家级", "行业级",
  "顶级", "知名", "头部", "一线", "领先", "公司", "企业", "品牌", "机构", "组织", "平台",
  "行业", "市场", "产品", "服务", "用户", "参考", "如下", "以下",
]);

function extractClaimEntities(sentence: string): string[] {
  const entities: string[] = [];
  // 标记之后的片段按并列分隔符切分为实体（客户包括 A 与 B、C）。
  const markerMatch = sentence.match(/(客户包括|客户有|客户涵盖|案例包括|案例有|合作伙伴|服务过的?客户)/);
  const tail = markerMatch ? sentence.slice((markerMatch.index ?? 0) + markerMatch[1].length) : "";
  for (const token of tail.split(/[、，,；;与和及还有]/)) {
    const cleaned = token.trim();
    if (cleaned.length >= 2 && !GENERIC_CLAIM_WORDS.has(cleaned)) entities.push(cleaned);
  }
  return entities;
}

function hasUnverifiableClaim(texts: string[], corpus: string): boolean {
  for (const text of texts) {
    for (const rawSentence of text.split(/[。！!？?\n；;]+/)) {
      const sentence = rawSentence.trim();
      if (!sentence || !CLAIM_SENTENCE_PATTERN.test(sentence)) continue;

      // 限定词追溯：权威/国际/官方等必须出现在语料中。
      for (const qualifier of sentence.match(CLAIM_QUALIFIER_PATTERN) ?? []) {
        if (!corpus.includes(normalizeForOverlap(qualifier))) return true;
      }
      // 实体追溯：客户/案例清单里的名称必须出现在语料中。
      for (const entity of extractClaimEntities(sentence)) {
        if (!corpus.includes(normalizeForOverlap(entity))) return true;
      }
    }
  }
  return false;
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
  // §8.3：超限即违规（回退规则版），不得静默截断后继续（评审覆盖审计）。
  const limitViolations: string[] = [];
  if (input.topic !== undefined) {
    if (typeof input.topic !== "string" || !input.topic.trim()) {
      return { ok: false, violations: ["gate-2-topic-outline"], candidate: null };
    }
    const topic = input.topic.trim();
    if (topic.length > BRIEF_LIMITS.topicMaxLength) limitViolations.push("topic");
    candidate.topic = topic;
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
    const titles = input.titleCandidates.map((t) => t.trim()).filter(Boolean);
    if (titles.length > BRIEF_LIMITS.titleCandidateMaxCount) limitViolations.push("titleCandidates");
    if (titles.some((t) => t.length > BRIEF_LIMITS.titleCandidateMaxLength)) limitViolations.push("titleCandidates");
    candidate.titleCandidates = titles;
  }
  if (input.keywords !== undefined) {
    if (!isStringArray(input.keywords)) {
      return { ok: false, violations: ["gate-1-structure"], candidate: null };
    }
    const keywords = input.keywords.map((k) => k.trim()).filter(Boolean);
    if (keywords.length > BRIEF_LIMITS.keywordMaxCount) limitViolations.push("keywords");
    if (keywords.some((k) => k.length > BRIEF_LIMITS.keywordMaxLength)) limitViolations.push("keywords");
    candidate.keywords = keywords;
  }
  if (input.notes !== undefined) {
    if (typeof input.notes !== "string") {
      return { ok: false, violations: ["gate-1-structure"], candidate: null };
    }
    if (input.notes.length > BRIEF_LIMITS.notesMaxLength) limitViolations.push("notes");
    candidate.notes = input.notes;
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
      const heading = record.heading.trim();
      const purpose = record.purpose.trim();
      if (heading.length > BRIEF_LIMITS.outlineHeadingMaxLength) limitViolations.push("outline");
      if (purpose.length > BRIEF_LIMITS.outlinePurposeMaxLength) limitViolations.push("outline");
      outline.push({ heading, purpose });
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

  // Gate 11（评审 R5）：候选所有文本字段中的链接必须来自允许来源
  // （来源快照或规则版已存在的引用），模型不得补充任何新 URL。
  const allCandidateTexts = [...candidateTexts(candidate), ...(candidate.keywords ?? []), candidate.audience ?? ""].filter(Boolean);
  const allowedUrls = extractUrls([
    ...sources,
    ...ctx.snapshot.evidenceSources,
    ...ctx.snapshot.actionSources,
    ctx.baseline.editorial.topic,
    ...(ctx.baseline.editorial.titleCandidates ?? []),
    ...ctx.baseline.editorial.outline.flatMap((s) => [s.heading, s.purpose]),
    ...(ctx.baseline.editorial.keywords ?? []),
    ctx.baseline.editorial.notes ?? "",
    ...ctx.baseline.editorial.references.map((r) => `${r.url} ${r.label ?? ""}`),
  ]);
  const candidateUrls = extractUrls(allCandidateTexts);
  for (const url of candidateUrls) {
    if (!allowedUrls.has(url)) {
      violations.push("gate-11-unapproved-links");
      break;
    }
  }

  // Gate 12（评审 R5）：客户/认证/案例/合作等新声明必须可追溯——
  // 声明句中的实体（公司名、限定词）必须出现在来源/项目/规则版语料中。
  if (hasUnverifiableClaim(allCandidateTexts, allowedClaimCorpus(ctx))) {
    violations.push("gate-12-unverifiable-claims");
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

  const allViolations = [...new Set([...limitViolations.map((f) => `gate-3-limit-${f}`), ...violations])];
  return { ok: allViolations.length === 0, violations: allViolations, candidate };
}
