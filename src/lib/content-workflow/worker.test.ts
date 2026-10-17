import { describe, it, expect, beforeEach, vi } from "vitest";
import { runGenerationBatch, WorkflowDataError, PROVIDER_RESULT_UNCONFIRMED } from "./worker";
import { callLLM } from "@/lib/ai/client";
import {
  commitUsageOperation as portalCommit,
  releaseUsageOperation as portalRelease,
} from "@/lib/billing/portal-usage-client";
import { prisma } from "@/lib/db";
import fixture from '../../../contracts/fixtures/evidence-brief-v2-valid.json';
import { verifyWorkflowEvidence, EvidenceAuthorityError } from './evidence-authority';
vi.mock('./evidence-authority', () => ({ verifyWorkflowEvidence: vi.fn(), EvidenceAuthorityError: class extends Error { constructor(public code: string, public retryable: boolean) { super(code); } } }));

vi.mock("@/lib/ai/client", () => ({
  callLLM: vi.fn(),
  LLMError: class extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

vi.mock("@/lib/billing/portal-usage-client", () => ({
  commitUsageOperation: vi.fn(),
  releaseUsageOperation: vi.fn(),
}));

vi.mock("@/lib/ai/prompts/wechat", () => ({
  buildWeChatPrompt: vi.fn(() => "PROMPT"),
}));

vi.mock("@/lib/platforms/capabilities", () => ({
  getGenerationCapabilities: vi.fn(),
  IMPLEMENTED_PROMPT_BUILDERS: { wechat: 'wechat', weibo: 'weibo', xiaohongshu: 'xiaohongshu', douyin: 'douyin' },
}));

const OP = "content-workflow:ws-1:" + "a".repeat(64);

/** 有效的 V1 快照（worker 唯一生成输入，§8.6）。 */
const SNAPSHOT = JSON.stringify({
  schemaVersion: 1,
  id: "brief_1",
  workspaceId: "ws-1",
  projectId: "pj_1",
  revision: 1,
  status: "ready",
  source: { type: "visibility_suggestion", suggestionId: "1", sourceHash: "h" },
  strategy: { objective: "目标", intent: "educate", contentType: "article" },
  editorial: {
    topic: "t",
    titleCandidates: [],
    outline: [],
    keywords: [],
    references: [],
  },
  constraints: {
    locked: { mustMention: [], avoidMention: [], allowedClaims: [], forbiddenClaims: [] },
    editable: { mustMention: [], avoidMention: [] },
  },
  platformPlan: [],
  generationMeta: { effectiveSource: "rules", rulesVersion: "1" },
});

function candidateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "run_1",
    workflowId: "wf_1",
    platform: "wechat",
    status: "queued",
    attemptCount: 0,
    nextAttemptAt: null,
    lockedBy: null,
    lockedUntil: null,
    workflow: {
      id: "wf_1",
      status: "queued",
      usageStatus: "reserved",
      usageOperationId: OP,
      briefSnapshot: SNAPSHOT,
      contentPieceId: "piece_1",
      workspaceId: "ws-1",
    },
    ...overrides,
  };
}

/** 恢复查询无过期运行的通用前置（R1 恢复在领取之前执行）。 */
function noExpiredRuns() {
  (prisma.contentGenerationRun.findMany as any).mockResolvedValueOnce([]);
}

describe("runGenerationBatch", () => {
  beforeEach(() => {
    // resetAllMocks：clearAllMocks 不清持久实现与 Once 队列，会跨测试泄漏。
    vi.resetAllMocks();
    vi.mocked(portalCommit).mockResolvedValue({ ok: true, status: "committed" });
  });

  it("commits usage before the first LLM call, then succeeds", async () => {
    noExpiredRuns();
    (prisma.contentGenerationRun.findMany as any)
      .mockResolvedValueOnce([candidateRow()])
      .mockResolvedValue([]);
    (prisma.contentGenerationRun.count as any).mockResolvedValue(0);
    (prisma.contentGenerationRun.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.contentPiece.findUnique as any).mockResolvedValue({
      id: "piece_1",
      brandVoiceId: null,
      platformContents: [{ id: "pc_1", platform: "wechat" }],
    });
    (prisma.brandVoice.findFirst as any).mockResolvedValue(null);
    vi.mocked(callLLM).mockResolvedValue("生成的内容");
    (prisma.platformContent.update as any).mockResolvedValue({});
    // aggregateAndUpdateWorkflow
    (prisma.contentGenerationRun.findMany as any)
      .mockResolvedValueOnce([{ platform: "wechat", status: "succeeded" }]);
    (prisma.contentWorkflow.updateMany as any).mockResolvedValue({ count: 1 });

    const result = await runGenerationBatch("worker-1");

    expect(result.claimed).toBe(1);
    expect(result.succeeded).toBe(1);
    // 额度先于模型请求提交（设计 §10.8）。
    expect(portalCommit).toHaveBeenCalledWith(OP);
    expect(vi.mocked(callLLM).mock.invocationCallOrder[0]).toBeGreaterThan(
      vi.mocked(portalCommit).mock.invocationCallOrder[0],
    );
    // committed 只置一次。
    const commitUpdate = (prisma.contentWorkflow.updateMany as any).mock.calls.find(
      (c: any[]) => c[0]?.where?.usageStatus === "reserved",
    );
    expect(commitUpdate?.[0]?.data?.usageStatus).toBe("committed");
    // 成功写入 PlatformContent。
    expect(prisma.platformContent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pc_1" },
        data: expect.objectContaining({ content: "生成的内容" }),
      }),
    );
    // 模型请求发出前落 providerRequestId（R1）。
    const mark = (prisma.contentGenerationRun.updateMany as any).mock.calls.find(
      (c: any[]) => typeof c[0]?.data?.providerRequestId === "string",
    );
    expect(mark).toBeDefined();
  });

  it("never calls the LLM when the usage commit fails", async () => {
    noExpiredRuns();
    (prisma.contentGenerationRun.findMany as any)
      .mockResolvedValueOnce([candidateRow()])
      .mockResolvedValue([]);
    (prisma.contentGenerationRun.count as any).mockResolvedValue(0);
    (prisma.contentGenerationRun.updateMany as any).mockResolvedValue({ count: 1 });
    vi.mocked(portalCommit).mockResolvedValue({
      ok: false,
      code: "PORTAL_UNAVAILABLE",
      message: "Portal 不可用",
    });
    (prisma.contentGenerationRun.findMany as any)
      .mockResolvedValueOnce([{ platform: "wechat", status: "failed_retryable" }]);
    (prisma.contentWorkflow.updateMany as any).mockResolvedValue({ count: 1 });

    const result = await runGenerationBatch("worker-1");

    expect(result.failedRetryable).toBe(1);
    expect(callLLM).not.toHaveBeenCalled();
    const failureUpdate = (prisma.contentGenerationRun.updateMany as any).mock.calls.find(
      (c: any[]) => c[0]?.where?.id === "run_1" && c[0]?.data?.status === "failed_retryable",
    );
    expect(failureUpdate?.[0]?.data?.failureCode).toBe("USAGE_COMMIT_UNAVAILABLE");
  });

  it("retries retryable LLM errors with backoff until the attempt cap", async () => {
    noExpiredRuns();
    (prisma.contentGenerationRun.findMany as any)
      .mockResolvedValueOnce([candidateRow({ attemptCount: 1 })])
      .mockResolvedValue([]);
    (prisma.contentGenerationRun.count as any).mockResolvedValue(0);
    (prisma.contentGenerationRun.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.contentPiece.findUnique as any).mockResolvedValue({
      id: "piece_1",
      brandVoiceId: null,
      platformContents: [{ id: "pc_1", platform: "wechat" }],
    });
    const { LLMError } = await import("@/lib/ai/client");
    vi.mocked(callLLM).mockRejectedValue(new LLMError("timeout", 408));
    (prisma.contentGenerationRun.findMany as any)
      .mockResolvedValueOnce([{ platform: "wechat", status: "failed_retryable" }]);
    (prisma.contentWorkflow.updateMany as any).mockResolvedValue({ count: 1 });

    const result = await runGenerationBatch("worker-1");

    expect(result.failedRetryable).toBe(1);
    const retryUpdate = (prisma.contentGenerationRun.updateMany as any).mock.calls.find(
      (c: any[]) => c[0]?.where?.id === "run_1" && c[0]?.data?.nextAttemptAt,
    );
    expect(retryUpdate).toBeDefined();

    // 第 3 次尝试失败 → 终止。
    vi.clearAllMocks();
    vi.mocked(portalCommit).mockResolvedValue({ ok: true, status: "committed" });
    noExpiredRuns();
    (prisma.contentGenerationRun.findMany as any)
      .mockResolvedValueOnce([candidateRow({ attemptCount: 3 })])
      .mockResolvedValue([]);
    (prisma.contentGenerationRun.count as any).mockResolvedValue(0);
    (prisma.contentGenerationRun.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.contentPiece.findUnique as any).mockResolvedValue({
      id: "piece_1",
      brandVoiceId: null,
      platformContents: [{ id: "pc_1", platform: "wechat" }],
    });
    vi.mocked(callLLM).mockRejectedValue(new LLMError("timeout", 408));
    (prisma.contentGenerationRun.findMany as any)
      .mockResolvedValueOnce([{ platform: "wechat", status: "failed_terminal" }]);
    (prisma.contentWorkflow.updateMany as any).mockResolvedValue({ count: 1 });

    const exhausted = await runGenerationBatch("worker-1");
    expect(exhausted.failedTerminal).toBe(1);
  });

  it("skips claiming when the workflow already has 2 generating runs", async () => {
    noExpiredRuns();
    (prisma.contentGenerationRun.findMany as any).mockResolvedValue([candidateRow()]);
    (prisma.contentGenerationRun.count as any).mockResolvedValue(2);

    const result = await runGenerationBatch("worker-1");
    expect(result.claimed).toBe(0);
    expect(prisma.contentGenerationRun.updateMany).not.toHaveBeenCalled();
    expect(callLLM).not.toHaveBeenCalled();
  });

  it("loses the claim race without processing", async () => {
    noExpiredRuns();
    (prisma.contentGenerationRun.findMany as any).mockResolvedValue([candidateRow()]);
    (prisma.contentGenerationRun.count as any).mockResolvedValue(0);
    (prisma.contentGenerationRun.updateMany as any).mockResolvedValue({ count: 0 });

    const result = await runGenerationBatch("worker-1");
    expect(result.claimed).toBe(0);
    expect(callLLM).not.toHaveBeenCalled();
  });

  it("marks runs of cancelled workflows as cancelled and releases usage", async () => {
    noExpiredRuns();
    (prisma.contentGenerationRun.findMany as any)
      .mockResolvedValueOnce([candidateRow({ workflow: { ...candidateRow().workflow, status: "cancelled" } })])
      .mockResolvedValue([]);
    (prisma.contentGenerationRun.updateMany as any).mockResolvedValue({ count: 1 });
    vi.mocked(portalRelease).mockResolvedValue({ ok: true, status: "released" });
    (prisma.contentWorkflow.findUnique as any).mockResolvedValue({
      id: "wf_1",
      usageStatus: "reserved",
      usageOperationId: OP,
    });
    (prisma.contentGenerationRun.findMany as any).mockResolvedValueOnce([]);

    const result = await runGenerationBatch("worker-1");
    // 取消的运行不再领取，本批无可处理任务。
    expect(result.claimed).toBe(0);
    const cancelUpdate = (prisma.contentGenerationRun.updateMany as any).mock.calls.find(
      (c: any[]) => c[0]?.data?.status === "cancelled",
    );
    expect(cancelUpdate).toBeDefined();
  });

  it("does not read the stale ContentPiece.brief; snapshot is the generation input (§8.6)", async () => {
    noExpiredRuns();
    (prisma.contentGenerationRun.findMany as any)
      .mockResolvedValueOnce([candidateRow()])
      .mockResolvedValue([]);
    (prisma.contentGenerationRun.count as any).mockResolvedValue(0);
    (prisma.contentGenerationRun.updateMany as any).mockResolvedValue({ count: 1 });
    // piece.brief 是陈旧的旧格式数据；快照才是唯一输入。
    (prisma.contentPiece.findUnique as any).mockResolvedValue({
      id: "piece_1",
      brandVoiceId: null,
      brief: JSON.stringify({ topic: "STALE", keyPoints: [], platforms: ["wechat"], references: "", notes: "" }),
      platformContents: [{ id: "pc_1", platform: "wechat" }],
    });
    vi.mocked(callLLM).mockResolvedValue("ok");
    (prisma.platformContent.update as any).mockResolvedValue({});
    (prisma.contentGenerationRun.findMany as any)
      .mockResolvedValueOnce([{ platform: "wechat", status: "succeeded" }]);
    (prisma.contentWorkflow.updateMany as any).mockResolvedValue({ count: 1 });

    const result = await runGenerationBatch("worker-1");

    // 快照解析成功、生成正常完成（陈旧 piece.brief 不再参与）。
    expect(result.succeeded).toBe(1);
    expect(callLLM).toHaveBeenCalled();
  });

  it("skips the model call when the lease is lost before the call (R1)", async () => {
    noExpiredRuns();
    (prisma.contentGenerationRun.findMany as any)
      .mockResolvedValueOnce([candidateRow()])
      .mockResolvedValue([]);
    (prisma.contentGenerationRun.count as any).mockResolvedValue(0);
    // 领取成功，但 providerRequestId 标记（租约已丢）失败。
    (prisma.contentGenerationRun.updateMany as any)
      .mockResolvedValueOnce({ count: 1 }) // claim
      .mockResolvedValue({ count: 0 });
    (prisma.contentPiece.findUnique as any).mockResolvedValue({
      id: "piece_1",
      brandVoiceId: null,
      platformContents: [{ id: "pc_1", platform: "wechat" }],
    });
    (prisma.contentGenerationRun.findMany as any)
      .mockResolvedValueOnce([{ platform: "wechat", status: "generating" }]);
    (prisma.contentWorkflow.updateMany as any).mockResolvedValue({ count: 1 });

    const result = await runGenerationBatch("worker-1");

    expect(result.skipped).toBe(1);
    expect(callLLM).not.toHaveBeenCalled();
  });
});

