import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { apiError, ERROR_CODES, responses } from "@/lib/errors";

// PATCH /api/workspaces/[id]/members/[memberId] - Change member role
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return responses.unauthorized();
  }

  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return responses.forbidden(apiError("authentication_error", ERROR_CODES.NO_WORKSPACE, "您还没有加入任何工作区"));
  }

  const { id, memberId } = await params;
  if (id !== ws.workspaceId) {
    return responses.notFound(apiError("not_found_error", ERROR_CODES.WORKSPACE_NOT_FOUND, "工作区不存在"));
  }

  // Only owner/admin can change roles
  if (ws.role !== "owner" && ws.role !== "admin") {
    return responses.forbidden(apiError("authentication_error", ERROR_CODES.INSUFFICIENT_PERMISSIONS, "没有权限执行此操作"));
  }

  const body = await req.json();
  const { role } = body as { role: string };

  const validRoles = ["admin", "member"];
  if (!validRoles.includes(role)) {
    return responses.badRequest(apiError("invalid_request_error", ERROR_CODES.INVALID_PARAMETER, "无效的角色", { param: "role" }));
  }

  // Find the target member
  const target = await prisma.workspaceMember.findUnique({
    where: { id: memberId },
  });

  if (!target || target.workspaceId !== ws.workspaceId) {
    return responses.notFound(apiError("not_found_error", ERROR_CODES.CONTENT_NOT_FOUND, "成员不存在"));
  }

  // Cannot change owner's role
  if (target.role === "owner") {
    return responses.forbidden(apiError("authentication_error", ERROR_CODES.INSUFFICIENT_PERMISSIONS, "不能修改所有者的角色"));
  }

  // Only owner can change admin role
  if (target.role === "admin" && ws.role !== "owner") {
    return responses.forbidden(apiError("authentication_error", ERROR_CODES.INSUFFICIENT_PERMISSIONS, "只有所有者可以修改管理员角色"));
  }

  const updated = await prisma.workspaceMember.update({
    where: { id: memberId },
    data: { role },
    include: { user: { select: { name: true, email: true } } },
  });

  return NextResponse.json({
    id: updated.id,
    name: updated.user.name,
    email: updated.user.email,
    role: updated.role,
    joinedAt: updated.joinedAt.toISOString(),
  });
}

// DELETE /api/workspaces/[id]/members/[memberId] - Remove member
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return responses.unauthorized();
  }

  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return responses.forbidden(apiError("authentication_error", ERROR_CODES.NO_WORKSPACE, "您还没有加入任何工作区"));
  }

  const { id, memberId } = await params;
  if (id !== ws.workspaceId) {
    return responses.notFound(apiError("not_found_error", ERROR_CODES.WORKSPACE_NOT_FOUND, "工作区不存在"));
  }

  if (ws.role !== "owner" && ws.role !== "admin") {
    return responses.forbidden(apiError("authentication_error", ERROR_CODES.INSUFFICIENT_PERMISSIONS, "没有权限执行此操作"));
  }

  const target = await prisma.workspaceMember.findUnique({
    where: { id: memberId },
  });

  if (!target || target.workspaceId !== ws.workspaceId) {
    return responses.notFound(apiError("not_found_error", ERROR_CODES.CONTENT_NOT_FOUND, "成员不存在"));
  }

  // Cannot remove owner
  if (target.role === "owner") {
    return responses.forbidden(apiError("authentication_error", ERROR_CODES.INSUFFICIENT_PERMISSIONS, "不能移除所有者"));
  }

  // Only owner can remove admin
  if (target.role === "admin" && ws.role !== "owner") {
    return responses.forbidden(apiError("authentication_error", ERROR_CODES.INSUFFICIENT_PERMISSIONS, "只有所有者可以移除管理员"));
  }

  // Cannot remove yourself
  if (target.userId === session.user.id) {
    return responses.badRequest(apiError("invalid_request_error", ERROR_CODES.INVALID_PARAMETER, "不能移除自己"));
  }

  await prisma.workspaceMember.delete({
    where: { id: memberId },
  });

  return NextResponse.json({ success: true });
}
