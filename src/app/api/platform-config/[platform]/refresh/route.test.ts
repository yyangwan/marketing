import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ "x-genilink-project-id": "project-1" })),
}));

vi.mock("@/lib/auth/service-auth", () => ({
  getServiceSession: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
}));

vi.mock("@/lib/auth/workspace", () => ({ getCurrentWorkspace: vi.fn() }));
vi.mock("@/lib/auth/service-context", () => ({
  getServiceWorkspace: vi.fn().mockResolvedValue({ workspaceId: "workspace-1", projectId: "project-1" }),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    platformApiConfig: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/platform", () => ({
  getPlatformAccessToken: vi.fn(),
  getWeChatClientCredentialToken: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { getPlatformAccessToken, getWeChatClientCredentialToken } from "@/lib/platform";
import { POST } from "./route";

describe("POST /api/platform-config/[platform]/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T02:00:00Z"));
    vi.mocked(prisma.platformApiConfig.findUnique).mockResolvedValue({
      id: "config-1",
      appId: "wechat-app-id",
      appSecret: "wechat-app-secret",
      refreshTokn: null,
    } as never);
  });

  it("uses WeChat client credentials and treats expiresIn as seconds", async () => {
    vi.mocked(getWeChatClientCredentialToken).mockResolvedValue({ accessToken: "fresh-token", expiresIn: 7200 });

    const response = await POST(
      new Request("http://localhost/api/platform-config/wechat/refresh", { method: "POST" }),
      { params: Promise.resolve({ platform: "wechat" }) },
    );

    expect(response.status).toBe(200);
    expect(getWeChatClientCredentialToken).toHaveBeenCalledWith("wechat-app-id", "wechat-app-secret");
    expect(getPlatformAccessToken).not.toHaveBeenCalled();
    expect(prisma.platformApiConfig.update).toHaveBeenCalledWith({
      where: { id: "config-1" },
      data: {
        accessToken: "fresh-token",
        tokenExpiresAt: new Date("2026-09-05T04:00:00Z"),
        lastRefreshedAt: new Date("2026-09-05T02:00:00Z"),
      },
    });
  });
});
