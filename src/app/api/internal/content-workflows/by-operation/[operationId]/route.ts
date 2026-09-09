import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/internal/content-workflows/by-operation/[operationId]
 *
 * Portal 对账查询（设计 §12.5）：共享密钥（CONTENT_USAGE_CALLBACK_SECRET）鉴权。
 * 代理层对 /api/internal/* 放行并剥离可伪造头（见 src/proxy.ts）。
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ operationId: string }> },
) {
  const secret = process.env.CONTENT_USAGE_CALLBACK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: { code: "SECRET_NOT_CONFIGURED", message: "内部接口未配置鉴权密钥" } },
      { status: 503 },
    );
  }
  const received = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "内部接口鉴权失败" } },
      { status: 401 },
    );
  }

  const { operationId } = await params;
  const workflow = await prisma.contentWorkflow.findUnique({
    where: { usageOperationId: operationId },
    select: {
      id: true,
      status: true,
      usageStatus: true,
      contentPieceId: true,
      workspaceId: true,
      projectId: true,
    },
  });
  if (!workflow) {
    return NextResponse.json(
      { error: { code: "WORKFLOW_NOT_FOUND", message: "工作流不存在" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ data: workflow });
}
