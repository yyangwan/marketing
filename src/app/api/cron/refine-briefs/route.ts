import { NextResponse } from "next/server";
import { runRefinementBatch } from "@/lib/content-brief/refinement-worker";

/**
 * GET /api/cron/refine-briefs — Brief 异步提炼 worker（设计 §10 调度）。
 * 外部调度器每 30 秒调用一次；Bearer CRON_SECRET 鉴权。
 * 代理层对 /api/cron/* 放行并剥离可伪造头（见 src/proxy.ts）。
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET not configured");
    return NextResponse.json({ error: "cron_not_configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runRefinementBatch("cron");
  return NextResponse.json({ data: result });
}
