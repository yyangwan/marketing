/**
 * WeChat Official Account Publisher
 * Phase 1F: Real Publishing Integration
 *
 * WeChat Official Account API documentation:
 * https://developers.weixin.qq.com/doc/offiaccount/OA_Web_Apps/WeChat_webpage_authorization.html
 */

import { BasePlatformPublisher, PlatformCredentials, PublishOptions, PublishResult } from "./base";

export interface WeChatCredentials extends PlatformCredentials {
  appId: string;
  appSecret: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
}

export interface WeChatMediaUploadResponse {
  errcode: number;
  errmsg: string;
  type: string;
  media_id: string;
  created_at: number;
}

export interface WeChatArticlePublishResponse {
  errcode: number;
  errmsg: string;
  media_id?: string;
}

export class WeChatPublisher extends BasePlatformPublisher {
  protected credentials: WeChatCredentials;

  constructor(credentials: WeChatCredentials) {
    super(credentials);
    this.credentials = credentials;
  }

  protected getApiBaseUrl(): string {
    return "https://api.weixin.qq.com/cgi-bin";
  }

  /**
   * Get a new access token from WeChat
   */
  protected async refreshAccessToken(): Promise<string | null> {
    if (!this.credentials.appId || !this.credentials.appSecret) {
      return null;
    }

    const url = `${this.getApiBaseUrl()}/token?grant_type=client_credential&appid=${this.credentials.appId}&secret=${this.credentials.appSecret}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.errcode) {
        console.error("WeChat token refresh failed:", data.errmsg);
        return null;
      }

      return data.access_token;
    } catch (error) {
      console.error("WeChat token refresh error:", error);
      return null;
    }
  }

  /**
   * Upload an image to WeChat media API
   */
  private async uploadImage(imageUrl: string, accessToken: string): Promise<string | null> {
    // First fetch the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return null;
    }

    const blob = await imageResponse.blob();

    // Upload to WeChat
    const formData = new FormData();
    formData.append("media", blob, "image.jpg");
    formData.append("type", "image");

    const uploadUrl = `${this.getApiBaseUrl()}/material/add_material?access_token=${accessToken}&type=image`;

    try {
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });

      const data: WeChatMediaUploadResponse = await uploadResponse.json();

      if (data.errcode === 0) {
        return data.media_id;
      }

      console.error("WeChat image upload failed:", data.errmsg);
      return null;
    } catch (error) {
      console.error("WeChat image upload error:", error);
      return null;
    }
  }

  /**
   * Publish an article to WeChat Official Account
   */
  async publish(options: PublishOptions): Promise<PublishResult> {
    // Get valid access token
    const accessToken = await this.refreshTokenIfNeeded();
    if (!accessToken) {
      return {
        success: false,
        errorMessage: "No valid access token. Please authenticate.",
        needsAuth: true,
      };
    }

    // Upload images if provided
    const mediaIds: string[] = [];
    if (options.images && options.images.length > 0) {
      for (const imageUrl of options.images) {
        const mediaId = await this.uploadImage(imageUrl, accessToken);
        if (mediaId) {
          mediaIds.push(mediaId);
        }
      }
    }

    // Create article data
    const articleData = {
      articles: [
        {
          title: options.title,
          author: "系统发布",  // Can be configurable
          digest: options.content.slice(0, 100),  // Brief description
          content: options.content,
          content_source_url: "",  // Original article URL
          thumb_media_id: mediaIds[0] || "",  // Cover image
          show_cover_pic: mediaIds.length > 0 ? 1 : 0,
          need_open_comment: 1,  // Enable comments
          only_fans_can_comment: 0,  // All users can comment
        },
      ],
    };

    // Add article as draft (we can publish immediately or save as draft)
    const addUrl = `${this.getApiBaseUrl()}/draft/add?access_token=${accessToken}`;

    try {
      const addResponse = await fetch(addUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(articleData),
      });

      const addData: WeChatArticlePublishResponse = await addResponse.json();

      if (addData.errcode === 0) {
        // Success - now publish the draft
        const publishUrl = `${this.getApiBaseUrl()}/freepublish/submit?access_token=${accessToken}`;
        const publishData = {
          media_id: addData.media_id,
        };

        const publishResponse = await fetch(publishUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(publishData),
        });

        const publishResult: WeChatArticlePublishResponse = await publishResponse.json();

        if (publishResult.errcode === 0) {
          return {
            success: true,
            platformPostId: addData.media_id,
            publishedUrl: `https://mp.weixin.qq.com/s/${addData.media_id}`,
          };
        } else {
          return {
            success: false,
            errorMessage: `Publish failed: ${publishResult.errmsg}`,
          };
        }
      } else {
        return {
          success: false,
          errorMessage: `Draft creation failed: ${addData.errmsg}`,
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
 * Get WeChat OAuth URL for user authorization
 */
export function getWeChatOAuthUrl(appId: string, redirectUri: string, state?: string): string {
  const scope = "snsapi_base";  // Basic authorization (no user info needed for publishing)
  return `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${state || ""}#wechat_redirect`;
}

/**
 * Exchange authorization code for access token
 */
export async function getWeChatAccessToken(
  appId: string,
  appSecret: string,
  code: string
): Promise<{ accessToken: string; expiresIn: number } | null> {
  const url = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}&secret=${appSecret}&code=${code}&grant_type=authorization_code`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.errcode) {
      console.error("WeChat OAuth token error:", data.errmsg);
      return null;
    }

    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  } catch (error) {
    console.error("WeChat OAuth error:", error);
    return null;
  }
}
