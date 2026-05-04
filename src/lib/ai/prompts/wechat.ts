import type { Brief, BrandVoice } from "@/types";

export function buildWeChatPrompt(brief: Brief, brandVoice?: BrandVoice): string {
  const prompt = `你是一位专业的微信公众号内容创作者。请根据以下简报，撰写一篇高质量的微信公众号长文章。

## 简报信息
- 主题：${brief.topic}
- 核心要点：${brief.keyPoints.join("、")}
- 补充说明：${brief.notes || "无"}
- 参考资料：${brief.references || "无"}

## 写作要求
1. 文章长度：1500-3000 字
2. 使用 HTML 格式输出（使用 h2, p, ul, li, strong 等标签）
3. 结构清晰：包含引言、2-3个核心段落、总结
4. 语言风格：专业但不晦涩，适合微信公众号阅读
5. 每个段落要有具体的数据、案例或 actionable 建议
6. 标题要吸引眼球但不标题党

请直接输出文章内容，不要添加额外说明。`;

  // Inject brand voice if provided
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

请遵循以上品牌调性指南，使文章内容符合品牌风格。
---
` + prompt;

    return promptWithBrand;
  }

  return prompt;
}
