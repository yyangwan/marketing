import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServiceSession } from "@/lib/auth/service-auth";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { getServiceWorkspace } from "@/lib/auth/service-context";
import { ERROR_CODES, apiError, errors, responses } from "@/lib/errors";

// GET /api/brand-voices - List all brand voices for the current workspace
export async function GET() {
  const session = await getServiceSession();
  if (!session?.user?.id) {
    return responses.unauthorized();
  }

  const ws = (await getServiceWorkspace()) ?? getCurrentWorkspace(session);
  if (!ws) {
    return responses.forbidden(errors.noWorkspace());
  }

  try {
    const brandVoices = await prisma.brandVoice.findMany({
      where: { workspaceId: ws.workspaceId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(brandVoices);
  } catch (error) {
    console.error("Failed to fetch brand voices:", error);
    return responses.serverError(
      apiError(
        "api_error",
        ERROR_CODES.DATABASE_ERROR,
        "Failed to fetch brand voices"
      )
    );
  }
}

// POST /api/brand-voices - Create a new brand voice
export async function POST(req: Request) {
  const session = await getServiceSession();
  if (!session?.user?.id) {
    return responses.unauthorized();
  }

  const ws = (await getServiceWorkspace()) ?? getCurrentWorkspace(session);
  if (!ws) {
    return responses.forbidden(errors.noWorkspace());
  }

  const body = await req.json();
  const { name, description, guidelines, samples, brandId } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return responses.badRequest(errors.invalidParam("name", "Name is required"));
  }

  if (!samples || !Array.isArray(samples) || samples.length === 0) {
    return responses.badRequest(
      errors.invalidParam("samples", "At least one sample is required")
    );
  }

  if (samples.length > 5) {
    return responses.badRequest(
      errors.invalidParam("samples", "Maximum 5 samples allowed")
    );
  }

  const totalChars = samples.join("").length;
  if (totalChars > 2500) {
    return responses.badRequest(
      errors.invalidParam(
        "samples",
        "Total sample content exceeds 2500 characters"
      )
    );
  }

  try {
    const brandVoice = await prisma.brandVoice.create({
      data: {
        name: name.trim(),
        description: typeof description === "string" ? description.trim() : "",
        guidelines: typeof guidelines === "string" ? guidelines.trim() : "",
        samples: JSON.stringify(samples),
        workspaceId: ws.workspaceId,
        brandId: typeof brandId === "string" ? brandId : ws.brandId,
        createdByUserId: session.user.id,
      },
    });

    return NextResponse.json(brandVoice, { status: 201 });
  } catch (error) {
    console.error("Failed to create brand voice:", error);
    return responses.serverError(
      apiError(
        "api_error",
        ERROR_CODES.DATABASE_ERROR,
        "Failed to create brand voice"
      )
    );
  }
}
