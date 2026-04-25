import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const invite = await prisma.workspaceInvite.findUnique({
    where: { token },
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

  const { name, password } = await req.json();
  if (!name || !password) {
    return NextResponse.json({ error: "所有字段均为必填" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "密码至少需要 8 个字符" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { email: invite.email },
  });

  if (existing) {
    return NextResponse.json(
      { error: "您已属于一个工作空间，暂不支持加入多个工作空间。" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: invite.email, passwordHash, name },
    });

    await tx.workspaceMember.create({
      data: {
        workspaceId: invite.workspaceId,
        userId: user.id,
        role: invite.role,
      },
    });

    await tx.workspaceInvite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });
  });

  return NextResponse.json({ success: true, email: invite.email });
}
