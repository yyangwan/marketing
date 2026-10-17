/**
 * 平台生成 worker（设计 §7.4/§9.3/§10.8/§12.4，评审 R1/R13/§8.6）：
 *
 * - 领取：status in (queued, failed_retryable) 且退避到期且租约可用；
 *   同一工作流 generating 运行 <2（行锁互斥），实例内并发 LLM 请求 ≤4
 *   （槽位在任何 await 之前同步预留）。
 * - 接管（R1）：每批先恢复租约过期的 generating 运行——
 *   平台内容已写入 → 直接补记 succeeded；已请求模型但结果未落库
 *   （providerRequestId 已置）→ failed_terminal/PROVIDER_RESULT_UNCONFIRMED，
 *   由人工通过重试确认；尚未请求模型 → 重置 queued 重新生成。
 * - 额度：usageStatus=reserved 时先向 Portal 提交（失败绝不调模型），
 *   条件更新保证 committed 只发生一次。
 * - 生成：唯一输入是工作流 briefSnapshot（§8.6）→ callLLM（180s，
 *   外部租约丢失信号可中止）；请求发出前落 providerRequestId 标记；
 *   生成期间每 30s 续租。
 * - 失败：429/5xx/超时退避 5s/30s/120s（+抖动，按尝试次数）≤3 次，之后终止。
 * - 每个运行终态后重新聚合工作流状态。
 */

import { randomUUID } from "node:crypto";
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
import { parseBrief } from "@/lib/content-brief/serde";
import { effectiveBriefToGenerationBrief } from "@/lib/content-brief/to-generation-brief";
import {
  aggregateWorkflowStatus,
  classifyLlmError,
  MAX_ATTEMPTS,
  retryDelayMs,
} from "./status";
import { LEASE_DURATION_MS, LEASE_RENEW_INTERVAL_MS, leaseExpiresAt } from "@/lib/workers/lease";
import { emitContentEvent } from "@/lib/observability/events";
import { disabledBatchResult, isContentWorkflowDisabled } from "./switch";
import { checkedEvidenceBrief, evidenceToGenerationInput, type EvidenceBriefV2 } from '@/lib/content-brief/evidence-v2';
import { verifyWorkflowEvidence, EvidenceAuthorityError } from './evidence-authority';

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

/** 供应商结果无法确认（进程在模型请求后退出）时的失败码，人工重试即确认重跑。 */
export const PROVIDER_RESULT_UNCONFIRMED = "PROVIDER_RESULT_UNCONFIRMED";

let inFlight = 0;

export interface GenerationBatchResult {
  claimed: number;
  succeeded: number;
  failedRetryable: number;
  failedTerminal: number;
  skipped: number;
  recovered: number;
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
    briefSnapshot: string;
    contentPieceId: string | null;
    workspaceId: string;
    projectId: string;
  };
}

