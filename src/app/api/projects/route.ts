import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  }

  const projects = await prisma.project.findMany({
    where: { workspaceId: ws.workspaceId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(projects);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  }

  try {
    const { name, clientName } = await req.json();

    if (!name) {
      return NextResponse.json(
        { error: "项目名称不能为空" },
        { status: 400 }
      );
    }

    const project = await prisma.project.create({
      data: {
        name,
        clientName: clientName || "",
        workspaceId: ws.workspaceId,
      },
    });

    return NextResponse.json(project);
  } catch (err: unknown) {
    if (String(err).includes("Unique constraint")) {
      return NextResponse.json(
        { error: "项目名称已存在" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}
