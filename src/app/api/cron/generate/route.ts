import { NextResponse } from "next/server";
import { runGenerationBatch } from "@/lib/content-workflow/worker";

/**
 * GET /api/cron/generate — 平台生成 worker（设计 §7.4）。
 * 外部调度器每 15-30 秒调用一次；Bearer CRON_SECRET 鉴权。
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

  const result = await runGenerationBatch("cron");
  return NextResponse.json({ data: result });
}
