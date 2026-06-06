import { jwtVerify, createRemoteJWKSet } from "jose";
import { NextRequest } from "next/server";

const GENILINK_JWKS_URL = process.env.GENILINK_JWKS_URL || "https://genilink.cn/.well-known/jwks.json";
const GENILINK_ISSUER = process.env.GENILINK_ISSUER || "https://app.genilink.cn";
const SERVICE_AUDIENCE = process.env.GENILINK_AUDIENCE || "content.genilink.cn";

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(GENILINK_JWKS_URL));
  }
  return jwks;
}

export interface GeniLinkClaims {
  sub: string;       // GeniLink user ID
  email?: string;
  name?: string;
  wid?: string;      // workspace ID
  pid?: string;      // project ID
  bid?: string;      // brand ID
  role?: string;
  scope?: "workspace" | "project";
}

/**
 * Verify a GeniLink-issued RS256 JWT against the JWKS endpoint.
 */
export async function verifyGeniLinkToken(token: string): Promise<GeniLinkClaims> {
  const { payload } = await jwtVerify(token, getJWKS(), {
    issuer: GENILINK_ISSUER,
    audience: SERVICE_AUDIENCE,
  });

  return {
    sub: payload.sub!,
    email: payload.email as string | undefined,
    name: payload.name as string | undefined,
    wid: payload.wid as string | undefined,
    pid: payload.pid as string | undefined,
    bid: payload.bid as string | undefined,
    role: payload.role as string | undefined,
    scope: payload.scope as "workspace" | "project" | undefined,
  };
}

/**
 * Verify Bearer token from an incoming request.
 * Returns claims if valid, null otherwise.
 * Edge-compatible — uses jose, no Prisma.
 */
export async function verifyBearerToken(request: NextRequest): Promise<GeniLinkClaims | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  try {
    return await verifyGeniLinkToken(authHeader.substring(7));
  } catch {
    return null;
  }
}

/**
 * Exchange an authorization code for a GeniLink service JWT.
 */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; claims: GeniLinkClaims }> {
  const genilinkUrl = process.env.GENILINK_URL || "https://genilink.cn";
  const clientSecret = process.env.GENILINK_CLIENT_SECRET;

  if (!clientSecret) {
    throw new Error("GENILINK_CLIENT_SECRET is not configured");
  }

  const res = await fetch(`${genilinkUrl}/api/auth/sso/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      service: "content",
      redirect_uri: redirectUri,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  const { access_token } = await res.json();
  const claims = await verifyGeniLinkToken(access_token);

  return { accessToken: access_token, claims };
}
