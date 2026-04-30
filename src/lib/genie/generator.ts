/**
 * Genie Content Generator
 * Phase 1E: Auto-generates content ideas based on analyzed sources
 */

import type { BusinessInsights } from "./analyzer";

export interface ContentIdea {
  title: string;
  brief: string;
  contentType: string;
  targetPlatform: string;
  estimatedWordCount: number;
  keywords: string[];
  sourceUrl?: string;
  reason: string; // Why this idea was generated
}

export interface GenerationResult {
  ideas: ContentIdea[];
  generatedAt: Date;
  sourceCount: number;
  confidence: number;
}

/**
 * Generates content ideas based on business insights
 */
export async function generateContentIdeas(
  insights: BusinessInsights,
  options: {
    sourceUrl?: string;
    count?: number; // Number of ideas to generate (default: 3)
    platforms?: string[]; // Target platforms (default: all)
  } = {}
): Promise<GenerationResult> {
  const { sourceUrl, count = 3, platforms = ["wechat", "weibo", "xiaohongshu", "douyin"] } = options;

  const prompt = buildGenerationPrompt(insights, { count, platforms });

  try {
    const response = await callAI(prompt);
    const ideas = parseAIResponse(response, sourceUrl);

    return {
      ideas,
      generatedAt: new Date(),
      sourceCount: 1,
      confidence: 0.8,
    };
  } catch (e) {
    console.error("Failed to generate content ideas:", e);
    throw e;
  }
}

/**
 * Generates content ideas from multiple sources
 */
export async function generateContentIdeasFromSources(
  sources: Array<{ insights: BusinessInsights; url: string }>,
  options: {
    count?: number;
    platforms?: string[];
  } = {}
): Promise<GenerationResult> {
  const { count = 5, platforms = ["wechat", "weibo", "xiaohongshu", "douyin"] } = options;

  // Merge insights from all sources
  const allInsights = sources.map((s) => s.insights);
  const mergedInsights = mergeInsights(allInsights);

  const prompt = buildGenerationPrompt(mergedInsights, {
    count,
    platforms,
    sourceUrls: sources.map((s) => s.url),
  });

  try {
    const response = await callAI(prompt);
    const ideas = parseAIResponse(response);

    return {
      ideas,
      generatedAt: new Date(),
      sourceCount: sources.length,
      confidence: 0.9,
    };
  } catch (e) {
    console.error("Failed to generate content ideas:", e);
    throw e;
  }
}

/**
 * Builds the AI prompt for content generation
 */
function buildGenerationPrompt(
  insights: BusinessInsights,
  options: {
    count?: number;
    platforms?: string[];
    sourceUrls?: string[];
  }
): string {
  const { count = 3, platforms, sourceUrls } = options;

  const platformNames = {
    wechat: "微信公众号",
    weibo: "微博",
    xiaohongshu: "小红书",
    douyin: "抖音",
  };

  return `你是一个专业的社交媒体内容策划。请基于以下品牌分析，生成${count}个有创意的内容营销创意。

## 品牌分析

业务类型: ${insights.businessType}
核心产品: ${insights.keyProducts.join(", ")}
品牌调性: ${insights.brandTone}
目标受众: ${insights.targetAudience}
常见话题: ${insights.recurringTopics.join(", ")}
内容主题: ${insights.contentThemes.join(", ")}
建议内容类型: ${insights.suggestedContentTypes.join(", ")}

${sourceUrls && sourceUrls.length > 0 ? `参考来源: ${sourceUrls.join(", ")}` : ""}

## 目标平台

${platforms?.map((p) => `- ${platformNames[p as keyof typeof platformNames] || p}`).join("\n") || "- 所有平台"}

## 要求

请生成${count}个内容创意，每个创意包含：
- title: 吸引人的标题（10-30字）
- brief: 内容概要（50-100字描述核心内容和角度）
- contentType: 内容类型（从品牌分析的suggestedContentTypes中选择）
- targetPlatform: 目标平台（${platforms?.join("/") || "wechat/weibo/xiaohongshu/douyin"}）
- estimatedWordCount: 预估字数（根据平台特性：微信1500-2500，微博50-500，小红书300-1500，抖音150-500）
- keywords: 相关关键词数组（3-5个）
- reason: 为什么这个创意适合该品牌（一句话说明）

创意要求：
1. 符合品牌调性和目标受众
2. 针对目标平台的特性优化
3. 结合常见话题和内容主题
4. 具有可执行性，能落地执行
5. 标题吸引人但不标题党

只返回JSON数组，不要有其他内容。格式：
[
  {
    "title": "...",
    "brief": "...",
    "contentType": "...",
    "targetPlatform": "...",
    "estimatedWordCount": 1000,
    "keywords": ["关键词1", "关键词2"],
    "reason": "..."
  }
]`;
}

