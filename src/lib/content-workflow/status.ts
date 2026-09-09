/**
 * 工作流聚合状态（设计 §9.2 纯函数）：
 *
 * - 全部 succeeded → succeeded
 * - ≥1 成功且 ≥1 最终失败 → partial
 * - 全部最终失败 → failed
 * - 存在 queued/generating → generating
 * - 全部 cancelled → cancelled
 */

export interface RunStatusInput {
  platform: string;
  status: string;
}

export function aggregateWorkflowStatus(runs: RunStatusInput[]): string {
  if (runs.length === 0) return "queued";

  const anyQueuedOrGenerating = runs.some(
    (r) => r.status === "queued" || r.status === "generating",
  );
  if (anyQueuedOrGenerating) return "generating";

  const allSucceeded = runs.every((r) => r.status === "succeeded");
  if (allSucceeded) return "succeeded";

  const anySucceeded = runs.some((r) => r.status === "succeeded");
  const anyFailed = runs.some(
    (r) => r.status === "failed_retryable" || r.status === "failed_terminal",
  );
  if (anySucceeded && anyFailed) return "partial";

  const allFailed = runs.every(
    (r) => r.status === "failed_retryable" || r.status === "failed_terminal",
  );
  if (allFailed) return "failed";

  const allCancelled = runs.every((r) => r.status === "cancelled");
  if (allCancelled) return "cancelled";

  return "partial";
}

/** 平台错误分类（设计 §13.1）：临时错误可自动重试，其余终止。 */
export function classifyLlmError(err: unknown): {
  kind: "retryable" | "terminal";
  code: string;
  message: string;
} {
  const llmError = err as { name?: string; statusCode?: number; message?: string };
  if (llmError?.name === "LLMError") {
    const status = llmError.statusCode ?? 0;
    const message = llmError.message?.slice(0, 500) ?? "LLM error";
    if (status === 408 || status === 429 || status >= 500) {
      return { kind: "retryable", code: status === 408 ? "LLM_TIMEOUT" : status === 429 ? "LLM_RATE_LIMITED" : `LLM_${status}`, message };
    }
    return { kind: "terminal", code: `LLM_${status}`, message };
  }
  return {
    kind: "retryable",
    code: "LLM_UNKNOWN",
    message: err instanceof Error ? err.message.slice(0, 500) : String(err),
  };
}

/** 重试退避（设计 §9.3）：5s/30s/120s + 抖动。 */
export const RETRY_BACKOFF_MS = [5_000, 30_000, 120_000] as const;
export const MAX_ATTEMPTS = 3;

export function retryDelayMs(attemptCount: number): number {
  const base = RETRY_BACKOFF_MS[Math.min(attemptCount, RETRY_BACKOFF_MS.length) - 1];
  const spread = Math.round(base * 0.2);
  return base + Math.floor((Math.random() * 2 - 1) * spread);
}
