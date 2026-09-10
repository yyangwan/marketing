import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createWorkflow,
  toWorkflowView,
  WorkflowValidationError,
} from "./service";
import { buildBaselineBrief } from "@/lib/content-brief/baseline-generator";
import type {
  ProjectSnapshotV1,
  VisibilitySuggestionSnapshotV1,
} from "@/contracts/content-creation-brief-v1";
import { prisma } from "@/lib/db";

const FIXED_NOW = new Date("2026-09-08T10:00:00.000Z");

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
  requestedChannels: ["wechat", "weibo"],
};

const projectSnapshot: ProjectSnapshotV1 = {
  schemaVersion: 1,
  projectId: "project-1",
  name: "云途科技",
  industry: "企业服务",
  productName: "云途助手",
  productKeywords: ["AI 搜索优化"],
  productDescription: "云途助手帮助企业追踪品牌在 AI 搜索场景下的表现。",
};

function briefRow(overrides: Record<string, unknown> = {}) {
  const baseline = buildBaselineBrief({
    briefId: "brief_1",
    workspaceId: "ws-1",
    projectId: "project-1",
    snapshot,
    projectSnapshot,
    sourceHash: "a".repeat(64),
    now: FIXED_NOW,
  });
  return {
    id: "brief_1",
    workspaceId: "ws-1",
    projectId: "project-1",
    revision: 3,
    status: "ready",
    projectSnapshot: JSON.stringify(projectSnapshot),
    effectiveBrief: JSON.stringify(baseline),
    idempotencyRequestHash: null,
    ...overrides,
  };
}

const INPUT = {
  briefId: "brief_1",
  briefRevision: 3,
  platforms: ["wechat", "weibo"] as const,
  usageOperationId: "content-workflow:ws-1:" + "a".repeat(64),
};

function params() {
  return {
    ctx: { workspaceId: "ws-1", projectId: "project-1", userId: "user-1" },
    input: { ...INPUT, platforms: [...INPUT.platforms] },
    idempotencyKey: "key-1",
    requestHash: "b".repeat(64),
  };
}

