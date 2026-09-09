/**
 * 平台生成 worker（设计 §7.4/§9.3/§10.8/§12.4）：
 *
 * - 领取：status in (queued, failed_retryable) 且退避到期且租约可用；
 *   同一工作流 generating 运行 <2，实例内并发 LLM 请求 ≤4。
 * - 额度：usageStatus=reserved 时先向 Portal 提交（失败绝不调模型），
 *   条件更新保证 committed 只发生一次。
 * - 生成：构建提示词 → callLLM（180s，外部租约丢失信号可中止）；
 *   生成期间每 30s 续租。
 * - 失败：429/5xx/超时退避 5s/30s/120s（+抖动）≤3 次，之后终止。
 * - 每个运行终态后重新聚合工作流状态。
 */

import { prisma } from "@/lib/db";
import { callLLM, LLMError } from "@/lib/ai/client";
import { buildWeChatPrompt } from "@/lib/ai/prompts/wechat";
import { buildWeiboPrompt } from "@/lib/ai/prompts/weibo";
import { buildXiaohongshuPrompt } from "@/lib/ai/prompts/xiaohongshu";
import { buildDouyinPrompt } from "@/lib/ai/prompts/douyin";
import type { BrandVoice, Brief, Platform } from "@/types";
import {
  commitUsageOperation as portalCommit,
  releaseUsageOperation as portalRelease,
} from "@/lib/billing/portal-usage-client";
import {
  aggregateWorkflowStatus,
  classifyLlmError,
  MAX_ATTEMPTS,
  retryDelayMs,
} from "./status";
import { LEASE_DURATION_MS, LEASE_RENEW_INTERVAL_MS, leaseExpiresAt } from "@/lib/workers/lease";
import { emitContentEvent } from "@/lib/observability/events";

const BUILDERS: Record<Platform, (brief: Brief, brandVoice?: BrandVoice) => string> = {
  wechat: buildWeChatPrompt,
  weibo: buildWeiboPrompt,
  xiaohongshu: buildXiaohongshuPrompt,
  douyin: buildDouyinPrompt,
};

/** 每实例并发模型请求上限（设计 §7.4）。 */
const MAX_INFLIGHT_LLM = 4;
/** 每工作流并发平台上限（设计 §7.4）。 */
const MAX_GENERATING_PER_WORKFLOW = 2;
/** 单平台生成硬超时（设计 §13.2）。 */
const GENERATION_TIMEOUT_MS = 180_000;
/** 每批最多处理的运行数。 */
const BATCH_SIZE = 6;

let inFlight = 0;

export interface GenerationBatchResult {
  claimed: number;
  succeeded: number;
  failedRetryable: number;
  failedTerminal: number;
  skipped: number;
}

interface ClaimedRun {
  run: {
    id: string;
    workflowId: string;
    platform: string;
    attemptCount: number;
    status: string;
  };
  workflow: {
    id: string;
    status: string;
    usageStatus: string;
    usageOperationId: string;
    contentPieceId: string | null;
    workspaceId: string;
  };
}

