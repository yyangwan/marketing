import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { prisma } from "@/lib/db";

const GENILINK_JWKS_URL =
  process.env.GENILINK_JWKS_URL || "https://genilink.cn/.well-known/jwks.json";
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
      issuer: "https://genilink.cn",
      audience: SERVICE_AUDIENCE,
    });
    return {
      sub: payload.sub!,
      email: payload.email as string | undefined,
      name: payload.name as string | undefined,
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const claims = await verifyIntegrationToken(request);
  if (!claims) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find user by genilinkUserId
  const user = await prisma.user.findFirst({
    where: { genilinkUserId: claims.sub },
  });

  if (!user) {
    return NextResponse.json({
      totalContent: 0,
      publishedCount: 0,
      recentContent: [],
      qualityAvg: null,
    });
  }

  // Get workspace for the user
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id },
  });
  if (!membership) {
    return NextResponse.json({
      totalContent: 0,
      publishedCount: 0,
      recentContent: [],
      qualityAvg: null,
    });
  }

  const workspaceId = membership.workspaceId;

  // Run queries in parallel
  const [totalContent, publishedContent, recentContent, qualityAgg] =
    await Promise.all([
      prisma.contentPiece.count({
        where: { project: { workspaceId } },
      }),

      prisma.platformContent.count({
        where: {
          contentPiece: { project: { workspaceId } },
          status: "published",
        },
      }),

      prisma.contentPiece.findMany({
        where: { project: { workspaceId } },
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
          contentPiece: { project: { workspaceId } },
        },
      }),
    ]);

  return NextResponse.json({
    totalContent,
    publishedCount: publishedContent,
    recentContent: recentContent.map((c) => ({
      id: c.id,
      title: c.title,
      platform: c.platformContents[0]?.platform || "unknown",
      createdAt: c.createdAt.toISOString(),
    })),
    qualityAvg: qualityAgg._avg.quality
      ? Math.round(qualityAgg._avg.quality)
      : null,
  });
}
