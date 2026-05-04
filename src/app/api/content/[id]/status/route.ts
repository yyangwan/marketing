import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { normalizeContentStatus } from "@/lib/content-status";
import { notifyContentStatus } from "@/lib/notifications/trigger";
import { ERROR_CODES, apiError, errors, responses } from "@/lib/errors";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return responses.unauthorized();
  }
  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return responses.forbidden(errors.noWorkspace());
  }

  const { id } = await params;
  const body = await req.json();
  const status = normalizeContentStatus(body.status);

  if (!status) {
    return responses.badRequest(
      errors.invalidParam("status", "Invalid content status")
    );
  }

  const existing = await prisma.contentPiece.findUnique({
    where: { id },
    include: { project: true },
  });
  if (!existing || existing.project.workspaceId !== ws.workspaceId) {
    return responses.notFound(errors.contentNotFound(id));
  }

  // If leaving "scheduled", remove the corresponding ContentSchedule record
  if (existing.status === "scheduled" && status !== "scheduled") {
    await prisma.contentSchedule.deleteMany({ where: { contentId: id } });
  }

  const piece = await prisma.contentPiece.update({
    where: { id },
    data: { status },
    include: { platformContents: true },
  });

  if (existing.status !== status) {
    await notifyContentStatus(id, status, ws.workspaceId);
  }

  return NextResponse.json(piece);
}
