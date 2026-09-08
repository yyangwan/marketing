import { describe, expect, it } from "vitest";
import { effectiveBriefToGenerationBrief } from "./to-generation-brief";
import { buildBaselineBrief } from "./baseline-generator";
import type {
  ProjectSnapshotV1,
  VisibilitySuggestionSnapshotV1,
} from "@/contracts/content-creation-brief-v1";
import createBriefRequest from "../../../contracts/fixtures/create-brief-request-valid.json";
import { buildContextPromptSection } from "@/lib/ai/prompts/context";

const project: ProjectSnapshotV1 = {
  schemaVersion: 1,
  projectId: "project_123",
  name: "云途科技",
  industry: "企业服务",
  productName: "云途助手",
  productKeywords: ["AI 搜索优化", "品牌可见性"],
  productDescription: "云途助手帮助企业追踪并优化品牌在 AI 搜索场景下的表现。",
};

function buildBaseline(overrides: Partial<VisibilitySuggestionSnapshotV1> = {}) {
  const snapshot = {
    ...(createBriefRequest.sourceSnapshot as VisibilitySuggestionSnapshotV1),
    ...overrides,
  };
  return buildBaselineBrief({
    briefId: "brief_test000000000001",
    workspaceId: "ws_6b0c2d4e5f",
    projectId: "project_123",
    snapshot,
    projectSnapshot: project,
    sourceHash: "a".repeat(64),
    now: new Date("2026-09-08T10:00:00.000Z"),
  });
}

describe("effectiveBriefToGenerationBrief", () => {
  it("约束全量进入 GenerationContext.boundaries（locked ∪ editable 去重并集）", () => {
    const baseline = buildBaseline();
    const brief = effectiveBriefToGenerationBrief(baseline, { projectSnapshot: project });

    expect(brief.context?.boundaries?.mustMention).toContain("云途助手");
    expect(brief.context?.boundaries?.mustMention).toContain("AI 搜索优化");
    expect(new Set(brief.context?.boundaries?.mustMention).size).toBe(
      brief.context?.boundaries?.mustMention.length,
    );
    expect(brief.context?.boundaries?.forbiddenClaims).toEqual(
      baseline.constraints.locked.forbiddenClaims,
    );
    expect(brief.context?.boundaries?.avoidMention).toEqual(
      expect.arrayContaining(baseline.constraints.locked.avoidMention),
    );
  });

  it("boundaries 能被现有 buildContextPromptSection 完整消费", () => {
    const brief = effectiveBriefToGenerationBrief(buildBaseline(), { projectSnapshot: project });
    const prompt = buildContextPromptSection(brief);
    expect(prompt).toContain("云途助手");
    expect(prompt).toContain("必须提及");
    expect(prompt).toContain("禁止使用的主张");
    expect(prompt).toContain("对外承诺引用率");
  });

  it("platformPlan 选中且支持的平台进入 platforms，unsupported 不进入", () => {
    const baseline = buildBaseline({ requestedChannels: ["wechat", "zhihu", "weibo"] });
    const brief = effectiveBriefToGenerationBrief(baseline);
    expect(brief.platforms).toEqual(["wechat", "weibo"]);
  });

  it("outline 映射为 keyPoints（heading——purpose）", () => {
    const baseline = buildBaseline();
    const brief = effectiveBriefToGenerationBrief(baseline);
    expect(brief.keyPoints).toHaveLength(baseline.editorial.outline.length);
    expect(brief.keyPoints[0]).toContain(baseline.editorial.outline[0].heading);
    expect(brief.keyPoints[0]).toContain(baseline.editorial.outline[0].purpose);
  });

  it("topic/references/notes/brandVoiceId 映射正确", () => {
    const baseline = buildBaseline();
    const brief = effectiveBriefToGenerationBrief(baseline, {
      projectSnapshot: project,
      brandVoiceId: "voice_1",
    });
    expect(brief.topic).toBe(baseline.editorial.topic);
    expect(brief.references).toBe(baseline.editorial.references.map((r) => r.url).join("\n"));
    expect(brief.notes).toBe(baseline.editorial.notes);
    expect(brief.brandVoiceId).toBe("voice_1");
    expect(brief.context?.project?.productName).toBe("云途助手");
  });
});
