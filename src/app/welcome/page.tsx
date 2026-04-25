import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Circle, Plus } from "lucide-react";

export default async function WelcomePage() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    redirect("/login");
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: session.user.workspaceId },
  });

  const projectCount = await prisma.project.count({
    where: { workspaceId: session.user.workspaceId },
  });

  if (projectCount > 0) {
    redirect("/");
  }

  return (
    <div className="min-h-full flex items-center justify-center bg-background">
      <div className="max-w-md w-full px-8 py-12 text-center">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">
          欢迎来到 {workspace?.name}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          让我们开始设置你的工作空间
        </p>

        {/* 3-step progress */}
        <div className="mt-10 space-y-4 text-left">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
            <span className="text-sm text-foreground">创建工作空间</span>
          </div>
          <div className="flex items-center gap-3">
            <Circle className="w-5 h-5 text-primary shrink-0" />
            <span className="text-sm font-medium text-foreground">创建第一个项目</span>
          </div>
          <div className="flex items-center gap-3">
            <Circle className="w-5 h-5 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground">邀请团队成员</span>
          </div>
        </div>

        <div className="mt-10">
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity duration-100"
          >
            <Plus className="w-4 h-4" />
            创建项目
          </Link>
        </div>
      </div>
    </div>
  );
}
