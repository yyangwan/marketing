import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { TemplatesClient } from "@/components/templates-client";

export default async function TemplatesPage() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    redirect("/login");
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-semibold text-foreground tracking-tight mb-2">
        AI 模板库
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        创建和管理可复用的 AI 内容生成模板。使用变量让模板更灵活。
      </p>

      <TemplatesClient workspaceId={session.user.workspaceId} />
    </div>
  );
}
