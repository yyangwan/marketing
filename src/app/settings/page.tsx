import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { SettingsClient } from "@/components/settings-client";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    redirect("/login");
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: session.user.workspaceId },
  });

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground tracking-tight mb-6">
        工作空间设置
      </h1>

      <SettingsClient
        workspaceId={session.user.workspaceId}
        workspaceName={workspace?.name || ""}
      />
    </div>
  );
}
