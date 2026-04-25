import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { callLLM } from "@/lib/ai/client";
import { buildWeChatPrompt } from "@/lib/ai/prompts/wechat";
import { buildWeiboPrompt } from "@/lib/ai/prompts/weibo";
import type { Brief, Platform } from "@/types";

const BUILDERS: Record<string, (brief: Brief) => string> = {
  wechat: buildWeChatPrompt,
  weibo: buildWeiboPrompt,
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  }

  const { contentPieceId, platform } = await req.json();

  const piece = await prisma.contentPiece.findUnique({
    where: { id: contentPieceId },
    include: { project: true },
  });
  if (!piece || piece.project.workspaceId !== ws.workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const brief: Brief = JSON.parse(piece.brief);
  const builder = BUILDERS[platform as Platform];
  if (!builder) {
    return NextResponse.json({ error: `No prompt for ${platform}` }, { status: 400 });
  }

  const prompt = builder(brief);
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