async function claimNextRun(workerId: string, now: Date): Promise<ClaimedRun | null> {
  // 候选：可领取的运行（退避到期、租约可用）。
  const candidates = await prisma.contentGenerationRun.findMany({
    where: {
      status: { in: ["queued", "failed_retryable"] },
      AND: [
        {
          OR: [
            { nextAttemptAt: null },
            { nextAttemptAt: { lte: now } },
          ],
        },
        {
          OR: [
            { lockedUntil: null },
            { lockedUntil: { lt: now } },
          ],
        },
      ],
    },
    include: { workflow: true },
    orderBy: { createdAt: "asc" },
    take: 10,
  });

  for (const candidate of candidates) {
    if (candidate.workflow.status === "cancelled") {
      await prisma.contentGenerationRun.updateMany({
        where: { id: candidate.id, status: { in: ["queued", "failed_retryable"] } },
        data: { status: "cancelled", completedAt: new Date() },
      });
      continue;
    }
    // 同工作流 generating < 2。
    const generating = await prisma.contentGenerationRun.count({
      where: { workflowId: candidate.workflowId, status: "generating" },
    });
    if (generating >= MAX_GENERATING_PER_WORKFLOW) continue;

    const claim = await prisma.contentGenerationRun.updateMany({
      where: {
        id: candidate.id,
        status: candidate.status,
        OR: [
          { lockedUntil: null },
          { lockedUntil: { lt: now } },
        ],
      },
      data: {
        status: "generating",
        lockedBy: workerId,
        lockedUntil: leaseExpiresAt(now),
        startedAt: new Date(),
        attemptCount: { increment: 1 },
      },
    });
    if (claim.count === 1) {
      // 确保工作流状态显示 generating。
      await prisma.contentWorkflow.updateMany({
        where: { id: candidate.workflowId, status: "queued" },
        data: { status: "generating" },
      });
      return {
        run: {
          id: candidate.id,
          workflowId: candidate.workflowId,
          platform: candidate.platform,
          attemptCount: candidate.attemptCount + 1,
          status: "generating",
        },
        workflow: {
          id: candidate.workflow.id,
          status: candidate.workflow.status,
          usageStatus: candidate.workflow.usageStatus,
          usageOperationId: candidate.workflow.usageOperationId,
          contentPieceId: candidate.workflow.contentPieceId,
          workspaceId: candidate.workflow.workspaceId,
        },
      };
    }
  }
  return null;
}

async function releaseLease(runId: string, workerId: string) {
  await prisma.contentGenerationRun.updateMany({
    where: { id: runId, lockedBy: workerId },
    data: { lockedBy: null, lockedUntil: null },
  });
}

async function finalizeRun(params: {
  runId: string;
  workflowId: string;
  status: "succeeded" | "failed_retryable" | "failed_terminal";
  failureCode?: string;
  failureMessage?: string;
  platformContentUpdate?: { platformContentId: string; content: string };
}): Promise<void> {
  if (params.platformContentUpdate) {
    await prisma.platformContent.update({
      where: { id: params.platformContentUpdate.platformContentId },
      data: { content: params.platformContentUpdate.content, status: "draft" },
    });
  }

  await prisma.contentGenerationRun.updateMany({
    where: { id: params.runId },
    data: {
      status: params.status,
      ...(params.failureCode ? { failureCode: params.failureCode.slice(0, 64) } : {}),
      ...(params.failureMessage ? { failureMessage: params.failureMessage.slice(0, 2000) } : {}),
      ...(params.status === "succeeded"
        ? { completedAt: new Date(), lockedBy: null, lockedUntil: null }
        : params.status === "failed_retryable"
          ? { nextAttemptAt: new Date(Date.now() + retryDelayMs(1)), lockedBy: null, lockedUntil: null }
          : { completedAt: new Date(), lockedBy: null, lockedUntil: null }),
    },
  });

  await aggregateAndUpdateWorkflow(params.workflowId);
}

async function aggregateAndUpdateWorkflow(workflowId: string): Promise<string> {
  const runs = await prisma.contentGenerationRun.findMany({
    where: { workflowId },
    select: { platform: true, status: true },
  });
  const status = aggregateWorkflowStatus(runs);
  const terminal = ["succeeded", "partial", "failed", "cancelled"].includes(status);
  await prisma.contentWorkflow.updateMany({
    where: { id: workflowId },
    data: { status, ...(terminal ? { completedAt: new Date() } : {}) },
  });
  if (terminal) {
    emitContentEvent("content_workflow.completed", { workflowId, status });
  }
  return status;
}

