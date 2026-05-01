/**
 * Platform Analysis API
 *
 * Analyzes content against platform-specific rules.
 * GET /api/content/[id]/analyze?platform=wechat
 */

import { NextRequest, NextResponse } from "next/server";
import { analyzeForPlatform } from "@/lib/analysis/platform-analyzer";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: contentId } = await params;
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform") as "wechat" | "weibo" | "xiaohongshu" | "douyin" | null;

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

  // TODO: Fetch actual content from database
  // For now, use mock content
  const mockContent = `
    <h1>如何提升团队协作效率</h1>
    <p>在当今数字化快速发展的时代，企业面临的竞争日益激烈。如何在这个充满挑战的环境中脱颖而出，成为每个企业管理者需要思考的核心问题。</p>
    <p>首先，我们需要认识到创新不仅仅是技术层面的突破，更是思维方式的革新。企业需要建立鼓励创新的内部机制，让每一位员工都能成为创新的参与者。</p>
    <p>其次，客户体验的提升是推动业务增长的关键因素。通过深入了解客户需求，提供个性化的服务和产品，可以有效提升客户满意度和忠诚度。</p>
  `;

  try {
    const analysis = analyzeForPlatform(mockContent, platform);
    return NextResponse.json(analysis);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Analysis failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
