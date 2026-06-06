import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServiceSession } from "@/lib/auth/service-auth";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { getServiceWorkspace } from "@/lib/auth/service-context";
import { generateForAllPlatforms } from "@/lib/ai/generator";
import type { Brief } from "@/types";
import { responses, errors, apiError, ERROR_CODES } from "@/lib/errors";
import { LLMError } from "@/lib/ai/client";

export async function GET(req: Request) {
  const session = await getServiceSession();
  if (!session?.user?.id) {
    return responses.unauthorized();
  }
  const ws = (await headers()).get("x-genilink-project-id") ? await getServiceWorkspace() : getCurrentWorkspace(session);
  if (!ws) {
    return responses.forbidden(errors.noWorkspace());
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  const pieces = await prisma.contentPiece.findMany({
    where: {
      workspaceId: ws.workspaceId,
      ...(projectId ? { projectId } : {}),
    },
    include: {
      platformContents: true,
      reviewComments: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    pieces.map((p) => ({
      ...p,
      reviewComments: undefined,
      _count: { reviewComments: p.reviewComments.length },
      _lastReviewAction: p.reviewComments.find(
        (c) => c.action === "approved" || c.action === "revision_requested"
      ) || null,
    }))
  );
}

export async function POST(req: Request) {
  const session = await getServiceSession();
  if (!session?.user?.id) {
    return responses.unauthorized();
  }
  const ws = (await headers()).get("x-genilink-project-id") ? await getServiceWorkspace() : getCurrentWorkspace(session);
  if (!ws) {
    return responses.forbidden(errors.noWorkspace());
  }

  try {
    const body = await req.json();
    const { projectId: requestedProjectId, brandVoiceId, ...briefData } = body;
    const projectId = requestedProjectId || ws.projectId;

    if (!projectId) {
      return responses.badRequest(errors.missingParam("projectId"));
    }

    const brief: Brief = {
      topic: briefData.topic,
      keyPoints: briefData.keyPoints || [],
      platforms: briefData.platforms || ["wechat"],
      references: briefData.references || "",
      notes: briefData.notes || "",
      brandVoiceId: brandVoiceId || undefined,
    };

    let effectiveBrandVoice = undefined;
    if (brandVoiceId) {
      const selectedVoice = await prisma.brandVoice.findFirst({
        where: { id: brandVoiceId, workspaceId: ws.workspaceId },
      });
      if (selectedVoice) {
        effectiveBrandVoice = selectedVoice;
      }
    }

    const piece = await prisma.contentPiece.create({
      data: {
        workspaceId: ws.workspaceId,
        projectId,
        brandId: ws.brandId,
        createdByUserId: session.user.id,
        title: brief.topic,
        type: "blog_post",
        brief: JSON.stringify(brief),
        status: "draft",
        brandVoiceId: effectiveBrandVoice?.id || null,
      },
    });

    const platformContents = await Promise.all(
      brief.platforms.map((p: string) =>
        prisma.platformContent.create({
          data: {
            contentPieceId: piece.id,
            platform: p,
            status: "draft",
            content: "",
          },
        })
      )
    );

    const results = await generateForAllPlatforms(brief, effectiveBrandVoice);

    await Promise.all(
      results.map((r, i) => {
        if (r.content && platformContents[i]) {
          return prisma.platformContent.update({
            where: { id: platformContents[i].id },
            data: { content: r.content },
          });
        }
        return Promise.resolve();
      })
    );

    const result = await prisma.contentPiece.findUnique({
      where: { id: piece.id },
      include: { platformContents: true },
    });

    return NextResponse.json(result);
  } catch (err) {
    // Distinguish LLM errors from other errors
    if (err instanceof LLMError) {
      return responses.serverError(errors.llmError(err.originalError));
    }
    const errorMessage = err instanceof Error ? err.message : String(err);
    return responses.serverError(
      apiError("api_error", ERROR_CODES.INTERNAL_ERROR, `鏈嶅姟鍣ㄥ唴閮ㄩ敊璇? ${errorMessage}`)
    );
  }
}

