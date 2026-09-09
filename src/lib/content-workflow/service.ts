/**
 * 内容工作流创建（设计 §10.5/§17.2）：
 *
 * 单个数据库事务：ContentPiece（派生 Brief）+ 空 PlatformContent +
 * ContentWorkflow（V1 快照）+ 每平台一条 ContentGenerationRun。
 * 生成从同步请求改为数据库任务，由 worker 租约执行。
 */

import { prisma } from "@/lib/db";
import { parseBrief, parseProjectSnapshot } from "@/lib/content-brief/serde";
import { effectiveBriefToGenerationBrief } from "@/lib/content-brief/to-generation-brief";
import { parseSupportedPlatforms } from "@/lib/platforms/validate";
import { isUniqueConstraintError } from "@/lib/contracts/hash";
import type { CreateContentWorkflowRequestV1 } from "@/contracts/content-workflow-v1";
import { emitContentEvent } from "@/lib/observability/events";

export class WorkflowValidationError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly extras?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "WorkflowValidationError";
  }
}

export interface CreateWorkflowParams {
  ctx: { workspaceId: string; projectId: string; userId: string };
  input: CreateContentWorkflowRequestV1;
  idempotencyKey: string;
  requestHash: string;
}

export interface WorkflowView {
  id: string;
  briefId: string;
  briefRevision: number;
  contentPieceId: string | null;
  status: string;
  platforms: Array<{
    platform: string;
    status: string;
    attemptCount?: number;
    error?: { code: string; message: string };
  }>;
}

export function toWorkflowView(workflow: {
  id: string;
  briefId: string;
  briefRevision: number;
  contentPieceId: string | null;
  status: string;
  usageOperationId: string;
  runs: Array<{
    platform: string;
    status: string;
    attemptCount: number;
    failureCode: string | null;
    failureMessage: string | null;
  }>;
}): WorkflowView {
  return {
    id: workflow.id,
    briefId: workflow.briefId,
    briefRevision: workflow.briefRevision,
    contentPieceId: workflow.contentPieceId,
    status: workflow.status,
    platforms: workflow.runs.map((run) => ({
      platform: run.platform,
      status: run.status,
      attemptCount: run.attemptCount,
      ...(run.failureCode
        ? {
            error: {
              code: run.failureCode,
              message: run.failureMessage ?? run.failureCode,
            },
          }
        : {}),
    })),
  };
}

