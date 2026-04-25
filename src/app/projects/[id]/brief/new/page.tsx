import { BriefForm } from "@/components/brief-form";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function NewProjectBriefPage({
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

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-4">
        <Link
          href={`/projects/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors duration-100"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          返回 {project.name}
        </Link>
      </div>
      <h1 className="text-xl font-semibold text-foreground tracking-tight mb-1">
        新建 Brief
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        为项目「{project.name}」创建新内容
      </p>
      <BriefForm projectId={id} />
    </div>
  );
}
