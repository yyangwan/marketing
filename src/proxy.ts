import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyBearerToken } from "@/lib/auth/genilink";
import { buildGeniLinkLoginUrl } from "@/lib/auth/genilink-login";

function hasSessionCookie(request: NextRequest): boolean {
  const cookieHeader = request.headers.get("cookie") ?? "";
  return (
    cookieHeader.includes("__Secure-authjs.session-token=") ||
    cookieHeader.includes("authjs.session-token=") ||
    cookieHeader.includes("__Host-authjs.session-token=")
  );
}

function isCalendarFrontendApi(request: NextRequest): boolean {
  const { pathname } = request.nextUrl;
  return (
    (request.method === "GET" && pathname === "/api/calendar/events") ||
    (request.method === "GET" && pathname === "/api/content") ||
    pathname === "/api/briefs" ||
    (request.method === "GET" && pathname === "/api/brand-voices") ||
    (pathname.startsWith("/api/content/") && pathname.endsWith("/schedule"))
  );
}

function withoutGenilinkHeaders(request: NextRequest): Headers {
  const requestHeaders = new Headers(request.headers);
  for (const key of Array.from(requestHeaders.keys())) {
    if (key.toLowerCase().startsWith("x-genilink-")) {
      requestHeaders.delete(key);
    }
  }
  return requestHeaders;
}

function withBrowserWorkspaceContext(request: NextRequest): NextResponse | null {
  if (!hasSessionCookie(request)) {
    return null;
  }

  const workspaceId = request.cookies.get("genilink-workspace")?.value;
  if (!workspaceId) {
    return null;
  }

  const requestHeaders = withoutGenilinkHeaders(request);
  requestHeaders.set("x-genilink-user-id", "browser-session");
  requestHeaders.set("x-genilink-workspace-id", workspaceId);
  requestHeaders.set("x-genilink-role", "member");

  const projectId = request.cookies.get("genilink-project")?.value || "__browser__";
  requestHeaders.set("x-genilink-project-id", projectId);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic =
    pathname.startsWith("/review") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/invites") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/invite") ||
    pathname === "/favicon.ico";

  if (isPublic) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    const bearerToken = request.headers.get("authorization");
    if (bearerToken?.startsWith("Bearer ")) {
      const claims = await verifyBearerToken(request);
      if (!claims) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-genilink-user-id", claims.sub);
      if (claims.email) requestHeaders.set("x-genilink-email", claims.email);
      if (claims.name) requestHeaders.set("x-genilink-name", encodeURIComponent(claims.name));
      if (claims.wid) requestHeaders.set("x-genilink-workspace-id", claims.wid);
      if (claims.pid) requestHeaders.set("x-genilink-project-id", claims.pid);
      if (claims.bid) requestHeaders.set("x-genilink-brand-id", claims.bid);
      if (claims.role) requestHeaders.set("x-genilink-role", claims.role);
      if (claims.scope) requestHeaders.set("x-genilink-scope", claims.scope);

      return NextResponse.next({
        request: { headers: requestHeaders },
      });
    }

    if (isCalendarFrontendApi(request)) {
      const browserWorkspaceResponse = withBrowserWorkspaceContext(request);
      if (browserWorkspaceResponse) {
        return browserWorkspaceResponse;
      }
    }

    return NextResponse.next({
      request: { headers: withoutGenilinkHeaders(request) },
    });
  }

  if (!hasSessionCookie(request)) {
    return NextResponse.redirect(buildGeniLinkLoginUrl(request.nextUrl.href));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
