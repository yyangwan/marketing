import { headers } from "next/headers";
import { prisma } from "@/lib/db";

/**
 * Get workspace context for service-to-service JWT requests.
 * Reads X-ContentOS-Project-Id header, looks up the project's workspaceId.
 * Returns null if not a service request or project not found.
 */
export async function getServiceWorkspace(): Promise<{
  workspaceId: string;
  role: string;
} | null> {
  const hdrs = await headers();
  const projectId = hdrs.get("x-contentos-project-id");
  if (!projectId) return null;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { workspaceId: true },
  });
  if (!project) return null;

  return { workspaceId: project.workspaceId, role: "owner" };
}
