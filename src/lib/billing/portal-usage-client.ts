/**
 * ContentOS → Portal 额度回调（设计 §10.8）：
 *
 * worker 在第一次向内容模型发起请求前必须获得 commit 成功或幂等成功响应；
 * Portal 不可用时任务保持 queued/failed_retryable，不得绕过计费继续生成。
 * 取消或永久失败使用 release；提交后的额度不能释放。
 */

import { getPortalBaseUrl, getUsageCallbackSecret } from "@/lib/config/portal";

const REQUEST_TIMEOUT_MS = 10_000;
/** 连接错误重试 1 次。 */
const RETRIES = 1;

export type UsageCallbackResult =
  | { ok: true; status: string; replayed?: boolean }
  | { ok: false; code: string; message: string };

async function callOnce(
  operationId: string,
  action: "commit" | "release",
  reason?: string,
): Promise<Response> {
  const secret = getUsageCallbackSecret();
  if (!secret) {
    throw Object.assign(new Error("CONTENT_USAGE_CALLBACK_SECRET not configured"), {
      code: "SECRET_NOT_CONFIGURED",
    });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(
      `${getPortalBaseUrl()}/api/internal/content-usage/operations/${encodeURIComponent(
        operationId,
      )}/${action}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
          "Idempotency-Key": `${operationId}:${action}`,
        },
        body: reason ? JSON.stringify({ reason: reason.slice(0, 200) }) : undefined,
        signal: controller.signal,
      },
    );
  } finally {
    clearTimeout(timer);
  }
}

async function callUsageOperation(
  operationId: string,
  action: "commit" | "release",
  reason?: string,
): Promise<UsageCallbackResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const res = await callOnce(operationId, action, reason);
      const body = (await res.json().catch(() => ({}))) as {
        data?: { status?: string };
        error?: { code?: string; message?: string };
      };
      if (res.ok) {
        return { ok: true, status: body.data?.status ?? action };
      }
      return {
        ok: false,
        code: body.error?.code ?? `PORTAL_${res.status}`,
        message: body.error?.message ?? `Portal 回调失败（${res.status}）`,
      };
    } catch (err) {
      lastError = err;
    }
  }
  return {
    ok: false,
    code: "PORTAL_UNAVAILABLE",
    message: lastError instanceof Error ? lastError.message : "Portal 不可用",
  };
}

export function commitUsageOperation(operationId: string): Promise<UsageCallbackResult> {
  return callUsageOperation(operationId, "commit");
}

export function releaseUsageOperation(
  operationId: string,
  reason?: string,
): Promise<UsageCallbackResult> {
  return callUsageOperation(operationId, "release", reason);
}
