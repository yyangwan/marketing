import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServiceSession } from "@/lib/auth/service-auth";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { getServiceWorkspace } from "@/lib/auth/service-context";
import { apiError, responses } from "@/lib/errors";
import { validateCreateBriefRequestV1 } from "@/lib/contracts/validate";
import { requestHash, sha256, stableStringify, getIdempotencyKey, isUniqueConstraintError } from "@/lib/contracts/hash";
import {
  buildBaselineBrief,
  evaluateContentEligibility,
} from "@/lib/content-brief/baseline-generator";
import { parseBrief } from "@/lib/content-brief/serde";
import type {
  ContentCreationBriefV1,
  CreateContentBriefRequestV1,
} from "@/contracts/content-creation-brief-v1";
import { validateBriefV1 } from "@/lib/contracts/validate";

function briefPublicView(brief: ContentCreationBriefV1) {
  // 不返回 sourceSnapshot/projectSnapshot 原文（设计 §10.3）。
  return {
    topic: brief.editorial.topic,
    titleCandidates: brief.editorial.titleCandidates,
    outline: brief.editorial.outline,
    keywords: brief.editorial.keywords,
    references: brief.editorial.references,
    notes: brief.editorial.notes ?? "",
    strategy: brief.strategy,
    constraints: brief.constraints,
  };
}

function rowView(row: {
  id: string;
  projectId: string;
  revision: number;
  status: string;
  effectiveBrief: string;
  refinementStatus: string;
  sourceSuggestionId: string;
}) {
  const brief = parseBrief(row.effectiveBrief);
  return {
    id: row.id,
    projectId: row.projectId,
    revision: row.revision,
    status: row.status,
    brief: brief ? briefPublicView(brief) : null,
    platformPlan: brief?.platformPlan ?? [],
    source: { suggestionId: row.sourceSuggestionId },
    refinement: { status: row.refinementStatus },
  };
}

/**
 * POST /api/content-briefs
 * Portal 服务间调用：用规范来源快照创建规则版 Brief（设计 §7.1/§10.2）。
 * 同步生成并保存规则版后立即返回；AI 提炼为异步任务（PR5）。
 */
export async function POST(req: Request) {
  const session = await getServiceSession();
  if (!session?.user?.id) {
    return responses.unauthorized();
  }
  const ws = (await getServiceWorkspace()) ?? getCurrentWorkspace(session);
  if (!ws) {
    return responses.forbidden(apiError("authentication_error", "no_workspace", "您还没有加入任何工作区"));
  }
  const projectId = ws.projectId;
  if (!projectId) {
    return responses.badRequest(apiError("invalid_request_error", "missing_parameter", "缺少项目上下文", { param: "projectId" }));
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

  const validation = validateCreateBriefRequestV1(body);
  if (!validation.ok) {
    return responses.unprocessable(
      apiError("invalid_request_error", "SOURCE_PAYLOAD_INVALID", "来源快照不符合契约", {
        param: validation.errors.slice(0, 5).join("; "),
      }),
    );
  }

  const request = body as CreateContentBriefRequestV1;
  const hash = requestHash(request);
  const sourceHash = sha256(stableStringify(request.sourceSnapshot));

  // 幂等回放：命中唯一约束后按请求哈希判定 replay / conflict。
  try {
    const eligibility = evaluateContentEligibility(request.sourceSnapshot);
    if (!eligibility.eligible) {
      return responses.unprocessable(
        apiError(
          "invalid_request_error",
          "SUGGESTION_NOT_CONTENT_ELIGIBLE",
          "该建议属于技术/运营任务，不适合转换为内容创作方案",
        ),
      );
    }

    const briefId = `brief_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
    const baseline = buildBaselineBrief({
      briefId,
      workspaceId: ws.workspaceId,
      projectId,
      snapshot: request.sourceSnapshot,
      projectSnapshot: request.projectSnapshot,
      sourceHash,
      suggestionRef: request.suggestionRef,
    });

    const briefValidation = validateBriefV1(baseline);
    if (!briefValidation.ok) {
      // 规则版生成器产出违约属于程序错误，不得静默保存。
      console.error("[content-brief] baseline failed schema validation", {
        ruleId: eligibility.ruleId,
        errors: briefValidation.errors.slice(0, 5),
      });
      return responses.serverError(
        apiError("api_error", "BASELINE_INVALID", "基础创作方案生成失败，请稍后重试"),
      );
    }

    const row = await prisma.contentBrief.create({
      data: {
        id: briefId,
        workspaceId: ws.workspaceId,
        projectId,
        createdByUserId: session.user.id,
        schemaVersion: 1,
        revision: 1,
        status: "baseline_ready",
        sourceType: "visibility_suggestion",
        sourceSuggestionId: request.sourceSnapshot.suggestionId,
        sourceHash,
        sourceSnapshot: JSON.stringify(request.sourceSnapshot),
        projectSnapshot: JSON.stringify(request.projectSnapshot),
        baselineBrief: JSON.stringify(baseline),
        effectiveBrief: JSON.stringify(baseline),
        generationMeta: JSON.stringify(baseline.generationMeta),
        idempotencyKey,
        idempotencyRequestHash: hash,
        refinementStatus: "queued",
      },
    });

    return NextResponse.json(
      {
        data: {
          ...rowView(row),
          eligibility: {
            requiresConfirmation: eligibility.requiresConfirmation,
            ruleId: eligibility.ruleId,
          },
        },
        meta: { replayed: false },
      },
      { status: 201 },
    );
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const existing = await prisma.contentBrief.findFirst({
        where: { workspaceId: ws.workspaceId, projectId, idempotencyKey },
      });
      if (existing && existing.idempotencyRequestHash === hash) {
        return NextResponse.json(
          { data: rowView(existing), meta: { replayed: true } },
          { status: 200 },
        );
      }
      return responses.conflict(
        apiError("invalid_request_error", "IDEMPOTENCY_KEY_REUSED", "相同幂等键已用于不同请求体"),
      );
    }
    console.error("[content-brief] create failed", error);
    return responses.serverError(
      apiError("api_error", "internal_error", "创建创作方案失败，请稍后重试"),
    );
  }
}

/**
 * GET /api/content-briefs — 当前项目的 Brief 列表（简要视图）。
 */
export async function GET() {
  const session = await getServiceSession();
  if (!session?.user?.id) {
    return responses.unauthorized();
  }
  const ws = (await getServiceWorkspace()) ?? getCurrentWorkspace(session);
  if (!ws || !ws.projectId) {
    return responses.forbidden(apiError("authentication_error", "no_workspace", "缺少工作区或项目上下文"));
  }

  const rows = await prisma.contentBrief.findMany({
    where: { workspaceId: ws.workspaceId, projectId: ws.projectId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ data: rows.map(rowView) });
}
