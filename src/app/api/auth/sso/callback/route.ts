import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/auth/genilink";
import { prisma } from "@/lib/db";
import { signIn } from "@/lib/auth/config";

/**
 * GET /api/auth/sso/callback?code=xxx
 *
 * Called by GeniLink after successful SSO authorization.
 * Exchanges the code for a JWT, auto-provisions the user,
 * and creates a local NextAuth session.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
  }

  const redirectUri = `${req.nextUrl.origin}/api/auth/sso/callback`;

  try {
    const { claims } = await exchangeCodeForToken(code, redirectUri);

    // Auto-provision user: find by genilinkUserId or email
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { genilinkUserId: claims.sub },
          ...(claims.email ? [{ email: claims.email }] : []),
        ],
      },
    });

    if (!user) {
      // Create new user from GeniLink claims
      user = await prisma.user.create({
        data: {
          genilinkUserId: claims.sub,
          email: claims.email || `${claims.sub}@genilink.cn`,
          passwordHash: "", // No local password — auth via GeniLink only
          name: claims.name || "User",
        },
      });
    } else if (!user.genilinkUserId) {
      // Link existing user to GeniLink
      await prisma.user.update({
        where: { id: user.id },
        data: { genilinkUserId: claims.sub },
      });
    }

    // Ensure workspace membership
    if (claims.wid) {
      const existingMembership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            userId: user.id,
            workspaceId: claims.wid,
          },
        },
      });

      if (!existingMembership) {
        // Find or create workspace
        let workspace = await prisma.workspace.findUnique({
          where: { id: claims.wid },
        });
        if (!workspace) {
          workspace = await prisma.workspace.create({
            data: { id: claims.wid, name: `${user.name}'s Workspace` },
          });
        }

        await prisma.workspaceMember.create({
          data: {
            userId: user.id,
            workspaceId: workspace.id,
            role: claims.role || "member",
          },
        });
      }
    }

    // Create local NextAuth session via signIn
    await signIn("credentials", {
      email: user.email,
      password: "__genilink_sso__", // Will be handled by modified credentials provider
      redirect: false,
    });

    // Redirect to dashboard
    const callbackUrl = searchParams.get("state") || "/dashboard";
    return NextResponse.redirect(new URL(callbackUrl, req.url));
  } catch (err) {
    console.error("SSO callback error:", err);
    return NextResponse.redirect(
      new URL(`/login?error=sso_failed`, req.url)
    );
  }
}
