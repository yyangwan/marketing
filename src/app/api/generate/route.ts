import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServiceSession } from "@/lib/auth/service-auth";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { getServiceWorkspace } from "@/lib/auth/service-context";
import { callLLM } from "@/lib/ai/client";
import { buildWeChatPrompt } from "@/lib/ai/prompts/wechat";
import { buildWeiboPrompt } from "@/lib/ai/prompts/weibo";
import { buildXiaohongshuPrompt } from "@/lib/ai/prompts/xiaohongshu";
import { buildDouyinPrompt } from "@/lib/ai/prompts/douyin";
import type { Brief, Platform, BrandVoice } from "@/types";

const BUILDERS: Record<Platform, (brief: Brief, brandVoice?: BrandVoice) => string> = {
  wechat: buildWeChatPrompt,
  weibo: buildWeiboPrompt,
  xiaohongshu: buildXiaohongshuPrompt,
  douyin: buildDouyinPrompt,
};

export async function POST(req: Request) {
  const session = await getServiceSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const ws = (await headers()).get("x-contentos-project-id") ? await getServiceWorkspace() : getCurrentWorkspace(session);
  if (!ws) {
    return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  }

  const { contentPieceId, platform } = await req.json();

  const piece = await prisma.contentPiece.findUnique({
    where: { id: contentPieceId },
    include: {
      project: {
        include: { brandVoice: true },
      },
      brandVoice: true,
    },
  });
  if (!piece || piece.project.workspaceId !== ws.workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const brief: Brief = JSON.parse(piece.brief);
  const builder = BUILDERS[platform as Platform];
  if (!builder) {
    return NextResponse.json({ error: `No prompt for ${platform}` }, { status: 400 });
  }

  // Use contentPiece's brandVoice, fall back to project's default
  const brandVoice = piece.brandVoice || piece.project.brandVoice;

  const prompt = builder(brief, brandVoice || undefined);
  const content = await callLLM(prompt);

  const pc = await prisma.platformContent.upsert({
    where: {
      contentPieceId_platform: { contentPieceId, platform },
    },
    create: { contentPieceId, platform, content, status: "draft" },
    update: { content },
  });

  return NextResponse.json(pc);
}
