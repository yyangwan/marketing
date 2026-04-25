import { KanbanBoard } from "@/components/kanban-board";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
  });

  if (
    !project ||
    !session?.user?.workspaceId ||
    project.workspaceId !== session.user.workspaceId
  ) {
    notFound();
  }

  const contentCount = await prisma.contentPiece.count({
    where: { projectId: id },
  });

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <Link href="/" className="hover:text-foreground transition-colors duration-100">
            全部内容
          </Link>
          <span>/</span>
          <span className="text-foreground">{project.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">
              {project.name}
            </h1>
            {project.clientName && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {project.clientName}
              </p>
            )}
          </div>
          <Link
            href={`/projects/${id}/brief/new`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity duration-100"
          >
            <Plus className="w-3.5 h-3.5" />
            新建内容
          </Link>
        </div>
      </div>
      <KanbanBoard projectId={id} />
    </div>
  );
}
