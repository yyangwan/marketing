import { describe, it, expect, beforeEach, vi } from "vitest";
import { runRefinementBatch } from "./refinement-worker";
import { buildBaselineBrief } from "./baseline-generator";
import { callLLMJson, LLMError } from "@/lib/ai/client";
import { getGenerationCapabilities } from "@/lib/platforms/capabilities";
import type {
  ProjectSnapshotV1,
  VisibilitySuggestionSnapshotV1,
} from "@/contracts/content-creation-brief-v1";

vi.mock("@/lib/ai/client", () => ({
  callLLMJson: vi.fn(),
  LLMError: class extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

vi.mock("@/lib/platforms/capabilities", () => ({
  getGenerationCapabilities: vi.fn().mockResolvedValue({
    schemaVersion: 1,
    platforms: { wechat: { enabled: true, maxConcurrent: 2 } },
  }),
}));

import { prisma } from "@/lib/db";

const FIXED_NOW = new Date("2026-09-08T10:00:00.000Z");

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

function baselineJson(revision = 1) {
  const brief = buildBaselineBrief({
    briefId: "brief_1",
    workspaceId: "ws-1",
    projectId: "project-1",
    snapshot,
    projectSnapshot: project,
    sourceHash: "a".repeat(64),
    now: FIXED_NOW,
  });
  brief.revision = revision;
  return JSON.stringify(brief);
}

function queuedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "brief_1",
    revision: 1,
    status: "baseline_ready",
    sourceSnapshot: JSON.stringify(snapshot),
    projectSnapshot: JSON.stringify(project),
    effectiveBrief: baselineJson(),
    refinementAttempts: 0,
    ...overrides,
  };
}

const goodCandidateOutput = {
  topic: "云途科技是什么？品牌定位与 AI 搜索时代的能力解读",
  titleCandidates: ["云途科技品牌解读"],
  outline: [
    { heading: "云途科技是谁", purpose: "介绍品牌定位" },
    { heading: "解决什么问题", purpose: "说明场景痛点" },
    { heading: "核心能力", purpose: "拆解已确认能力" },
    { heading: "如何开始", purpose: "给出行动路径" },
  ],
  keywords: ["AI 搜索", "品牌可见性"],
  notes: "围绕品牌定位展开，保持客观。",
  audience: "市场负责人",
};

describe("runRefinementBatch", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(global.Date, "now").mockReturnValue(FIXED_NOW.getTime());
    // resetAllMocks 会清掉 vi.mock factory 里设置的实现，这里恢复。
    vi.mocked(getGenerationCapabilities).mockResolvedValue({
      schemaVersion: 1,
      platforms: { wechat: { enabled: true, maxConcurrent: 2 } },
    });
  });

  /** 恢复查询（R1）无过期 running。 */
  function noExpiredRunning() {
    (prisma.contentBrief.updateMany as any).mockResolvedValueOnce({ count: 0 });
  }

  it("claims via conditional update and publishes the refined brief", async () => {
    (prisma.contentBrief.findFirst as any).mockResolvedValueOnce(queuedRow()).mockResolvedValueOnce(null);
    noExpiredRunning();
    (prisma.contentBrief.updateMany as any).mockResolvedValue({ count: 1 });
    vi.mocked(callLLMJson).mockResolvedValue(goodCandidateOutput as never);

    const result = await runRefinementBatch("worker-1");

    expect(result.claimed).toBe(1);
    expect(result.succeeded).toBe(1);

    // 领取：条件更新置 running + 租约（calls[0] 是恢复查询）
    const claimCall = (prisma.contentBrief.updateMany as any).mock.calls[1][0];
    expect(claimCall.where.id).toBe("brief_1");
    expect(claimCall.where.refinementStatus).toBe("queued");
    expect(claimCall.data.refinementStatus).toBe("running");
    expect(claimCall.data.refinementLockedBy).toBe("worker-1");

    // 发布：条件更新 where revision（冻结基线 revision，R2）
    const publishCall = (prisma.contentBrief.updateMany as any).mock.calls[2][0];
    expect(publishCall.where).toMatchObject({ id: "brief_1", revision: 1 });
    const published = JSON.parse(publishCall.data.effectiveBrief);
    expect(published.editorial.topic).toBe(goodCandidateOutput.topic);
    expect(published.generationMeta.effectiveSource).toBe("llm");
    expect(publishCall.data.refinementStatus).toBe("succeeded");
    expect(publishCall.data.status).toBe("ready");
  });

  it("retains the candidate without publishing when the user edited meanwhile", async () => {
    (prisma.contentBrief.findFirst as any).mockResolvedValueOnce(queuedRow()).mockResolvedValueOnce(null);
    // 恢复无过期 → claim 成功 → 条件发布 count=0（revision 已变）→ 保留候选。
    (prisma.contentBrief.updateMany as any)
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    vi.mocked(callLLMJson).mockResolvedValue(goodCandidateOutput as never);

    const result = await runRefinementBatch("worker-1");

    expect(result.retainedOnly).toBe(1);
    const retainCall = (prisma.contentBrief.updateMany as any).mock.calls[3][0];
    expect(retainCall.data.refinementStatus).toBe("succeeded");
    expect(retainCall.data.effectiveBrief).toBeUndefined();
    expect(retainCall.data.refinedCandidate).toBeDefined();
  });

  it("falls back without retry when quality gates fail", async () => {
    (prisma.contentBrief.findFirst as any).mockResolvedValueOnce(queuedRow()).mockResolvedValueOnce(null);
    noExpiredRunning();
    (prisma.contentBrief.updateMany as any).mockResolvedValue({ count: 1 });
    vi.mocked(callLLMJson).mockResolvedValue({
      topic: "餐饮行业数字化转型白皮书（2026）",
      outline: [
        { heading: "a", purpose: "b" },
        { heading: "a", purpose: "c" },
        { heading: "d", purpose: "e" },
        { heading: "f", purpose: "g" },
      ],
    } as never);

    const result = await runRefinementBatch("worker-1");

    expect(result.fallback).toBe(1);
    const fallbackCall = (prisma.contentBrief.updateMany as any).mock.calls[2][0];
    expect(fallbackCall.data.refinementStatus).toBe("fallback");
    expect(fallbackCall.data.refinementLastError).toContain("gate-");
  });

  it("schedules a 30s retry on retryable LLM errors (timeout/5xx), max 3 attempts", async () => {
    (prisma.contentBrief.findFirst as any)
      .mockResolvedValueOnce(queuedRow({ refinementAttempts: 0 }))
      .mockResolvedValueOnce(null);
    noExpiredRunning();
    (prisma.contentBrief.updateMany as any).mockResolvedValue({ count: 1 });
    vi.mocked(callLLMJson).mockRejectedValue(new LLMError("timeout", 408));

    const result = await runRefinementBatch("worker-1");
    expect(result.claimed).toBe(1);

    const retryCall = (prisma.contentBrief.updateMany as any).mock.calls[2][0];
    expect(retryCall.data.refinementStatus).toBe("queued");
    expect(retryCall.data.refinementAttempts).toBe(1);
    expect(retryCall.data.refinementNextAttemptAt).toBeInstanceOf(Date);

    // 已达上限（第 3 次）→ fallback
    vi.clearAllMocks();
    noExpiredRunning();
    (prisma.contentBrief.findFirst as any)
      .mockResolvedValueOnce(queuedRow({ refinementAttempts: 2 }))
      .mockResolvedValueOnce(null);
    (prisma.contentBrief.updateMany as any).mockResolvedValue({ count: 1 });
    vi.mocked(callLLMJson).mockRejectedValue(new LLMError("timeout", 408));

    const exhausted = await runRefinementBatch("worker-1");
    expect(exhausted.fallback).toBe(1);
    const fallbackCall = (prisma.contentBrief.updateMany as any).mock.calls[2][0];
    expect(fallbackCall.data.refinementStatus).toBe("fallback");
  });

  it("does not retry on invalid JSON (output problem)", async () => {
    (prisma.contentBrief.findFirst as any).mockResolvedValueOnce(queuedRow()).mockResolvedValueOnce(null);
    noExpiredRunning();
    (prisma.contentBrief.updateMany as any).mockResolvedValue({ count: 1 });
    vi.mocked(callLLMJson).mockRejectedValue(new LLMError("invalid json", 422));

    const result = await runRefinementBatch("worker-1");
    const fallbackCall = (prisma.contentBrief.updateMany as any).mock.calls[2][0];
    expect(result.fallback).toBe(1);
    expect(fallbackCall.data.refinementStatus).toBe("fallback");
  });

  it("stops the batch when no claimable brief remains", async () => {
    (prisma.contentBrief.findFirst as any).mockResolvedValue(null);
    const result = await runRefinementBatch("worker-1");
    expect(result).toEqual({ claimed: 0, succeeded: 0, fallback: 0, retainedOnly: 0 });
  });

  it("refines the frozen base, not the user-edited brief, when edited before claim (R2)", async () => {
    // 用户在 worker 领取前把 revision 编辑到 2；提炼基线仍是入队时冻结的 revision 1。
    const userEdited = JSON.parse(baselineJson());
    userEdited.editorial.topic = "用户改过的主题";
    (prisma.contentBrief.findFirst as any)
      .mockResolvedValueOnce(
        queuedRow({
          revision: 2,
          effectiveBrief: JSON.stringify(userEdited),
          refinementBaseRevision: 1,
          refinementBaseBrief: baselineJson(),
        }),
      )
      .mockResolvedValueOnce(null);
    noExpiredRunning();
    (prisma.contentBrief.updateMany as any).mockResolvedValue({ count: 1 });
    vi.mocked(callLLMJson).mockResolvedValue(goodCandidateOutput as never);

    const result = await runRefinementBatch("worker-1");

    // 提示词以冻结基线为输入，不包含用户临时编辑的主题。
    const promptArg = vi.mocked(callLLMJson).mock.calls[0]?.[0] as string;
    expect(promptArg).not.toContain("用户改过的主题");

    // 发布条件是基线 revision（1）而非当前 revision（2）→ 条件失败 → 仅保留候选。
    const publishCall = (prisma.contentBrief.updateMany as any).mock.calls.find(
      (c: any[]) => c[0]?.data?.effectiveBrief !== undefined,
    );
    expect(publishCall?.[0]?.where?.revision).toBe(1);
  });

  it("requeues expired running refinements after a crash (R1)", async () => {
    // 恢复查询命中 2 条过期 running。
    (prisma.contentBrief.updateMany as any).mockResolvedValueOnce({ count: 2 });
    // 领取阶段无候选。
    (prisma.contentBrief.findFirst as any).mockResolvedValue(null);

    const result = await runRefinementBatch("worker-1");

    const recoveryCall = (prisma.contentBrief.updateMany as any).mock.calls[0][0];
    expect(recoveryCall.where).toMatchObject({ refinementStatus: "running" });
    expect(recoveryCall.data.refinementStatus).toBe("queued");
    expect(result.claimed).toBe(0);
    expect(vi.mocked(callLLMJson)).not.toHaveBeenCalled();
  });

  it("loses the race gracefully when another worker claims first", async () => {
    (prisma.contentBrief.findFirst as any).mockResolvedValueOnce(queuedRow()).mockResolvedValueOnce(null);
    noExpiredRunning();
    (prisma.contentBrief.updateMany as any).mockResolvedValue({ count: 0 });
    vi.mocked(callLLMJson).mockResolvedValue(goodCandidateOutput as never);

    const result = await runRefinementBatch("worker-1");
    expect(result.claimed).toBe(0);
    expect(vi.mocked(callLLMJson)).not.toHaveBeenCalled();
  });
});
