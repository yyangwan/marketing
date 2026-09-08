/**
 * 规则版基线生成器（设计 §11.1/§11.2）。
 *
 * 从 GeniLink Portal src/lib/content/content-brief.ts 移植并升级为
 * ContentCreationBriefV1：
 * - 版本化内容适配规则表（evaluateContentEligibility）；
 * - 任务语言到读者语言的转换（主题与大纲不出现内部执行话术）；
 * - locked 约束从项目快照推导，LLM 与用户均不可覆盖。
 *
 * 本模块必须是纯函数：无 IO、无 Date.now（时间由调用方注入）。
 */

import {
  BRIEF_LIMITS,
  type BriefContentType,
  type ContentCreationBriefV1,
  type ProjectSnapshotV1,
  type VisibilitySuggestionSnapshotV1,
} from "@/contracts/content-creation-brief-v1";
import { UNSUPPORTED_PLATFORM_REASONS } from "@/contracts/content-creation-brief-v1";

export const RULES_VERSION = "2026-09.1";

// ---------------------------------------------------------------------------
// 文本工具（移植自 Portal content-brief.ts）
// ---------------------------------------------------------------------------

export function cleanText(value?: string | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function shortPhrase(value?: string | null, limit = 36): string {
  const firstSentence = cleanText(value).split(/[。！？.!?；;]/)[0]?.trim() ?? "";
  return firstSentence.length > limit ? `${firstSentence.slice(0, limit)}…` : firstSentence;
}

function unique(values: string[], limit?: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = cleanText(raw);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
    if (limit && result.length >= limit) break;
  }
  return result;
}

function clamp(value: string, limit: number): string {
  return value.length > limit ? value.slice(0, limit) : value;
}