export async function createWorkflow(
  params: CreateWorkflowParams,
): Promise<{ replayed: boolean; view: WorkflowView }> {
  const { ctx, input, idempotencyKey, requestHash } = params;

  // 平台严格校验（设计 §17.2）：契约层已挡，双保险。
  const platformParse = parseSupportedPlatforms(input.platforms);
  if (!platformParse.ok) {
    throw new WorkflowValidationError(
      422,
      platformParse.code,
      platformParse.code === "PLATFORM_MISSING"
        ? "缺少生成平台"
        : `不支持的平台: ${platformParse.invalid.join(", ")}`,
    );
  }
  const platforms = platformParse.platforms;

  const brief = await prisma.contentBrief.findFirst({
    where: { id: input.briefId, workspaceId: ctx.workspaceId, projectId: ctx.projectId },
  });
  if (!brief) {
    throw new WorkflowValidationError(404, "BRIEF_NOT_FOUND", `创作方案不存在: ${input.briefId}`);
  }
  if (brief.status === "archived") {
    throw new WorkflowValidationError(409, "BRIEF_ARCHIVED", "创作方案已归档，不能创建工作流");
  }
  if (brief.revision !== input.briefRevision) {
    throw new WorkflowValidationError(
      409,
      "BRIEF_VERSION_CONFLICT",
      "创作方案已更新，请刷新后重试",
      { currentRevision: brief.revision },
    );
  }

  if (input.brandVoiceId) {
    const voice = await prisma.brandVoice.findFirst({
      where: { id: input.brandVoiceId, workspaceId: ctx.workspaceId },
    });
    if (!voice) {
      throw new WorkflowValidationError(422, "BRAND_VOICE_NOT_FOUND", "品牌声音不存在或不属于当前工作区");
    }
  }
  if (input.templateId) {
    const template = await prisma.aITemplate.findFirst({
      where: { id: input.templateId, workspaceId: ctx.workspaceId },
    });
    if (!template) {
      throw new WorkflowValidationError(422, "TEMPLATE_NOT_FOUND", "内容模板不存在或不属于当前工作区");
    }
  }

  // 幂等回放。
  const existing = await prisma.contentWorkflow.findFirst({
    where: { workspaceId: ctx.workspaceId, projectId: ctx.projectId, idempotencyKey },
    include: { runs: true },
  });
  if (existing) {
    if (existing.idempotencyRequestHash !== requestHash) {
      throw new WorkflowValidationError(409, "IDEMPOTENCY_KEY_REUSED", "相同幂等键已用于不同请求体");
    }
    return { replayed: true, view: toWorkflowView(existing) };
  }

  const effective = parseBrief(brief.effectiveBrief);
  const projectSnapshot = parseProjectSnapshot(brief.projectSnapshot);
  if (!effective) {
    throw new WorkflowValidationError(500, "BRIEF_CORRUPTED", "创作方案数据损坏，无法创建工作流");
  }

  const generationBrief = effectiveBriefToGenerationBrief(effective, {
    projectSnapshot,
    brandVoiceId: input.brandVoiceId ?? null,
  });
  const title = (effective.editorial.topic || "未命名内容").slice(0, 80);

  try {
    const workflow = await prisma.$transaction(async (tx) => {
      const piece = await tx.contentPiece.create({
        data: {
          workspaceId: ctx.workspaceId,
          projectId: ctx.projectId,
          createdByUserId: ctx.userId,
          title,
          type: "blog_post",
          brief: JSON.stringify(generationBrief),
          ...(input.brandVoiceId ? { brandVoiceId: input.brandVoiceId } : {}),
          status: "draft",
          platformContents: {
            create: platforms.map((platform) => ({ platform, status: "draft" })),
          },
        },
        include: { platformContents: true },
      });

      const created = await tx.contentWorkflow.create({
        data: {
          workspaceId: ctx.workspaceId,
          projectId: ctx.projectId,
          briefId: input.briefId,
          briefRevision: brief.revision,
          briefSnapshot: JSON.stringify(effective),
          contentPieceId: piece.id,
          usageOperationId: input.usageOperationId,
          usageStatus: "reserved",
          idempotencyKey,
          idempotencyRequestHash: requestHash,
          status: "queued",
          runs: {
            create: platforms.map((platform) => ({
              platform,
              status: "queued",
            })),
          },
        },
        include: { runs: true },
      });

      // Brief 进入 confirmed（记录确认时间与 revision）。
      await tx.contentBrief.updateMany({
        where: { id: brief.id, revision: brief.revision },
        data: { status: "confirmed", confirmedAt: new Date() },
      });

      return created;
    });

    emitContentEvent("content_workflow.created", {
      workflowId: workflow.id,
      briefId: input.briefId,
      briefRevision: brief.revision,
      operationId: input.usageOperationId,
      platforms: platforms.join(","),
    });

    return { replayed: false, view: toWorkflowView(workflow) };
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      const raced = await prisma.contentWorkflow.findFirst({
        where: { workspaceId: ctx.workspaceId, projectId: ctx.projectId, idempotencyKey },
        include: { runs: true },
      });
      if (raced && raced.idempotencyRequestHash === requestHash) {
        return { replayed: true, view: toWorkflowView(raced) };
      }
      throw new WorkflowValidationError(409, "IDEMPOTENCY_KEY_REUSED", "相同幂等键已用于不同请求体");
    }
    throw err;
  }
}
