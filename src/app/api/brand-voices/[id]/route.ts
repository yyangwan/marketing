import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";

// GET /api/brand-voices/[id] - Get a single brand voice
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  }

  const { id } = await params;
  const brandVoice = await prisma.brandVoice.findUnique({
    where: { id },
  });

  if (!brandVoice || brandVoice.workspaceId !== ws.workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(brandVoice);
}

// PUT /api/brand-voices/[id] - Update a brand voice
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.brandVoice.findUnique({
    where: { id },
  });

  if (!existing || existing.workspaceId !== ws.workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { name, description, guidelines, samples } = body;

  // Validation
  if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
    return NextResponse.json(
      { error: "Invalid input", message: "Name is required" },
      { status: 400 }
    );
  }

  if (samples !== undefined) {
    if (!Array.isArray(samples) || samples.length === 0) {
      return NextResponse.json(
        { error: "Invalid input", message: "At least one sample is required" },
        { status: 400 }
      );
    }

    if (samples.length > 5) {
      return NextResponse.json(
        { error: "Invalid input", message: "Maximum 5 samples allowed" },
        { status: 400 }
      );
    }

    const totalChars = samples.join("").length;
    if (totalChars > 2500) {
      return NextResponse.json(
        { error: "Invalid input", message: "Total sample content exceeds 2500 characters" },
        { status: 400 }
      );
    }
  }

  try {
    const updated = await prisma.brandVoice.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || "" }),
        ...(guidelines !== undefined && { guidelines: guidelines?.trim() || "" }),
        ...(samples !== undefined && { samples: JSON.stringify(samples) }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update brand voice:", error);
    return NextResponse.json(
      { error: "Failed to update brand voice" },
      { status: 500 }
    );
  }
}

// DELETE /api/brand-voices/[id] - Delete a brand voice
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.brandVoice.findUnique({
    where: { id },
    include: {
      _count: {
        select: { projects: true, contentPieces: true },
      },
    },
  });

  if (!existing || existing.workspaceId !== ws.workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // RESTRICT: Cannot delete if in use
  const usageCount = (existing._count.projects || 0) + (existing._count.contentPieces || 0);
  if (usageCount > 0) {
    return NextResponse.json(
      {
        error: "Cannot delete brand voice in use",
        message: `This brand voice is being used by ${usageCount} item(s). Please remove it from all projects and content pieces before deleting.`,
      },
      { status: 409 }
    );
  }

  try {
    await prisma.brandVoice.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete brand voice:", error);
    return NextResponse.json(
      { error: "Failed to delete brand voice" },
      { status: 500 }
    );
  }
}
