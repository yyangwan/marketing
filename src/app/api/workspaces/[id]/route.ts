import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServiceSession } from "@/lib/auth/service-auth";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { getServiceWorkspace } from "@/lib/auth/service-context";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServiceSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const ws = (await headers()).get("x-contentos-project-id") ? await getServiceWorkspace() : getCurrentWorkspace(session);
  if (!ws) {
    return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  }

  const { id } = await params;
  if (id !== ws.workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (ws.role !== "owner" && ws.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { name } = await req.json();
  if (!name) {
    return NextResponse.json({ error: "名称不能为空" }, { status: 400 });
  }

  const workspace = await prisma.workspace.update({
    where: { id },
    data: { name },
  });

  return NextResponse.json(workspace);
}
