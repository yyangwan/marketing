import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServiceSession } from "@/lib/auth/service-auth";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { getServiceWorkspace } from "@/lib/auth/service-context";
import { apiError, responses } from "@/lib/errors";

/**
 * GET /api/briefs — 内容列表（旧概览接口，保留读取）。
 * 旧的 POST（同步全平台生成）已由内容工作流替代：
 * POST /api/content-briefs 创建方案，POST /api/content-workflows 提交生成。
 */
export async function GET(req: Request) {
  const session = await getServiceSession();
  if (!session?.user?.id) {
    return responses.unauthorized();
  }
  const ws = (await getServiceWorkspace()) ?? getCurrentWorkspace(session);
  if (!ws) {
    return responses.forbidden(apiError("authentication_error", "no_workspace", "您还没有加入任何工作区"));
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  const pieces = await prisma.contentPiece.findMany({
    where: {
      workspaceId: ws.workspaceId,
      ...(projectId ? { projectId } : {}),
    },
    include: {
      platformContents: true,
      reviewComments: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    pieces.map((p) => ({
      ...p,
      reviewComments: undefined,
      _count: { reviewComments: p.reviewComments.length },
      _lastReviewAction:
        p.reviewComments.find(
          (c) => c.action === "approved" || c.action === "revision_requested"
        ) || null,
    })),
  );
}
