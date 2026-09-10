import { describe, expect, it } from "vitest";
import {
  hasLongOverlap,
  normalizeForOverlap,
  validateRefinementCandidate,
  type QualityGateContext,
} from "./quality-gates";
import { buildBaselineBrief } from "./baseline-generator";
import type {
  ProjectSnapshotV1,
  VisibilitySuggestionSnapshotV1,
} from "@/contracts/content-creation-brief-v1";

const FIXED_NOW = new Date("2026-09-08T10:00:00.000Z");

const project: ProjectSnapshotV1 = {
  schemaVersion: 1,
  projectId: "project-1",
  name: "云途科技",
  industry: "企业服务",
  productName: "云途助手",
  productKeywords: ["AI 搜索优化", "品牌可见性"],
  productDescription: "云途助手帮助企业追踪并优化品牌在 AI 搜索场景下的表现。",
};

const snapshot: VisibilitySuggestionSnapshotV1 = {
  schemaVersion: 1,
  suggestionId: "154",
  text: "建立品牌百科词条，提升 AI 助手引用",
  description: "补齐官方百科与 FAQ 资产",
  category: "引用可见性",
  priority: "high",
  actionType: "content_publish",
  typeTags: ["百科"],
  keywords: ["AI 搜索"],
  contentOutline: "品牌定位、核心能力",
  evidenceSummary: "DeepSeek 检索测试缺少引用",
  auditFindings: ["DeepSeek 未引用自有内容"],
  acceptanceCriteria: ["百科词条上线"],
  expectedResult: "引用频率提升",
  successMetric: "引用率观察值",
  measurementPlan: "每周记录",
  evidenceSources: ["https://example.com/audit"],
  actionSources: ["https://example.com/baike"],
  requestedChannels: ["wechat"],
};

function buildContext(): QualityGateContext {
  return {
    baseline: buildBaselineBrief({
      briefId: "brief_1",
      workspaceId: "ws-1",
      projectId: "project-1",
      snapshot,
      projectSnapshot: project,
      sourceHash: "a".repeat(64),
      now: FIXED_NOW,
    }),
    snapshot,
    projectSnapshot: project,
  };
}

function goodCandidate() {
  return {
    topic: "云途科技是什么？品牌定位与 AI 搜索时代的能力解读",
    titleCandidates: ["云途科技品牌解读"],
    outline: [
      { heading: "云途科技是谁", purpose: "介绍品牌定位" },
      { heading: "解决什么问题", purpose: "说明 AI 搜索场景痛点" },
      { heading: "核心能力", purpose: "拆解已确认能力" },
      { heading: "如何开始", purpose: "给出行动路径" },
    ],
    keywords: ["AI 搜索", "品牌可见性"],
    notes: "围绕品牌定位展开，保持客观。",
    audience: "市场负责人",
  };
}

describe("链接白名单与事实可追溯（R5，gate-11/12）", () => {
  it("rejects invented clients, certifications and links (评审复现用例)", () => {
    const ctx = buildContext();
    const candidate = goodCandidate();
    candidate.notes =
      "已获得权威认证，客户包括微软与阿里巴巴；参考 https://invented.example/case";

    const result = validateRefinementCandidate(candidate, ctx);
    expect(result.ok).toBe(false);
    expect(result.violations).toContain("gate-11-unapproved-links");
    expect(result.violations).toContain("gate-12-unverifiable-claims");
  });

  it("rejects links in any candidate text field, not only notes", () => {
    const ctx = buildContext();
    const candidate = goodCandidate();
    candidate.outline[0].purpose = "详见 https://llm-invented.example/guide";

    const result = validateRefinementCandidate(candidate, ctx);
    expect(result.violations).toContain("gate-11-unapproved-links");
  });

  it("accepts links that exist in the source snapshot", () => {
    const ctx = buildContext();
    const candidate = goodCandidate();
    // 来源快照中存在 https://example.com/audit 与 https://example.com/baike。
    candidate.notes = "引用证据见 https://example.com/audit";

    const result = validateRefinementCandidate(candidate, ctx);
    expect(result.violations).not.toContain("gate-11-unapproved-links");
  });

  it("rejects client claims whose names do not appear in sources or project", () => {
    const ctx = buildContext();
    const candidate = goodCandidate();
    candidate.notes = "客户包括某虚构集团";

    const result = validateRefinementCandidate(candidate, ctx);
    expect(result.violations).toContain("gate-12-unverifiable-claims");
  });

  it("accepts traceable claims naming the project product", () => {
    const ctx = buildContext();
    const candidate = goodCandidate();
    // 产品关键词“品牌可见性”出现在项目快照中，可追溯。
    candidate.notes = "围绕品牌可见性展开，不新增事实。";

    const result = validateRefinementCandidate(candidate, ctx);
    expect(result.violations).not.toContain("gate-12-unverifiable-claims");
  });

  it("rejects untraceable certification qualifiers even without client names", () => {
    const ctx = buildContext();
    const candidate = goodCandidate();
    candidate.notes = "产品已获得国际认证";

    const result = validateRefinementCandidate(candidate, ctx);
    expect(result.violations).toContain("gate-12-unverifiable-claims");
  });
});

