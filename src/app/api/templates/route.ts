import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { ERROR_CODES, apiError, errors, responses } from "@/lib/errors";

// GET /api/templates - List all templates for the current workspace
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return responses.unauthorized();
  }

  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return responses.forbidden(errors.noWorkspace());
  }

  try {
    const templates = await prisma.aITemplate.findMany({
      where: { workspaceId: ws.workspaceId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Failed to fetch templates:", error);
    return responses.serverError(
      apiError("api_error", ERROR_CODES.DATABASE_ERROR, "Failed to fetch templates")
    );
  }
}

// POST /api/templates - Create a new template
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return responses.unauthorized();
  }

  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return responses.forbidden(errors.noWorkspace());
  }

  const body = await req.json();
  const { name, description, template, variables } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return responses.badRequest(errors.invalidParam("name", "Name is required"));
  }

  if (!template || typeof template !== "string" || template.trim().length === 0) {
    return responses.badRequest(
      errors.invalidParam("template", "Template content is required")
    );
  }

  if (!variables || !Array.isArray(variables)) {
    return responses.badRequest(
      errors.invalidParam("variables", "Variables must be an array")
    );
  }

  const varNameRegex = /^[a-z0-9_]+$/;
  for (const variable of variables) {
    if (
      !variable?.name ||
      typeof variable.name !== "string" ||
      !varNameRegex.test(variable.name)
    ) {
      return responses.badRequest(
        errors.invalidParam(
          "variables",
          `Invalid variable name "${variable?.name}". Only lowercase letters, numbers, and underscore are allowed.`
        )
      );
    }
    if (!["text", "number", "textarea"].includes(variable.type)) {
      return responses.badRequest(
        errors.invalidParam(
          "variables",
          `Invalid variable type "${variable.type}"`
        )
      );
    }
  }

  try {
    const newTemplate = await prisma.aITemplate.create({
      data: {
        name: name.trim(),
        description: typeof description === "string" ? description.trim() : "",
        template: template.trim(),
        variables: JSON.stringify(variables),
        workspaceId: ws.workspaceId,
      },
    });

    return NextResponse.json(newTemplate, { status: 201 });
  } catch (error) {
    console.error("Failed to create template:", error);
    return responses.serverError(
      apiError("api_error", ERROR_CODES.DATABASE_ERROR, "Failed to create template")
    );
  }
}
