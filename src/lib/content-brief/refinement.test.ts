import { describe, expect, it } from "vitest";
import { buildRefinementPrompt, mergeRefined } from "./refinement";
import { buildBaselineBrief } from "./baseline-generator";
import type {
  ProjectSnapshotV1,
  VisibilitySuggestionSnapshotV1,
} from "@/contracts/content-creation-brief-v1";
import { validateBriefV1 } from "@/lib/contracts/validate";

const project: ProjectSnapshotV1 = {
  schemaVersion: 1,
  projectId: "project-1",
  name: "云途科技",
  industry: "企业服务",
  productName: "云途助手",
  productKeywords: ["AI 搜索优化"],
  productDescription: "云途助手帮助企业追踪并优化品牌在 AI 搜索场景下的表现。",
};

const snapshot: VisibilitySuggestionSnapshotV1 = {
  schemaVersion: 1,
  suggestionId: "154",
  text: "建立品牌百科词条",
  typeTags: ["百科"],
  keywords: ["AI 搜索"],
  auditFindings: [],
  acceptanceCriteria: [],
  evidenceSources: [],
  actionSources: [],
  requestedChannels: ["wechat"],
};

function baseline() {
  return buildBaselineBrief({
    briefId: "brief_1",
    workspaceId: "ws-1",
    projectId: "project-1",
    snapshot,
    projectSnapshot: project,
    sourceHash: "a".repeat(64),
    now: new Date("2026-09-08T10:00:00.000Z"),
  });
}

describe("buildRefinementPrompt", () => {
  it("embeds snapshot, baseline and hard rules; never embeds URLs to invent", () => {
    const { system, user } = buildRefinementPrompt({
      baseline: baseline(),
      snapshot,
      projectSnapshot: project,
      capabilities: {
        schemaVersion: 1,
        platforms: {
          wechat: { enabled: true },
          zhihu: { enabled: false, reason: "generator_not_implemented" },
        },
      },
    });
    expect(system).toContain("不得复制");
    expect(system).toContain("不得新增来源中不存在的数字");
    expect(user).toContain("建立品牌百科词条");
    expect(user).toContain("云途科技");
    expect(user).toContain("不支持");
  });
});

describe("mergeRefined（设计 §8.5 合并优先级）", () => {
  it("applies editorial candidates only; locked constraints and source stay untouched", () => {
    const base = baseline();
    const merged = mergeRefined(
      base,
      {
        topic: "云途科技是什么？AI 搜索时代的品牌可信度建设",
        titleCandidates: ["品牌可信度建设指南"],
        outline: [
          { heading: "品牌是谁", purpose: "定位介绍" },
          { heading: "痛点", purpose: "场景问题" },
          { heading: "能力", purpose: "核心能力" },
          { heading: "行动", purpose: "下一步" },
        ],
        keywords: ["AI 搜索", "品牌可见性"],
        notes: "新的备注",
        audience: "增长负责人",
      },
      { model: "deepseek-chat", promptVersion: "refinement-v1" },
    );

    expect(merged.editorial.topic).toBe("云途科技是什么？AI 搜索时代的品牌可信度建设");
    expect(merged.editorial.outline).toHaveLength(4);
    expect(merged.strategy.audience).toBe("增长负责人");
    // locked/来源/平台不动
    expect(merged.constraints.locked).toEqual(base.constraints.locked);
    expect(merged.source).toEqual(base.source);
    expect(merged.platformPlan).toEqual(base.platformPlan);
    expect(merged.generationMeta.effectiveSource).toBe("llm");
    expect(merged.generationMeta.refinementBaseRevision).toBe(base.revision);
    // 合并结果仍满足契约
    expect(validateBriefV1(merged).ok).toBe(true);
  });

  it("keeps baseline fields the candidate omits", () => {
    const base = baseline();
    const merged = mergeRefined(base, { topic: "云途科技品牌解读与 AI 搜索适配指南" }, {
      model: "deepseek-chat",
      promptVersion: "refinement-v1",
    });
    expect(merged.editorial.outline).toEqual(base.editorial.outline);
    expect(merged.editorial.keywords).toEqual(base.editorial.keywords);
    expect(merged.editorial.notes).toBe(base.editorial.notes);
  });
});
