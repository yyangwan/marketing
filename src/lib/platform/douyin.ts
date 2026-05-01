/**
 * Douyin (TikTok China) Publisher
 * Phase 1F: Real Publishing Integration
 *
 * Note: Douyin's official API requires partnership application.
 * This implementation provides a framework for integration.
 *
 * For production use, apply for official API access at:
 * https://developer.open-douyin.com/
 */

import { BasePlatformPublisher, PlatformCredentials, PublishOptions, PublishResult } from "./base";

export interface DouyinCredentials extends PlatformCredentials {
  appId?: string;
  appSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  openId?: string;  // User OpenID for publishing
}

export interface DouyinVideoUploadResponse {
  data: {
    video: {
      id: string;
    };
  };
}

export interface DouyinVideoPublishResponse {
  data: {
    item_id: string;
  };
  error_code: {
    code: number;
    description: string;
  };
}

export class DouyinPublisher extends BasePlatformPublisher {
  protected credentials: DouyinCredentials;

  constructor(credentials: DouyinCredentials) {
    super(credentials);
    this.credentials = credentials;
  }

  protected getApiBaseUrl(): string {
    return "https://developer.toutiao.com";
  }

  /**
   * Refresh Douyin access token
   */
  protected async refreshAccessToken(): Promise<string | null> {
    if (!this.credentials.appId || !this.credentials.appSecret || !this.credentials.refreshToken) {
      // Return existing token if available (for testing)
      if (this.credentials.accessToken) {
        return this.credentials.accessToken;
      }
      return null;
    }

    const url = `${this.getApiBaseUrl()}/api/apps/v1/token/refresh`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          app_id: this.credentials.appId,
          secret: this.credentials.appSecret,
          grant_type: "refresh_token",
          refresh_token: this.credentials.refreshToken,
        }),
      });

      const data = await response.json();

      if (data.error_code && data.error_code.code !== 0) {
        console.error("Douyin token refresh failed:", data.error_code.description);
        return null;
      }

      return data.data.access_token;
    } catch (error) {
      console.error("Douyin token refresh error:", error);
      return null;
    }
  }

  /**
   * Upload a video to Douyin
   * Note: This is a simplified implementation. Douyin video upload
   * requires chunked upload for large files.
   */
  private async uploadVideo(videoUrl: string, accessToken: string): Promise<string | null> {
    // For this implementation, we'll assume videoUrl is already hosted
    // In production, you would:
    // 1. Download the video
    // 2. Upload using chunked upload API
    // 3. Get video ID back

    const uploadUrl = `${this.getApiBaseUrl()}/api/v1/video/upload/`;

    try {
      // This is a placeholder - actual implementation requires
      // the Douyin chunked upload SDK
      console.warn("Douyin video upload requires official SDK integration");
      return null;
    } catch (error) {
      console.error("Douyin video upload error:", error);
      return null;
    }
  }

  /**
   * Publish content to Douyin
   * Note: Douyin is primarily a video platform. Text-only posts
   * are not standard. This implementation provides a framework.
   */
  async publish(options: PublishOptions): Promise<PublishResult> {
    // Get valid access token
    const accessToken = await this.refreshTokenIfNeeded();
    if (!accessToken) {
      return {
        success: false,
        errorMessage: "No valid access token. Please re-authenticate.",
        needsAuth: true,
      };
    }

    // Douyin primarily supports video content
    // If no video/images provided, we can still create a text post
    // but it's not the platform's strength

    if (!options.images || options.images.length === 0) {
      return {
        success: false,
        errorMessage: "Douyin requires at least one image or video for publishing.",
      };
    }

    // For images, Douyin supports photo slideshows
    // Create a post with the first image as cover
    const postData = {
      text: `${options.title}\n\n${options.content}`,
      cover: options.images[0],
      images: options.images,
    };

    const publishUrl = `${this.getApiBaseUrl()}/api/v1/item/publish/`;

    try {
      const publishResponse = await fetch(publishUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(postData),
      });

      const data: DouyinVideoPublishResponse = await publishResponse.json();

      if (data.data && data.data.item_id) {
        return {
          success: true,
          platformPostId: data.data.item_id,
          publishedUrl: `https://www.douyin.com/video/${data.data.item_id}`,
        };
      } else if (data.error_code) {
        return {
          success: false,
          errorMessage: `Publish failed: ${data.error_code.description}`,
        };
      } else {
        return {
          success: false,
          errorMessage: "Publish failed: Unknown error",
        };
      }
    } catch (error) {
      return {
        success: false,
        errorMessage: `Network error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }
}

/**
 * Get Douyin OAuth URL
 */
export function getDouyinOAuthUrl(appId: string, redirectUri: string, state?: string): string {
  const scope = "video.create,item.comment";
  return `https://developer.toutiao.com/api/apps/v2/oauth/authorize?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${state || ""}`;
}

/**
 * Exchange authorization code for access token
 */
export async function getDouyinAccessToken(
  appId: string,
  appSecret: string,
  code: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; openId: string } | null> {
  const url = `https://developer.toutiao.com/api/apps/v2/token`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_id: appId,
        secret: appSecret,
        code,
        grant_type: "authorization_code",
      }),
    });

    const data = await response.json();

    if (data.error_code && data.error_code.code !== 0) {
      console.error("Douyin OAuth token error:", data.error_code.description);
      return null;
    }

    return {
      accessToken: data.data.access_token,
      refreshToken: data.data.refresh_token,
      expiresIn: data.data.expires_in,
      openId: data.data.open_id,
    };
  } catch (error) {
    console.error("Douyin OAuth error:", error);
    return null;
  }
}
