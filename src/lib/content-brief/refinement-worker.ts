/**
 * Brief 异步提炼 worker（设计 §7.2/§12.4，评审 R1/R2）。
 *
 * 提炼基线在入队时冻结（refinementBaseRevision + refinementBaseBrief）：
 * 用户在领取前/重试间隔编辑不会成为提炼基线，也不会被提炼结果覆盖
 * （发布条件是基线 revision，不一致时仅保留候选）。
 * 条件更新领取租约 → LLM（45s 硬超时）→ 十条质量门 →
 * 通过则按基线 revision 条件发布；LLM 临时错误退避重试 ≤2 次；
 * 质量门失败直接回退规则版。事实来源是数据库状态，浏览器断开不影响执行。
 * 租约过期的 running（进程重启/切换）重置 queued 重新提炼——提炼不产生
 * 用户计费，重复调用模型是安全的，用户编辑保护由基线冻结保证。
 */

import { prisma } from "@/lib/db";
import { callLLMJson, LLMError } from "@/lib/ai/client";
import { parseBrief, parseProjectSnapshot, parseSourceSnapshot } from "./serde";
import { validateRefinementCandidate } from "./quality-gates";
import {
  REFINEMENT_MODEL,
  REFINEMENT_PROMPT_VERSION,
  REFINEMENT_TEMPERATURE,
  REFINEMENT_TIMEOUT_MS,
  REFINEMENT_MAX_TOKENS,
  buildRefinementPrompt,
  mergeRefined,
} from "./refinement";
import { getGenerationCapabilities } from "@/lib/platforms/capabilities";
import { withJitter, leaseExpiresAt } from "@/lib/workers/lease";
import { emitContentEvent } from "@/lib/observability/events";
import { disabledBatchResult, isContentWorkflowDisabled } from "@/lib/content-workflow/switch";

/** LLM 临时错误的最大尝试次数（首次 + 2 次重试）。 */
const MAX_ATTEMPTS = 3;
/** 重试退避基准：30 秒 + 抖动。 */
const RETRY_BACKOFF_MS = 30_000;

export interface RefinementBatchResult {
  claimed: number;
  succeeded: number;
  fallback: number;
  retainedOnly: number;
}

function isRetryableLlmError(err: unknown): boolean {
  if (err instanceof LLMError) {
    // 408 超时 / 429 限流 / 5xx 重试；JSON 不合格（422）属于输出问题，不重试。
    return err.statusCode === 408 || err.statusCode === 429 || err.statusCode >= 500;
  }
  return false;
}

/** 恢复租约过期的 running（R1）：重置 queued，等待正常领取。 */
async function recoverExpiredRefinements(now: Date): Promise<number> {
  const reset = await prisma.contentBrief.updateMany({
    where: {
      refinementStatus: "running",
      refinementLockedUntil: { lt: now },
    },
    data: {
      refinementStatus: "queued",
      refinementLockedBy: null,
      refinementLockedUntil: null,
      refinementNextAttemptAt: now,
    },
  });
  return reset.count;
}

async function claimNextBrief(workerId: string, now: Date) {
  const candidate = await prisma.contentBrief.findFirst({
    where: {
      refinementStatus: "queued",
      refinementNextAttemptAt: { lte: now },
      OR: [{ refinementLockedUntil: null }, { refinementLockedUntil: { lt: now } }],
      status: { not: "archived" },
    },
    orderBy: { createdAt: "asc" },
  });
  if (!candidate) return null;

  const claim = await prisma.contentBrief.updateMany({
    where: {
      id: candidate.id,
      refinementStatus: "queued",
      OR: [{ refinementLockedUntil: null }, { refinementLockedUntil: { lt: now } }],
    },
    data: {
      refinementStatus: "running",
      refinementLockedBy: workerId,
      refinementLockedUntil: leaseExpiresAt(now),
    },
  });
  if (claim.count !== 1) return null;
  return candidate;
}

async function releaseBrief(id: string) {
  await prisma.contentBrief.updateMany({
    where: { id },
    data: { refinementLockedBy: null, refinementLockedUntil: null },
  });
}

async function scheduleRetry(row: { id: string; refinementAttempts: number }, err: unknown) {
  const attempts = row.refinementAttempts + 1;
  const retryable = isRetryableLlmError(err);
  if (retryable && attempts < MAX_ATTEMPTS) {
    await prisma.contentBrief.updateMany({
      where: { id: row.id },
      data: {
        refinementStatus: "queued",
        refinementAttempts: attempts,
        refinementNextAttemptAt: new Date(Date.now() + withJitter(RETRY_BACKOFF_MS)),
        refinementLockedBy: null,
        refinementLockedUntil: null,
        refinementLastError: err instanceof Error ? err.message.slice(0, 500) : String(err),
        // 重试仍针对同一冻结基线：不更新 refinementBase* 字段。
      },
    });
    return "retry" as const;
  }
  await prisma.contentBrief.updateMany({
    where: { id: row.id },
    data: {
      refinementStatus: "fallback",
      refinementAttempts: attempts,
      refinementLockedBy: null,
      refinementLockedUntil: null,
      refinementLastError: err instanceof Error ? err.message.slice(0, 500) : String(err),
    },
  });
  emitContentEvent("content_brief.refinement_fallback", {
    briefId: row.id,
    reason: err instanceof Error ? err.message.slice(0, 120) : "unknown",
    attempts,
  });
  return "fallback" as const;
}

