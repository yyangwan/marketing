import type { Brief, BrandVoice } from "@/types";

export function buildDouyinPrompt(brief: Brief, brandVoice?: BrandVoice): string {
  const prompt = `你是一位专业的抖音短视频脚本创作者。请根据以下简报，撰写一份抖音短视频脚本。

## 简报信息
- 主题：${brief.topic}
- 核心要点：${brief.keyPoints.join("、")}
- 补充说明：${brief.notes || "无"}
- 参考资料：${brief.references || "无"}

## 写作要求
1. 总时长控制在 30-90 秒（按正常语速约 100-300 字）
2. 格式要求：使用以下结构
   - 【标题】：一句话概括视频主题（用于封面）
   - 【开头 3 秒 hook】：用提问/反常识/悬念抓住注意力
   - 【正文】：2-4 个核心要点，每个要点配合画面描述
   - 【结尾 CTA】：引导点赞、关注或评论
3. 每个段落标注建议的画面/字幕描述（用 [画面：...] 格式）
4. 语言口语化、节奏感强，适合短视频节奏
5. 适当使用网络热梗和流行语
6. 避免生硬的广告感，内容要有价值输出

请直接输出脚本内容，不要添加额外说明。`;

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

请遵循以上品牌调性指南，使脚本内容符合品牌风格。
---
` + prompt;

    return promptWithBrand;
  }

  return prompt;
}
