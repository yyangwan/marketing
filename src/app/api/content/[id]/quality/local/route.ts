import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";

// Local analysis utilities (instant, no AI required)
import {
  calculateLocalMetrics,
  calculateOverallLocalQuality,
  getLocalQualitySuggestions,
} from "@/lib/analysis/quality";
import { calculateReadability } from "@/lib/analysis/readability";
import { analyzeSentiment, analyzeEmotions } from "@/lib/analysis/sentiment";
import { analyzeContentStructure } from "@/lib/analysis/structure";
import { extractKeywordsFromHTML } from "@/lib/analysis/keywords";

/**
 * GET /api/content/[id]/quality/local
 *
 * Returns instantly computed quality metrics without AI evaluation.
 * Provides immediate feedback while AI evaluation runs in background.
 *
 * Response includes:
 * - localMetrics: readability, vocabulary diversity, sentence complexity, consistency
 * - overallScore: combined local quality score (0-100)
 * - sentiment: sentiment analysis with emotion breakdown
 * - structure: content structure analysis
 * - keywords: auto-extracted keywords
 * - suggestions: improvement suggestions based on local metrics
 */
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
    include: {
      project: true,
      platformContents: true,
    },
  });

  if (!piece || piece.project.workspaceId !== ws.workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Get the first platform content for analysis
  const platformContent = piece.platformContents[0];
  if (!platformContent || !platformContent.content) {
    return NextResponse.json(
      {
        localMetrics: {
          readabilityScore: 0,
          vocabularyDiversity: 0,
          sentenceComplexity: 0,
          consistencyScore: 0,
        },
        overallScore: 0,
        sentiment: { overall: "neutral", score: 0, confidence: 0 },
        structure: {
          hasH1: false,
          h1Count: 0,
          headingHierarchy: [],
          paragraphCount: 0,
          averageParagraphLength: 0,
          longParagraphs: 0,
          structureScore: 0,
        },
        keywords: [],
        emotions: {
          joy: 0,
          sadness: 0,
          anger: 0,
          fear: 0,
          surprise: 0,
        },
        suggestions: ["内容为空，无法分析"],
      },
      { status: 200 }
    );
  }

  const content = platformContent.content;

  try {
    // Calculate all local metrics
    const localMetrics = calculateLocalMetrics(content);
    const overallScore = calculateOverallLocalQuality(content);

    // Sentiment analysis
    const sentiment = analyzeSentiment(content);
    const emotions = analyzeEmotions(content);

    // Structure analysis
    const structure = analyzeContentStructure(content);

    // Extract keywords
    const keywords = extractKeywordsFromHTML(content, { topN: 10 });

    // Generate suggestions
    const suggestions = getLocalQualitySuggestions(localMetrics);

    return NextResponse.json({
      localMetrics,
      overallScore,
      sentiment,
      emotions,
      structure,
      keywords,
      suggestions,
    });
  } catch (error) {
    console.error("Failed to calculate local quality metrics:", error);
    return NextResponse.json(
      { error: "Failed to calculate quality metrics" },
      { status: 500 }
    );
  }
}