describe("validateRefinementCandidate 十条质量门", () => {
  it("accepts a clean candidate", () => {
    const result = validateRefinementCandidate(goodCandidate(), buildContext());
    expect(result.violations).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("gate-1 rejects non-object payloads", () => {
    expect(validateRefinementCandidate("text", buildContext()).violations).toContain("gate-1-structure");
    expect(validateRefinementCandidate([1, 2], buildContext()).violations).toContain("gate-1-structure");
  });

  it("gate-1 rejects out-of-scope fields (platforms/constraints/source)", () => {
    const bad = { ...goodCandidate(), platformPlan: [{ platform: "zhihu" }] };
    expect(validateRefinementCandidate(bad, buildContext()).violations).toContain("gate-1-structure");
    const bad2 = { ...goodCandidate(), constraints: { locked: {} } };
    expect(validateRefinementCandidate(bad2, buildContext()).violations).toContain("gate-1-structure");
  });

  it("gate-2 rejects empty topic and out-of-range outline", () => {
    expect(
      validateRefinementCandidate({ ...goodCandidate(), topic: "  " }, buildContext()).violations
    ).toContain("gate-2-topic-outline");
    expect(
      validateRefinementCandidate(
        { ...goodCandidate(), outline: goodCandidate().outline.slice(0, 2) },
        buildContext(),
      ).violations,
    ).toContain("gate-2-topic-outline");
    expect(
      validateRefinementCandidate({ ...goodCandidate(), topic: "" }, buildContext()).violations,
    ).toContain("gate-2-topic-outline");
  });

  it("gate-5 rejects copying internal source text (≥12 normalized chars)", () => {
    const bad = {
      ...goodCandidate(),
      notes: `内部结论：${snapshot.auditFindings[0]}，请注意引用率观察值口径对齐。`,
    };
    const result = validateRefinementCandidate(bad, buildContext());
    expect(result.violations).toContain("gate-5-source-copy");
  });

  it("gate-5 tolerates short common words", () => {
    const good = { ...goodCandidate(), notes: "品牌 内容 优化 提升 引用" };
    const result = validateRefinementCandidate(good, buildContext());
    expect(result.violations).not.toContain("gate-5-source-copy");
  });

  it("gate-6 rejects internal execution jargon", () => {
    const bad = { ...goodCandidate(), topic: "云途科技：完成本次优化建议的验收标准说明" };
    expect(
      validateRefinementCandidate(bad, buildContext()).violations,
    ).toContain("gate-6-internal-jargon");
  });

  it("gate-7 rejects dropping brand anchors from the topic", () => {
    const bad = { ...goodCandidate(), topic: "如何做好企业内容营销：从零开始的完整方法论" };
    expect(
      validateRefinementCandidate(bad, buildContext()).violations,
    ).toContain("gate-7-removed-anchors");
  });

  it("gate-8 rejects numbers absent from sources", () => {
    const bad = { ...goodCandidate(), notes: "帮助企业实现 300% 的增长，价格 999 元。" };
    expect(
      validateRefinementCandidate(bad, buildContext()).violations,
    ).toContain("gate-8-new-numbers");
  });

  it("gate-8 accepts numbers present in sources (60% 观察指标)", () => {
    const ctx = buildContext();
    const snapshotWithNumber = {
      ...ctx.snapshot,
      expectedResult: "引用率达到 60%",
    } as typeof ctx.snapshot;
    const baseline = buildBaselineBrief({
      briefId: "brief_1",
      workspaceId: "ws-1",
      projectId: "project-1",
      snapshot: snapshotWithNumber,
      projectSnapshot: project,
      sourceHash: "a".repeat(64),
      now: FIXED_NOW,
    });
    const good = {
      ...goodCandidate(),
      notes: "发布后内部观察（禁止写入正文）：引用率达到 60%。",
    };
    const result = validateRefinementCandidate(good, {
      baseline,
      snapshot: snapshotWithNumber,
      projectSnapshot: project,
    });
    expect(result.violations).not.toContain("gate-8-new-numbers");
  });

  it("gate-9 rejects duplicated outline headings", () => {
    const bad = goodCandidate();
    bad.outline = [
      { heading: "品牌介绍", purpose: "a" },
      { heading: "品牌介绍", purpose: "b" },
      { heading: "能力", purpose: "c" },
      { heading: "开始", purpose: "d" },
    ];
    expect(
      validateRefinementCandidate(bad, buildContext()).violations,
    ).toContain("gate-9-duplicate-sections");
  });

  it("gate-10 rejects off-topic generic essays", () => {
    const bad = {
      ...goodCandidate(),
      topic: "餐饮行业数字化转型白皮书（2026）",
      keywords: ["餐饮数字化"],
    };
    const result = validateRefinementCandidate(bad, buildContext());
    expect(result.violations).toContain("gate-10-off-topic");
  });
});

describe("normalizeForOverlap / hasLongOverlap", () => {
  it("normalizes width, case, whitespace and punctuation", () => {
    expect(normalizeForOverlap("ＡＩ 搜索，优化！")).toBe("ai搜索优化");
  });

  it("detects contiguous overlap of 12+ normalized chars", () => {
    expect(hasLongOverlap("品牌在ＡＩ搜索场景下的可见性与可信度提升方法", "提升品牌在ai搜索场景下的可信度")).toBe(true);
    expect(hasLongOverlap("完全不同的一句话内容甲", "另外一句完全不同的话乙")).toBe(false);
  });
});
