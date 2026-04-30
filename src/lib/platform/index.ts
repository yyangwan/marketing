/**
 * Platform Publisher Factory and Exports
 * Phase 1F: Real Publishing Integration
 */

import type { Platform } from "../../types";
import type { PlatformCredentials, PublishOptions, PublishResult } from "./base";
import { WeChatPublisher, getWeChatOAuthUrl, getWeChatAccessToken } from "./wechat";
import { WeiboPublisher, getWeiboOAuthUrl, getWeiboAccessToken } from "./weibo";
import { XiaohongshuPublisher, getXiaohongshuOAuthUrl, getXiaohongshuAccessToken } from "./xiaohongshu";
import { DouyinPublisher, getDouyinOAuthUrl, getDouyinAccessToken } from "./douyin";

// Export all publishers
export { WeChatPublisher, getWeChatOAuthUrl, getWeChatAccessToken } from "./wechat";
export { WeiboPublisher, getWeiboOAuthUrl, getWeiboAccessToken } from "./weibo";
export { XiaohongshuPublisher, getXiaohongshuOAuthUrl, getXiaohongshuAccessToken } from "./xiaohongshu";
export { DouyinPublisher, getDouyinOAuthUrl, getDouyinAccessToken } from "./douyin";
export { BasePlatformPublisher, type PlatformCredentials, type PublishOptions, type PublishResult } from "./base";

/**
 * Factory function to get the appropriate publisher for a platform
 */
export function getPlatformPublisher(platform: Platform, credentials: PlatformCredentials) {
  switch (platform) {
    case "wechat":
      return new WeChatPublisher(credentials);
    case "weibo":
      return new WeiboPublisher(credentials);
    case "xiaohongshu":
      return new XiaohongshuPublisher(credentials);
    case "douyin":
      return new DouyinPublisher(credentials);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * Get OAuth URL for a platform
 */
export function getPlatformOAuthUrl(platform: Platform, appId: string, redirectUri: string, state?: string): string {
  switch (platform) {
    case "wechat":
      return getWeChatOAuthUrl(appId, redirectUri, state);
    case "weibo":
      return getWeiboOAuthUrl(appId, redirectUri, state);
    case "xiaohongshu":
      return getXiaohongshuOAuthUrl(appId, redirectUri, state);
    case "douyin":
      return getDouyinOAuthUrl(appId, redirectUri, state);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * Exchange OAuth code for access token
 */
export async function getPlatformAccessToken(
  platform: Platform,
  appId: string,
  appSecret: string,
  code: string,
  redirectUri?: string
): Promise<{ accessToken: string; expiresIn?: number; [key: string]: any } | null> {
  switch (platform) {
    case "wechat":
      return await getWeChatAccessToken(appId, appSecret, code);
    case "weibo":
      return await getWeiboAccessToken(appId, appSecret, code, redirectUri || "");
    case "xiaohongshu":
      return await getXiaohongshuAccessToken(appId, appSecret, code);
    case "douyin":
      return await getDouyinAccessToken(appId, appSecret, code);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * Helper to publish content to a platform
 */
export async function publishToPlatform(
  platform: Platform,
  credentials: PlatformCredentials,
  options: PublishOptions
): Promise<PublishResult> {
  const publisher = getPlatformPublisher(platform, credentials);
  return await publisher.publish(options);
}
