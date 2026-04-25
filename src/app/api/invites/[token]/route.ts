import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const invite = await prisma.workspaceInvite.findUnique({
    where: { token },
    include: {
      workspace: { select: { name: true } },
    },
  });

  if (!invite) {
    return NextResponse.json({ error: "邀请不存在" }, { status: 404 });
  }

  if (invite.usedAt) {
    return NextResponse.json({ error: "邀请已被使用" }, { status: 410 });
  }

  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "邀请链接已过期" }, { status: 410 });
  }

  const inviter = await prisma.workspaceMember.findFirst({
    where: { workspaceId: invite.workspaceId, userId: invite.invitedBy },
    include: { user: { select: { name: true } } },
  });

  return NextResponse.json({
    workspaceName: invite.workspace.name,
    inviterName: inviter?.user.name || "管理员",
    email: invite.email,
    role: invite.role,
  });
}
