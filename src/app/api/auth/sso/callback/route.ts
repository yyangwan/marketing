import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/auth/genilink";

const PUBLIC_APP_URL = process.env.AUTH_URL || process.env.NEXTAUTH_URL;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
  }

  try {
    const callbackOrigin = PUBLIC_APP_URL || req.nextUrl.origin;
    await exchangeCodeForToken(code, `${callbackOrigin}/api/auth/sso/callback`);
    return NextResponse.redirect(new URL(searchParams.get("state") || "/", req.url));
  } catch {
    return NextResponse.redirect(new URL("/login?error=sso_failed", req.url));
  }
}
