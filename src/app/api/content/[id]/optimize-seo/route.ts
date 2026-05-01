/**
 * SEO Optimization API
 *
 * Optimizes content for SEO using AI.
 * POST /api/content/[id]/optimize-seo
 */

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/ai/client";

interface SEOOptimizeRequest {
  content: string;
  keyword: string;
}

function generateSEODiff(original: string, optimized: string): string {
  const origText = original.replace(/<[^>]*>/g, "");
  const optText = optimized.replace(/<[^>]*>/g, "");

  if (origText === optText) {
    return "无变化";
  }

  return `原文:\n${origText.slice(0, 200)}${origText.length > 200 ? '...' : ''}\n\n优化后:\n${optText.slice(0, 200)}${optText.length > 200 ? '...' : ''}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const contentId = params.id;

  try {
    const body = await req.json() as SEOOptimizeRequest;
    const { content, keyword } = body;

    if (!content) {
      return NextResponse.json(
        { error: "Missing content parameter" },
        { status: 400 }
      );
    }

    if (!keyword) {
      return NextResponse.json(
        { error: "Missing keyword parameter" },
        { status: 400 }
      );
    }

    // Extract plain text for analysis
    const textContent = content.replace(/<[^>]*>/g, "");
    const words = textContent.split(/\s+/).filter((w) => w.length > 0);
    const wordCount = words.length;

    // Calculate current keyword density
    const keywordLower = keyword.toLowerCase();
    const regex = new RegExp(keywordLower, "gi");
    const currentCount = (textContent.match(regex) || []).length;
    const currentDensity = wordCount > 0 ? (currentCount / wordCount) * 100 : 0;

    // Build SEO optimization prompt
    const prompt = `你是一位 SEO 优化专家。请根据以下信息优化内容的 SEO 表现。

【目标关键词】
${keyword}

【当前 SEO 分析】
- 内容长度: ${textContent.length} 字符
- 词数: ${wordCount}
- 关键词出现次数: ${currentCount}
- 关键词密度: ${currentDensity.toFixed(1)}%

【SEO 优化要求】
1. 关键词密度控制在 2-5% 之间
2. 在标题/开头自然地包含关键词（如果当前没有）
3. 确保内容长度在 300-2000 字符之间
4. 保持内容的可读性和自然流畅
5. 不要堆砌关键词

【原始内容（HTML 格式）】
${content}

【重要输出格式要求】
1. 必须返回 HTML 格式的内容
2. 保留段落结构，使用 <p> 标签
3. 保留文本格式，如 <strong> 加粗</strong>、<em> 斜体</em> 等
4. 不要使用 Markdown 格式
5. 直接输出优化后的 HTML，不要包含任何解释

优化后的内容：`;

    // Call AI for optimization
    const optimized = await callLLM(prompt);

    // Ensure HTML format
    let safeOptimized = optimized.trim();
    if (!safeOptimized.includes('<') || !safeOptimized.includes('>')) {
      // Wrap in paragraphs if plain text
      const paragraphs = safeOptimized.split(/\n\n+/);
      safeOptimized = paragraphs
        .map(p => p.trim() ? `<p>${p.replace(/\n/g, '<br>')}</p>` : '')
        .join('');
    }

    // Generate diff
    const diff = generateSEODiff(content, safeOptimized);

    return NextResponse.json({
      original: content,
      optimized: safeOptimized,
      diff,
      applied: false,
    });
  } catch (error) {
    console.error("SEO optimization error:", error);
    return NextResponse.json(
      {
        error: "SEO optimization failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
