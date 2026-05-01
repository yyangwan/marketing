import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { callLLM } from "@/lib/ai/client";

// GET /api/content/[id]/quality - Get existing quality evaluation
export async function GET(
  req: Request,
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

  // Find content piece and verify workspace access
  const piece = await prisma.contentPiece.findUnique({
    where: { id },
    include: { project: true },
  });

  if (!piece || piece.project.workspaceId !== ws.workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Return existing quality evaluation if any
  const quality = await prisma.contentQuality.findUnique({
    where: { contentPieceId: id },
  });

  if (!quality) {
    return NextResponse.json({ error: "No quality evaluation found" }, { status: 404 });
  }

  return NextResponse.json(quality);
}

// POST /api/content/[id]/quality - Create or refresh quality evaluation
export async function POST(
  req: Request,
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

  // Get platform from request body
  const body = await req.json().catch(() => ({}));
  const { platform } = body as { platform?: string };

  // Find content piece and verify workspace access
  const piece = await prisma.contentPiece.findUnique({
    where: { id },
    include: {
      project: { include: { brandVoice: true } },
      platformContents: {
        where: platform ? { platform } : undefined,
      },
    },
  });

  if (!piece || piece.project.workspaceId !== ws.workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Get the platform content for evaluation
  // If platform specified, use that; otherwise use first available
  let platformContent;
  if (platform) {
    platformContent = piece.platformContents.find((pc) => pc.platform === platform);
  } else {
    platformContent = piece.platformContents[0];
  }

  if (!platformContent || !platformContent.content) {
    return NextResponse.json(
      { error: "No content to evaluate" },
      { status: 400 }
    );
  }

  // Build evaluation prompt
  const brief = JSON.parse(piece.brief);
  const brandVoice = piece.project.brandVoice;

  const prompt = `你是一位专业的内容质量评估专家。请对以下内容进行多维度评估。

【内容信息】
主题：${brief.topic}
核心要点：${brief.keyPoints?.join("、")}

【品牌调性】
${brandVoice ? `
品牌名称：${brandVoice.name}
品牌描述：${brandVoice.description || ""}
调性指南：${brandVoice.guidelines || ""}
` : "无品牌调性"}

【待评估内容】
${platformContent.content.replace(/<[^>]*>/g, "")}

请从以下4个维度打分（0-10分，整数）：
1. quality - 内容质量（逻辑、结构、表达）
2. engagement - 吸引力（有趣性、互动性）
3. brandVoice - 品牌调性符合度（${brandVoice ? "有品牌参考" : "无品牌参考，评分基于一致性"}）
4. platformFit - 平台适配度（适合社交媒体风格）

输出格式（仅JSON，无其他文字）：
{
  "quality": 8,
  "engagement": 7,
  "brandVoice": 6,
  "platformFit": 7,
  "suggestions": ["建议1", "建议2"]
}`;

  try {
    const response = await callLLM(prompt);

    // Try to parse JSON response
    let evaluation;
    try {
      // Find JSON in response (handle potential markdown code blocks)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        evaluation = JSON.parse(jsonMatch[0]);
      } else {
        evaluation = JSON.parse(response);
      }
    } catch {
      // Fallback parsing if response isn't valid JSON
      const qualityMatch = response.match(/quality[：:]\s*(\d+)/i);
      const engagementMatch = response.match(/engagement[：:]\s*(\d+)/i);
      const brandVoiceMatch = response.match(/brand[ -_]?voice[：:]\s*(\d+)/i);
      const platformFitMatch = response.match(/platform[ -_]?fit[：:]\s*(\d+)/i);

      evaluation = {
        quality: qualityMatch ? parseInt(qualityMatch[1]) : 5,
        engagement: engagementMatch ? parseInt(engagementMatch[1]) : 5,
        brandVoice: brandVoiceMatch ? parseInt(brandVoiceMatch[1]) : 5,
        platformFit: platformFitMatch ? parseInt(platformFitMatch[1]) : 5,
        suggestions: [],
      };
    }

    // Validate scores are 0-10
    const scores = ["quality", "engagement", "brandVoice", "platformFit"] as const;
    for (const score of scores) {
      if (typeof evaluation[score] !== "number" || evaluation[score] < 0) {
        evaluation[score] = 0;
      } else if (evaluation[score] > 10) {
        evaluation[score] = 10;
      }
    }

    // Upsert quality evaluation
    const quality = await prisma.contentQuality.upsert({
      where: { contentPieceId: id },
      create: {
        contentPieceId: id,
        quality: evaluation.quality,
        engagement: evaluation.engagement,
        brandVoice: evaluation.brandVoice,
        platformFit: evaluation.platformFit,
        suggestions: JSON.stringify(evaluation.suggestions || []),
      },
      update: {
        quality: evaluation.quality,
        engagement: evaluation.engagement,
        brandVoice: evaluation.brandVoice,
        platformFit: evaluation.platformFit,
        suggestions: JSON.stringify(evaluation.suggestions || []),
      },
    });

    return NextResponse.json(quality);
  } catch (error) {
    console.error("Failed to evaluate content quality:", error);
    return NextResponse.json(
      { error: "Failed to evaluate content quality" },
      { status: 500 }
    );
  }
}
