import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { ContentEditor } from "@/components/content-editor";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default async function ContentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;
  const piece = await prisma.contentPiece.findUnique({
    where: { id },
    include: { platformContents: true, project: true },
  });

  if (!piece) notFound();

  // Verify workspace ownership
  if (
    !session?.user?.workspaceId ||
    piece.project.workspaceId !== session.user.workspaceId
  ) {
    notFound();
  }

  const brief = JSON.parse(piece.brief);
  const reviewUrl = piece.reviewToken
    ? `${process.env.AUTH_URL || "http://localhost:3000"}/review/${piece.reviewToken}`
    : null;

  return (
    <div className="p-6">
      <div className="mb-4">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors duration-100">
          <ArrowLeft className="w-3.5 h-3.5" />
          返回看板
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground tracking-tight">{piece.title}</h1>
        <div className="mt-2 text-sm text-muted-foreground">
          <span>核心要点：</span>
          {brief.keyPoints?.join(" / ")}
        </div>
      </div>

      <ContentEditor
        contentPieceId={piece.id}
        platforms={piece.platformContents.map((pc) => ({
          platform: pc.platform,
          content: pc.content || "",
          id: pc.id,
          status: pc.status,
        }))}
        initialReviewUrl={reviewUrl}
      />
    </div>
  );
}
