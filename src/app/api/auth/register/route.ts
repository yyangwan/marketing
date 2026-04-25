import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { workspaceName, name, email, password } = await req.json();

    if (!workspaceName || !name || !email || !password) {
      return NextResponse.json(
        { error: "所有字段均为必填" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "密码至少需要 8 个字符" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "该邮箱已注册" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, passwordHash, name },
      });

      const workspace = await tx.workspace.create({
        data: { name: workspaceName },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: "owner",
        },
      });

      return { userId: user.id, workspaceId: workspace.id };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("Registration error:", err);
    return NextResponse.json(
      { error: "注册失败，请重试" },
      { status: 500 }
    );
  }
}
