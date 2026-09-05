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
