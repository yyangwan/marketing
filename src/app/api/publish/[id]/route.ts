import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPlatformConfigKey } from "@/lib/platform/config-scope";
import { getServiceSession } from "@/lib/auth/service-auth";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { getServiceWorkspace } from "@/lib/auth/service-context";
import type { Platform, PublishResult } from "@/types";
import { getWeChatClientCredentialToken, publishToPlatform } from "@/lib/platform";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServiceSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const ws = (await headers()).get("x-genilink-project-id") ? await getServiceWorkspace() : getCurrentWorkspace(session);
  if (!ws) {
    return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  }

  const { id } = await params;

  const pc = await prisma.platformContent.findUnique({ where: { id } });
  if (!pc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const piece = await prisma.contentPiece.findUnique({
    where: { id: pc.contentPieceId },
    include: {},
  });

  // Verify workspace ownership
  if (!piece || piece.workspaceId !== ws.workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const platform = pc.platform as Platform;
  const title = piece?.title || "Untitled";
  const content = pc.content || "";

  // Get platform API configuration
  const apiConfig = await prisma.platformApiConfig.findUnique({
    where: {
      workspaceId_projectId_userId_platform: getPlatformConfigKey(
        { workspaceId: ws.workspaceId, projectId: piece.projectId },
        piece.createdByUserId,
        platform,
      ),
    },
  });

  if (!apiConfig) {
    return NextResponse.json(
      {
        error: "Platform not configured",
        needsAuth: true,
        platform,
      },
      { status: 400 }
    );
  }

  if (!apiConfig.enabled) {
    return NextResponse.json(
      {
        error: "Platform integration is disabled",
        platform,
      },
      { status: 400 }
    );
  }

  let accessToken = apiConfig.accessToken;
  let tokenExpiresAt = apiConfig.tokenExpiresAt;
  const tokenExpiresSoon = tokenExpiresAt
    ? tokenExpiresAt.getTime() <= Date.now() + 5 * 60 * 1000
    : false;

  if (
    platform === "wechat" &&
    (!accessToken || tokenExpiresSoon) &&
    apiConfig.appId &&
    apiConfig.appSecret
  ) {
    const token = await getWeChatClientCredentialToken(apiConfig.appId, apiConfig.appSecret);
    if (token) {
      accessToken = token.accessToken;
      tokenExpiresAt = new Date(Date.now() + token.expiresIn * 1000);
      await prisma.platformApiConfig.update({
        where: { id: apiConfig.id },
        data: {
          accessToken,
          tokenExpiresAt,
          lastRefreshedAt: new Date(),
        },
      });
    }
  }

  if (!accessToken) {
    return NextResponse.json(
      {
        error: "发布平台授权不可用，请检查凭证或重新授权。",
        code: "PLATFORM_AUTH_REQUIRED",
        needsAuth: true,
        platform,
      },
      { status: 400 }
    );
  }

  try {
    // Prepare publish options
    const publishOptions = {
      title,
      content,
      images: [], // Could be extended to include image uploads
    };

    // Publish to the platform
    const result: PublishResult = await publishToPlatform(platform, {
      appId: apiConfig.appId || undefined,
      appSecret: apiConfig.appSecret || undefined,
      accessToken,
      refreshToken: apiConfig.refreshTokn || undefined,
      tokenExpiresAt: tokenExpiresAt || undefined,
    }, publishOptions);

    // Create publish history record
    await prisma.publishHistory.create({
      data: {
        workspaceId: ws.workspaceId,
        platform,
        platformContentId: id,
        title,
        content,
        status: result.success ? "success" : "failed",
        publishedUrl: result.publishedUrl || null,
        platformPostId: result.platformPostId || null,
        errorMessage: result.errorMessage || null,
        lastAttemptAt: new Date(),
        completedAt: result.success ? new Date() : null,
      },
    });

    if (result.success) {
      // Update platform content with published URL
      const updated = await prisma.platformContent.update({
        where: { id },
        data: {
          status: "published",
          publishedUrl: result.publishedUrl || null,
        },
      });

      // Check if all platform contents are published
      const allPlatformContents = await prisma.platformContent.findMany({
        where: { contentPieceId: pc.contentPieceId },
      });

      const allPublished = allPlatformContents.every((pc) => pc.status === "published");

      if (allPublished) {
        await prisma.contentPiece.update({
          where: { id: pc.contentPieceId },
          data: { status: "published" },
        });
      }

      return NextResponse.json({
        ...updated,
        publishedAt: new Date().toISOString(),
        platformPostId: result.platformPostId,
      });
    } else {
      // Update attempt count on failure
      await prisma.publishHistory.updateMany({
        where: {
          platformContentId: id,
          status: "failed",
        },
        data: {
          attemptCount: { increment: 1 },
        },
      });

      return NextResponse.json(
        {
          error: result.errorMessage || "Publishing failed",
          needsAuth: result.needsAuth || false,
          platform,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Publish error:", error);

    // Log failure in history
    await prisma.publishHistory.create({
      data: {
        workspaceId: ws.workspaceId,
        platform,
        platformContentId: id,
        title,
        content,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        lastAttemptAt: new Date(),
        attemptCount: 1,
      },
    });

    return NextResponse.json(
      {
        error: "Internal server error during publishing",
        platform,
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check publish status
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServiceSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const ws = (await headers()).get("x-genilink-project-id") ? await getServiceWorkspace() : getCurrentWorkspace(session);
  if (!ws) {
    return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  }

  const { id } = await params;

  const pc = await prisma.platformContent.findUnique({
    where: { id },
    include: {
      contentPiece: {
        include: {},
      },
    },
  });

  if (!pc || pc.contentPiece.workspaceId !== ws.workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Get publish history for this content
  const history = await prisma.publishHistory.findMany({
    where: { platformContentId: id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return NextResponse.json({
    platformContent: pc,
    publishHistory: history,
  });
}

