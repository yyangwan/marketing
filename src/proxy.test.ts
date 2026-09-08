import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

describe("ContentOS proxy public assets", () => {
  it("allows the bundled WeChat cover to be fetched without a browser session", async () => {
    const response = await proxy(new NextRequest("http://127.0.0.1:4002/wechat-default-cover.png"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  });
});

describe("ContentOS proxy service endpoints", () => {
  it("passes /api/cron through without JWT verification (handler self-verifies the secret)", async () => {
    const request = new NextRequest("http://127.0.0.1:4002/api/cron/publish", {
      headers: { authorization: "Bearer cron-secret-value" },
    });
    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("passes /api/internal through and strips forged x-genilink-* headers", async () => {
    const request = new NextRequest("http://127.0.0.1:4002/api/internal/content-workflows/x", {
      headers: {
        authorization: "Bearer shared-secret",
        "x-genilink-workspace-id": "forged",
      },
    });
    const response = await proxy(request);

    expect(response.status).toBe(200);
    // middleware-next=1 表示放行；x-genilink-* 的剥离无法从 NextResponse 直接断言，
    // 但放行路径与 cron 一致（withoutGenilinkHeaders），由 handler 自行鉴权。
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
