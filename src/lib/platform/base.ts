/**
 * Base Platform Publisher Interface
 * Phase 1F: Real Publishing Integration
 */

export interface PlatformCredentials {
  appId?: string;
  appSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  extraConfig?: Record<string, unknown>;
}

export interface PublishOptions {
  title: string;
  content: string;
  images?: string[];
  scheduledAt?: Date;
}

export interface PublishResult {
  success: boolean;
  publishedUrl?: string;
  platformPostId?: string;
  errorMessage?: string;
  needsAuth?: boolean;
}

/**
 * Abstract base class for platform publishers
 */
export abstract class BasePlatformPublisher {
  protected credentials: PlatformCredentials;

  constructor(credentials: PlatformCredentials) {
    this.credentials = credentials;
  }

  /**
   * Validate that credentials are present and valid
   */
  protected validateCredentials(): boolean {
    return !!this.credentials.accessToken;
  }

  /**
   * Refresh access token if needed
   */
  protected async refreshTokenIfNeeded(): Promise<string | null> {
    // If there's an access token with no expiry time, use it
    if (this.credentials.accessToken) {
      if (!this.credentials.tokenExpiresAt) {
        // No expiry set - assume token is valid
        return this.credentials.accessToken;
      }

      // Check if token is expired or will expire soon (within 5 minutes)
      const now = new Date();
      const expiryTime = new Date(this.credentials.tokenExpiresAt);
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

      if (expiryTime > fiveMinutesFromNow) {
        // Token is still valid
        return this.credentials.accessToken || null;
      }
    }

    // Token needs refresh - check if we can refresh
    if (!this.credentials.refreshToken) {
      // Can't refresh - try using existing token anyway
      return this.credentials.accessToken || null;
    }

    // Attempt refresh
    return await this.refreshAccessToken();
  }

  /**
   * Refresh the access token - must be implemented by subclass
   */
  protected abstract refreshAccessToken(): Promise<string | null>;

  /**
   * Publish content to the platform - must be implemented by subclass
   */
  abstract publish(options: PublishOptions): Promise<PublishResult>;

  /**
   * Get platform-specific API base URL
   */
  protected abstract getApiBaseUrl(): string;
}
