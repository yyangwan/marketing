import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServiceSession } from "@/lib/auth/service-auth";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { getServiceWorkspace } from "@/lib/auth/service-context";
import crypto from "crypto";
import { notifyContentStatus } from "@/lib/notifications/trigger";

export async function POST(
  _req: Request,
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

  const piece = await prisma.contentPiece.findUnique({
    where: { id },
    include: { project: true },
  });
  if (!piece || piece.project.workspaceId !== ws.workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const reviewToken = crypto.randomUUID();
  const reviewExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const updated = await prisma.contentPiece.update({
    where: { id },
    data: { reviewToken, reviewExpiresAt, status: "review" },
  });

  await notifyContentStatus(id, "review", ws.workspaceId);

  return NextResponse.json({
    reviewToken: updated.reviewToken,
    reviewExpiresAt: updated.reviewExpiresAt,
    reviewUrl: `/review/${updated.reviewToken}`,
  });
}

export async function GET(
  _req: Request,
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

  const piece = await prisma.contentPiece.findUnique({
    where: { id },
    include: {
      project: true,
      reviewComments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!piece || piece.project.workspaceId !== ws.workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    reviewToken: piece.reviewToken,
    reviewExpiresAt: piece.reviewExpiresAt,
    reviewUrl: piece.reviewToken ? `/review/${piece.reviewToken}` : null,
    comments: piece.reviewComments,
  });
}