/**
 * Calls DeepSeek AI for generation
 */
async function callAI(prompt: string): Promise<string> {
  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: "你是一个专业的社交媒体内容策划，擅长创作有创意、可执行的营销内容。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7, // Higher temperature for more creativity
      max_tokens: 3000,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

/**
 * Parses AI response into ContentIdea array
 */
function parseAIResponse(response: string, sourceUrl?: string): ContentIdea[] {
  // Extract JSON from response
  const jsonMatch =
    response.match(/```json\s*([\s\S]*?)\s*```/) ||
    response.match(/```\s*([\s\S]*?)\s*```/) ||
    response.match(/\[[\s\S]*\]/);

  if (!jsonMatch) {
    throw new Error("Failed to extract JSON from AI response");
  }

  const jsonString = jsonMatch[1] || jsonMatch[0];
  const parsed = JSON.parse(jsonString);

  if (!Array.isArray(parsed)) {
    throw new Error("Expected array of content ideas");
  }

  // Add source URL if provided
  if (sourceUrl) {
    parsed.forEach((idea: ContentIdea) => {
      idea.sourceUrl = sourceUrl;
    });
  }

  return parsed as ContentIdea[];
}

/**
 * Merges multiple business insights
 */
function mergeInsights(insightsArray: BusinessInsights[]): BusinessInsights {
  if (insightsArray.length === 0) {
    throw new Error("Cannot merge empty insights");
  }

  if (insightsArray.length === 1) {
    return insightsArray[0];
  }

  // Aggregate all unique values
  const allProducts = insightsArray.flatMap((i) => i.keyProducts);
  const allTopics = insightsArray.flatMap((i) => i.recurringTopics);
  const allThemes = insightsArray.flatMap((i) => i.contentThemes);
  const allTypes = insightsArray.flatMap((i) => i.suggestedContentTypes);

  // Use most common for single-value fields
  const businessTypes = insightsArray.map((i) => i.businessType);
  const tones = insightsArray.map((i) => i.brandTone);
  const audiences = insightsArray.map((i) => i.targetAudience);

  return {
    businessType: getMostCommon(businessTypes),
    keyProducts: [...new Set(allProducts)].slice(0, 5),
    brandTone: getMostCommon(tones),
    targetAudience: getMostCommon(audiences),
    recurringTopics: [...new Set(allTopics)].slice(0, 5),
    contentThemes: [...new Set(allThemes)].slice(0, 5),
    suggestedContentTypes: [...new Set(allTypes)].slice(0, 5),
  };
}

/**
 * Gets the most common value from an array
 */
function getMostCommon<T>(arr: T[]): T {
  const counts = new Map<T, number>();
  for (const item of arr) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }

  let maxCount = 0;
  let mostCommon: T = arr[0];

  for (const [item, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = item;
    }
  }

  return mostCommon;
}

/**
 * Converts ContentIdea to ContentPiece creation data
 */
export function ideaToContentPiece(
  idea: ContentIdea,
  projectId: string
): {
  projectId: string;
  title: string;
  brief: string;
  type: string;
  status: string;
  metadata: Record<string, unknown>;
} {
  return {
    projectId,
    title: idea.title,
    brief: `${idea.brief}\n\n目标平台: ${idea.targetPlatform}\n预估字数: ${idea.estimatedWordCount}\n关键词: ${idea.keywords.join(", ")}\n生成理由: ${idea.reason}`,
    type: idea.contentType,
    status: "genie_draft",
    metadata: {
      sourceUrl: idea.sourceUrl,
      targetPlatform: idea.targetPlatform,
      estimatedWordCount: idea.estimatedWordCount,
      keywords: idea.keywords,
      generatedBy: "genie",
    },
  };
}

/**
 * Batch converts ideas to ContentPiece creation data
 */
export function ideasToContentPieces(
  ideas: ContentIdea[],
  projectId: string
): Array<{
  projectId: string;
  title: string;
  brief: string;
  type: string;
  status: string;
  metadata: Record<string, unknown>;
}> {
  return ideas.map((idea) => ideaToContentPiece(idea, projectId));
}
