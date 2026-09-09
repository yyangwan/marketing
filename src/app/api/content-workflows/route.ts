import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServiceSession } from "@/lib/auth/service-auth";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { getServiceWorkspace } from "@/lib/auth/service-context";
import { apiError, responses } from "@/lib/errors";
import { getIdempotencyKey, requestHash } from "@/lib/contracts/hash";
import { validateCreateWorkflowRequestV1 } from "@/lib/contracts/validate";
import {
  createWorkflow,
  toWorkflowView,
  WorkflowValidationError,
} from "@/lib/content-workflow/service";
import { runGenerationBatch } from "@/lib/content-workflow/worker";

/**
 * POST /api/content-workflows（设计 §10.5）
 * Portal 预占额度后调用：事务创建 ContentPiece + 平台运行。
 * 返回 202；生成由 worker 异步执行。
 */
export async function POST(req: Request) {
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

  const idempotencyKey = getIdempotencyKey(req);
  if (!idempotencyKey) {
    return responses.badRequest(
      apiError("invalid_request_error", "IDEMPOTENCY_KEY_REQUIRED", "缺少 Idempotency-Key 请求头"),
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return responses.badRequest(apiError("invalid_request_error", "invalid_parameter", "请求体不是合法 JSON"));
  }

  const validation = validateCreateWorkflowRequestV1(body);
  if (!validation.ok) {
    return responses.unprocessable(
      apiError("invalid_request_error", "WORKFLOW_PAYLOAD_INVALID", "工作流请求不符合契约", {
        param: validation.errors.slice(0, 5).join("; "),
      }),
    );
  }

  try {
    const result = await createWorkflow({
      ctx: {
        workspaceId: ws.workspaceId,
        projectId: ws.projectId,
        userId: session.user.id,
      },
      input: body as Parameters<typeof createWorkflow>[0]["input"],
      idempotencyKey,
      requestHash: requestHash(body),
    });

    // 机会性 kick：立即执行一批生成，不阻塞响应。
    void runGenerationBatch(`inline-${randomUUID().slice(0, 8)}`).catch(() => undefined);

    return NextResponse.json(
      { data: result.view, meta: { replayed: result.replayed } },
      { status: result.replayed ? 200 : 202 },
    );
  } catch (err) {
    if (err instanceof WorkflowValidationError) {
      return NextResponse.json(
        {
          ...apiError(
            err.status >= 500 ? "api_error" : "invalid_request_error",
            err.code,
            err.message,
          ),
          ...(err.extras ?? {}),
        },
        { status: err.status },
      );
    }
    console.error("[content-workflows] create failed", err);
    return responses.serverError(
      apiError("api_error", "internal_error", "创建工作流失败，请稍后重试"),
    );
  }
}

/** GET /api/content-workflows — 当前项目最近的工作流。 */
export async function GET() {
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
  const workflows = await prisma.contentWorkflow.findMany({
    where: { workspaceId: ws.workspaceId, projectId: ws.projectId },
    include: { runs: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return NextResponse.json({ data: workflows.map(toWorkflowView) });
}