/** 模型请求前的额度提交（设计 §10.8）：失败绝不继续生成。 */
async function ensureUsageCommitted(claimed: ClaimedRun): Promise<{ ok: boolean; code?: string }> {
  if (claimed.workflow.usageStatus === "committed") return { ok: true };

  const commit = await portalCommit(claimed.workflow.usageOperationId);
  if (!commit.ok) {
    return { ok: false, code: commit.code };
  }
  // 条件更新：committed 只置一次。
  await prisma.contentWorkflow.updateMany({
    where: { id: claimed.workflow.id, usageStatus: "reserved" },
    data: { usageStatus: "committed" },
  });
  emitContentEvent("content_workflow.usage_committed", {
    workflowId: claimed.workflow.id,
    operationId: claimed.workflow.usageOperationId,
  });
  return { ok: true };
}

async function buildAndGenerate(claimed: ClaimedRun, workerId: string): Promise<string> {
  const piece = await prisma.contentPiece.findUnique({
    where: { id: claimed.workflow.contentPieceId ?? "" },
    include: { platformContents: true },
  });
  if (!piece) {
    throw new WorkflowDataError("CONTENT_PIECE_MISSING", "内容记录不存在");
  }
  const platformContent = piece.platformContents.find((pc) => pc.platform === claimed.run.platform);
  if (!platformContent) {
    throw new WorkflowDataError("PLATFORM_CONTENT_MISSING", "平台内容记录不存在");
  }

  let brandVoice: BrandVoice | undefined;
  if (piece.brandVoiceId) {
    brandVoice =
      (await prisma.brandVoice.findFirst({
        where: { id: piece.brandVoiceId, workspaceId: claimed.workflow.workspaceId },
      })) ?? undefined;
  }

  const brief = JSON.parse(piece.brief) as Brief;
  const builder = BUILDERS[claimed.run.platform as Platform];
  if (!builder) {
    throw new WorkflowDataError("PLATFORM_NOT_SUPPORTED", `不支持的平台: ${claimed.run.platform}`);
  }
  const prompt = builder(brief, brandVoice);

  // 租约续期：丢失租约（被接管）时中止模型请求，避免重复消耗。
  const abort = new AbortController();
  const renewTimer = setInterval(async () => {
    try {
      const renewed = await prisma.contentGenerationRun.updateMany({
        where: { id: claimed.run.id, lockedBy: workerId, status: "generating" },
        data: { lockedUntil: new Date(Date.now() + LEASE_DURATION_MS) },
      });
      if (renewed.count === 0) abort.abort();
    } catch {
      // 数据库抖动时保守续期失败不中止；租约到期后自然可被接管。
    }
  }, LEASE_RENEW_INTERVAL_MS);

  emitContentEvent("content_generation.started", {
    workflowId: claimed.workflow.id,
    platform: claimed.run.platform,
    attempt: claimed.run.attemptCount,
  });

  try {
    const content = await callLLM(prompt, undefined, {
      timeoutMs: GENERATION_TIMEOUT_MS,
      signal: abort.signal,
    });
    return platformContent.id + "||" + content;
  } finally {
    clearInterval(renewTimer);
  }
}

export class WorkflowDataError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "WorkflowDataError";
  }
}

async function processRun(claimed: ClaimedRun, workerId: string): Promise<
  "succeeded" | "failed_retryable" | "failed_terminal" | "skipped"
