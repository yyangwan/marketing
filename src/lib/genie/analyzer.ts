/**
 * Genie Content Analyzer
 * Phase 1E: Analyzes fetched content to extract business insights
 */

import type { FetchedContent } from "./url-fetcher";

export interface BusinessInsights {
  businessType: string;
  keyProducts: string[];
  brandTone: string;
  targetAudience: string;
  recurringTopics: string[];
  contentThemes: string[];
  suggestedContentTypes: string[];
}

export interface AnalysisResult {
  url: string;
  insights: BusinessInsights;
  confidence: number; // 0-1
  analyzedAt: Date;
  sampleContent: string;
}

/**
 * Analyzes fetched content to extract business insights
 */
export async function analyzeContent(
  content: FetchedContent
): Promise<AnalysisResult> {
  // Build the analysis prompt
  const prompt = buildAnalysisPrompt(content);

  try {
    const response = await callAI(prompt);
    const insights = parseAIResponse(response);

    return {
      url: content.url,
      insights,
      confidence: calculateConfidence(content),
      analyzedAt: new Date(),
      sampleContent: content.content.slice(0, 500), // First 500 chars
    };
  } catch (e) {
    console.error(`Failed to analyze ${content.url}:`, e);
    throw e;
  }
}

/**
 * Builds the AI prompt for content analysis
 */
function buildAnalysisPrompt(content: FetchedContent): string {
  return `你是一个专业的品牌内容分析师。请分析以下网页内容，提取关键的品牌和业务信息。

网页URL: ${content.url}
标题: ${content.title}

内容:
${content.content.slice(0, 3000)}

请以JSON格式返回分析结果，包含以下字段：
{
  "businessType": "业务类型 (电商/SaaS/本地服务/内容创作/媒体/教育/金融/医疗等)",
  "keyProducts": ["主要产品或服务1", "产品2", ...],
  "brandTone": "品牌调性 (专业/亲切/幽默/高端/年轻/温暖等)",
  "targetAudience": "目标受众 (Z世代/职场人士/宝妈/学生/企业主等)",
  "recurringTopics": ["常见话题1", "话题2", ...],
  "contentThemes": ["内容主题1", "主题2", ...],
  "suggestedContentTypes": ["建议的内容类型 (产品介绍/使用教程/用户故事/行业洞察/活动促销等)"]
}

要求：
1. businessType 必须从以下选择：电商、SaaS、本地服务、内容创作、媒体、教育、金融、医疗、制造、咨询、非营利组织、其他
2. brandTone 必须从以下选择：专业、亲切、幽默、高端、年轻、温暖、科技感、文艺、务实、潮流
3. targetAudience 必须从以下选择：Z世代、职场人士、宝妈、学生、企业主、投资人、行业从业者、大众消费者、B2B客户
4. 每个数组至少包含2-3个具体的项目
5. 基于实际内容分析，不要编造

只返回JSON，不要有其他内容。`;
}

/**
 * Calls DeepSeek AI for analysis
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
          content: "你是一个专业的品牌内容分析师，擅长从网页内容中提取商业洞察。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

/**
 * Parses AI response into BusinessInsights
 */
export function parseAIResponse(response: string): BusinessInsights {
  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch =
    response.match(/```json\s*([\s\S]*?)\s*```/) ||
    response.match(/```\s*([\s\S]*?)\s*```/) ||
    response.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error("Failed to extract JSON from AI response");
  }

  const jsonString = jsonMatch[1] || jsonMatch[0];
  const parsed = JSON.parse(jsonString);

  // Validate required fields
  const requiredFields: (keyof BusinessInsights)[] = [
    "businessType",
    "keyProducts",
    "brandTone",
    "targetAudience",
    "recurringTopics",
    "contentThemes",
    "suggestedContentTypes",
  ];

  for (const field of requiredFields) {
    if (!parsed[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  return parsed as BusinessInsights;
}

/**
 * Calculates confidence score based on content quality
 */
function calculateConfidence(content: FetchedContent): number {
  let score = 0.5; // Base confidence

  // More content = higher confidence
  if (content.content.length > 1000) score += 0.2;
  else if (content.content.length > 500) score += 0.1;

  // Has title = higher confidence
  if (content.title && content.title.length > 5) score += 0.1;

  // Has images = richer content
  if (content.images.length > 0) score += 0.1;

  // Has structured content (headings) = higher confidence
  const headingCount = (content.content.match(/^#+\s/gm) || []).length;
  if (headingCount > 2) score += 0.1;

  return Math.min(score, 1);
}

/**
 * Batch analyzes multiple content pieces
 */
export async function analyzeContents(
  contents: FetchedContent[]
): Promise<AnalysisResult[]> {
  const results: AnalysisResult[] = [];

  for (const content of contents) {
    try {
      const result = await analyzeContent(content);
      results.push(result);
    } catch (e) {
      console.error(`Failed to analyze ${content.url}:`, e);
      // Continue with other items
    }
  }

  return results;
}

/**
 * Merges multiple analyses for the same domain
 */
export function mergeAnalyses(analyses: AnalysisResult[]): BusinessInsights {
  if (analyses.length === 0) {
    throw new Error("Cannot merge empty analyses");
  }

  if (analyses.length === 1) {
    return analyses[0].insights;
  }

  // Merge by taking most common values
  const businessTypes = analyses.map((a) => a.insights.businessType);
  const businessType = getMostCommon(businessTypes);

  const allProducts = analyses.flatMap((a) => a.insights.keyProducts);
  const keyProducts = [...new Set(allProducts)].slice(0, 5);

  const tones = analyses.map((a) => a.insights.brandTone);
  const brandTone = getMostCommon(tones);

  const audiences = analyses.map((a) => a.insights.targetAudience);
  const targetAudience = getMostCommon(audiences);

  const allTopics = analyses.flatMap((a) => a.insights.recurringTopics);
  const recurringTopics = [...new Set(allTopics)].slice(0, 5);

  const allThemes = analyses.flatMap((a) => a.insights.contentThemes);
  const contentThemes = [...new Set(allThemes)].slice(0, 5);

  const allTypes = analyses.flatMap((a) => a.insights.suggestedContentTypes);
  const suggestedContentTypes = [...new Set(allTypes)].slice(0, 5);

  return {
    businessType,
    keyProducts,
    brandTone,
    targetAudience,
    recurringTopics,
    contentThemes,
    suggestedContentTypes,
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
