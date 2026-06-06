import { headers } from "next/headers";

export type ServiceWorkspaceContext = {
  workspaceId: string;
  projectId?: string;
  brandId?: string;
  userId: string;
  role: string;
  scope?: string;
};

/**
 * Get service-to-service context from verified JWT claims injected by middleware.
 * 智创 no longer resolves workspace through a local Project row.
 */
export async function getServiceWorkspace(): Promise<ServiceWorkspaceContext | null> {
  let hdrs: Awaited<ReturnType<typeof headers>> | null = null;
  try {
    hdrs = await headers();
  } catch {
    return null;
  }

  const userId = hdrs.get("x-genilink-user-id");
  const workspaceId = hdrs.get("x-genilink-workspace-id");
  if (!userId || !workspaceId) return null;

  return {
    userId,
    workspaceId,
    projectId: hdrs.get("x-genilink-project-id") ?? undefined,
    brandId: hdrs.get("x-genilink-brand-id") ?? undefined,
    role: hdrs.get("x-genilink-role") ?? "member",
    scope: hdrs.get("x-genilink-scope") ?? undefined,
  };
}
