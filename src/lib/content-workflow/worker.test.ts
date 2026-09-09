import { describe, it, expect, beforeEach, vi } from "vitest";
import { runGenerationBatch, WorkflowDataError } from "./worker";
import { callLLM } from "@/lib/ai/client";
import {
  commitUsageOperation as portalCommit,
  releaseUsageOperation as portalRelease,
} from "@/lib/billing/portal-usage-client";
import { prisma } from "@/lib/db";

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
}));

const OP = "content-workflow:ws-1:" + "a".repeat(64);

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
      contentPieceId: "piece_1",
      workspaceId: "ws-1",
    },
    ...overrides,
  };
}

describe("runGenerationBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(portalCommit).mockResolvedValue({ ok: true, status: "committed" });
  });

  it("commits usage before the first LLM call, then succeeds", async () => {
    (prisma.contentGenerationRun.findMany as any)
      .mockResolvedValueOnce([candidateRow()])
      .mockResolvedValue([]);
    (prisma.contentGenerationRun.count as any).mockResolvedValue(0);
    (prisma.contentGenerationRun.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.contentPiece.findUnique as any).mockResolvedValue({
      id: "piece_1",
      brandVoiceId: null,
      brief: JSON.stringify({ topic: "t", keyPoints: [], platforms: ["wechat"], references: "", notes: "" }),
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
  });

  it("never calls the LLM when the usage commit fails", async () => {
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
    (prisma.contentGenerationRun.findMany as any)
      .mockResolvedValueOnce([candidateRow({ attemptCount: 1 })])
      .mockResolvedValue([]);
    (prisma.contentGenerationRun.count as any).mockResolvedValue(0);
    (prisma.contentGenerationRun.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.contentPiece.findUnique as any).mockResolvedValue({
      id: "piece_1",
      brandVoiceId: null,
      brief: JSON.stringify({ topic: "t", keyPoints: [], platforms: ["wechat"], references: "", notes: "" }),
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
    (prisma.contentGenerationRun.findMany as any)
      .mockResolvedValueOnce([candidateRow({ attemptCount: 3 })])
      .mockResolvedValue([]);
    (prisma.contentGenerationRun.count as any).mockResolvedValue(0);
    (prisma.contentGenerationRun.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.contentPiece.findUnique as any).mockResolvedValue({
      id: "piece_1",
      brandVoiceId: null,
      brief: JSON.stringify({ topic: "t", keyPoints: [], platforms: ["wechat"], references: "", notes: "" }),
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
    (prisma.contentGenerationRun.findMany as any).mockResolvedValue([candidateRow()]);
    (prisma.contentGenerationRun.count as any).mockResolvedValue(2);

    const result = await runGenerationBatch("worker-1");
    expect(result.claimed).toBe(0);
    expect(prisma.contentGenerationRun.updateMany).not.toHaveBeenCalled();
    expect(callLLM).not.toHaveBeenCalled();
  });

  it("loses the claim race without processing", async () => {
    (prisma.contentGenerationRun.findMany as any).mockResolvedValue([candidateRow()]);
    (prisma.contentGenerationRun.count as any).mockResolvedValue(0);
    (prisma.contentGenerationRun.updateMany as any).mockResolvedValue({ count: 0 });

    const result = await runGenerationBatch("worker-1");
    expect(result.claimed).toBe(0);
    expect(callLLM).not.toHaveBeenCalled();
  });

  it("marks runs of cancelled workflows as cancelled and releases usage", async () => {
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
});

describe("WorkflowDataError", () => {
  it("carries a code for terminal data problems", () => {
    const err = new WorkflowDataError("PLATFORM_NOT_SUPPORTED", "不支持的平台");
    expect(err.code).toBe("PLATFORM_NOT_SUPPORTED");
  });
});
