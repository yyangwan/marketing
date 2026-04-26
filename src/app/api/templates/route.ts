import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import type { AITemplate, TemplateVariable, TemplateVariableType } from "@/types";

// GET /api/templates - List all templates for the current workspace
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  }

  const templates = await prisma.aITemplate.findMany({
    where: { workspaceId: ws.workspaceId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(templates);
}

// POST /api/templates - Create a new template
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
  const { name, description, template, variables } = body;

  // Validation
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json(
      { error: "Invalid input", message: "Name is required" },
      { status: 400 }
    );
  }

  if (!template || typeof template !== "string" || template.trim().length === 0) {
    return NextResponse.json(
      { error: "Invalid input", message: "Template content is required" },
      { status: 400 }
    );
  }

  if (!variables || !Array.isArray(variables)) {
    return NextResponse.json(
      { error: "Invalid input", message: "Variables must be an array" },
      { status: 400 }
    );
  }

  // Validate variable names (whitelist: a-z, 0-9, underscore only)
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

  try {
    const newTemplate = await prisma.aITemplate.create({
      data: {
        name: name.trim(),
        description: description?.trim() || "",
        template: template.trim(),
        variables: JSON.stringify(variables),
        workspaceId: ws.workspaceId,
      },
    });

    return NextResponse.json(newTemplate, { status: 201 });
  } catch (error) {
    console.error("Failed to create template:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
