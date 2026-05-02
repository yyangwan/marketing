import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { MembersClient } from "@/components/members-client";

export default async function MembersPage() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    redirect("/login");
  }

  const wsId = session.user.workspaceId;
  const isOwnerOrAdmin = session.user.role === "owner" || session.user.role === "admin";

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: wsId },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { joinedAt: "asc" },
  });

  // Fetch pending invites (only for owner/admin)
  let invites: Array<{
    id: string;
    token: string;
    email: string;
    role: string;
    expiresAt: string;
    createdAt: string;
    isExpired: boolean;
  }> = [];

  if (isOwnerOrAdmin) {
    const rawInvites = await prisma.workspaceInvite.findMany({
      where: { workspaceId: wsId, usedAt: null },
      orderBy: { createdAt: "desc" },
    });
    invites = rawInvites.map((inv) => ({
      id: inv.id,
      token: inv.token,
      email: inv.email,
      role: inv.role,
      expiresAt: inv.expiresAt.toISOString(),
      createdAt: inv.createdAt.toISOString(),
      isExpired: inv.expiresAt < new Date(),
    }));
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground tracking-tight mb-6">
        成员管理
      </h1>
      <MembersClient
        workspaceId={wsId}
        currentUserId={session.user.id}
        currentUserRole={session.user.role || "member"}
        members={members.map((m) => ({
          id: m.id,
          name: m.user.name,
          email: m.user.email,
          role: m.role,
          joinedAt: m.joinedAt.toISOString(),
        }))}
        invites={invites}
      />
    </div>
  );
}
