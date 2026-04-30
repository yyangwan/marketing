/**
 * Weibo Publisher
 * Phase 1F: Real Publishing Integration
 *
 * Weibo API documentation:
 * https://open.weibo.com/wiki/%E5%BE%AE%E5%8D%9AAPI
 */

import { BasePlatformPublisher, PlatformCredentials, PublishOptions, PublishResult } from "./base";

export interface WeiboCredentials extends PlatformCredentials {
  appId: string;  // App Key
  appSecret: string;  // App Secret
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
}

export interface WeiboUploadResponse {
  code: number;
  msg: string;
  data?: {
    image_id: string;
    url: string;
  };
}

export interface WeiboStatusUpdateResponse {
  code: number;
  msg: string;
  data?: {
    id: string;
    text: string;
    created_at: string;
  };
}

export class WeiboPublisher extends BasePlatformPublisher {
  protected credentials: WeiboCredentials;

  constructor(credentials: WeiboCredentials) {
    super(credentials);
    this.credentials = credentials;
  }

  protected getApiBaseUrl(): string {
    return "https://api.weibo.com/2";
  }

  /**
   * Weibo access tokens are long-lived (typically 30+ days)
   * For this implementation, we'll use the existing token
   * In production, you'd implement token refresh via OAuth flow
   */
  protected async refreshAccessToken(): Promise<string | null> {
    // Weibo token refresh requires user interaction
    // Return existing token if still valid
    if (this.credentials.accessToken) {
      if (this.credentials.tokenExpiresAt) {
        const now = new Date();
        const expiryTime = new Date(this.credentials.tokenExpiresAt);
        if (expiryTime > now) {
          return this.credentials.accessToken;
        }
      }
    }
    return null;
  }

  /**
   * Upload an image to Weibo
   */
  private async uploadImage(imageUrl: string, accessToken: string): Promise<string | null> {
    // Fetch the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return null;
    }

    const blob = await imageResponse.blob();

    // Upload to Weibo
    const formData = new FormData();
    formData.append("image", blob, "image.jpg");

    const uploadUrl = `${this.getApiBaseUrl()}/statuses/upload.json?access_token=${accessToken}`;

    try {
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });

      const data: WeiboUploadResponse = await uploadResponse.json();

      if (data.code === 0 && data.data) {
        return data.data.image_id;
      }

      console.error("Weibo image upload failed:", data.msg);
      return null;
    } catch (error) {
      console.error("Weibo image upload error:", error);
      return null;
    }
  }

  /**
   * Publish a status update to Weibo
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

    // Upload images if provided
    const imageIds: string[] = [];
    if (options.images && options.images.length > 0) {
      for (const imageUrl of options.images) {
        const imageId = await this.uploadImage(imageUrl, accessToken);
        if (imageId) {
          imageIds.push(imageId);
        }
      }
    }

    // Build status update
    // Weibo posts are limited to 140 Chinese characters for basic text
    // Images can be attached separately
    let statusText = `${options.title}\n\n${options.content}`;

    // Truncate if too long (Weibo limit is approximately 140 Chinese characters)
    const maxLength = 280;  // Approximate for mixed content
    if (statusText.length > maxLength) {
      statusText = statusText.slice(0, maxLength - 3) + "...";
    }

    const updateUrl = `${this.getApiBaseUrl()}/statuses/update.json?access_token=${accessToken}`;

    try {
      const formData = new FormData();
      formData.append("status", statusText);

      // Add images if available
      if (imageIds.length > 0) {
        formData.append("pic_id", imageIds[0]);  // Primary image
        if (imageIds.length > 1) {
          formData.append("pic_ids", imageIds.join(","));
        }
      }

      const updateResponse = await fetch(updateUrl, {
        method: "POST",
        body: formData,
      });

      const data: WeiboStatusUpdateResponse = await updateResponse.json();

      if (data.code === 0 && data.data) {
        return {
          success: true,
          platformPostId: data.data.id,
          publishedUrl: `https://weibo.com/${data.data.id}`,
        };
      } else {
        return {
          success: false,
          errorMessage: `Publish failed: ${data.msg}`,
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
 * Get Weibo OAuth URL for user authorization
 */
export function getWeiboOAuthUrl(appId: string, redirectUri: string, state?: string): string {
  return `https://api.weibo.com/oauth2/authorize?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${state || ""}`;
}

/**
 * Exchange authorization code for access token
 */
export async function getWeiboAccessToken(
  appId: string,
  appSecret: string,
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; expiresIn: number; uid: string } | null> {
  const url = `https://api.weibo.com/oauth2/access_token?client_id=${appId}&client_secret=${appSecret}&grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  try {
    const response = await fetch(url, {
      method: "POST",
    });

    const data = await response.json();

    if (data.error_code) {
      console.error("Weibo OAuth token error:", data.error);
      return null;
    }

    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
      uid: data.uid,
    };
  } catch (error) {
    console.error("Weibo OAuth error:", error);
    return null;
  }
}
