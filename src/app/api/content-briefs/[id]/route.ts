import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServiceSession } from "@/lib/auth/service-auth";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { getServiceWorkspace } from "@/lib/auth/service-context";
import { apiError, responses } from "@/lib/errors";
import { getIdempotencyKey, requestHash } from "@/lib/contracts/hash";
import { validateBriefV1 } from "@/lib/contracts/validate";
import { parseBrief } from "@/lib/content-brief/serde";
import { evaluateContentEligibility } from "@/lib/content-brief/baseline-generator";
import {
  BRIEF_LIMITS,
  type ContentCreationBriefV1,
} from "@/contracts/content-creation-brief-v1";

async function resolveContext() {
  const session = await getServiceSession();
  if (!session?.user?.id) {
    return { error: responses.unauthorized() } as const;
  }
  const ws = (await getServiceWorkspace()) ?? getCurrentWorkspace(session);
  if (!ws || !ws.projectId) {
    return {
      error: responses.forbidden(
        apiError("authentication_error", "no_workspace", "缺少工作区或项目上下文"),
      ),
    } as const;
  }
  return { ws } as const;
}

function briefNotFound(id: string) {
  return responses.notFound(
    apiError("not_found_error", "BRIEF_NOT_FOUND", `创作方案不存在: ${id}`, { param: "id" }),
  );
}

