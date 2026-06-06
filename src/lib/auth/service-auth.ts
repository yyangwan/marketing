import { auth } from "./config";
import { headers } from "next/headers";

/**
 * Get user session from either NextAuth session cookie or injected
 * x-genilink-* headers (service-to-service JWT via middleware).
 *
 * Returns a Session-compatible object so route handlers can drop-in replace
 * `auth()` with `getServiceSession()`.
 */
export async function getServiceSession() {
  // Try NextAuth session first (browser requests)
  try {
    const session = await auth();
    if (session?.user?.id) return session;
  } catch {
    // Fall through to header-based service auth.
  }

  // Fallback: read headers injected by middleware from verified JWT
  let hdrs: Awaited<ReturnType<typeof headers>> | null = null;
  try {
    hdrs = await headers();
  } catch {
    return null;
  }
  const userId = hdrs.get("x-genilink-user-id");
  if (!userId) return null;

  return {
    user: {
      id: userId,
      email: hdrs.get("x-genilink-email") ?? undefined,
      name: hdrs.get("x-genilink-name") ? decodeURIComponent(hdrs.get("x-genilink-name")!) : undefined,
      workspaceId: hdrs.get("x-genilink-workspace-id") ?? undefined,
      projectId: hdrs.get("x-genilink-project-id") ?? undefined,
      brandId: hdrs.get("x-genilink-brand-id") ?? undefined,
      role: hdrs.get("x-genilink-role") ?? undefined,
    },
    expires: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  };
}
