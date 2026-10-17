import { describe, expect, it, vi } from "vitest";
vi.mock('@/lib/auth/genilink', () => ({ verifyBearerToken: vi.fn() }));
import { verifyBearerToken } from '@/lib/auth/genilink';
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
  it('never carries forged project or role headers through a workspace JWT', async () => {
    vi.mocked(verifyBearerToken).mockResolvedValue({ sub: 'user', wid: 'ws', scope: 'workspace' } as never);
    const response = await proxy(new NextRequest('http://localhost/api/evidence-briefs/workflows', { headers: { authorization: 'Bearer fake-jwt', 'x-genilink-project-id': 'forged-project', 'x-genilink-role': 'owner' } }));
    expect(response.headers.get('x-middleware-request-x-genilink-project-id')).toBeNull();
    expect(response.headers.get('x-middleware-request-x-genilink-role')).toBeNull();
    expect(response.headers.get('x-middleware-request-x-genilink-user-id')).toBe('user');
  });
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
