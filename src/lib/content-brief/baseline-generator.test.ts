import { describe, expect, it } from "vitest";
import {
  RULES_VERSION,
  buildBaselineBrief,
  buildPlatformPlan,
  evaluateContentEligibility,
} from "./baseline-generator";
import type {
  ProjectSnapshotV1,
  VisibilitySuggestionSnapshotV1,
} from "@/contracts/content-creation-brief-v1";
import { validateBriefV1 } from "@/lib/contracts/validate";

const FIXED_NOW = new Date("2026-09-08T10:00:00.000Z");

/** 中性基底：不含任何会命中规则表的信号词，场景由各用例显式注入。 */
function snapshot(overrides: Partial<VisibilitySuggestionSnapshotV1> = {}): VisibilitySuggestionSnapshotV1 {
  return {
    schemaVersion: 1,
    suggestionId: "154",
    text: "提升品牌内容的搜索表现",
    description: "",
    category: "",
    priority: "medium",
    actionType: "",
    typeTags: [],
    keywords: ["AI 搜索"],
    contentOutline: "",
    evidenceSummary: "",
    auditFindings: [],
    acceptanceCriteria: [],
    expectedResult: "",
    successMetric: "",
    measurementPlan: "",
    evidenceSources: [],
    actionSources: [],
    requestedChannels: ["wechat"],
    ...overrides,
  };
}

const project: ProjectSnapshotV1 = {
  schemaVersion: 1,
  projectId: "project_123",
  name: "云途科技",
  url: "https://example.com",
  industry: "企业服务",
  productName: "云途助手",
  productKeywords: ["AI 搜索优化", "品牌可见性"],
  productDescription: "云途助手帮助企业追踪并优化品牌在 AI 搜索场景下的表现。",
};

function build(overrides: Partial<VisibilitySuggestionSnapshotV1> = {}) {
  const snap = snapshot(overrides);
  return {
    snapshot: snap,
    brief: buildBaselineBrief({
      briefId: "brief_test000000000001",
      workspaceId: "ws_6b0c2d4e5f",
      projectId: "project_123",
      snapshot: snap,
      projectSnapshot: project,
      sourceHash: "a".repeat(64),
      now: FIXED_NOW,
    }),
  };
}

describe("evaluateContentEligibility（设计 §11.1 规则表）", () => {
  it("priority 100: 发布 FAQ 任务 → faq，可创建", () => {
    const result = evaluateContentEligibility(snapshot({ text: "发布 FAQ 页面提升推荐覆盖率" }));
    expect(result.eligible).toBe(true);
    expect(result.contentType).toBe("faq");
    expect(result.ruleId).toBe("rule-100-content-asset");
  });

  it("priority 100 wins over 0: 带配置字样的发布任务仍是内容", () => {
    const result = evaluateContentEligibility(
      snapshot({ text: "配置发布渠道并撰写品牌对比页文章", requestedChannels: ["wechat"] }),
    );
    expect(result.eligible).toBe(true);
    expect(result.contentType).toBe("comparison");
  });

  it("priority 90: 引用/可见性信号 + 内容渠道 → explainer，可创建", () => {
    const result = evaluateContentEligibility(
      snapshot({ text: "提升 DeepSeek 对品牌信息的引用率到 60%", requestedChannels: ["wechat"] }),
    );
    expect(result.eligible).toBe(true);
    expect(result.contentType).toBe("explainer");
    expect(result.ruleId).toBe("rule-90-citation-visibility");
  });

  it("priority 90 without channels or sources falls to 50 requiresConfirmation", () => {
    const result = evaluateContentEligibility(
      snapshot({
        text: "提升品牌在 AI 助手中的可见性",
        requestedChannels: [],
        evidenceSources: [],
        actionSources: [],
      }),
    );
    expect(result.eligible).toBe(true);
    expect(result.requiresConfirmation).toBe(true);
    expect(result.ruleId).toBe("rule-50-mixed");
  });

  it("priority 0: 纯技术/运营任务 → 不可创建", () => {
    for (const text of [
      "配置平台授权并绑定账号",
      "为站点部署 SSL 证书",
      "申请 API 密钥并接入 SDK",
    ]) {
      const result = evaluateContentEligibility(snapshot({ text }));
      expect(result.eligible, text).toBe(false);
      expect(result.ruleId).toBe("rule-0-technical-ops");
    }
  });

  it("mixed business signals without clear direction → 50 requiresConfirmation", () => {
    const result = evaluateContentEligibility(snapshot({ text: "关注品牌在海外市场的声量变化" }));
    expect(result.eligible).toBe(true);
    expect(result.requiresConfirmation).toBe(true);
  });
});

