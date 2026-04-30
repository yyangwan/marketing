import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { getPlatformAccessToken } from "@/lib/platform";

/**
 * OAuth Callback Endpoint
 * Handles OAuth callbacks from WeChat, Weibo, Xiaohongshu, Douyin
 *
 * Query params:
 * - platform: "wechat" | "weibo" | "xiaohongshu" | "douyin"
 * - code: authorization code from platform
 * - state: optional state parameter for CSRF protection
 * - redirect_uri: optional override for redirect URI
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform") as "wechat" | "weibo" | "xiaohongshu" | "douyin" | null;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const redirectUri = searchParams.get("redirect_uri");

  if (!platform || !code) {
    return NextResponse.json(
      {
        error: "Missing required parameters: platform and code are required",
      },
      { status: 400 }
    );
  }

  // For OAuth flow, we might not have a session yet
  // In that case, we need to handle authentication differently
  // For now, we'll require a session for security
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  }

  // Get existing platform config
  const config = await prisma.platformApiConfig.findUnique({
    where: {
      workspaceId_platform: {
        workspaceId: ws.workspaceId,
        platform,
      },
    },
  });

  if (!config || !config.appId || !config.appSecret) {
    return NextResponse.json(
      {
        error: "Platform not configured. Please set up appId and appSecret first.",
      },
      { status: 400 }
    );
  }

  try {
    // Exchange code for access token
    const tokenResult = await getPlatformAccessToken(
      platform,
      config.appId!,
      config.appSecret!,
      code,
      redirectUri || undefined
    );

    if (!tokenResult) {
      return NextResponse.json(
        {
          error: "Failed to exchange authorization code for access token",
        },
        { status: 500 }
      );
    }

    // Calculate token expiration (default 30 days if not specified)
    const expiresIn = tokenResult.expiresIn || 30 * 24 * 60 * 60 * 1000;
    const tokenExpiresAt = new Date(Date.now() + expiresIn);

    // Update config with access token
    const updatedConfig = await prisma.platformApiConfig.update({
      where: {
        workspaceId_platform: {
          workspaceId: ws.workspaceId,
          platform,
        },
      },
      data: {
        accessToken: tokenResult.accessToken,
        ...(tokenResult.refreshToken && { refreshTokn: tokenResult.refreshToken }),
        tokenExpiresAt,
        lastRefreshedAt: new Date(),
      },
    });

    // If redirect_uri was provided, redirect to success page
    if (redirectUri) {
      const successUrl = new URL(redirectUri);
      successUrl.searchParams.set("platform", platform);
      successUrl.searchParams.set("status", "success");
      return NextResponse.redirect(successUrl.toString());
    }

    return NextResponse.json({
      success: true,
      platform,
      config: {
        id: updatedConfig.id,
        platform: updatedConfig.platform,
        hasAccessToken: !!updatedConfig.accessToken,
        tokenExpiresAt: updatedConfig.tokenExpiresAt,
        lastRefreshedAt: updatedConfig.lastRefreshedAt,
      },
    });
  } catch (error) {
    console.error("OAuth callback error:", error);

    if (redirectUri) {
      const errorUrl = new URL(redirectUri);
      errorUrl.searchParams.set("platform", platform);
      errorUrl.searchParams.set("status", "error");
      errorUrl.searchParams.set("message", "OAuth callback failed");
      return NextResponse.redirect(errorUrl.toString());
    }

    return NextResponse.json(
      {
        error: "OAuth callback failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Get OAuth URL for a platform
 *
 * Query params:
 * - platform: "wechat" | "weibo" | "xiaohongshu" | "douyin"
 * - redirect_uri: where to redirect after OAuth
 * - state: optional state parameter
 */
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform") as "wechat" | "weibo" | "xiaohongshu" | "douyin" | null;
  const redirectUri = searchParams.get("redirect_uri");
  const stateParam = searchParams.get("state");

  if (!platform || !redirectUri) {
    return NextResponse.json(
      {
        error: "Missing required parameters: platform and redirect_uri are required",
      },
      { status: 400 }
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  }

  // Get existing platform config
  const config = await prisma.platformApiConfig.findUnique({
    where: {
      workspaceId_platform: {
        workspaceId: ws.workspaceId,
        platform,
      },
    },
  });

  if (!config || !config.appId) {
    return NextResponse.json(
      {
        error: "Platform not configured. Please set up appId first.",
      },
      { status: 400 }
    );
  }

  try {
    // Get OAuth URL for the platform
    const { getPlatformOAuthUrl } = await import("@/lib/platform");
    const oauthUrl = getPlatformOAuthUrl(platform, config.appId!, redirectUri, stateParam || undefined);

    return NextResponse.json({
      platform,
      oauthUrl,
    });
  } catch (error) {
    console.error("OAuth URL generation error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate OAuth URL",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
