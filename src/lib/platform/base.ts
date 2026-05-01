/**
 * Base Platform Publisher Interface
 * Phase 1F: Real Publishing Integration
 */

/**
 * Error types for publish failures
 */
export enum PublishErrorType {
  AUTHENTICATION = "authentication",
  RATE_LIMIT = "rate_limit",
  NETWORK = "network",
  CONTENT = "content",
  UNKNOWN = "unknown",
}

/**
 * Categorized error information
 */
export interface PublishError {
  type: PublishErrorType;
  message: string;
  retryable: boolean;
  retryAfter?: number; // seconds
}

/**
 * Platform credentials configuration
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

/**
 * Categorize an error to determine retry strategy
 */
export function categorizeError(error: string | Error): PublishError {
  const errorMessage = typeof error === "string" ? error : error.message;

  // Authentication errors
  if (
    errorMessage.includes("access token") ||
    errorMessage.includes("unauthorized") ||
    errorMessage.includes("authentication") ||
    errorMessage.includes("401") ||
    errorMessage.includes("invalid credential") ||
    errorMessage.includes("40001") // WeChat invalid credential
  ) {
    return {
      type: PublishErrorType.AUTHENTICATION,
      message: errorMessage,
      retryable: false,
    };
  }

  // Rate limit errors
  if (
    errorMessage.includes("rate limit") ||
    errorMessage.includes("429") ||
    errorMessage.includes("too many requests") ||
    errorMessage.includes("api freq out of limit") ||
    errorMessage.includes("45009") // WeChat rate limit
  ) {
    return {
      type: PublishErrorType.RATE_LIMIT,
      message: errorMessage,
      retryable: true,
      retryAfter: 60, // Default 60 seconds
    };
  }

  // Network errors
  if (
    errorMessage.includes("network") ||
    errorMessage.includes("timeout") ||
    errorMessage.includes("ECONNREFUSED") ||
    errorMessage.includes("ETIMEDOUT") ||
    errorMessage.includes("ENOTFOUND") ||
    errorMessage.includes("fetch failed")
  ) {
    return {
      type: PublishErrorType.NETWORK,
      message: errorMessage,
      retryable: true,
    };
  }

  // Content validation errors
  if (
    errorMessage.includes("invalid content") ||
    errorMessage.includes("content too long") ||
    errorMessage.includes("validation") ||
    errorMessage.includes("content required") ||
    errorMessage.includes("40015") // WeChat invalid content length
  ) {
    return {
      type: PublishErrorType.CONTENT,
      message: errorMessage,
      retryable: false,
    };
  }

  // Unknown errors - assume retryable
  return {
    type: PublishErrorType.UNKNOWN,
    message: errorMessage,
    retryable: true,
  };
}
