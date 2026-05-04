import type { Brief, BrandVoice } from "@/types";

export function buildWeiboPrompt(brief: Brief, brandVoice?: BrandVoice): string {
  const prompt = `你是一位专业的微博内容创作者。请根据以下简报，撰写一条微博帖子。

## 简报信息
- 主题：${brief.topic}
- 核心要点：${brief.keyPoints.join("、")}
- 补充说明：${brief.notes || "无"}

## 写作要求
1. 字数不超过 140 字（不含标签）
2. 语气简洁有力，有观点
3. 使用 1-2 个相关话题标签（格式：#话题#）
4. 适当使用 emoji 增加表现力
5. 开头用一句话抓住注意力
6. 可以使用纯文本格式

请直接输出微博内容，不要添加额外说明。`;

  if (brandVoice) {
    let samples: string[];
    try {
      samples = JSON.parse(brandVoice.samples);
    } catch {
      samples = [];
    }
    const promptWithBrand = `【品牌调性指南】
${brandVoice.description || ""}
${brandVoice.guidelines || ""}

【品牌声音示例】
${samples.map((s: string, i: number) => `示例 ${i + 1}:\n${s}`).join("\n\n")}

请遵循以上品牌调性指南，使微博内容符合品牌风格。
---
` + prompt;

    return promptWithBrand;
  }

  return prompt;
}