function normalizeUrl(value: string): string {
  const trimmed = cleanText(value);
  if (!trimmed) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function isSpecificReferenceUrl(value: string): boolean {
  const normalized = normalizeUrl(value);
  if (!normalized) return false;
  const url = new URL(normalized);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const hasContentPathHint = /\/(articles?|blogs?|posts?|news|docs?|guides?|cases?|learn|resources?|questions?|knowledge|insights?)\b/i.test(
    url.pathname,
  );
  return pathParts.length >= 2 || hasContentPathHint;
}

export function filterSpecificReferenceUrls(values: string[], limit = 5): string[] {
  return unique(
    values.map(normalizeUrl).filter((v) => v && isSpecificReferenceUrl(v)),
    limit,
  );
}

// ---------------------------------------------------------------------------
// 内容适配规则表（设计 §11.1）——版本化、显式优先级
// ---------------------------------------------------------------------------

export interface EligibilityResult {
  /** false 时创建接口返回 422 SUGGESTION_NOT_CONTENT_ELIGIBLE，不创建 Brief。 */
  eligible: boolean;
  /** 优先级 50：生成基础 Brief，但要求用户确认内容方向。 */
  requiresConfirmation: boolean;
  contentType: BriefContentType | null;
  ruleId: string;
  signals: string[];
}

/** 优先级 100：明确的发布/内容资产任务。 */
const RULE_100: Array<{ signal: RegExp; contentType: BriefContentType }> = [
  { signal: /faq|常见问题|问答|q&a/i, contentType: "faq" },
  { signal: /对比页|竞品对比|对比|比较|选型|评测|comparison/i, contentType: "comparison" },
  { signal: /指南|攻略|教程|方法论|guide|tutorial/i, contentType: "guide" },
  { signal: /案例|客户故事|case[_ ]?study/i, contentType: "case_study" },
  { signal: /观点|洞察|趋势|白皮书|thought/i, contentType: "thought_leadership" },
  { signal: /清单|检查清单|checklist/i, contentType: "checklist" },
  { signal: /百科|词条|encyclop/i, contentType: "explainer" },
  { signal: /发布|文章|专栏|博客|内容页|publish|article|blog/i, contentType: "explainer" },
];

/** 优先级 90：引用/推荐/品牌可见性，且包含内容渠道或来源。 */
const RULE_90 = /引用|推荐|可见性|曝光|citation|visibility|品牌声量/i;

/** 优先级 0：纯技术/运营任务（权限、部署、接口、账号、投放配置等）。 */
const RULE_0 =
  /(授权|账号|密码|登录|绑定|api|接口|sdk|密钥|token|部署|dns|ssl|证书|域名解析|埋点|监控告警|工单|开票|发票|付款|预算|配额|配置|权限|后台设置)/i;

/** 强信号：建议标题、动作类型、类型标签——直接描述任务本身。 */
function strongSignalText(snapshot: VisibilitySuggestionSnapshotV1): string {
  return [snapshot.text, snapshot.actionType, ...snapshot.typeTags].map(cleanText).join(" ");
}

/** 弱信号：描述、分类、关键词——背景信息，仅在强信号未命中时参与判定。 */
function weakSignalText(snapshot: VisibilitySuggestionSnapshotV1): string {
  return [snapshot.description, snapshot.category, ...snapshot.keywords].map(cleanText).join(" ");
}

/**
 * 任务信号：强信号 + 描述/分类（不含关键词）。
 * 关键词描述主题域而非任务动作，不能让“品牌可见性”之类的词
 * 把纯技术任务判成内容任务（设计 §11.1 规则 90/0 的输入）。
 */
function taskSignalText(snapshot: VisibilitySuggestionSnapshotV1): string {
  return [snapshot.text, snapshot.actionType, ...snapshot.typeTags, snapshot.description, snapshot.category]
    .map(cleanText)
    .join(" ");
}

export function evaluateContentEligibility(
  snapshot: VisibilitySuggestionSnapshotV1,
): EligibilityResult {
  const strong = strongSignalText(snapshot);
  const weak = weakSignalText(snapshot);
  const signals: string[] = [];

  // 优先级 100：明确的内容资产任务。强信号优先，弱信号兜底。
  for (const pass of [strong, weak]) {
    for (const rule of RULE_100) {
      if (pass && rule.signal.test(pass)) {
        signals.push(`rule-100:${rule.signal.source.slice(0, 24)}`);
        return {
          eligible: true,
          requiresConfirmation: false,
          contentType: rule.contentType,
          ruleId: "rule-100-content-asset",
          signals,
        };
      }
    }
  }

  // 优先级 90：引用/可见性信号且带内容渠道或来源。
  const hasChannels =
    snapshot.requestedChannels.length > 0 ||
    snapshot.evidenceSources.length > 0 ||
    snapshot.actionSources.length > 0;
  const taskText = taskSignalText(snapshot);
  if (RULE_90.test(taskText) && hasChannels) {
    signals.push("rule-90-citation-visibility");
    const contentType: BriefContentType = /指南|攻略|guide/i.test(taskText)
      ? "guide"
      : "explainer";
    return {
      eligible: true,
      requiresConfirmation: false,
      contentType,
      ruleId: "rule-90-citation-visibility",
      signals,
    };
  }

  // 优先级 0：纯技术/运营任务。
  if (RULE_0.test(taskText)) {
    signals.push("rule-0-technical-ops");
    return {
      eligible: false,
      requiresConfirmation: false,
      contentType: null,
      ruleId: "rule-0-technical-ops",
      signals,
    };
  }

  // 优先级 50：信号混合或缺少明确方向，生成基础 Brief 要求用户确认。
  signals.push("rule-50-mixed");
  return {
    eligible: true,
    requiresConfirmation: true,
    contentType: "explainer",
    ruleId: "rule-50-mixed",
    signals,
  };
}

// ---------------------------------------------------------------------------
// 平台计划（设计 §5.5：只开放已实现平台，禁止静默替换）
// ---------------------------------------------------------------------------

const CHANNEL_TO_PLATFORM: Record<string, string> = {
  wechat: "wechat",
  微信: "wechat",
  微信公众号: "wechat",
  公众号: "wechat",
  weibo: "weibo",
  微博: "weibo",
  douyin: "douyin",
  抖音: "douyin",
  xiaohongshu: "xiaohongshu",
  小红书: "xiaohongshu",
  toutiao: "toutiao",
  今日头条: "toutiao",
  头条: "toutiao",
  zhihu: "zhihu",
  知乎: "zhihu",
};

const PLATFORM_ORDER = ["wechat", "weibo", "xiaohongshu", "douyin", "zhihu", "toutiao"];

const UNSUPPORTED_LABELS: Record<string, string> = {
  zhihu: "知乎",
  toutiao: "今日头条",
};

function detectRequestedPlatforms(snapshot: VisibilitySuggestionSnapshotV1): string[] {
  return unique(
    snapshot.requestedChannels
      .map((channel) => {
        const key = channel.toLowerCase();
        return CHANNEL_TO_PLATFORM[key] ?? CHANNEL_TO_PLATFORM[channel] ?? "";
      })
      .filter(Boolean),
  );
}

export function buildPlatformPlan(
  snapshot: VisibilitySuggestionSnapshotV1,
): ContentCreationBriefV1["platformPlan"] {
  const requested = detectRequestedPlatforms(snapshot);
  const platforms = requested.length > 0 ? requested : ["wechat"];
  return [...platforms]
    .sort((a, b) => PLATFORM_ORDER.indexOf(a) - PLATFORM_ORDER.indexOf(b))
    .map((platform) =>
      UNSUPPORTED_PLATFORM_REASONS[platform]
        ? {
            platform,
            capability: "unsupported" as const,
            selected: false,
            reason: `当前暂不支持${UNSUPPORTED_LABELS[platform] ?? platform}自动生成`,
          }
        : {
            platform,
            capability: "supported" as const,
            selected: true,
          },
    );
}

// ---------------------------------------------------------------------------
// 任务语言 → 读者语言（设计 §11.2）
// ---------------------------------------------------------------------------

const CONTENT_TYPE_LABELS: Record<BriefContentType, string> = {
  faq: "常见问题解答",
  guide: "实操指南",
  comparison: "选型对比",
  case_study: "案例解析",
  thought_leadership: "行业洞察",
  checklist: "检查清单",
  explainer: "科普解读",
};

interface EditorialContext {
  brand: string;
  product: string;
  keywords: string[];
  keywordLabel: string;
  positioning: string;
}

function editorialContext(
  snapshot: VisibilitySuggestionSnapshotV1,
  project: ProjectSnapshotV1,
): EditorialContext {
  const brand = cleanText(project.name) || cleanText(project.productName) || "品牌";
  const product = cleanText(project.productName);
  const keywords = unique(
    project.productKeywords.length > 0 ? project.productKeywords : snapshot.keywords,
    2,
  );
  return {
    brand,
    product,
    keywords,
    keywordLabel: keywords.join("与"),
    positioning: shortPhrase(project.productDescription),
  };
}

/** 主题：读者视角，不复述任务原句。 */
function editorialTopic(
  snapshot: VisibilitySuggestionSnapshotV1,
  project: ProjectSnapshotV1,
  contentType: BriefContentType,
): string {
  const ctx = editorialContext(snapshot, project);
  const productSuffix =
    ctx.product && ctx.product !== ctx.brand ? `（${ctx.product}）` : "";

  switch (contentType) {
    case "faq":
      return `${ctx.brand}${productSuffix}常见问题：${ctx.keywordLabel || "核心能力"}的理解与应用`;
    case "comparison":
      return `${ctx.keywordLabel || ctx.product || ctx.brand}选型指南：关键能力、适用场景与评估方法`;
    case "explainer": {
      if (ctx.positioning) {
        return `${ctx.brand}是什么？${ctx.positioning}的定位、核心能力与应用场景`;
      }
      return `${ctx.brand}是什么？品牌定位、核心能力与应用场景`;
    }
    default:
      return `${ctx.brand}${productSuffix}如何做好${ctx.keywordLabel || "内容建设"}：从理解到落地`;
  }
}

/** 大纲：按内容类型给读者问题结构，不是执行清单。 */
function editorialOutline(
  snapshot: VisibilitySuggestionSnapshotV1,
  project: ProjectSnapshotV1,
  contentType: BriefContentType,
): ContentCreationBriefV1["editorial"]["outline"] {
  const ctx = editorialContext(snapshot, project);
  const brand = ctx.brand;
  const topicWord = ctx.keywordLabel || "这一能力";

  const sectionsByType: Record<BriefContentType, Array<[string, string]>> = {
    faq: [
      [`${brand}是什么，适合谁`, `用读者语言说明基本概念和适用人群，不复述内部任务`],
      [`${topicWord}能解决什么问题`, `从用户痛点出发解释价值，不使用对外承诺指标`],
      [`如何开始使用`, `给出基于已确认能力的可执行路径，不虚构功能`],
      [`效果如何评估`, `提供读者可自行验证的判断方法`],
      [`常见误区与解答`, `澄清理解偏差，只引用已确认资料`],
    ],
    comparison: [
      [`为什么需要对比`, `说明读者在选型时面对的真实问题`],
      [`关键能力维度`, `只列客观可验证的评估维度，不做贬损`],
      [`不同方案的适用场景`, `基于公开信息描述适用边界`],
      [`如何做决策`, `给出评估清单和下一步行动`],
      [`常见问题`, `回答读者在对比过程中的高频疑问`],
    ],
    guide: [
      [`现状与常见问题`, `描述目标读者当前遇到的困难`],
      [`核心方法`, `拆解可执行步骤，基于已确认能力`],
      [`实施要点`, `说明关键动作与注意事项`],
      [`效果评估`, `说明如何判断改进是否有效`],
    ],
    explainer: [
      [`目标用户正在遇到什么问题`, `用读者语言解释当前信息缺口`],
      [`${brand}的核心定位`, `基于官方资料说明品牌是什么、提供什么`],
      [`典型应用场景`, `用具体场景说明价值，不虚构案例`],
      [`如何判断信息可信度`, `帮助读者识别可靠信息来源`],
      [`下一步建议`, `给出清晰、可执行的理解路径`],
    ],
    case_study: [
      [`背景与挑战`, `描述典型场景下面临的问题（不虚构具体客户）`],
      [`解决思路`, `说明通用解决路径与关键动作`],
      [`实施过程`, `分步说明可复现的做法`],
      [`结果与启示`, `总结可迁移的经验，不编造数据`],
    ],
    thought_leadership: [
      [`行业现状观察`, `基于公开信息描述趋势`],
      [`核心观点`, `提出有依据的判断`],
      [`对读者的意义`, `说明趋势对目标人群的影响`],
      [`行动建议`, `给出务实下一步`],
    ],
    checklist: [
      [`为什么要用清单`, `说明场景与价值`],
      [`核心检查项`, `列出可执行的检查点`],
      [`常见疏漏`, `提示高频遗漏`],
      [`如何持续维护`, `说明更新与复查节奏`],
    ],
  };

  return sectionsByType[contentType].map(([heading, purpose], index) => ({
    id: `section_${index + 1}`,
    heading: clamp(heading, BRIEF_LIMITS.outlineHeadingMaxLength),
    purpose: clamp(purpose, BRIEF_LIMITS.outlinePurposeMaxLength),
    evidenceRefs: [],
  }));
}

// ---------------------------------------------------------------------------
// 基线 Brief（设计 §11.2：规则版必须先于 LLM 可用）
// ---------------------------------------------------------------------------

export interface BuildBaselineParams {
  briefId: string;
  workspaceId: string;
  projectId: string;
  snapshot: VisibilitySuggestionSnapshotV1;
  projectSnapshot: ProjectSnapshotV1;
  sourceHash: string;
  suggestionRef?: { reportId?: string; auditId?: string };
  /** 注入时间，测试可固定。 */
  now?: Date;
}

export function buildBaselineBrief(params: BuildBaselineParams): ContentCreationBriefV1 {
  const { snapshot, projectSnapshot, sourceHash } = params;
  const eligibility = evaluateContentEligibility(snapshot);
  const contentType = eligibility.contentType ?? "explainer";
  const now = (params.now ?? new Date()).toISOString();

  const brand = cleanText(projectSnapshot.name) || cleanText(projectSnapshot.productName) || "品牌";
  const product = cleanText(projectSnapshot.productName);
  const keywords = unique(
    [...snapshot.keywords, ...projectSnapshot.productKeywords],
    8,
  ).map((k) => clamp(k, BRIEF_LIMITS.keywordMaxLength));

  const topic = clamp(
    editorialTopic(snapshot, projectSnapshot, contentType),
    BRIEF_LIMITS.topicMaxLength,
  );

  const referenceUrls = filterSpecificReferenceUrls(
    [...snapshot.actionSources, ...snapshot.evidenceSources],
    5,
  );
  const references: ContentCreationBriefV1["editorial"]["references"] = referenceUrls.map(
    (url, index) => ({
      id: `ref_${index + 1}`,
      url,
      source: "suggestion" as const,
    }),
  );
  if (projectSnapshot.url && isSpecificReferenceUrl(projectSnapshot.url)) {
    references.unshift({
      id: "ref_project",
      url: normalizeUrl(projectSnapshot.url),
      label: `${brand}官网`,
      source: "project" as const,
    });
  }

  const noteLines = unique(
    [
      snapshot.expectedResult
        ? `内部观察指标（禁止写入正文）：${cleanText(snapshot.expectedResult)}`
        : "",
      snapshot.successMetric
        ? `发布后内部观察（禁止写入正文）：${cleanText(snapshot.successMetric)}`
        : "",
      keywords.length > 0 ? `自然融入关键词：${keywords.slice(0, 3).join("、")}，避免堆砌。` : "",
      `事实要求：只使用已确认的项目、产品与参考资料；缺少证据的案例、数据和结论不得编造。`,
    ],
    8,
  );

  const lockedMustMention = unique(
    [product, ...projectSnapshot.productKeywords.slice(0, 4)].filter(Boolean),
    BRIEF_LIMITS.constraintMaxCount,
  ).map((v) => clamp(v, BRIEF_LIMITS.constraintMaxLength));

  const lockedAvoidMention = unique(
    ["编造客户案例、数据指标、第三方背书或参考链接"],
    BRIEF_LIMITS.constraintMaxCount,
  );

  const allowedClaims = projectSnapshot.productDescription
    ? [clamp(cleanText(projectSnapshot.productDescription), BRIEF_LIMITS.constraintMaxLength)]
    : [];

  const forbiddenClaims = unique(
    [
      "对外承诺引用率、覆盖率、排名等具体指标",
      "无法验证的竞品贬损或对比结论",
    ],
    BRIEF_LIMITS.constraintMaxCount,
  );

  return {
    schemaVersion: 1,
    id: params.briefId,
    workspaceId: params.workspaceId,
    projectId: params.projectId,
    revision: 1,
    status: "baseline_ready",
    source: {
      type: "visibility_suggestion",
      suggestionId: snapshot.suggestionId,
      sourceHash,
      ...(params.suggestionRef?.auditId ? { auditId: params.suggestionRef.auditId } : {}),
      ...(params.suggestionRef?.reportId ? { reportId: params.suggestionRef.reportId } : {}),
    },
    strategy: {
      objective: clamp(
        `围绕「${topic}」创作面向读者的${CONTENT_TYPE_LABELS[contentType]}，帮助读者理解现状、方法与判断依据`,
        2000,
      ),
      intent: "awareness",
      contentType,
    },
    editorial: {
      topic,
      titleCandidates: [clamp(topic, BRIEF_LIMITS.titleCandidateMaxLength)],
      outline: editorialOutline(snapshot, projectSnapshot, contentType),
      keywords,
      references: references.slice(0, BRIEF_LIMITS.referenceMaxCount),
      notes: clamp(noteLines.join("\n"), BRIEF_LIMITS.notesMaxLength),
    },
    platformPlan: buildPlatformPlan(snapshot),
    constraints: {
      locked: {
        mustMention: lockedMustMention,
        avoidMention: lockedAvoidMention,
        allowedClaims,
        forbiddenClaims,
        factualityPolicy: "verified_sources_only",
      },
      editable: {
        mustMention: keywords.slice(0, 3),
        avoidMention: ["绝对化用语（如“最好”“第一”）", "未经验证的行业数据"],
      },
    },
    generationMeta: {
      effectiveSource: "rules",
      rulesVersion: RULES_VERSION,
    },
    createdAt: now,
    updatedAt: now,
  };
}
