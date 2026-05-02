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

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: session.user.workspaceId },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { joinedAt: "asc" },
  });

  const isOwnerOrAdmin = session.user.role === "owner" || session.user.role === "admin";

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground tracking-tight mb-6">
        工作空间设置
      </h1>

      <SettingsClient
        workspaceId={session.user.workspaceId}
        workspaceName={workspace?.name || ""}
        members={members.map((m) => ({
          id: m.id,
          name: m.user.name,
          email: m.user.email,
          role: m.role,
          joinedAt: m.joinedAt.toISOString(),
        }))}
        isOwnerOrAdmin={isOwnerOrAdmin}
      />
    </div>
  );
}
