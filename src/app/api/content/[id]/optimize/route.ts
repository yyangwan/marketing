/**
 * Platform Optimization API
 *
 * Optimizes content for a specific platform using AI.
 * POST /api/content/[id]/optimize
 */

import { NextRequest, NextResponse } from "next/server";
import { optimizeForPlatform } from "@/lib/analysis/optimizer";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: contentId } = await params;

  try {
    const body = await req.json();
    const { platform, content } = body;

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

    if (!content) {
      return NextResponse.json(
        { error: "Missing content parameter" },
        { status: 400 }
      );
    }

    // Optimize content for the platform
    const result = await optimizeForPlatform(content, platform);

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