async function claimNextRun(workerId: string, now: Date): Promise<ClaimedRun | null> {
  // 候选：可领取的运行（退避到期、租约可用）。
  const candidates = await prisma.contentGenerationRun.findMany({
    where: {
      status: { in: ["queued", "failed_retryable"] },
      ...(process.env.CONTENT_EVIDENCE_BRIEF_ENABLED === 'true' ? {} : { workflow: { brief: { schemaVersion: { not: 2 } } } }),
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
    try {
      if (JSON.parse(candidate.workflow.briefSnapshot).schemaVersion === 2 && process.env.CONTENT_EVIDENCE_BRIEF_ENABLED !== 'true') continue;
    } catch { /* Invalid snapshots are rejected after claiming. */ }
    if (candidate.workflow.status === "cancelled") {
      await prisma.contentGenerationRun.updateMany({
        where: { id: candidate.id, status: { in: ["queued", "failed_retryable"] } },
        data: { status: "cancelled", completedAt: new Date() },
      });
      continue;
    }
    // 工作流级并发互斥（R13）：SELECT ... FOR UPDATE 序列化同一工作流的领取，
    // count 与条件领取在同一个事务内原子完成。
    const claimed = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM ContentWorkflow WHERE id = ${candidate.workflowId} FOR UPDATE`;
      const generating = await tx.contentGenerationRun.count({
        where: { workflowId: candidate.workflowId, status: "generating" },
      });
      if (generating >= MAX_GENERATING_PER_WORKFLOW) return null;

      const claim = await tx.contentGenerationRun.updateMany({
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
      if (claim.count !== 1) return null;
      // 确保工作流状态显示 generating。
      await tx.contentWorkflow.updateMany({
        where: { id: candidate.workflowId, status: "queued" },
        data: { status: "generating" },
      });
      return candidate;
    });
    if (claimed) {
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
          briefSnapshot: candidate.workflow.briefSnapshot,
          contentPieceId: candidate.workflow.contentPieceId,
          workspaceId: candidate.workflow.workspaceId,
          projectId: candidate.workflow.projectId,
        },
      };
    }
  }
  return null;
}

/**
 * 恢复租约过期的 generating 运行（R1）。
 * 三种故障形态（调用前退出 / 调用后退出 / 写结果前退出）：
 * - 平台内容已写入但运行未终态 → 补记 succeeded（幂等完成）；
 * - providerRequestId 已置且无内容 → 供应商结果不确定 → 人工确认状态；
 * - 尚未发出模型请求 → 重置 queued，由正常领取重新生成。
 */
async function recoverExpiredGenerations(workerId: string, now: Date): Promise<number> {
  const expired = await prisma.contentGenerationRun.findMany({
    where: {
      status: "generating",
      lockedUntil: { lt: now },
    },
    include: { workflow: { select: { contentPieceId: true } } },
    take: 10,
  });

  let recovered = 0;
  for (const run of expired) {
    // 先原子抢占恢复权，避免两个实例同时处理同一过期运行。
    const grab = await prisma.contentGenerationRun.updateMany({
      where: { id: run.id, status: "generating", lockedUntil: { lt: now } },
      data: { lockedBy: `recover-${workerId}`, lockedUntil: leaseExpiresAt(now) },
    });
    if (grab.count !== 1) continue;

    const pieceId = run.workflow?.contentPieceId;
    const piece = pieceId
      ? await prisma.contentPiece.findUnique({
          where: { id: pieceId },
          include: { platformContents: true },
        })
      : null;
    const platformContent = piece?.platformContents.find((pc) => pc.platform === run.platform);
    const contentWritten = Boolean(platformContent?.content && platformContent.content.length > 0);

    if (contentWritten) {
      // 写结果前退出（内容已落库）：补记成功。
      await finalizeRun({
        runId: run.id,
        workflowId: run.workflowId,
        status: "succeeded",
      });
      emitContentEvent("content_generation.succeeded", {
        workflowId: run.workflowId,
        platform: run.platform,
        recovered: true,
      });
    } else if (run.providerRequestId) {
      // 调用后退出：模型请求已发出但结果未落库，不能自动重跑（可能重复消耗）。
      await finalizeRun({
        runId: run.id,
        workflowId: run.workflowId,
        status: "failed_terminal",
        failureCode: PROVIDER_RESULT_UNCONFIRMED,
        failureMessage: "进程在模型请求后中断，结果无法确认；请人工确认后重试",
      });
      emitContentEvent("content_generation.failed", {
        workflowId: run.workflowId,
        platform: run.platform,
        code: PROVIDER_RESULT_UNCONFIRMED,
        recovered: true,
      });
    } else {
      // 调用前退出：安全重置排队，工作流状态按全部运行重新聚合。
      await prisma.contentGenerationRun.updateMany({
        where: { id: run.id, status: "generating" },
        data: { status: "queued", lockedBy: null, lockedUntil: null },
      });
      await aggregateAndUpdateWorkflow(run.workflowId).catch(() => undefined);
    }
    recovered += 1;
  }
  return recovered;
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
  attemptCount?: number;
  failureCode?: string;
  failureMessage?: string;
  platformContentUpdate?: { platformContentId: string; content: string };
  lease?: { workerId: string; attemptCount: number };
}): Promise<void> {
  if (params.lease) {
    await prisma.$transaction(async tx => {
      // The status transition and content write share one transaction and the run row lock.
      const changed = await tx.contentGenerationRun.updateMany({
        where: { id: params.runId, status: 'generating', lockedBy: params.lease!.workerId, attemptCount: params.lease!.attemptCount, lockedUntil: { gt: new Date() } },
        data: { status: params.status, failureCode: params.failureCode ?? null, failureMessage: params.failureMessage ?? null,
          lockedBy: null, lockedUntil: null, ...(params.status === 'failed_retryable' ? { nextAttemptAt: new Date(Date.now() + retryDelayMs(params.attemptCount ?? 1)) } : { completedAt: new Date() }) },
      });
      if (changed.count !== 1) throw new WorkflowDataError('LEASE_LOST_BEFORE_CALL', '任务租约已丢失，放弃写入');
      if (params.platformContentUpdate) await tx.platformContent.update({ where: { id: params.platformContentUpdate.platformContentId }, data: { content: params.platformContentUpdate.content, status: 'draft' } });
    });
    await aggregateAndUpdateWorkflow(params.workflowId);
    return;
  }
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
          ? {
              nextAttemptAt: new Date(Date.now() + retryDelayMs(params.attemptCount ?? 1)),
              lockedBy: null,
              lockedUntil: null,
            }
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

async function buildAndGenerate(claimed: ClaimedRun, workerId: string, execution: { requestSent: boolean; responseReceived: boolean }): Promise<string> {
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

  // 唯一生成输入：工作流 briefSnapshot（§8.6，评审指出此前读 ContentPiece.brief）。
  const evidence = evidenceSnapshot(claimed);
  let brief: Brief;
  if (evidence) {
    // Recheck after quota confirmation and immediately before building the model request.
    const live = await revalidateEvidence(claimed, evidence);
    const input = evidenceToGenerationInput(live);
    if (!input || live.execution.channel !== claimed.run.platform) throw new WorkflowDataError('EVIDENCE_CHANNEL_MISMATCH', '获批渠道与任务不一致');
    brief = input;
  } else {
    const snapshot = parseBrief(claimed.workflow.briefSnapshot);
    if (!snapshot) throw new WorkflowDataError("BRIEF_SNAPSHOT_CORRUPTED", "工作流快照损坏，无法生成");
    brief = effectiveBriefToGenerationBrief(snapshot, { brandVoiceId: piece.brandVoiceId });
  }
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
        where: { id: claimed.run.id, lockedBy: workerId, status: "generating", lockedUntil: { gt: new Date() }, attemptCount: claimed.run.attemptCount },
        data: { lockedUntil: new Date(Date.now() + LEASE_DURATION_MS) },
      });
      if (renewed.count === 0) abort.abort();
    } catch {
      // A failed renewal cannot authorize further model work.
      abort.abort();
    }
  }, LEASE_RENEW_INTERVAL_MS);

  emitContentEvent("content_generation.started", {
    workflowId: claimed.workflow.id,
    platform: claimed.run.platform,
    attempt: claimed.run.attemptCount,
  });

  try {
    // 模型请求标记（R1）：调用前落 providerRequestId，接管时据此区分
    // “从未请求”与“结果不确定”。条件更新失败（租约已丢）则不发起请求。
    const mark = await prisma.contentGenerationRun.updateMany({
      where: { id: claimed.run.id, lockedBy: workerId, status: "generating", lockedUntil: { gt: new Date() }, attemptCount: claimed.run.attemptCount },
      data: { providerRequestId: `llm-${randomUUID()}` },
    });
    if (mark.count !== 1) {
      throw new WorkflowDataError("LEASE_LOST_BEFORE_CALL", "租约已丢失，放弃本次模型请求");
    }

    execution.requestSent = true;
    let content: string;
    try {
      content = await callLLM(prompt, undefined, {
        timeoutMs: GENERATION_TIMEOUT_MS,
        signal: abort.signal,
      });
      execution.responseReceived = true;
      if (abort.signal.aborted) throw new Error('generation_cancelled_after_request');
    } catch (error) {
      if (abort.signal.aborted) throw new WorkflowDataError(PROVIDER_RESULT_UNCONFIRMED, '模型请求期间续租失败或租约丢失，结果待人工确认');
      throw error;
    }
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

function evidenceSnapshot(claimed: ClaimedRun): EvidenceBriefV2 | null {
  let raw: { schemaVersion?: unknown; approval?: { id?: string } };
  try { raw = JSON.parse(claimed.workflow.briefSnapshot); }
  catch { throw new WorkflowDataError('BRIEF_SNAPSHOT_CORRUPTED', '工作流快照损坏'); }
  if (raw.schemaVersion !== 2) return null;
  try { return checkedEvidenceBrief(raw, claimed.workflow.projectId, raw.approval?.id || ''); }
  catch { throw new WorkflowDataError('EVIDENCE_SNAPSHOT_INVALID', '草稿材料过期或不符合授权范围'); }
}

function revalidateEvidence(claimed: ClaimedRun, snapshot: EvidenceBriefV2) {
  return verifyWorkflowEvidence({ operationId: claimed.workflow.usageOperationId, workspaceId: claimed.workflow.workspaceId,
    projectId: claimed.workflow.projectId, approvalId: snapshot.approval.id, snapshot });
}

async function rejectEvidence(claimed: ClaimedRun, error: EvidenceAuthorityError | WorkflowDataError, workerId: string) {
  const retryable = error instanceof EvidenceAuthorityError && error.retryable && claimed.run.attemptCount < MAX_ATTEMPTS;
  await finalizeRun({ runId: claimed.run.id, workflowId: claimed.workflow.id, status: retryable ? 'failed_retryable' : 'failed_terminal',
    attemptCount: claimed.run.attemptCount, failureCode: error.code, failureMessage: '证据授权复验未通过，未发起本次模型请求', lease: { workerId, attemptCount: claimed.run.attemptCount } });
  if (!retryable) await releaseWorkflowUsage(claimed.workflow.id, 'evidence_verification_failed');
  return retryable ? 'failed_retryable' as const : 'failed_terminal' as const;
}

async function processRun(claimed: ClaimedRun, workerId: string): Promise<
  "succeeded" | "failed_retryable" | "failed_terminal" | "skipped"
> {
  let isEvidence = true;
  try { isEvidence = JSON.parse(claimed.workflow.briefSnapshot).schemaVersion === 2; } catch { /* Corrupt inputs fail closed below. */ }
  const finishRun = (params: Parameters<typeof finalizeRun>[0]) => finalizeRun({ ...params, ...(isEvidence ? { lease: { workerId, attemptCount: claimed.run.attemptCount } } : {}) });
  // An invalid or withdrawn source must not consume quota or enter the model.
  try { const evidence = evidenceSnapshot(claimed); if (evidence) await revalidateEvidence(claimed, evidence); }
  catch (error) {
    if (error instanceof EvidenceAuthorityError || error instanceof WorkflowDataError) return rejectEvidence(claimed, error, workerId);
    throw error;
  }
  // 1. 额度先行（设计 §10.8）。
  const usage = await ensureUsageCommitted(claimed);
  if (!usage.ok) {
    // Portal 不可用：任务可重试，绝不绕过计费调模型。
    await finishRun({
      runId: claimed.run.id,
      workflowId: claimed.workflow.id,
      status: "failed_retryable",
      attemptCount: claimed.run.attemptCount,
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
  const execution = { requestSent: false, responseReceived: false };
  try {
    const result = await buildAndGenerate(claimed, workerId, execution);
    const [platformContentId, ...rest] = result.split("||");
    const content = rest.join("||");
    await finishRun({
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
    if (err instanceof EvidenceAuthorityError) return rejectEvidence(claimed, err, workerId);
    if (err instanceof WorkflowDataError && err.code === "LEASE_LOST_BEFORE_CALL") {
      // 租约丢失：本实例不再持有任务，留给接管方，不计失败。
      await releaseLease(claimed.run.id, workerId).catch(() => undefined);
      return "skipped";
    }
    const providerStatus = (err as { statusCode?: number } | null)?.statusCode;
    if (err instanceof WorkflowDataError && err.code === PROVIDER_RESULT_UNCONFIRMED ||
        execution.responseReceived || isEvidence && execution.requestSent &&
        (!Number.isInteger(providerStatus) || providerStatus === 408)) {
      // Transport cancellation and persistence failures cannot prove that the provider did
      // no work. Keep the request marker and require an explicit human retry. A stale
      // owner must not overwrite a takeover, even while recording this failure.
      await finalizeRun({ runId: claimed.run.id, workflowId: claimed.workflow.id,
        status: 'failed_terminal', failureCode: PROVIDER_RESULT_UNCONFIRMED,
        failureMessage: '模型请求结果或保存结果尚待确认，请人工核对后重试',
        lease: { workerId, attemptCount: claimed.run.attemptCount } });
      return 'failed_terminal';
    }
    if (err instanceof WorkflowDataError) {
      await finishRun({
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
      await finishRun({
        runId: claimed.run.id,
        workflowId: claimed.workflow.id,
        status: "failed_retryable",
        attemptCount: claimed.run.attemptCount,
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
    await finishRun({
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
    recovered: 0,
  };

  // 停用开关（R7）：cron 与 inline kick 的共同入口，暂停领取。
  if (isContentWorkflowDisabled()) {
    return disabledBatchResult(result);
  }

  try {
    result.recovered = await recoverExpiredGenerations(workerId, new Date());
  } catch (err) {
    console.error("[generation-worker] recovery failed", err);
  }

  for (let i = 0; i < BATCH_SIZE; i++) {
    if (inFlight >= MAX_INFLIGHT_LLM) break;

    // 槽位在任何 await 之前同步预留（R13）：JS 单线程下检查+自增无并发窗口。
    inFlight += 1;
    let claimed: ClaimedRun | null = null;
    try {
      claimed = await claimNextRun(workerId, new Date());
    } catch (err) {
      console.error("[generation-worker] claim failed", err);
      inFlight -= 1;
      break;
    }
    if (!claimed) {
      inFlight -= 1;
      break;
    }
    result.claimed += 1;

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
