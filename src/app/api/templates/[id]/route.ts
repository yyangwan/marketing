import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";

// GET /api/templates/[id] - Get a single template
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
  const template = await prisma.aITemplate.findUnique({
    where: { id },
  });

  if (!template || template.workspaceId !== ws.workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(template);
}

// PUT /api/templates/[id] - Update a template
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
  const existing = await prisma.aITemplate.findUnique({
    where: { id },
  });

  if (!existing || existing.workspaceId !== ws.workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { name, description, template, variables } = body;

  // Validation (same as POST)
  if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
    return NextResponse.json(
      { error: "Invalid input", message: "Name is required" },
      { status: 400 }
    );
  }

  if (template !== undefined && (typeof template !== "string" || template.trim().length === 0)) {
    return NextResponse.json(
      { error: "Invalid input", message: "Template content is required" },
      { status: 400 }
    );
  }

  if (variables !== undefined) {
    if (!Array.isArray(variables)) {
      return NextResponse.json(
        { error: "Invalid input", message: "Variables must be an array" },
        { status: 400 }
      );
    }

    const varNameRegex = /^[a-z0-9_]+$/;
    for (const v of variables) {
      if (!v.name || typeof v.name !== "string" || !varNameRegex.test(v.name)) {
        return NextResponse.json(
          {
            error: "Invalid input",
            message: `Invalid variable name "${v.name}". Only lowercase letters, numbers, and underscore are allowed.`,
          },
          { status: 400 }
        );
      }
      if (!["text", "number", "textarea"].includes(v.type)) {
        return NextResponse.json(
          { error: "Invalid input", message: `Invalid variable type "${v.type}"` },
          { status: 400 }
        );
      }
    }
  }

  try {
    const updated = await prisma.aITemplate.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || "" }),
        ...(template !== undefined && { template: template.trim() }),
        ...(variables !== undefined && { variables: JSON.stringify(variables) }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update template:", error);
    return NextResponse.json(
      { error: "Failed to update template" },
      { status: 500 }
    );
  }
}

// DELETE /api/templates/[id] - Delete a template
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
  const existing = await prisma.aITemplate.findUnique({
    where: { id },
  });

  if (!existing || existing.workspaceId !== ws.workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await prisma.aITemplate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete template:", error);
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    );
  }
}