> {
  // 1. 额度先行（设计 §10.8）。
  const usage = await ensureUsageCommitted(claimed);
  if (!usage.ok) {
    // Portal 不可用：任务可重试，绝不绕过计费调模型。
    await finalizeRun({
      runId: claimed.run.id,
      workflowId: claimed.workflow.id,
      status: "failed_retryable",
      failureCode: "USAGE_COMMIT_UNAVAILABLE",
      failureMessage: `额度确认失败（${usage.code}），稍后自动重试`,
    });
    emitContentEvent("content_generation.failed", {
      workflowId: claimed.workflow.id,
      platform: claimed.run.platform,
      code: "USAGE_COMMIT_UNAVAILABLE",
    });
    return "failed_retryable";
  }

  // 2. 生成。
  try {
    const result = await buildAndGenerate(claimed, workerId);
    const [platformContentId, ...rest] = result.split("||");
    const content = rest.join("||");
    await finalizeRun({
      runId: claimed.run.id,
      workflowId: claimed.workflow.id,
      status: "succeeded",
      platformContentUpdate: { platformContentId, content },
    });
    emitContentEvent("content_generation.succeeded", {
      workflowId: claimed.workflow.id,
      platform: claimed.run.platform,
    });
    return "succeeded";
  } catch (err) {
    if (err instanceof WorkflowDataError) {
      await finalizeRun({
        runId: claimed.run.id,
        workflowId: claimed.workflow.id,
        status: "failed_terminal",
        failureCode: err.code,
        failureMessage: err.message,
      });
      return "failed_terminal";
    }

    const classified = classifyLlmError(err);
    if (classified.kind === "retryable" && claimed.run.attemptCount < MAX_ATTEMPTS) {
      await finalizeRun({
        runId: claimed.run.id,
        workflowId: claimed.workflow.id,
        status: "failed_retryable",
        failureCode: classified.code,
        failureMessage: classified.message,
      });
      emitContentEvent("content_generation.retried", {
        workflowId: claimed.workflow.id,
        platform: claimed.run.platform,
        code: classified.code,
        attempt: claimed.run.attemptCount,
      });
      return "failed_retryable";
    }

    // 模型请求已发出后的供应商失败仍视为一次生成尝试（设计 §5.6）：
    // 额度保持 committed，不释放。
    await finalizeRun({
      runId: claimed.run.id,
      workflowId: claimed.workflow.id,
      status: "failed_terminal",
      failureCode: classified.code,
      failureMessage: classified.message,
    });
    emitContentEvent("content_generation.failed", {
      workflowId: claimed.workflow.id,
      platform: claimed.run.platform,
      code: classified.code,
    });
    return "failed_terminal";
  }
}

/** 领取并执行一批生成任务；由 cron 路由或工作流创建后的 kick 调用。 */
export async function runGenerationBatch(workerId: string): Promise<GenerationBatchResult> {
  const result: GenerationBatchResult = {
    claimed: 0,
    succeeded: 0,
    failedRetryable: 0,
    failedTerminal: 0,
    skipped: 0,
  };

  for (let i = 0; i < BATCH_SIZE; i++) {
    if (inFlight >= MAX_INFLIGHT_LLM) break;

    let claimed: ClaimedRun | null = null;
    try {
      claimed = await claimNextRun(workerId, new Date());
    } catch (err) {
      console.error("[generation-worker] claim failed", err);
      break;
    }
    if (!claimed) break;
    result.claimed += 1;

    inFlight += 1;
    try {
      const outcome = await processRun(claimed, workerId);
      if (outcome === "succeeded") result.succeeded += 1;
      else if (outcome === "failed_retryable") result.failedRetryable += 1;
      else if (outcome === "failed_terminal") result.failedTerminal += 1;
      else result.skipped += 1;
    } catch (err) {
      console.error("[generation-worker] process failed", {
        runId: claimed.run.id,
        err,
      });
      await releaseLease(claimed.run.id, workerId).catch(() => undefined);
      result.skipped += 1;
    } finally {
      inFlight -= 1;
    }
  }

  return result;
}

/** 管理员强制释放（测试与运维）：usageStatus=reserved 时通知 Portal 释放。 */
export async function releaseWorkflowUsage(workflowId: string, reason: string): Promise<boolean> {
  const workflow = await prisma.contentWorkflow.findUnique({ where: { id: workflowId } });
  if (!workflow || workflow.usageStatus !== "reserved") return false;
  const released = await portalRelease(workflow.usageOperationId, reason);
  if (released.ok) {
    await prisma.contentWorkflow.updateMany({
      where: { id: workflowId, usageStatus: "reserved" },
      data: { usageStatus: "released" },
    });
  }
  return released.ok;
}

export { LLMError };
