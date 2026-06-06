interface SessionLike {
  user?: {
    id?: string;
    workspaceId?: string;
    projectId?: string;
    brandId?: string;
    role?: string;
    [key: string]: unknown;
  };
}

export function getCurrentWorkspace(session: SessionLike | null): {
  workspaceId: string;
  projectId?: string;
  brandId?: string;
  role: string;
} | null {
  if (!session?.user?.workspaceId || !session?.user?.role) {
    return null;
  }
  return {
    workspaceId: session.user.workspaceId,
    projectId: session.user.projectId,
    brandId: session.user.brandId,
    role: session.user.role,
  };
}

export function requireWorkspace(session: SessionLike | null): {
  workspaceId: string;
  projectId?: string;
  brandId?: string;
  role: string;
} {
  const ws = getCurrentWorkspace(session);
  if (!ws) {
    throw new Error("no_workspace");
  }
  return ws;
}
