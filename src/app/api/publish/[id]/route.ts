import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import type { Platform } from "@/types";

const MOCK_URLS: Record<Platform, (title: string) => string> = {
  wechat: (t) => `https://mp.weixin.qq.com/s/mock-${encodeURIComponent(t.slice(0, 20))}`,
  weibo: (t) => `https://weibo.com/mock/${encodeURIComponent(t.slice(0, 20))}`,
  xiaohongshu: (t) => `https://xiaohongshu.com/explore/mock-${encodeURIComponent(t.slice(0, 20))}`,
  douyin: (t) => `https://douyin.com/video/mock-${encodeURIComponent(t.slice(0, 20))}`,
};

export async function POST(
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

  const pc = await prisma.platformContent.findUnique({ where: { id } });
  if (!pc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const piece = await prisma.contentPiece.findUnique({
    where: { id: pc.contentPieceId },
    include: { project: true },
  });

  // Verify workspace ownership
  if (!piece || piece.project.workspaceId !== ws.workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const platform = pc.platform as Platform;
  const title = piece?.title || "Untitled";

  const mockUrl = MOCK_URLS[platform]?.(title) || `https://mock.publish/${id}`;
  const publishedAt = new Date().toISOString();

  const updated = await prisma.platformContent.update({
    where: { id },
    data: {
      status: "published",
      publishedUrl: mockUrl,
    },
  });

  await prisma.contentPiece.update({
    where: { id: pc.contentPieceId },
    data: { status: "published" },
  });

  return NextResponse.json({ ...updated, publishedAt });
}
