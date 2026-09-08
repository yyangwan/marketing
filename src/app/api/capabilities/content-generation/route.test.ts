import { describe, expect, it } from "vitest";
import { GET } from "./route";
import { validateCapabilitiesV1 } from "@/lib/contracts/validate";
import { FALLBACK_CAPABILITIES } from "@/contracts/content-platform-capabilities-v1";

describe("GET /api/capabilities/content-generation", () => {
  it("returns a schema-valid capability document", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(validateCapabilitiesV1(body).ok).toBe(true);
  });

  it("only enables the four implemented platforms", async () => {
    const response = await GET();
    const body = await response.json();

    const enabled = Object.entries(body.platforms as Record<string, { enabled: boolean }>)
      .filter(([, v]) => v.enabled)
      .map(([k]) => k)
      .sort();
    expect(enabled).toEqual(["douyin", "wechat", "weibo", "xiaohongshu"]);
  });

  it("matches the compile-time fallback snapshot", async () => {
    const response = await GET();
    const body = await response.json();
    expect(body).toEqual(FALLBACK_CAPABILITIES);
  });
});
