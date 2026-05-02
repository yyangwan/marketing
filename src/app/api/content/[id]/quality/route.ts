import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { callLLM } from "@/lib/ai/client";

// GET /api/content/[id]/quality - Get existing quality evaluation
export async function GET(
  _req: Request,
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

  const piece = await prisma.contentPiece.findUnique({
    where: { id },
    include: { project: true },
  });

  if (!piece || piece.project.workspaceId !== ws.workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const quality = await prisma.contentQuality.findUnique({
    where: { contentPieceId: id },
  });

  if (!quality) {
    return NextResponse.json({ error: "No quality evaluation found" }, { status: 404 });
  }

  return NextResponse.json(quality);
}

// POST /api/content/[id]/quality - Create or refresh quality evaluation
export async function POST(
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
  const body = await req.json().catch(() => ({}));
  const { platform } = body as { platform?: string };

  const piece = await prisma.contentPiece.findUnique({
    where: { id },
    include: {
      project: { include: { brandVoice: true } },
      brandVoice: true,
      platformContents: {
        where: platform ? { platform } : undefined,
      },
    },
  });

  if (!piece || piece.project.workspaceId !== ws.workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const platformContent = platform
    ? piece.platformContents.find((pc) => pc.platform === platform)
    : piece.platformContents[0];

  if (!platformContent || !platformContent.content) {
    return NextResponse.json({ error: "No content to evaluate" }, { status: 400 });
  }

  const brief = JSON.parse(piece.brief);
  const brandVoice = piece.brandVoice || piece.project.brandVoice;
  const plainContent = platformContent.content.replace(/<[^>]*>/g, "");

  const prompt = [
    "You are a content quality reviewer.",
    "Score the content as integers from 0 to 10.",
    `Topic: ${brief.topic}`,
    `Key points: ${(brief.keyPoints || []).join(", ")}`,
    brandVoice
      ? `Brand voice: ${brandVoice.name}. ${brandVoice.description || ""} ${brandVoice.guidelines || ""}`
      : "Brand voice: none provided.",
    `Platform: ${platformContent.platform}`,
    `Content: ${plainContent}`,
    "Return JSON only with this shape:",
    '{"quality":8,"engagement":7,"brandVoice":6,"platformFit":7,"suggestions":["Suggestion 1","Suggestion 2"]}',
  ].join("\n");

  try {
    const response = await callLLM(prompt);

    let evaluation;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      evaluation = JSON.parse(jsonMatch ? jsonMatch[0] : response);
    } catch {
      const qualityMatch = response.match(/quality[:：]?\s*(\d+)/i);
      const engagementMatch = response.match(/engagement[:：]?\s*(\d+)/i);
      const brandVoiceMatch = response.match(/brand[ -_]?voice[:：]?\s*(\d+)/i);
      const platformFitMatch = response.match(/platform[ -_]?fit[:：]?\s*(\d+)/i);

      evaluation = {
        quality: qualityMatch ? parseInt(qualityMatch[1], 10) : 5,
        engagement: engagementMatch ? parseInt(engagementMatch[1], 10) : 5,
        brandVoice: brandVoiceMatch ? parseInt(brandVoiceMatch[1], 10) : 5,
        platformFit: platformFitMatch ? parseInt(platformFitMatch[1], 10) : 5,
        suggestions: [],
      };
    }

    const scores = ["quality", "engagement", "brandVoice", "platformFit"] as const;
    for (const score of scores) {
      if (typeof evaluation[score] !== "number" || evaluation[score] < 0) {
        evaluation[score] = 0;
      } else if (evaluation[score] > 10) {
        evaluation[score] = 10;
      }
    }

    const quality = await prisma.contentQuality.upsert({
      where: { contentPieceId: id },
      create: {
        contentPieceId: id,
        quality: evaluation.quality,
        engagement: evaluation.engagement,
        brandVoice: evaluation.brandVoice,
        platformFit: evaluation.platformFit,
        suggestions: JSON.stringify(evaluation.suggestions || []),
      },
      update: {
        quality: evaluation.quality,
        engagement: evaluation.engagement,
        brandVoice: evaluation.brandVoice,
        platformFit: evaluation.platformFit,
        suggestions: JSON.stringify(evaluation.suggestions || []),
      },
    });

    return NextResponse.json(quality);
  } catch (error) {
    console.error("Failed to evaluate content quality:", error);
    return NextResponse.json(
      { error: "Failed to evaluate content quality" },
      { status: 500 }
    );
  }
}
