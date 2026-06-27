import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServiceSession } from "@/lib/auth/service-auth";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { getServiceWorkspace } from "@/lib/auth/service-context";
import { callLLM } from "@/lib/ai/client";
import { buildContextPromptSection } from "@/lib/ai/prompts/context";
import type { Brief } from "@/types";

function parseBrief(briefText: string): Brief {
  try {
    return JSON.parse(briefText) as Brief;
  } catch {
    return {
      topic: "",
      keyPoints: [],
      platforms: [],
      references: "",
      notes: "",
    };
  }
}

function buildContextSection(args: {
  piece: {
    title: string;
    projectId: string;
    brandId?: string | null;
  };
  platform: string;
  workspaceBrandId?: string | null;
  brief: Brief;
  brandVoice: {
    name: string;
    description: string | null;
    guidelines: string | null;
  } | null;
}): string {
  const { piece, platform, workspaceBrandId, brief, brandVoice } = args;
  const lines = [
    "## 内容上下文",
    `- 内容标题: ${piece.title}`,
    `- 项目ID: ${piece.projectId}`,
    `- 品牌ID: ${piece.brandId || workspaceBrandId || "未提供"}`,
    `- 平台: ${platform}`,
    `- 内容主题: ${brief.topic || "未提供"}`,
    `- 核心要点: ${brief.keyPoints.length > 0 ? brief.keyPoints.join("、") : "未提供"}`,
    brandVoice
      ? `- 品牌声线: ${brandVoice.name}. ${brandVoice.description || ""} ${brandVoice.guidelines || ""}`.trim()
      : "- 品牌声线: 未提供",
  ];

  const structuredContext = buildContextPromptSection(brief);
  if (structuredContext) {
    lines.push(structuredContext);
  }

  return lines.filter(Boolean).join("\n");
}

async function resolveBrandVoice(
  piece: { brandVoice?: { name: string; description: string | null; guidelines: string | null } | null; brandId?: string | null },
  workspaceId: string,
  workspaceBrandId?: string | null
) {
  if (piece.brandVoice) {
    return piece.brandVoice;
  }

  const brandId = piece.brandId ?? workspaceBrandId;
  if (!brandId) {
    return null;
  }

  return prisma.brandVoice.findFirst({
    where: { workspaceId, brandId },
  });
}

function getPieceWorkspaceId(piece: {
  workspaceId?: string | null;
  project?: { workspaceId?: string | null } | null;
}) {
  return piece.workspaceId ?? piece.project?.workspaceId ?? null;
}

// GET /api/content/[id]/quality - Get existing quality evaluation
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServiceSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ws = (await getServiceWorkspace()) ?? getCurrentWorkspace(session);
  if (!ws) {
    return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  }

  const { id } = await params;

  const piece = await prisma.contentPiece.findUnique({
    where: { id },
    include: {},
  });

  if (!piece || getPieceWorkspaceId(piece) !== ws.workspaceId) {
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
  const session = await getServiceSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ws = (await getServiceWorkspace()) ?? getCurrentWorkspace(session);
  if (!ws) {
    return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { platform } = body as { platform?: string };

  const piece = await prisma.contentPiece.findUnique({
    where: { id },
    include: {
      brandVoice: true,
      platformContents: {
        where: platform ? { platform } : undefined,
      },
    },
  });

  if (!piece || getPieceWorkspaceId(piece) !== ws.workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const platformContent = platform
    ? piece.platformContents.find((pc) => pc.platform === platform)
    : piece.platformContents[0];

  if (!platformContent || !platformContent.content) {
    return NextResponse.json({ error: "No content to evaluate" }, { status: 400 });
  }

  const brief = parseBrief(piece.brief);
  const brandVoice = await resolveBrandVoice(piece, ws.workspaceId, ws.brandId);
  const plainContent = platformContent.content.replace(/<[^>]*>/g, "");
  const contextSection = buildContextSection({
    piece,
    platform: platformContent.platform,
    workspaceBrandId: ws.brandId,
    brief,
    brandVoice,
  });

  const prompt = [
    "You are a content quality reviewer.",
    "Score the content as integers from 0 to 10.",
    contextSection,
    `Topic: ${brief.topic}`,
    `Key points: ${(brief.keyPoints || []).join(", ")}`,
    `Platform: ${platformContent.platform}`,
    `Content: ${plainContent}`,
    "Return JSON only with this shape:",
    '{"quality":8,"engagement":7,"brandVoice":6,"platformFit":7,"suggestions":["Suggestion 1","Suggestion 2"]}',
  ].filter(Boolean).join("\n");

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
