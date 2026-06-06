import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/auth/genilink";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
  }

  try {
    await exchangeCodeForToken(code, `${req.nextUrl.origin}/api/auth/sso/callback`);
    return NextResponse.redirect(new URL(searchParams.get("state") || "/", req.url));
  } catch {
    return NextResponse.redirect(new URL("/login?error=sso_failed", req.url));
  }
}