describe("expired generating takeover (R1)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(portalCommit).mockResolvedValue({ ok: true, status: "committed" });
  });

  function expiredRun(overrides: Record<string, unknown> = {}) {
    return {
      id: "run_9",
      workflowId: "wf_9",
      platform: "wechat",
      status: "generating",
      providerRequestId: null,
      lockedUntil: new Date(Date.now() - 1000),
      workflow: { contentPieceId: "piece_9" },
      ...overrides,
    };
  }

  it("recovers a crash before the model call by requeueing (调用前退出)", async () => {
    (prisma.contentGenerationRun.findMany as any).mockResolvedValueOnce([expiredRun()]);
    // 重置 queued 后的聚合查询。
    (prisma.contentGenerationRun.findMany as any).mockResolvedValueOnce([]);
    (prisma.contentGenerationRun.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.contentWorkflow.updateMany as any).mockResolvedValue({ count: 1 });
    // 领取阶段无候选。
    (prisma.contentGenerationRun.findMany as any).mockResolvedValue([]);

    const result = await runGenerationBatch("worker-2");

    expect(result.recovered).toBe(1);
    const reset = (prisma.contentGenerationRun.updateMany as any).mock.calls.find(
      (c: any[]) => c[0]?.data?.status === "queued",
    );
    expect(reset?.[0]?.where?.id).toBe("run_9");
    expect(callLLM).not.toHaveBeenCalled();
  });

  it("marks a crash after the model call as provider-unconfirmed terminal (调用后退出)", async () => {
    (prisma.contentGenerationRun.findMany as any).mockResolvedValueOnce([
      expiredRun({ providerRequestId: "llm-old" }),
    ]);
    (prisma.contentPiece.findUnique as any).mockResolvedValue({
      id: "piece_9",
      platformContents: [{ id: "pc_9", platform: "wechat", content: "" }],
    });
    (prisma.contentGenerationRun.updateMany as any).mockResolvedValue({ count: 1 });
    // finalize 聚合 + 领取候选（无）。
    (prisma.contentGenerationRun.findMany as any).mockResolvedValue([]);
    (prisma.contentWorkflow.updateMany as any).mockResolvedValue({ count: 1 });

    const result = await runGenerationBatch("worker-2");

    expect(result.recovered).toBe(1);
    const terminal = (prisma.contentGenerationRun.updateMany as any).mock.calls.find(
      (c: any[]) => c[0]?.data?.status === "failed_terminal",
    );
    expect(terminal?.[0]?.data?.failureCode).toBe(PROVIDER_RESULT_UNCONFIRMED);
    expect(callLLM).not.toHaveBeenCalled();
  });

  it("finalizes a crash after writing content as succeeded (写结果前退出)", async () => {
    (prisma.contentGenerationRun.findMany as any).mockResolvedValueOnce([expiredRun({ providerRequestId: "llm-old" })]);
    (prisma.contentPiece.findUnique as any).mockResolvedValue({
      id: "piece_9",
      platformContents: [{ id: "pc_9", platform: "wechat", content: "已生成的正文" }],
    });
    (prisma.contentGenerationRun.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.contentGenerationRun.findMany as any).mockResolvedValue([]);
    (prisma.contentWorkflow.updateMany as any).mockResolvedValue({ count: 1 });

    const result = await runGenerationBatch("worker-2");

    expect(result.recovered).toBe(1);
    const success = (prisma.contentGenerationRun.updateMany as any).mock.calls.find(
      (c: any[]) => c[0]?.data?.status === "succeeded",
    );
    expect(success).toBeDefined();
    expect(callLLM).not.toHaveBeenCalled();
  });

  it("does not double-recover when another instance grabbed the expired run", async () => {
    (prisma.contentGenerationRun.findMany as any).mockResolvedValueOnce([expiredRun()]);
    // 抢占恢复权失败。
    (prisma.contentGenerationRun.updateMany as any).mockResolvedValueOnce({ count: 0 });
    (prisma.contentGenerationRun.findMany as any).mockResolvedValue([]);

    const result = await runGenerationBatch("worker-2");
    expect(result.recovered).toBe(0);
  });
});