function view(row: {
  id: string;
  projectId: string;
  revision: number;
  status: string;
  effectiveBrief: string;
  sourceSuggestionId: string;
  sourceHash: string;
  sourceSnapshot: string;
  refinementStatus: string;
  refinementAttempts: number;
  refinementLastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const brief = parseBrief(row.effectiveBrief);
  const eligibility = parseAndEvaluate(row.sourceSnapshot);
  return {
    id: row.id,
    projectId: row.projectId,
    revision: row.revision,
    status: row.status,
    brief: brief
      ? {
          topic: brief.editorial.topic,
          titleCandidates: brief.editorial.titleCandidates,
          outline: brief.editorial.outline,
          keywords: brief.editorial.keywords,
          references: brief.editorial.references,
          notes: brief.editorial.notes ?? "",
          strategy: brief.strategy,
          constraints: brief.constraints,
        }
      : null,
    platformPlan: brief?.platformPlan ?? [],
    source: {
      suggestionId: row.sourceSuggestionId,
      sourceHash: row.sourceHash,
      ...(brief?.source.reportId ? { reportId: brief.source.reportId } : {}),
      ...(brief?.source.auditId ? { auditId: brief.source.auditId } : {}),
    },
    refinement: {
      status: row.refinementStatus,
      attempts: row.refinementAttempts,
      ...(row.refinementLastError ? { lastError: row.refinementLastError } : {}),
    },
    eligibility,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function parseAndEvaluate(sourceSnapshotRaw: string) {
  try {
    const snapshot = JSON.parse(sourceSnapshotRaw);
    if (snapshot && snapshot.schemaVersion === 1) {
      const result = evaluateContentEligibility(snapshot);
      return { requiresConfirmation: result.requiresConfirmation, ruleId: result.ruleId };
    }
  } catch {
    // fallthrough
  }
  return null;
}

/** GET /api/content-briefs/[id] — 不返回完整来源快照（设计 §10.3）。 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveContext();
  if ("error" in ctx) return ctx.error;
  const { id } = await params;

  const row = await prisma.contentBrief.findFirst({
    where: { id, workspaceId: ctx.ws.workspaceId, projectId: ctx.ws.projectId },
  });
  if (!row) return briefNotFound(id);

  return NextResponse.json({ data: view(row) });
}

interface PatchBody {
  expectedRevision?: number;
  editorial?: Partial<ContentCreationBriefV1["editorial"]>;
  strategy?: Partial<ContentCreationBriefV1["strategy"]>;
  constraints?: { editable?: Partial<ContentCreationBriefV1["constraints"]["editable"]> };
  selectedPlatforms?: string[];
}

const SUPPORTED_FOR_SELECTION = new Set(["wechat", "weibo", "xiaohongshu", "douyin"]);

/**
 * PATCH /api/content-briefs/[id] — 乐观锁编辑（设计 §10.4/§12.2，评审 R8/R2）。
 * 可编辑字段：strategy 用户可见部分、editorial、selectedPlatforms、constraints.editable。
 * 项目归属、来源、constraints.locked、generationMeta 不可编辑。
 * 幂等：同键同请求体重放首次结果；同键不同请求体 409。
 * 编辑内容字段时取消尚未领取的 queued 提炼（用户编辑优先，避免对陈旧基线白耗模型调用）。
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveContext();
  if ("error" in ctx) return ctx.error;
  const { id } = await params;

  const idempotencyKey = getIdempotencyKey(req);
  if (!idempotencyKey) {
    return responses.badRequest(
      apiError("invalid_request_error", "IDEMPOTENCY_KEY_REQUIRED", "缺少 Idempotency-Key 请求头"),
    );
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return responses.badRequest(apiError("invalid_request_error", "invalid_parameter", "请求体不是合法 JSON"));
  }

  const row = await prisma.contentBrief.findFirst({
    where: { id, workspaceId: ctx.ws.workspaceId, projectId: ctx.ws.projectId },
  });
  if (!row) return briefNotFound(id);

  if (row.status === "archived") {
    return responses.conflict(
      apiError("invalid_request_error", "BRIEF_ARCHIVED", "创作方案已归档，不能编辑"),
    );
  }

  // 幂等重放（R8）：保存成功但响应丢失时，客户端同键重试应拿回首次结果，
  // 而不是被乐观锁误报 409。同键不同请求体属于键滥用。
  const patchHash = requestHash(body);
  if (row.lastPatchKey === idempotencyKey) {
    if (row.lastPatchHash !== patchHash) {
      return responses.conflict(
        apiError("invalid_request_error", "IDEMPOTENCY_KEY_REUSED", "相同幂等键已用于不同请求体"),
      );
    }
    if (row.lastPatchResponse) {
      try {
        const replayed = JSON.parse(row.lastPatchResponse) as Record<string, unknown>;
        return NextResponse.json({ ...replayed, meta: { replayed: true } });
      } catch {
        // 存储损坏则回退当前视图。
      }
    }
    const fresh = await prisma.contentBrief.findFirst({ where: { id: row.id } });
    return NextResponse.json({ data: view(fresh ?? row), meta: { replayed: true } });
  }

  const expectedRevision = body.expectedRevision;
  if (typeof expectedRevision !== "number" || !Number.isInteger(expectedRevision) || expectedRevision < 1) {
    return responses.badRequest(
      apiError("invalid_request_error", "invalid_parameter", "expectedRevision 必须是正整数", {
        param: "expectedRevision",
      }),
    );
  }

  const current = parseBrief(row.effectiveBrief);
  if (!current) {
    return responses.serverError(apiError("api_error", "internal_error", "创作方案数据损坏"));
  }

  // 合并用户编辑（浅合并到可编辑字段）。
  const merged: ContentCreationBriefV1 = {
    ...current,
    strategy: { ...current.strategy, ...(body.strategy ?? {}) },
    editorial: { ...current.editorial, ...(body.editorial ?? {}) },
    constraints: {
      locked: current.constraints.locked,
      editable: { ...current.constraints.editable, ...(body.constraints?.editable ?? {}) },
    },
  };

  if (Array.isArray(body.selectedPlatforms)) {
    const invalid = body.selectedPlatforms.filter(
      (p) => typeof p !== "string" || !SUPPORTED_FOR_SELECTION.has(p),
    );
    if (invalid.length > 0) {
      return responses.unprocessable(
        apiError(
          "invalid_request_error",
          "PLATFORM_NOT_SUPPORTED",
          `不支持的平台: ${invalid.join(", ")}，当前支持 wechat/weibo/xiaohongshu/douyin`,
          { param: "selectedPlatforms" },
        ),
      );
    }
    const selected = new Set(body.selectedPlatforms);
    // 保留原计划中的平台，更新选中状态；新选中的平台补充进计划。
    const plan = current.platformPlan.map((item) => ({
      ...item,
      selected: selected.has(item.platform)
        ? item.capability === "supported"
        : false,
    }));
    const known = new Set(plan.map((p) => p.platform));
    for (const platform of body.selectedPlatforms) {
      if (!known.has(platform)) {
        plan.push({ platform, capability: "supported" as const, selected: true });
      }
    }
    merged.platformPlan = plan;
  }

  // §8.3：超限编辑直接 422（validateBriefV1），不再静默截断（评审覆盖审计）。

  const validation = validateBriefV1(merged);
  if (!validation.ok) {
    return responses.unprocessable(
      apiError("invalid_request_error", "BRIEF_PAYLOAD_INVALID", "编辑后的创作方案不符合契约", {
        param: validation.errors.slice(0, 5).join("; "),
      }),
    );
  }

  merged.revision = expectedRevision + 1;
  merged.generationMeta = { ...merged.generationMeta, effectiveSource: "user" };
  merged.updatedAt = new Date().toISOString();

  // 乐观锁：仅当 revision 仍是 expectedRevision 时写入（设计 §12.2）。
  // 同步记录 PATCH 幂等键/哈希（R8），便于响应丢失后的同键重放。
  const update = await prisma.contentBrief.updateMany({
    where: {
      id: row.id,
      workspaceId: ctx.ws.workspaceId,
      projectId: ctx.ws.projectId,
      revision: expectedRevision,
      status: { not: "archived" },
    },
    data: {
      revision: expectedRevision + 1,
      status: "ready",
      effectiveBrief: JSON.stringify(merged),
      generationMeta: JSON.stringify(merged.generationMeta),
      lastPatchKey: idempotencyKey,
      lastPatchHash: patchHash,
    },
  });

  if (update.count === 0) {
    const fresh = await prisma.contentBrief.findFirst({ where: { id: row.id } });
    return NextResponse.json(
      {
        ...apiError(
          "invalid_request_error",
          "BRIEF_VERSION_CONFLICT",
          "创作方案已在其他页面更新，请刷新后继续",
        ),
        currentRevision: fresh?.revision ?? null,
      },
      { status: 409 },
    );
  }

  // 用户编辑了内容字段（R2）：取消尚未领取的 queued 提炼——其基线已过时，
  // 继续提炼只会白耗一次模型调用且结果必然只被保留不发布。
  if (body.editorial || body.strategy || body.constraints) {
    await prisma.contentBrief
      .updateMany({
        where: { id: row.id, refinementStatus: "queued" },
        data: { refinementStatus: "cancelled", refinementLockedBy: null, refinementLockedUntil: null },
      })
      .catch(() => undefined);
  }

  const updated = await prisma.contentBrief.findFirst({ where: { id: row.id } });
  const responseBody = { data: view(updated ?? row) };
  // 尽力保存首次响应（R8）：存失败只影响重放保真，不影响保存本身。
  await prisma.contentBrief
    .updateMany({
      where: { id: row.id, lastPatchKey: idempotencyKey },
      data: { lastPatchResponse: JSON.stringify(responseBody) },
    })
    .catch(() => undefined);
  return NextResponse.json(responseBody);
}
