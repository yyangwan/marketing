import type { Brief } from "@/types";

function formatList(value: string[] | undefined): string {
  return value && value.length > 0 ? value.join("、") : "无";
}

function formatListOr(value: string[] | undefined, fallback: string | undefined): string {
  return value && value.length > 0 ? value.join("、") : fallback || "无";
}

export function buildContextPromptSection(brief: Brief): string {
  const context = brief.context;
  if (!context) return "";

  const project = context.project ?? {};
  const boundaries = context.boundaries ?? {};
  const insights = context.insights ?? {};
  const idea = context.idea ?? {};

  return `

## 项目与产品边界
- 项目ID：${project.projectId || "无"}
- 品牌ID：${project.brandId || "无"}
- 产品/服务：${project.productName || formatList(insights.keyProducts)}
- 产品描述：${project.productDescription || "无"}
- 定位：${project.positioning || insights.businessType || "无"}
- 目标客户：${formatListOr(project.targetCustomers, insights.targetAudience)}
- 品牌调性：${insights.brandTone || "无"}
- 来源主题：${formatList(insights.contentThemes)}
- 常见话题：${formatList(insights.recurringTopics)}
- 建议内容类型：${formatList(insights.suggestedContentTypes)}
- 参考来源：${formatList(insights.sourceUrls)}

## 本次内容创意
- 创意标题：${idea.title || brief.topic}
- 内容角度：${idea.angle || "无"}
- 内容类型：${idea.contentType || "无"}
- 目标平台：${idea.targetPlatform || formatList(brief.platforms)}
- 预计字数：${idea.estimatedWordCount || "无"}
- 关键词：${formatList(idea.keywords)}
- 生成理由：${idea.reason || "无"}

## 生成约束
1. 内容必须围绕上述产品/服务、目标客户和定位展开，不要只根据主题泛泛创作。
2. 如果主题可延展，优先延展到产品使用场景、客户痛点、业务价值或行业洞察。
3. 不要编造产品不存在的功能、价格、客户案例、认证、数据或对外承诺。
4. 必须提及：${formatList(boundaries.mustMention)}
5. 避免提及：${formatList(boundaries.avoidMention)}
6. 允许使用的主张：${formatList(boundaries.allowedClaims)}
7. 禁止使用的主张：${formatList(boundaries.forbiddenClaims)}
8. 竞品处理：${formatList(boundaries.competitors)}。如需比较，只做客观能力维度比较，不做无法验证的贬损。`;
}
