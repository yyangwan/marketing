import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { ReviewPageClient } from "./review-client";
import type { Platform } from "@/types";
import { PLATFORM_CONFIG } from "@/types";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const piece = await prisma.contentPiece.findUnique({
    where: { reviewToken: token },
    include: {
      platformContents: true,
      reviewComments: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!piece) notFound();

  // Check expiration
  if (piece.reviewExpiresAt && new Date() > piece.reviewExpiresAt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-sm">
          <h1 className="text-lg font-semibold text-foreground mb-2">链接已过期</h1>
          <p className="text-sm text-muted-foreground">
            此审阅链接已过期。请联系您的代理商获取新的链接。
          </p>
        </div>
      </div>
    );
  }

  // Check if already reviewed
  const existingAction = piece.reviewComments.find(
    (c) => c.action === "approved" || c.action === "revision_requested"
  );

  const platforms = piece.platformContents.map((pc) => ({
    platform: pc.platform as Platform,
    label: PLATFORM_CONFIG[pc.platform as Platform]?.label || pc.platform,
    badgeColor: PLATFORM_CONFIG[pc.platform as Platform]?.badgeColor || "",
    content: pc.content || "",
  }));

  return (
    <ReviewPageClient
      title={piece.title}
      platforms={platforms}
      token={token}
      existingAction={existingAction ? { action: existingAction.action, authorName: existingAction.authorName, comment: existingAction.comment || undefined, createdAt: existingAction.createdAt.toISOString() } : null}
    />
  );
}
