const GENILINK_URL = process.env.GENILINK_URL || "http://localhost:3001";
const APP_URL = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";

export function buildGeniLinkLoginUrl(callbackUrl: string): string {
  const loginUrl = new URL("/auth/login", GENILINK_URL);
  const absoluteCallbackUrl = new URL(callbackUrl, APP_URL).toString();
  loginUrl.searchParams.set("callbackUrl", absoluteCallbackUrl);
  return loginUrl.toString();
}
