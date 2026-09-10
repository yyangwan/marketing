import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServiceSession } from "@/lib/auth/service-auth";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { getServiceWorkspace } from "@/lib/auth/service-context";
import { apiError, responses } from "@/lib/errors";
import { toWorkflowView } from "@/lib/content-workflow/service";

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

/** GET /api/content-workflows/[id]（设计 §10.6）：平台级状态与错误。 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveContext();
  if ("error" in ctx) return ctx.error;
  const { id } = await params;

  const workflow = await prisma.contentWorkflow.findFirst({
    where: { id, workspaceId: ctx.ws.workspaceId, projectId: ctx.ws.projectId },
    include: { runs: { orderBy: { createdAt: "asc" } } },
  });
  if (!workflow) {
    return responses.notFound(
      apiError("not_found_error", "WORKFLOW_NOT_FOUND", `工作流不存在: ${id}`, { param: "id" }),
    );
  }

  return NextResponse.json({ data: toWorkflowView(workflow) });
}
