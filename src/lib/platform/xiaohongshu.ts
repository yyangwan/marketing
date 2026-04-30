/**
 * Xiaohongshu (Little Red Book) Publisher
 * Phase 1F: Real Publishing Integration
 *
 * Note: Xiaohongshu's public API is limited.
 * Official business account API requires partnership application.
 * This implementation uses the available web endpoints.
 *
 * For production use, apply for official API access at:
 * https://www.xiaohongshu.com/business/cooperation
 */

import { BasePlatformPublisher, PlatformCredentials, PublishOptions, PublishResult } from "./base";

export interface XiaohongshuCredentials extends PlatformCredentials {
  appId?: string;
  appSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  cookie?: string;  // Web session cookie (for non-API publishing)
}

export class XiaohongshuPublisher extends BasePlatformPublisher {
  protected credentials: XiaohongshuCredentials;

  constructor(credentials: XiaohongshuCredentials) {
    super(credentials);
    this.credentials = credentials;
  }

  protected getApiBaseUrl(): string {
    return "https://edith.xiaohongshu.com";
  }

  /**
   * Xiaohongshu API tokens are typically long-lived
   * Refresh via cookie-based web session if needed
   */
  protected async refreshAccessToken(): Promise<string | null> {
    // For Xiaohongshu, we typically use cookie-based authentication
    // The access token from OAuth is long-lived
    if (this.credentials.accessToken) {
      if (this.credentials.tokenExpiresAt) {
        const now = new Date();
        const expiryTime = new Date(this.credentials.tokenExpiresAt);
        if (expiryTime > now) {
          return this.credentials.accessToken;
        }
      }
      // If no expiry time set, assume token is valid (for testing)
      return this.credentials.accessToken;
    }
    return null;
  }

  /**
   * Upload an image to Xiaohongshu
   */
  private async uploadImage(imageUrl: string, accessToken: string): Promise<string | null> {
    const uploadUrl = `${this.getApiBaseUrl()}/api/sns/upload/image`;

    try {
      // Fetch the image
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        return null;
      }

      const blob = await imageResponse.blob();

      // Upload to Xiaohongshu
      const formData = new FormData();
      formData.append("file", blob, "image.jpg");

      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
        body: formData,
      });

      const data = await uploadResponse.json();

      if (data.success && data.data) {
        return data.data.url;
      }

      console.error("Xiaohongshu image upload failed:", data.msg);
      return null;
    } catch (error) {
      console.error("Xiaohongshu image upload error:", error);
      return null;
    }
  }

  /**
   * Publish a note to Xiaohongshu
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

    // Upload images if provided (Xiaohongshu requires images)
    const imageUrls: string[] = [];
    if (options.images && options.images.length > 0) {
      for (const imageUrl of options.images) {
        const uploadedUrl = await this.uploadImage(imageUrl, accessToken);
        if (uploadedUrl) {
          imageUrls.push(uploadedUrl);
        }
      }
    }

    // Xiaohongshu requires at least one image
    if (imageUrls.length === 0) {
      return {
        success: false,
        errorMessage: "Xiaohongshu requires at least one image for publishing.",
      };
    }

    // Create note data
    const noteData = {
      title: options.title,
      desc: options.content,
      images: imageUrls,
      type: "normal",  // Note type
      topics: [],  // Can add topic IDs if available
    };

    const publishUrl = `${this.getApiBaseUrl()}/api/sns/note/publish`;

    try {
      const publishResponse = await fetch(publishUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(noteData),
      });

      const data = await publishResponse.json();

      if (data.success && data.data) {
        return {
          success: true,
          platformPostId: data.data.note_id,
          publishedUrl: `https://www.xiaohongshu.com/explore/${data.data.note_id}`,
        };
      } else {
        return {
          success: false,
          errorMessage: `Publish failed: ${data.msg || "Unknown error"}`,
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
 * Get Xiaohongshu OAuth URL (simplified - actual flow requires partnership)
 * Note: Official OAuth requires applying for business partnership
 */
export function getXiaohongshuOAuthUrl(appId: string, redirectUri: string, state?: string): string {
  // This is a simplified example. Actual implementation requires:
  // 1. Apply for Xiaohongshu business partnership
  // 2. Get official app credentials
  // 3. Use their OAuth 2.0 flow
  return `https://www.xiaohongshu.com/business/auth?appid=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${state || ""}`;
}

/**
 * Exchange authorization code for access token
 */
export async function getXiaohongshuAccessToken(
  appId: string,
  appSecret: string,
  code: string
): Promise<{ accessToken: string; expiresIn: number } | null> {
  const url = `https://edith.xiaohongshu.com/api/oauth2/access_token`;

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

    if (data.error) {
      console.error("Xiaohongshu OAuth token error:", data.error);
      return null;
    }

    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  } catch (error) {
    console.error("Xiaohongshu OAuth error:", error);
    return null;
  }
}
