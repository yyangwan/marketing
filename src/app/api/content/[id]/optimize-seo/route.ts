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

    // Analyze current SEO issues
    const issues: string[] = [];

    // Check content length
    if (textContent.length < 300) {
      issues.push(`内容过短 (${textContent.length}字符)，需要扩展到至少 300 字符`);
    } else if (textContent.length > 2000) {
      issues.push(`内容过长 (${textContent.length}字符)，需要精简到 2000 字符以内`);
    }

    // Check word count
    if (wordCount < 50) {
      issues.push(`词数过少 (${wordCount}词)，需要增加内容深度`);
    }

    // Check keyword density
    if (currentDensity < 2) {
      issues.push(`关键词密度过低 (${currentDensity.toFixed(1)}%)，当前出现 ${currentCount} 次，需要自然地增加关键词出现频率`);
    } else if (currentDensity > 5) {
      issues.push(`关键词密度过高 (${currentDensity.toFixed(1)}%)，当前出现 ${currentCount} 次，需要减少关键词堆砌`);
    }

    // Check if keyword appears in beginning (first 200 chars)
    const beginning = textContent.slice(0, 200);
    if (!keywordLower.test(beginning)) {
      issues.push("关键词未在内容开头出现，建议在第一段自然地包含关键词");
    }

    // Build targeted optimization prompt
    let prompt = `你是一位 SEO 优化专家。请根据当前内容的具体问题进行针对性优化。

【目标关键词】
${keyword}

【当前 SEO 状态】
- 内容长度: ${textContent.length} 字符 (目标: 300-2000)
- 词数: ${wordCount} 词 (目标: ≥50)
- 关键词出现次数: ${currentCount} 次
- 关键词密度: ${currentDensity.toFixed(1)}% (目标: 2-5%)

【需要解决的问题】
${issues.length > 0 ? issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n') : '无明显问题，进行微调优化'}

【优化策略】
`;

    // Add specific instructions based on issues
    if (currentDensity < 2) {
      prompt += `
- 自然地在内容中增加关键词 "${keyword}" 的出现次数
- 将关键词密度提升到 2-5% 的范围内
- 可以在标题、开头、段落首句或总结中自然融入关键词`;
    } else if (currentDensity > 5) {
      prompt += `
- 减少关键词 "${keyword}" 的过度使用
- 删除一些不必要的重复关键词
- 将密度降低到 2-5% 的健康范围`;
    } else {
      prompt += `
- 当前关键词密度良好，保持现状
- 专注于优化内容质量和可读性`;
    }

    if (textContent.length < 300) {
      prompt += `
- 扩展内容，增加有价值的信息
- 添加更多细节、例子或说明
- 目标长度: 300-2000 字符`;
    } else if (textContent.length > 2000) {
      prompt += `
- 精简内容，删除冗余表述
- 提炼核心信息，保持简洁有力
- 目标长度: 300-2000 字符`;
    }

    if (!keywordLower.test(beginning)) {
      prompt += `
- 在内容开头（第一段）自然地包含关键词 "${keyword}"
- 可以通过添加引言、背景介绍或问题陈述的方式融入`;
    }

    prompt += `

【原始内容（HTML 格式）】
${content}

【重要输出要求】
1. 必须返回 HTML 格式的内容
2. 保留段落结构，使用 <p> 标签
3. 保留文本格式（加粗、斜体等）
4. 不要使用 Markdown 格式
5. 只输出优化后的 HTML，不要任何解释

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
