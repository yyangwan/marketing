interface SessionLike {
  user?: {
    id?: string;
    workspaceId?: string;
    role?: string;
    [key: string]: unknown;
  };
}

export function getCurrentWorkspace(session: SessionLike | null): {
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

export function requireWorkspace(session: SessionLike | null): {
  workspaceId: string;
  role: string;
} {
  const ws = getCurrentWorkspace(session);
  if (!ws) {
    throw new Error("no_workspace");
  }
  return ws;
}
