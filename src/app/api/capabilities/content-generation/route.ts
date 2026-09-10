import { NextResponse } from "next/server";
import { getGenerationCapabilities } from "@/lib/platforms/capabilities";

/**
 * GET /api/capabilities/content-generation
 * 平台生成能力声明（设计 §10.9）。非敏感元数据，可被 Portal 缓存 60 秒。
 */
export async function GET() {
  return NextResponse.json(getGenerationCapabilities());
}
