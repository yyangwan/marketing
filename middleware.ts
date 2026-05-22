import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyBearerToken } from "@/lib/auth/genilink";

const GENILINK_URL = process.env.GENILINK_URL || "https://genilink.cn";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public routes — no auth required
  const isPublic =
    pathname.startsWith("/review") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/invites") ||
    pathname.startsWith("/_next") ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/invite") ||
    pathname === "/favicon.ico";

  if (isPublic) return NextResponse.next();

  // Service-to-service: accept Bearer JWT on API routes
  if (pathname.startsWith("/api/")) {
    const bearerToken = req.headers.get("authorization");
    if (bearerToken?.startsWith("Bearer ")) {
      const claims = await verifyBearerToken(req);
      if (!claims) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.next();
    }
  }

  // Check for authjs session token (Edge-compatible — no Prisma needed)
  const sessionToken =
    req.cookies.get("authjs.session-token")?.value ||
    req.cookies.get("__Secure-authjs.session-token")?.value;

  if (!sessionToken) {
    // Redirect to GeniLink SSO
    const ssoUrl = new URL(`${GENILINK_URL}/api/auth/sso`);
    ssoUrl.searchParams.set("service", "content");
    ssoUrl.searchParams.set(
      "redirect_uri",
      `${req.nextUrl.origin}/api/auth/sso/callback`
    );
    return NextResponse.redirect(ssoUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
