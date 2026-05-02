import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { apiError, ERROR_CODES, responses } from "@/lib/errors";

// GET /api/workspaces/[id]/invites - List pending invites
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return responses.unauthorized();
  }
  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return responses.forbidden(apiError("authentication_error", ERROR_CODES.NO_WORKSPACE, "您还没有加入任何工作区"));
  }

  const { id } = await params;
  if (id !== ws.workspaceId) {
    return responses.notFound(apiError("not_found_error", ERROR_CODES.WORKSPACE_NOT_FOUND, "工作区不存在"));
  }

  if (ws.role !== "owner" && ws.role !== "admin") {
    return responses.forbidden(apiError("authentication_error", ERROR_CODES.INSUFFICIENT_PERMISSIONS, "没有权限执行此操作"));
  }

  const invites = await prisma.workspaceInvite.findMany({
    where: { workspaceId: ws.workspaceId, usedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    invites.map((inv) => ({
      id: inv.id,
      token: inv.token,
      email: inv.email,
      role: inv.role,
      expiresAt: inv.expiresAt.toISOString(),
      createdAt: inv.createdAt.toISOString(),
      isExpired: inv.expiresAt < new Date(),
    }))
  );
}

// POST /api/workspaces/[id]/invites - Create invite
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return responses.unauthorized();
  }
  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return responses.forbidden(apiError("authentication_error", ERROR_CODES.NO_WORKSPACE, "您还没有加入任何工作区"));
  }

  const { id } = await params;
  if (id !== ws.workspaceId) {
    return responses.notFound(apiError("not_found_error", ERROR_CODES.WORKSPACE_NOT_FOUND, "工作区不存在"));
  }

  if (ws.role !== "owner" && ws.role !== "admin") {
    return responses.forbidden(apiError("authentication_error", ERROR_CODES.INSUFFICIENT_PERMISSIONS, "没有权限执行此操作"));
  }

  const { email } = await req.json();
  if (!email) {
    return responses.badRequest(apiError("invalid_request_error", ERROR_CODES.MISSING_PARAMETER, "邮箱不能为空", { param: "email" }));
  }

  // Check if already a member
  const existingMember = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: ws.workspaceId,
      user: { email },
    },
  });
  if (existingMember) {
    return responses.badRequest(apiError("invalid_request_error", ERROR_CODES.INVALID_PARAMETER, "该用户已是工作区成员", { param: "email" }));
  }

  const invite = await prisma.workspaceInvite.create({
    data: {
      workspaceId: ws.workspaceId,
      email,
      role: "member",
      invitedBy: session.user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return NextResponse.json({
    id: invite.id,
    inviteUrl: `/invite/${invite.token}`,
    expiresAt: invite.expiresAt.toISOString(),
  });
}
