import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { ERROR_CODES, apiError, errors, responses } from "@/lib/errors";

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
    const projects = await prisma.project.findMany({
      where: { workspaceId: ws.workspaceId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return responses.serverError(
      apiError("api_error", ERROR_CODES.DATABASE_ERROR, "Failed to fetch projects")
    );
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return responses.unauthorized();
  }
  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return responses.forbidden(errors.noWorkspace());
  }

  try {
    const { name, clientName } = await req.json();

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return responses.badRequest(
        errors.invalidParam("name", "Project name is required")
      );
    }

    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        clientName: typeof clientName === "string" ? clientName.trim() : "",
        workspaceId: ws.workspaceId,
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    if (String(error).includes("Unique constraint")) {
      return responses.conflict(
        apiError(
          "invalid_request_error",
          ERROR_CODES.VALIDATION_FAILED,
          "A project with this name already exists in the workspace.",
          { param: "name" }
        )
      );
    }

    console.error("Failed to create project:", error);
    return responses.serverError(
      apiError("api_error", ERROR_CODES.DATABASE_ERROR, "Failed to create project")
    );
  }
}