describe("content workflow switch (R7)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("claims nothing while disabled", async () => {
    process.env.CONTENT_WORKFLOW_DISABLED = "true";
    try {
      const result = await runGenerationBatch("cron");
      expect(result.claimed).toBe(0);
      expect((result as any).disabled).toBe(true);
      expect(prisma.contentGenerationRun.findMany).not.toHaveBeenCalled();
      expect(callLLM).not.toHaveBeenCalled();
    } finally {
      delete process.env.CONTENT_WORKFLOW_DISABLED;
    }
  });
});

describe("instance in-flight slots (R13)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(portalCommit).mockResolvedValue({ ok: true, status: "committed" });
  });

  it("caps concurrent model calls across concurrent batches at MAX_INFLIGHT_LLM", async () => {
    // 按 where 条件分发：恢复查询（status=generating）无过期运行；
    // 领取查询全局只给 4 个候选——第 5、6 个并发批次必须因槽位已满而空手而归。
    let claimable = 4;
    (prisma.contentGenerationRun.findMany as any).mockImplementation(async (args: any) => {
      if (args?.where?.status === "generating") return [];
      return claimable-- > 0 ? [candidateRow({ id: `run_${claimable}` })] : [];
    });
    (prisma.contentGenerationRun.count as any).mockResolvedValue(0);
    (prisma.contentGenerationRun.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.contentPiece.findUnique as any).mockResolvedValue({
      id: "piece_1",
      brandVoiceId: null,
      platformContents: [{ id: "pc_1", platform: "wechat" }],
    });
    (prisma.contentWorkflow.updateMany as any).mockResolvedValue({ count: 1 });

    // 模型调用先挂起，模拟长时间占用。
    const resolvers: Array<() => void> = [];
    vi.mocked(callLLM).mockImplementation(
      () => new Promise<string>((resolve) => resolvers.push(() => resolve("done"))) as Promise<string>,
    );

    // 6 个并发批次（cron + 多个 inline kick）：实例级并发槽位 ≤4。
    const batches = Array.from({ length: 6 }, () => runGenerationBatch(`kick-${Math.random()}`));
    // 让所有微任务推进到 callLLM 挂起。
    await new Promise((r) => setTimeout(r, 20));

    expect(callLLM).toHaveBeenCalledTimes(4);

    for (const resolve of resolvers) resolve();
    await Promise.all(batches);
  });
});

