import { callLLM } from "./client";
import { buildWeChatPrompt } from "./prompts/wechat";
import { buildWeiboPrompt } from "./prompts/weibo";
import { buildXiaohongshuPrompt } from "./prompts/xiaohongshu";
import { buildDouyinPrompt } from "./prompts/douyin";
import type { Brief, Platform } from "@/types";

interface GenerateResult {
  platform: Platform;
  content: string;
  error?: string;
}

export async function generateForAllPlatforms(brief: Brief): Promise<GenerateResult[]> {
  const platformPrompts: Record<Platform, (brief: Brief) => string> = {
    wechat: buildWeChatPrompt,
    weibo: buildWeiboPrompt,
    xiaohongshu: buildXiaohongshuPrompt,
    douyin: buildDouyinPrompt,
  };

  const results = await Promise.all(
    brief.platforms.map(async (platform): Promise<GenerateResult> => {
      const buildPrompt = platformPrompts[platform];
      if (!buildPrompt) {
        return { platform, content: "", error: `No prompt template for ${platform}` };
      }

      const prompt = buildPrompt(brief);
      if (!prompt) {
        return { platform, content: `[${platform} 内容将在后续版本支持]`, error: "Not yet supported" };
      }

      try {
        const content = await callLLM(prompt);
        return { platform, content };
      } catch (err) {
        return { platform, content: "", error: String(err) };
      }
    })
  );

  return results;
}
