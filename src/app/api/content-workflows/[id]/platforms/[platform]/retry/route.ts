import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServiceSession } from "@/lib/auth/service-auth";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { getServiceWorkspace } from "@/lib/auth/service-context";
import { apiError, responses } from "@/lib/errors";
import { getIdempotencyKey } from "@/lib/contracts/hash";
import { aggregateWorkflowStatus } from "@/lib/content-workflow/status";
import { runGenerationBatch } from "@/lib/content-workflow/worker";
import { emitContentEvent } from "@/lib/observability/events";

/**
 * POST /api/content-workflows/[id]/platforms/[platform]/retry（设计 §10.7）
 *
 * - 只允许重试 failed_retryable（failed_terminal 需管理员确认，暂不开放）；
 * - 已成功的平台不得覆盖（409）；
 * - 状态迁移是条件更新：重复点击在 queued 后是幂等 no-op；
 *   attemptCount 由 worker 领取时递增，重试点击本身不增加；
 * - 不新增 UsageEvent；返回 202 和最新工作流状态。
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; platform: string }> },
) {
  const session = await getServiceSession();
  if (!session?.user?.id) {
    return responses.unauthorized();
  }
  const ws = (await getServiceWorkspace()) ?? getCurrentWorkspace(session);
  if (!ws || !ws.projectId) {
    return responses.forbidden(
      apiError("authentication_error", "no_workspace", "缺少工作区或项目上下文"),
    );
  }

  if (!getIdempotencyKey(req)) {
    return responses.badRequest(
      apiError("invalid_request_error", "IDEMPOTENCY_KEY_REQUIRED", "缺少 Idempotency-Key 请求头"),
    );
  }

  const { id, platform } = await params;

  const workflow = await prisma.contentWorkflow.findFirst({
    where: { id, workspaceId: ws.workspaceId, projectId: ws.projectId },
    include: { runs: true },
  });
  if (!workflow) {
    return responses.notFound(
      apiError("not_found_error", "WORKFLOW_NOT_FOUND", `工作流不存在: ${id}`, { param: "id" }),
    );
  }

  const run = workflow.runs.find((r) => r.platform === platform);
  if (!run) {
    return responses.notFound(
      apiError("not_found_error", "RUN_NOT_FOUND", `平台运行不存在: ${platform}`, {
        param: "platform",
      }),
    );
  }
  if (run.status === "succeeded") {
    return responses.conflict(
      apiError("invalid_request_error", "RUN_ALREADY_SUCCEEDED", "该平台已生成成功，不能覆盖"),
    );
  }
  if (run.status !== "failed_retryable") {
    return responses.conflict(
      apiError(
        "invalid_request_error",
        "RUN_NOT_RETRYABLE",
        `当前状态（${run.status}）不可重试`,
      ),
    );
  }

  const requeue = await prisma.contentGenerationRun.updateMany({
    where: { id: run.id, status: "failed_retryable" },
    data: {
      status: "queued",
      nextAttemptAt: null,
      failureCode: null,
      failureMessage: null,
    },
  });

  if (requeue.count === 1) {
    // 工作流回到 generating（由 queued 运行聚合而来）。
    const runs = await prisma.contentGenerationRun.findMany({
      where: { workflowId: workflow.id },
      select: { platform: true, status: true },
    });
    await prisma.contentWorkflow.updateMany({
      where: { id: workflow.id },
      data: {
        status: aggregateWorkflowStatus(runs),
        completedAt: null,
      },
    });
    emitContentEvent("content_generation.retried", {
      workflowId: workflow.id,
      platform,
      code: "manual",
    });
  }

  // 机会性 kick。
  void runGenerationBatch(`retry-${randomUUID().slice(0, 8)}`).catch(() => undefined);

  const fresh = await prisma.contentWorkflow.findFirst({
    where: { id: workflow.id },
    include: { runs: { orderBy: { createdAt: "asc" } } },
  });
  const { toWorkflowView } = await import("@/lib/content-workflow/service");
  return NextResponse.json(
    { data: toWorkflowView(fresh ?? workflow), meta: { replayed: requeue.count === 0 } },
    { status: 202 },
  );
}
