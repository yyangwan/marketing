import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import type { BrandVoice } from "@/types";

// GET /api/brand-voices - List all brand voices for the current workspace
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  }

  const brandVoices = await prisma.brandVoice.findMany({
    where: { workspaceId: ws.workspaceId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(brandVoices);
}

// POST /api/brand-voices - Create a new brand voice
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  }

  const body = await req.json();
  const { name, description, guidelines, samples } = body;

  // Validation
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json(
      { error: "Invalid input", message: "Name is required" },
      { status: 400 }
    );
  }

  if (!samples || !Array.isArray(samples) || samples.length === 0) {
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

  // Check total chars across all samples (max 2500)
  const totalChars = samples.join("").length;
  if (totalChars > 2500) {
    return NextResponse.json(
      { error: "Invalid input", message: "Total sample content exceeds 2500 characters" },
      { status: 400 }
    );
  }

  try {
    const brandVoice = await prisma.brandVoice.create({
      data: {
        name: name.trim(),
        description: description?.trim() || "",
        guidelines: guidelines?.trim() || "",
        samples: JSON.stringify(samples),
        workspaceId: ws.workspaceId,
      },
    });

    return NextResponse.json(brandVoice, { status: 201 });
  } catch (error) {
    console.error("Failed to create brand voice:", error);
    return NextResponse.json(
      { error: "Failed to create brand voice" },
      { status: 500 }
    );
  }
}