describe("WorkflowDataError", () => {
  it("carries a code for terminal data problems", () => {
    const err = new WorkflowDataError("PLATFORM_NOT_SUPPORTED", "不支持的平台");
    expect(err.code).toBe("PLATFORM_NOT_SUPPORTED");
  });
});

describe('evidence generation fencing', () => {
  beforeEach(() => {
    vi.stubEnv('CONTENT_EVIDENCE_BRIEF_ENABLED', 'true');
    vi.resetAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => (fn as (tx: typeof prisma) => unknown)(prisma) as never);
    noExpiredRuns();
    const candidate = candidateRow(); candidate.workflow.briefSnapshot = JSON.stringify(fixture);
    Object.assign(candidate.workflow, { projectId: 'p1' });
    vi.mocked(prisma.contentGenerationRun.findMany).mockResolvedValueOnce([candidate] as never).mockResolvedValue([]);
    vi.mocked(prisma.contentGenerationRun.count).mockResolvedValue(0);
    vi.mocked(prisma.contentGenerationRun.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.contentWorkflow.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.contentPiece.findUnique).mockResolvedValue({ id: 'piece_1', platformContents: [{ id: 'pc_1', platform: 'wechat' }] } as never);
    vi.mocked(verifyWorkflowEvidence).mockResolvedValue(fixture as never);
    vi.mocked(portalCommit).mockResolvedValue({ ok: true, status: 'committed' });
    vi.mocked(callLLM).mockResolvedValue('待审核草稿');
  });
  it('revalidates before quota commitment and again before model generation', async () => {
    expect((await runGenerationBatch('evidence-worker')).succeeded).toBe(1);
    expect(verifyWorkflowEvidence).toHaveBeenCalledTimes(2);
    expect(vi.mocked(verifyWorkflowEvidence).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(portalCommit).mock.invocationCallOrder[0]);
    expect(vi.mocked(verifyWorkflowEvidence).mock.invocationCallOrder[1]).toBeLessThan(vi.mocked(callLLM).mock.invocationCallOrder[0]);
    const finalize = vi.mocked(prisma.contentGenerationRun.updateMany).mock.calls.find(([args]) => args.data.status === 'succeeded');
    expect(finalize?.[0].where).toMatchObject({ lockedBy: 'evidence-worker', attemptCount: 1, lockedUntil: { gt: expect.any(Date) } });
  });
  it('never commits quota or calls the model for revoked facts', async () => {
    vi.mocked(verifyWorkflowEvidence).mockRejectedValue(new EvidenceAuthorityError('EVIDENCE_AUTHORIZATION_STALE', false));
    vi.mocked(prisma.contentWorkflow.findUnique).mockResolvedValue({ usageStatus: 'reserved', usageOperationId: OP } as never);
    vi.mocked(portalRelease).mockResolvedValue({ ok: true, status: 'released' });
    expect((await runGenerationBatch('evidence-worker')).failedTerminal).toBe(1);
    expect(portalCommit).not.toHaveBeenCalled(); expect(callLLM).not.toHaveBeenCalled(); expect(portalRelease).toHaveBeenCalledWith(OP, 'evidence_verification_failed');
  });
  it('keeps a temporary authority failure retryable without a model call', async () => {
    vi.mocked(verifyWorkflowEvidence).mockRejectedValue(new EvidenceAuthorityError('EVIDENCE_AUTHORITY_UNAVAILABLE', true));
    expect((await runGenerationBatch('evidence-worker')).failedRetryable).toBe(1);
    expect(portalCommit).not.toHaveBeenCalled(); expect(callLLM).not.toHaveBeenCalled(); expect(portalRelease).not.toHaveBeenCalled();
  });
  it('does not call the model when authorization changes during quota confirmation', async () => {
    vi.mocked(verifyWorkflowEvidence).mockResolvedValueOnce(fixture as never).mockRejectedValueOnce(new EvidenceAuthorityError('EVIDENCE_AUTHORIZATION_STALE', false));
    expect((await runGenerationBatch('evidence-worker')).failedTerminal).toBe(1);
    expect(portalCommit).toHaveBeenCalledOnce(); expect(callLLM).not.toHaveBeenCalled(); expect(prisma.platformContent.update).not.toHaveBeenCalled();
  });
  it('does not persist output after losing the lease', async () => {
    vi.mocked(prisma.contentGenerationRun.updateMany).mockImplementation(async args => ({ count: args.data.status === 'succeeded' ? 0 : 1 }));
    expect((await runGenerationBatch('evidence-worker')).skipped).toBe(1);
    expect(callLLM).toHaveBeenCalledOnce(); expect(prisma.platformContent.update).not.toHaveBeenCalled();
  });
  it('requires manual confirmation when renewal fails after sending the model request', async () => {
    let renew: (() => Promise<void>) | undefined;
    const timer = vi.spyOn(globalThis, 'setInterval').mockImplementation(callback => {
      renew = callback as () => Promise<void>;
      return 1 as unknown as ReturnType<typeof setInterval>;
    });
    vi.mocked(prisma.contentGenerationRun.updateMany).mockImplementation(args => {
      if (args.data.lockedUntil && !args.data.status && !args.data.lockedBy) throw new Error('temporary_database_failure');
      return Promise.resolve({ count: 1 }) as never;
    });
    vi.mocked(callLLM).mockImplementation(async (_prompt, _system, options) => {
      await renew!();
      expect(options?.signal?.aborted).toBe(true);
      throw Object.assign(new Error('aborted'), { name: 'LLMError', statusCode: 408 });
    });
    try {
      expect((await runGenerationBatch('evidence-worker')).failedTerminal).toBe(1);
      const failure = vi.mocked(prisma.contentGenerationRun.updateMany).mock.calls.find(([args]) => args.data.failureCode === PROVIDER_RESULT_UNCONFIRMED);
      expect(failure?.[0].where).toMatchObject({ status: 'generating', lockedBy: 'evidence-worker', attemptCount: 1, lockedUntil: { gt: expect.any(Date) } });
      expect(failure?.[0].data).toMatchObject({ status: 'failed_terminal' });
      expect(failure?.[0].data).not.toHaveProperty('providerRequestId');
      expect(prisma.platformContent.update).not.toHaveBeenCalled();
      expect(portalRelease).not.toHaveBeenCalled();
    } finally { timer.mockRestore(); }
  });
  it('does not repeat the model request when its successful response cannot be persisted', async () => {
    vi.mocked(prisma.platformContent.update).mockRejectedValueOnce(new Error('database_write_failed'));
    expect((await runGenerationBatch('evidence-worker')).failedTerminal).toBe(1);
    expect(callLLM).toHaveBeenCalledOnce();
    const failure = vi.mocked(prisma.contentGenerationRun.updateMany).mock.calls.find(([args]) => args.data.failureCode === PROVIDER_RESULT_UNCONFIRMED);
    expect(failure?.[0].data).toMatchObject({ status: 'failed_terminal' });
    expect(failure?.[0].data).not.toHaveProperty('providerRequestId');
    expect(prisma.contentGenerationRun.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'failed_retryable' }) }));
    expect(portalRelease).not.toHaveBeenCalled();
  });
  it('leaves an unknown result to the takeover owner when its lease is lost', async () => {
    vi.mocked(callLLM).mockRejectedValue(new Error('connection_closed_after_send'));
    vi.mocked(prisma.contentGenerationRun.updateMany).mockImplementation(args => Promise.resolve({ count: args.data.failureCode === PROVIDER_RESULT_UNCONFIRMED ? 0 : 1 }) as never);
    expect((await runGenerationBatch('evidence-worker')).skipped).toBe(1);
    expect(prisma.platformContent.update).not.toHaveBeenCalled();
    expect(prisma.contentGenerationRun.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'failed_retryable' }) }));
  });
  it('still retries a definite rate-limit response under the original attempt cap', async () => {
    vi.mocked(callLLM).mockRejectedValue(Object.assign(new Error('rate limited'), { name: 'LLMError', statusCode: 429 }));
    expect((await runGenerationBatch('evidence-worker')).failedRetryable).toBe(1);
    expect(prisma.contentGenerationRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'failed_retryable', failureCode: 'LLM_RATE_LIMITED' }) }));
  });
  it('pauses evidence jobs when the feature is disabled without consuming attempts', async () => {
    vi.stubEnv('CONTENT_EVIDENCE_BRIEF_ENABLED', 'false');
    expect((await runGenerationBatch('evidence-worker')).claimed).toBe(0);
    expect(prisma.contentGenerationRun.updateMany).not.toHaveBeenCalled(); expect(portalCommit).not.toHaveBeenCalled(); expect(callLLM).not.toHaveBeenCalled();
  });
});
