import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { getPlatformAccessToken } from "@/lib/platform";

/**
 * POST /api/platform-config/[platform]/refresh
 * Manually trigger token refresh for a platform
 * Note: This endpoint uses the refresh token to get a new access token
 * If the refresh token is not available, returns an error
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ws = getCurrentWorkspace(session);
  if (!ws) {
    return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  }

  const { platform } = await params;

  // Get platform config
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
      { error: "Platform not configured" },
      { status: 400 }
    );
  }

  // Use refresh token if available, otherwise fall back to client credentials flow
  // For WeChat, we can use app credentials to get a new token
  // For OAuth-based platforms, we need the refresh token
  const code = config.refreshTokn || ""; // Use refresh token as "code" if available

  try {
    // Get new access token
    const tokenData = await getPlatformAccessToken(
      platform as any,
      config.appId,
      config.appSecret,
      code
    );

    if (!tokenData || !tokenData.accessToken) {
      return NextResponse.json(
        { error: "Token refresh failed - no token returned" },
        { status: 500 }
      );
    }

    // Calculate expiry time
    const expiresIn = tokenData.expiresIn || (30 * 24 * 60 * 60 * 1000); // Default 30 days
    const tokenExpiresAt = new Date(Date.now() + expiresIn);

    await prisma.platformApiConfig.update({
      where: { id: config.id },
      data: {
        accessToken: tokenData.accessToken,
        tokenExpiresAt,
        lastRefreshedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      tokenExpiresAt: tokenExpiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    return NextResponse.json(
      { error: "Token refresh failed" },
      { status: 500 }
    );
  }
}
