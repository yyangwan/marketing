import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const piece = await prisma.contentPiece.findUnique({
    where: { reviewToken: token },
  });

  if (!piece) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (piece.reviewExpiresAt && new Date() > piece.reviewExpiresAt) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  // Check if already reviewed
  const existingAction = await prisma.reviewComment.findFirst({
    where: { contentPieceId: piece.id, action: { in: ["approved", "revision_requested"] } },
  });
  if (existingAction) {
    return NextResponse.json(
      { error: "already_reviewed", status: existingAction.action },
      { status: 409 }
    );
  }

  const body = await req.json();
  const { authorName, comment } = body;

  if (!authorName?.trim()) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }
  if (!comment?.trim()) {
    return NextResponse.json({ error: "comment_required" }, { status: 400 });
  }

  // Log the revision request
  await prisma.reviewComment.create({
    data: {
      contentPieceId: piece.id,
      authorName: authorName.trim(),
      comment: comment.trim(),
      action: "revision_requested",
    },
  });

  // Update content piece status back to editing
  await prisma.contentPiece.update({
    where: { id: piece.id },
    data: { status: "revision_requested" },
  });

  return NextResponse.json({ success: true, action: "revision_requested" });
}