async function processBrief(row: {
  id: string;
  revision: number;
  status: string;
  sourceSnapshot: string;
  projectSnapshot: string;
  effectiveBrief: string;
  baselineBrief: string;
  refinementBaseRevision: number | null;
  refinementBaseBrief: string | null;
  refinementAttempts: number;
}): Promise<"succeeded" | "retained-only" | "retry" | "fallback"> {
  // 提炼基线（R2）：优先入队时冻结的快照，旧行回退 effectiveBrief。
  const baseRevision = row.refinementBaseRevision ?? row.revision;
  const baseRaw = row.refinementBaseBrief ?? row.effectiveBrief;
  const baseline = parseBrief(baseRaw);
  const snapshot = parseSourceSnapshot(row.sourceSnapshot);
  const projectSnapshot = parseProjectSnapshot(row.projectSnapshot);
  if (!baseline || !snapshot || !projectSnapshot) {
    // 数据损坏：直接回退，保留规则版可用。
    await prisma.contentBrief.updateMany({
      where: { id: row.id },
      data: {
        refinementStatus: "fallback",
        refinementLockedBy: null,
        refinementLockedUntil: null,
        refinementLastError: "corrupted snapshot data",
      },
    });
    return "fallback";
  }

  emitContentEvent("content_brief.refinement_started", {
    briefId: row.id,
    attempt: row.refinementAttempts + 1,
  });

  let raw: unknown;
  try {
    const prompt = buildRefinementPrompt({
      baseline,
      snapshot,
      projectSnapshot,
      capabilities: await getGenerationCapabilities(),
    });
    raw = await callLLMJson<unknown>(prompt.user, prompt.system, {
      temperature: REFINEMENT_TEMPERATURE,
      maxTokens: REFINEMENT_MAX_TOKENS,
      timeoutMs: REFINEMENT_TIMEOUT_MS,
    });
  } catch (err) {
    return scheduleRetry(row, err);
  }

  const gate = validateRefinementCandidate(raw, { baseline, snapshot, projectSnapshot });
  if (!gate.ok || !gate.candidate) {
    await prisma.contentBrief.updateMany({
      where: { id: row.id },
      data: {
        refinementStatus: "fallback",
        refinementLockedBy: null,
        refinementLockedUntil: null,
        refinementLastError: gate.violations.join(","),
      },
    });
    emitContentEvent("content_brief.refinement_fallback", {
      briefId: row.id,
      reason: gate.violations.join(","),
    });
    return "fallback";
  }

  const merged = mergeRefined(baseline, gate.candidate, {
    model: REFINEMENT_MODEL,
    promptVersion: REFINEMENT_PROMPT_VERSION,
  });
  merged.revision = baseRevision;

  // 条件发布（R2）：仅当 revision 仍等于冻结基线时生效——用户在领取前或
  // 重试间隔编辑过（revision 已前进）则只保留候选，绝不覆盖用户内容。
  const publish = await prisma.contentBrief.updateMany({
    where: { id: row.id, revision: baseRevision, status: { not: "archived" } },
    data: {
      effectiveBrief: JSON.stringify(merged),
      refinedCandidate: JSON.stringify(gate.candidate),
      generationMeta: JSON.stringify(merged.generationMeta),
      refinementStatus: "succeeded",
      refinementLockedBy: null,
      refinementLockedUntil: null,
      status: row.status === "baseline_ready" || row.status === "refining" ? "ready" : row.status,
    },
  });

  if (publish.count === 0) {
    // 用户已编辑：仅保留候选供审计，不覆盖用户内容。
    await prisma.contentBrief.updateMany({
      where: { id: row.id },
      data: {
        refinedCandidate: JSON.stringify(gate.candidate),
        refinementStatus: "succeeded",
        refinementLockedBy: null,
        refinementLockedUntil: null,
      },
    });
    emitContentEvent("content_brief.refinement_succeeded", {
      briefId: row.id,
      published: false,
    });
    return "retained-only";
  }

  emitContentEvent("content_brief.refinement_succeeded", {
    briefId: row.id,
    published: true,
  });
  return "succeeded";
}

/** 领取并处理一批待提炼的 Brief；由 cron 路由或创建后的机会性 kick 调用。 */
export async function runRefinementBatch(workerId: string): Promise<RefinementBatchResult> {
  const result: RefinementBatchResult = { claimed: 0, succeeded: 0, fallback: 0, retainedOnly: 0 };

  // 停用开关（R7）：暂停领取，cron 与 inline kick 共同入口。
  if (isContentWorkflowDisabled()) {
    return disabledBatchResult(result);
  }

  try {
    await recoverExpiredRefinements(new Date());
  } catch (err) {
    console.error("[refinement-worker] recovery failed", err);
  }

  for (let i = 0; i < 5; i++) {
    const now = new Date();
    let row;
    try {
      row = await claimNextBrief(workerId, now);
    } catch (err) {
      console.error("[refinement-worker] claim failed", err);
      break;
    }
    if (!row) break;
    result.claimed += 1;

    try {
      const outcome = await processBrief(row);
      if (outcome === "succeeded") result.succeeded += 1;
      else if (outcome === "retained-only") result.retainedOnly += 1;
      else if (outcome === "fallback") result.fallback += 1;
      // "retry" 计入 fallback 类别之外，本批不再处理该行。
    } catch (err) {
      console.error("[refinement-worker] process failed", { briefId: row.id, err });
      await releaseBrief(row.id).catch(() => undefined);
    }
  }

  return result;
}
