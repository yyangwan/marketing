import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { InviteAcceptForm } from "@/components/invite-accept-form";
import { AlertCircle } from "lucide-react";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invite = await prisma.workspaceInvite.findUnique({
    where: { token },
    include: {
      workspace: { select: { name: true } },
    },
  });

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-sm w-full p-8 text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-foreground">邀请不存在</h1>
          <p className="text-sm text-muted-foreground mt-1">该邀请链接无效</p>
        </div>
      </div>
    );
  }

  if (invite.usedAt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-sm w-full p-8 text-center">
          <AlertCircle className="w-12 h-12 text-amber-600 mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-foreground">邀请已被使用</h1>
          <p className="text-sm text-muted-foreground mt-1">该邀请链接已被使用</p>
        </div>
      </div>
    );
  }

  if (invite.expiresAt < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-sm w-full p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-foreground">邀请链接已过期</h1>
          <p className="text-sm text-muted-foreground mt-1">请联系管理员获取新的邀请链接</p>
        </div>
      </div>
    );
  }

  const inviter = await prisma.workspaceMember.findFirst({
    where: { workspaceId: invite.workspaceId, userId: invite.invitedBy },
    include: { user: { select: { name: true } } },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-semibold text-foreground">
            {inviter?.user.name || "管理员"} 邀请您加入
          </h1>
          <p className="text-xl font-semibold text-primary mt-1">
            {invite.workspace.name}
          </p>
        </div>

        <InviteAcceptForm
          token={token}
          email={invite.email}
          workspaceName={invite.workspace.name}
        />
      </div>
    </div>
  );
}
