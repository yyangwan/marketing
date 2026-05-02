import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { apiError, ERROR_CODES, responses } from "@/lib/errors";

// DELETE /api/workspaces/[id]/invites/[inviteId] - Revoke invite
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; inviteId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return responses.unauthorized();
  }
  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return responses.forbidden(apiError("authentication_error", ERROR_CODES.NO_WORKSPACE, "您还没有加入任何工作区"));
  }

  const { id, inviteId } = await params;
  if (id !== ws.workspaceId) {
    return responses.notFound(apiError("not_found_error", ERROR_CODES.WORKSPACE_NOT_FOUND, "工作区不存在"));
  }

  if (ws.role !== "owner" && ws.role !== "admin") {
    return responses.forbidden(apiError("authentication_error", ERROR_CODES.INSUFFICIENT_PERMISSIONS, "没有权限执行此操作"));
  }

  const invite = await prisma.workspaceInvite.findUnique({
    where: { id: inviteId },
  });

  if (!invite || invite.workspaceId !== ws.workspaceId) {
    return responses.notFound(apiError("not_found_error", ERROR_CODES.CONTENT_NOT_FOUND, "邀请不存在"));
  }

  await prisma.workspaceInvite.delete({
    where: { id: inviteId },
  });

  return NextResponse.json({ success: true });
}
