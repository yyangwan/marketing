import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { prisma } from "@/lib/db";

const GENILINK_JWKS_URL =
  process.env.GENILINK_JWKS_URL || "https://genilink.cn/.well-known/jwks.json";
const GENILINK_ISSUER = process.env.GENILINK_ISSUER || "https://app.genilink.cn";
const SERVICE_AUDIENCE =
  process.env.GENILINK_AUDIENCE || "content.genilink.cn";

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(GENILINK_JWKS_URL));
  }
  return jwks;
}

async function verifyIntegrationToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  try {
    const { payload } = await jwtVerify(authHeader.substring(7), getJWKS(), {
      issuer: GENILINK_ISSUER,
      audience: SERVICE_AUDIENCE,
    });
    return {
      sub: payload.sub!,
      workspaceId: payload.wid as string | undefined,
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const claims = await verifyIntegrationToken(request);
  if (!claims?.workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = claims.workspaceId;
  const [totalContent, publishedContent, recentContent, qualityAgg] =
    await Promise.all([
      prisma.contentPiece.count({ where: { workspaceId } }),
      prisma.platformContent.count({
        where: {
          contentPiece: { workspaceId },
          status: "published",
        },
      }),
      prisma.contentPiece.findMany({
        where: { workspaceId },
        include: {
          platformContents: {
            select: { platform: true },
            take: 1,
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.contentQuality.aggregate({
        _avg: { quality: true },
        where: {
          contentPiece: { workspaceId },
        },
      }),
    ]);

  return NextResponse.json({
    totalContent,
    publishedCount: publishedContent,
    recentContent: recentContent.map((content) => ({
      id: content.id,
      title: content.title,
      projectId: content.projectId,
      platform: content.platformContents[0]?.platform || "unknown",
      createdAt: content.createdAt.toISOString(),
    })),
    qualityAvg: qualityAgg._avg?.quality
      ? Math.round(qualityAgg._avg.quality)
      : null,
  });
}