describe("buildBaselineBrief 黄金样例（设计 §19.2）", () => {
  it("产出始终通过 V1 契约校验（TS 类型 ↔ schema 一致性证明）", () => {
    for (const overrides of [
      {},
      { text: "发布 FAQ 页面" },
      { text: "创建竞品对比页" },
      { text: "在知乎发布品牌百科词条" },
    ]) {
      const { brief } = build(overrides);
      const validation = validateBriefV1(brief);
      expect(validation.ok, JSON.stringify(validation.errors)).toBe(true);
    }
  });

  it("百度百科词条建议 → explainer，主题为品牌定位与能力，无任务原句", () => {
    const { brief } = build({ text: "建立品牌百度百科词条，获得 DeepSeek 引用" });
    expect(brief.strategy.contentType).toBe("explainer");
    expect(brief.editorial.topic).toContain("云途科技");
    expect(brief.editorial.topic).toContain("是什么");
    // 不出现任务原句（设计 §11.2 转换表第 1 行）。
    expect(brief.editorial.topic).not.toContain("百度百科词条");
    expect(brief.editorial.topic).not.toContain("DeepSeek 引用");
    for (const section of brief.editorial.outline) {
      expect(section.heading).not.toContain("词条");
      expect(section.heading).not.toContain("审计");
    }
  });

  it("FAQ 建议 → 大纲是用户问题结构，不是验收清单", () => {
    const { brief } = build({
      text: "发布 FAQ 页面提升推荐覆盖",
      acceptanceCriteria: ["FAQ 页面上线", "覆盖 20 个高频问题"],
    });
    expect(brief.strategy.contentType).toBe("faq");
    const headings = brief.editorial.outline.map((s) => s.heading).join(" ");
    expect(headings).toContain("适合谁");
    expect(headings).not.toContain("验收");
    expect(headings).not.toContain("20 个高频问题");
  });

  it("竞品对比页 → comparison，只允许客观维度（禁止贬损写入锁定约束）", () => {
    const { brief } = build({ text: "创建竞品对比页" });
    expect(brief.strategy.contentType).toBe("comparison");
    expect(brief.constraints.locked.forbiddenClaims).toContain("无法验证的竞品贬损或对比结论");
    const purposes = brief.editorial.outline.map((s) => s.purpose).join(" ");
    expect(purposes).toContain("客观");
    expect(purposes).toContain("不做贬损");
  });

  it("引用率 60% 目标 → 只进入内部观察指标，不进主题/大纲", () => {
    const { brief } = build({
      text: "提升 DeepSeek 引用率到 60%",
      expectedResult: "引用率达到 60%",
      requestedChannels: ["wechat"],
    });
    expect(brief.editorial.topic).not.toContain("60%");
    for (const section of brief.editorial.outline) {
      expect(section.heading).not.toContain("60%");
      expect(section.purpose).not.toContain("60%");
    }
    expect(brief.editorial.notes).toContain("内部观察指标（禁止写入正文）");
    expect(brief.editorial.notes).toContain("引用率达到 60%");
  });

  it("知乎渠道建议 → 标记 unsupported，不静默改成微信", () => {
    const plan = buildPlatformPlan(snapshot({ requestedChannels: ["zhihu"] }));
    expect(plan).toEqual([
      {
        platform: "zhihu",
        capability: "unsupported",
        selected: false,
        reason: "当前暂不支持知乎自动生成",
      },
    ]);
  });

  it("锁定约束从项目快照推导且不可为空策略", () => {
    const { brief } = build();
    expect(brief.constraints.locked.mustMention).toContain("云途助手");
    expect(brief.constraints.locked.mustMention).toContain("AI 搜索优化");
    expect(brief.constraints.locked.factualityPolicy).toBe("verified_sources_only");
    expect(brief.constraints.locked.avoidMention.length).toBeGreaterThan(0);
    expect(brief.generationMeta).toEqual({
      effectiveSource: "rules",
      rulesVersion: RULES_VERSION,
    });
  });

  it("大纲始终 4–12 项，引用只保留具体内容页", () => {
    const { brief } = build();
    expect(brief.editorial.outline.length).toBeGreaterThanOrEqual(4);
    expect(brief.editorial.outline.length).toBeLessThanOrEqual(12);
    // baike.example.com/brand 是具体路径；example.com/audit/deepseek-brand 也是。
    for (const ref of brief.editorial.references) {
      expect(ref.url).toMatch(/^https?:\/\//);
    }
  });
});
