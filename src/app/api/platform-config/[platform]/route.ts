import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServiceSession } from "@/lib/auth/service-auth";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { getServiceWorkspace } from "@/lib/auth/service-context";
import type { Platform } from "@/types";
import { getPlatformConfigKey, getPlatformConfigScope } from "@/lib/platform/config-scope";

/**
 * GET /api/platform-config/[platform]
 * Get platform configuration for a workspace
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  const session = await getServiceSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const ws = (await headers()).get("x-genilink-project-id") ? await getServiceWorkspace() : getCurrentWorkspace(session);
  if (!ws) {
    return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  }

  const { platform } = await params;
  const validatedPlatform = platform as Platform;
  const configKey = getPlatformConfigKey(ws, session.user.id, validatedPlatform);

  const config = await prisma.platformApiConfig.findUnique({
    where: {
      workspaceId_projectId_userId_platform: configKey,
    },
  });

  // Don't expose sensitive secrets
  const sanitizedConfig = config
    ? {
        id: config.id,
        platform: config.platform,
        appId: config.appId,
        tokenExpiresAt: config.tokenExpiresAt,
        lastRefreshedAt: config.lastRefreshedAt,
        enabled: config.enabled,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
        // Include whether it has an access token (without exposing it)
        hasAccessToken: !!config.accessToken,
      }
    : null;

  return NextResponse.json({ config: sanitizedConfig });
}

/**
 * POST /api/platform-config/[platform]
 * Create or update platform configuration
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  const session = await getServiceSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const ws = (await headers()).get("x-genilink-project-id") ? await getServiceWorkspace() : getCurrentWorkspace(session);
  if (!ws) {
    return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  }

  const { platform } = await params;
  const validatedPlatform = platform as Platform;
  const configKey = getPlatformConfigKey(ws, session.user.id, validatedPlatform);
  const configScope = getPlatformConfigScope(ws, session.user.id);

  const body = await req.json();
  const { appId, appSecret, accessToken, refreshToken, enabled, extraConfig } = body;

  // Validate required fields based on platform
  if (!appId && (!accessToken || !refreshToken)) {
    return NextResponse.json(
      {
        error: "Either appId or access token is required",
      },
      { status: 400 }
    );
  }

  try {
    const config = await prisma.platformApiConfig.upsert({
      where: {
        workspaceId_projectId_userId_platform: configKey,
      },
      create: {
          ...configScope,
          platform: validatedPlatform,
        appId: appId || null,
        appSecret: appSecret || null,
        accessToken: accessToken || null,
        refreshTokn: refreshToken || null,
        enabled: enabled !== undefined ? enabled : true,
        extraConfig: extraConfig ? JSON.stringify(extraConfig) : null,
      },
      update: {
        ...(appId !== undefined && { appId }),
        ...(appSecret !== undefined && { appSecret }),
        ...(accessToken !== undefined && { accessToken }),
        ...(refreshToken !== undefined && { refreshTokn: refreshToken }),
        ...(enabled !== undefined && { enabled }),
        ...(extraConfig !== undefined && { extraConfig: JSON.stringify(extraConfig) }),
      },
    });

    return NextResponse.json({
      config: {
        id: config.id,
        platform: config.platform,
        appId: config.appId,
        tokenExpiresAt: config.tokenExpiresAt,
        lastRefreshedAt: config.lastRefreshedAt,
        enabled: config.enabled,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
        hasAccessToken: !!config.accessToken,
      },
    });
  } catch (error) {
    console.error("Platform config save error:", error);
    return NextResponse.json(
      {
        error: "Failed to save platform configuration",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/platform-config/[platform]
 * Remove platform configuration
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  const session = await getServiceSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const ws = (await headers()).get("x-genilink-project-id") ? await getServiceWorkspace() : getCurrentWorkspace(session);
  if (!ws) {
    return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  }

  const { platform } = await params;
  const validatedPlatform = platform as Platform;
  const configKey = getPlatformConfigKey(ws, session.user.id, validatedPlatform);

  await prisma.platformApiConfig.delete({
    where: {
      workspaceId_projectId_userId_platform: configKey,
    },
  });

  return NextResponse.json({ success: true });
}

