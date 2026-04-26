import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";

// GET /api/content/[id]/schedule - Get schedule for a content piece
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  }

  const { id } = await context.params;

  // Verify content piece exists and belongs to workspace
  const contentPiece = await prisma.contentPiece.findFirst({
    where: {
      id,
      project: { workspaceId: ws.workspaceId },
    },
    include: { schedules: true },
  });

  if (!contentPiece) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(contentPiece.schedules[0] || null);
}

// POST /api/content/[id]/schedule - Create or update schedule
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await req.json();
  const { scheduledAt } = body;

  // Validate scheduledAt
  if (!scheduledAt) {
    return NextResponse.json(
      { error: "invalid_input", message: "scheduledAt is required" },
      { status: 400 }
    );
  }

  const scheduledDate = new Date(scheduledAt);
  if (isNaN(scheduledDate.getTime())) {
    return NextResponse.json(
      { error: "invalid_input", message: "Invalid date format" },
      { status: 400 }
    );
  }

  // Verify content piece exists and belongs to workspace
  const contentPiece = await prisma.contentPiece.findFirst({
    where: {
      id,
      project: { workspaceId: ws.workspaceId },
    },
  });

  if (!contentPiece) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    // Check if schedule already exists
    const existing = await prisma.contentSchedule.findFirst({
      where: { contentId: id },
    });

    let schedule;

    if (existing) {
      // Update existing schedule
      schedule = await prisma.contentSchedule.update({
        where: { id: existing.id },
        data: {
          scheduledAt: scheduledDate,
          status: "scheduled",
        },
      });
    } else {
      // Create new schedule
      schedule = await prisma.contentSchedule.create({
        data: {
          contentId: id,
          scheduledAt: scheduledDate,
          status: "scheduled",
        },
      });
    }

    // Update content piece status
    await prisma.contentPiece.update({
      where: { id },
      data: { status: "scheduled" },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: session.user.id,
        workspaceId: ws.workspaceId,
        type: "schedule_reminder",
        title: "Content scheduled",
        message: `"${contentPiece.title}" is scheduled for ${scheduledDate.toISOString()}`,
        link: `/content/${id}`,
      },
    });

    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    console.error("Failed to create schedule:", error);
    return NextResponse.json(
      { error: "Failed to create schedule" },
      { status: 500 }
    );
  }
}

// DELETE /api/content/[id]/schedule - Remove schedule
export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  }

  const { id } = await context.params;

  // Verify content piece exists and belongs to workspace
  const contentPiece = await prisma.contentPiece.findFirst({
    where: {
      id,
      project: { workspaceId: ws.workspaceId },
    },
  });

  if (!contentPiece) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    // Delete schedule record
    await prisma.contentSchedule.deleteMany({
      where: { contentId: id },
    });

    // Update content status back to draft
    await prisma.contentPiece.update({
      where: { id },
      data: { status: "draft" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete schedule:", error);
    return NextResponse.json(
      { error: "Failed to delete schedule" },
      { status: 500 }
    );
  }
}
