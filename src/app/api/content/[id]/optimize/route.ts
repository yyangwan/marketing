/**
 * Platform Optimization API
 *
 * Optimizes content for a specific platform using AI.
 * POST /api/content/[id]/optimize
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServiceSession } from "@/lib/auth/service-auth";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { getServiceWorkspace } from "@/lib/auth/service-context";
import { buildContextPromptSection } from "@/lib/ai/prompts/context";
import { optimizeForPlatform } from "@/lib/analysis/optimizer";
import type { Brief, Platform } from "@/types";

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
    brief: string;
    brandVoice?: {
      name: string;
      description: string | null;
      guidelines: string | null;
    } | null;
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

export async function POST(
  req: NextRequest,
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

  const { id: contentId } = await params;

  try {
    const body = await req.json();
    const { platform, content } = body as { platform?: string; content?: string };
    const platformValue = platform as Platform;

    if (!platform) {
      return NextResponse.json(
        { error: "Missing platform parameter" },
        { status: 400 }
      );
    }

    if (!["wechat", "weibo", "xiaohongshu", "douyin"].includes(platform)) {
      return NextResponse.json(
        { error: "Invalid platform. Must be wechat, weibo, xiaohongshu, or douyin" },
        { status: 400 }
      );
    }

    const piece = await prisma.contentPiece.findUnique({
      where: { id: contentId },
      include: {
        brandVoice: true,
        platformContents: {
          where: { platform },
        },
      },
    });

    if (!piece || getPieceWorkspaceId(piece) !== ws.workspaceId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const sourceContent =
      typeof content === "string" && content.trim().length > 0
        ? content
        : piece.platformContents[0]?.content ?? "";

    if (!sourceContent) {
      return NextResponse.json(
        { error: "Missing content parameter" },
        { status: 400 }
      );
    }

    const brief = parseBrief(piece.brief);
    const brandVoice = await resolveBrandVoice(piece, ws.workspaceId, ws.brandId);
    const contextSection = buildContextSection({
      piece,
      platform: platformValue,
      workspaceBrandId: ws.brandId,
      brief,
      brandVoice,
    });

    const result = await optimizeForPlatform(sourceContent, platformValue, contextSection);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Optimization failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
