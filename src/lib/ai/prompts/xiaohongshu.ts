import type { Brief, BrandVoice } from "@/types";

export function buildXiaohongshuPrompt(brief: Brief, brandVoice?: BrandVoice): string {
  const prompt = `你是一位专业的小红书种草博主。请根据以下简报，撰写一篇高质量的小红书笔记。

## 简报信息
- 主题：${brief.topic}
- 核心要点：${brief.keyPoints.join("、")}
- 补充说明：${brief.notes || "无"}
- 参考资料：${brief.references || "无"}

## 写作要求
1. 标题：15 字以内，必须包含吸睛关键词，可以使用 [] 或 emoji 增加吸引力
2. 正文：300-800 字，使用轻松活泼的口语化表达
3. 结构：开头抛出痛点/好奇心 → 分点展开（使用 emoji 作为列表标记）→ 总结互动引导
4. 使用大量 emoji 增加阅读趣味性（每段至少 1-2 个）
5. 正文结尾引导互动（如："姐妹们觉得怎么样？评论区聊聊~"）
6. 输出纯文本格式，段落间用空行分隔
7. 语气：像跟闺蜜聊天一样亲切自然，避免官方腔调
8. 适当使用小红书常见表达："绝绝子""种草""姐妹们""宝藏""yyds"等

请直接输出笔记内容（第一行为标题，空行后为正文），不要添加额外说明。`;

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

请遵循以上品牌调性指南，使笔记内容符合品牌风格。
---
` + prompt;

    return promptWithBrand;
  }

  return prompt;
}
