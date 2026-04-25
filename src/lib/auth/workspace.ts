import type { Session } from "next-auth";

export function getCurrentWorkspace(session: Session | null): {
  workspaceId: string;
  role: string;
} | null {
  if (!session?.user?.workspaceId || !session?.user?.role) {
    return null;
  }
  return {
    workspaceId: session.user.workspaceId,
    role: session.user.role,
  };
}

export function requireWorkspace(session: Session | null): {
  workspaceId: string;
  role: string;
} {
  const ws = getCurrentWorkspace(session);
  if (!ws) {
    throw new Error("no_workspace");
  }
  return ws;
}