describe("createWorkflow", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("creates piece + runs + workflow snapshot in one transaction", async () => {
    (prisma.contentBrief.findFirst as any).mockResolvedValue(briefRow());
    (prisma.brandVoice.findFirst as any).mockResolvedValue(null);
    (prisma.aITemplate.findFirst as any).mockResolvedValue(null);
    (prisma.contentWorkflow.findFirst as any).mockResolvedValue(null);
    // 事务内 Brief 版本确认成功（R9）。
    (prisma.contentBrief.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.$transaction as any).mockImplementation(async (fn: (tx: unknown) => unknown) => {
      // 模拟事务内的创建链
      (prisma.contentPiece.create as any).mockResolvedValueOnce({
        id: "piece_1",
        platformContents: [{ id: "pc_w", platform: "wechat" }, { id: "pc_b", platform: "weibo" }],
      });
      (prisma.contentWorkflow.create as any).mockResolvedValueOnce({
        id: "wf_1",
        briefId: "brief_1",
        briefRevision: 3,
        contentPieceId: "piece_1",
        status: "queued",
        usageOperationId: INPUT.usageOperationId,
        runs: [
          { platform: "wechat", status: "queued", attemptCount: 0, failureCode: null, failureMessage: null },
          { platform: "weibo", status: "queued", attemptCount: 0, failureCode: null, failureMessage: null },
        ],
      });
      return fn(prisma);
    });

    const result = await createWorkflow(params());

    expect(result.replayed).toBe(false);
    expect(result.view.platforms).toHaveLength(2);
    expect(result.view.contentPieceId).toBe("piece_1");

    const pieceArgs = (prisma.contentPiece.create as any).mock.calls[0][0].data;
    // 派生 Brief 带完整约束（boundaries 来自 locked ∪ editable）。
    const derivedBrief = JSON.parse(pieceArgs.brief);
    expect(derivedBrief.context.boundaries.mustMention).toContain("云途助手");
    expect(pieceArgs.platformContents.create).toEqual([
      { platform: "wechat", status: "draft" },
      { platform: "weibo", status: "draft" },
    ]);

    const workflowArgs = (prisma.contentWorkflow.create as any).mock.calls[0][0].data;
    expect(workflowArgs.briefRevision).toBe(3);
    expect(workflowArgs.usageOperationId).toBe(INPUT.usageOperationId);
    expect(workflowArgs.usageStatus).toBe("reserved");
    expect(JSON.parse(workflowArgs.briefSnapshot).schemaVersion).toBe(1);
    expect(workflowArgs.runs.create).toEqual([
      { platform: "wechat", status: "queued" },
      { platform: "weibo", status: "queued" },
    ]);
    // Brief 进入 confirmed。
    expect(prisma.contentBrief.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "brief_1", revision: 3 },
        data: expect.objectContaining({ status: "confirmed" }),
      }),
    );
  });

  it("rejects revision mismatch with 409 and current revision", async () => {
    (prisma.contentBrief.findFirst as any).mockResolvedValue(briefRow({ revision: 7 }));
    (prisma.contentWorkflow.findFirst as any).mockResolvedValue(null);

    await expect(createWorkflow(params())).rejects.toMatchObject({
      status: 409,
      code: "BRIEF_VERSION_CONFLICT",
      extras: { currentRevision: 7 },
    });
  });

  it("rejects unsupported platforms with 422", async () => {
    (prisma.contentBrief.findFirst as any).mockResolvedValue(briefRow());
    const bad = params();
    (bad.input as { platforms: string[] }).platforms = ["zhihu"];

    await expect(createWorkflow(bad)).rejects.toMatchObject({
      status: 422,
      code: "PLATFORM_NOT_SUPPORTED",
    });
  });

  it("rejects briefs outside the workspace/project (404)", async () => {
    (prisma.contentBrief.findFirst as any).mockResolvedValue(null);
    await expect(createWorkflow(params())).rejects.toMatchObject({
      status: 404,
      code: "BRIEF_NOT_FOUND",
    });
  });

  it("replays idempotent submissions with the same hash", async () => {
    (prisma.contentBrief.findFirst as any).mockResolvedValue(briefRow());
    (prisma.brandVoice.findFirst as any).mockResolvedValue(null);
    (prisma.aITemplate.findFirst as any).mockResolvedValue(null);
    (prisma.contentWorkflow.findFirst as any).mockResolvedValue({
      id: "wf_existing",
      briefId: "brief_1",
      briefRevision: 3,
      contentPieceId: "piece_1",
      status: "succeeded",
      usageOperationId: INPUT.usageOperationId,
      idempotencyRequestHash: "b".repeat(64),
      runs: [
        { platform: "wechat", status: "succeeded", attemptCount: 1, failureCode: null, failureMessage: null },
      ],
    });

    const result = await createWorkflow(params());
    expect(result.replayed).toBe(true);
    expect(result.view.id).toBe("wf_existing");
    expect(prisma.contentWorkflow.create).not.toHaveBeenCalled();
  });

  it("rejects the same key with a different body (409)", async () => {
    (prisma.contentBrief.findFirst as any).mockResolvedValue(briefRow());
    (prisma.contentWorkflow.findFirst as any).mockResolvedValue({
      idempotencyRequestHash: "c".repeat(64),
    });

    await expect(createWorkflow(params())).rejects.toMatchObject({
      status: 409,
      code: "IDEMPOTENCY_KEY_REUSED",
    });
  });

  it("replays before revision validation so a stale replay cannot trigger release (R4)", async () => {
    // 时序：工作流已受理（旧 key）→ 另一页面编辑 Brief（revision 前进）→ 原样重放。
    // 幂等识别必须先于版本校验，返回原结果而不是 409。
    (prisma.contentBrief.findFirst as any).mockResolvedValue(briefRow({ revision: 9 }));
    (prisma.contentWorkflow.findFirst as any).mockResolvedValue({
      id: "wf_existing",
      briefId: "brief_1",
      briefRevision: 3,
      contentPieceId: "piece_1",
      status: "generating",
      usageOperationId: INPUT.usageOperationId,
      idempotencyRequestHash: "b".repeat(64),
      runs: [
        { platform: "wechat", status: "generating", attemptCount: 1, failureCode: null, failureMessage: null },
      ],
    });

    const result = await createWorkflow(params());
    expect(result.replayed).toBe(true);
    expect(result.view.id).toBe("wf_existing");
    // 不做新的创建/确认。
    expect(prisma.contentWorkflow.create).not.toHaveBeenCalled();
    expect(prisma.contentBrief.updateMany).not.toHaveBeenCalled();
  });

  it("rolls back the creation transaction when the revision confirm loses the race (R9)", async () => {
    (prisma.contentBrief.findFirst as any).mockResolvedValue(briefRow());
    (prisma.brandVoice.findFirst as any).mockResolvedValue(null);
    (prisma.contentWorkflow.findFirst as any).mockResolvedValue(null);
    (prisma.$transaction as any).mockImplementation(async (fn: (tx: unknown) => unknown) => {
      (prisma.contentPiece.create as any).mockResolvedValueOnce({
        id: "piece_1",
        platformContents: [{ id: "pc_w", platform: "wechat" }, { id: "pc_b", platform: "weibo" }],
      });
      (prisma.contentWorkflow.create as any).mockResolvedValueOnce({
        id: "wf_1",
        briefId: "brief_1",
        briefRevision: 3,
        contentPieceId: "piece_1",
        status: "queued",
        usageOperationId: INPUT.usageOperationId,
        runs: [],
      });
      // 事务内版本确认失败：读取后被并发 PATCH。
      (prisma.contentBrief.updateMany as any).mockResolvedValue({ count: 0 });
      return fn(prisma);
    });

    await expect(createWorkflow(params())).rejects.toMatchObject({
      status: 409,
      code: "BRIEF_VERSION_CONFLICT",
    });
  });

  it("validates brand voice ownership", async () => {
    (prisma.contentBrief.findFirst as any).mockResolvedValue(briefRow());
    (prisma.contentWorkflow.findFirst as any).mockResolvedValue(null);
    (prisma.brandVoice.findFirst as any).mockResolvedValue(null);
    const withVoice = params();
    (withVoice.input as { brandVoiceId?: string }).brandVoiceId = "voice_other_ws";

    await expect(createWorkflow(withVoice)).rejects.toMatchObject({
      status: 422,
      code: "BRAND_VOICE_NOT_FOUND",
    });
  });
});

describe("toWorkflowView", () => {
  it("maps run failures into platform error objects", () => {
    const view = toWorkflowView({
      id: "wf_1",
      briefId: "brief_1",
      briefRevision: 3,
      contentPieceId: "piece_1",
      status: "partial",
      usageOperationId: INPUT.usageOperationId,
      runs: [
        { platform: "wechat", status: "succeeded", attemptCount: 1, failureCode: null, failureMessage: null },
        {
          platform: "xiaohongshu",
          status: "failed_retryable",
          attemptCount: 2,
          failureCode: "LLM_TIMEOUT",
          failureMessage: "小红书内容生成超时，可以重试",
        },
      ],
    });
    expect(view.platforms[1].error).toEqual({
      code: "LLM_TIMEOUT",
      message: "小红书内容生成超时，可以重试",
    });
  });
});

describe("WorkflowValidationError shape", () => {
  it("carries status/code/extras", () => {
    const err = new WorkflowValidationError(409, "X", "msg", { currentRevision: 2 });
    expect(err.status).toBe(409);
    expect(err.extras).toEqual({ currentRevision: 2 });
  });
});
