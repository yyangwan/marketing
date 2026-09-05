import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ "x-genilink-project-id": "project-1" })),
}));

vi.mock("@/lib/auth/service-auth", () => ({
  getServiceSession: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
}));

vi.mock("@/lib/auth/workspace", () => ({
  getCurrentWorkspace: vi.fn(),
}));

vi.mock("@/lib/auth/service-context", () => ({
  getServiceWorkspace: vi.fn().mockResolvedValue({ workspaceId: "workspace-1", projectId: "project-1" }),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    platformContent: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    contentPiece: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    platformApiConfig: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    publishHistory: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/platform", () => ({
  getWeChatClientCredentialToken: vi.fn(),
  publishToPlatform: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { getWeChatClientCredentialToken, publishToPlatform } from "@/lib/platform";
import { POST } from "./route";

describe("POST /api/publish/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T02:00:00Z"));

    vi.mocked(prisma.platformContent.findUnique).mockResolvedValue({
      id: "platform-content-1",
      contentPieceId: "content-1",
      platform: "wechat",
      content: "Article body",
    } as never);
    vi.mocked(prisma.contentPiece.findUnique).mockResolvedValue({
      id: "content-1",
      workspaceId: "workspace-1",
      projectId: "project-1",
      createdByUserId: "user-1",
      title: "Article title",
    } as never);
    vi.mocked(prisma.platformApiConfig.findUnique).mockResolvedValue({
      id: "config-1",
      enabled: true,
      appId: "wechat-app-id",
      appSecret: "wechat-app-secret",
      accessToken: null,
      refreshTokn: null,
      tokenExpiresAt: null,
    } as never);
    vi.mocked(prisma.platformContent.update).mockResolvedValue({ id: "platform-content-1" } as never);
    vi.mocked(prisma.platformContent.findMany).mockResolvedValue([{ status: "published" }] as never);
  });

  it("obtains and persists a WeChat client-credential token before publishing", async () => {
    vi.mocked(getWeChatClientCredentialToken).mockResolvedValue({ accessToken: "fresh-token", expiresIn: 7200 });
    vi.mocked(publishToPlatform).mockResolvedValue({ success: true, platformPostId: "post-1" });

    const response = await POST(
      new Request("http://localhost/api/publish/platform-content-1", { method: "POST" }),
      { params: Promise.resolve({ id: "platform-content-1" }) },
    );

    expect(response.status).toBe(200);
    expect(getWeChatClientCredentialToken).toHaveBeenCalledWith("wechat-app-id", "wechat-app-secret");
    expect(prisma.platformApiConfig.update).toHaveBeenCalledWith({
      where: { id: "config-1" },
      data: {
        accessToken: "fresh-token",
        tokenExpiresAt: new Date("2026-09-05T04:00:00Z"),
        lastRefreshedAt: new Date("2026-09-05T02:00:00Z"),
      },
    });
    expect(publishToPlatform).toHaveBeenCalledWith(
      "wechat",
      expect.objectContaining({
        accessToken: "fresh-token",
        tokenExpiresAt: new Date("2026-09-05T04:00:00Z"),
      }),
      expect.objectContaining({ title: "Article title", content: "Article body" }),
    );
  });

  it("returns a channel-specific authorization error when WeChat rejects the credentials", async () => {
    vi.mocked(getWeChatClientCredentialToken).mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/publish/platform-content-1", { method: "POST" }),
      { params: Promise.resolve({ id: "platform-content-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "PLATFORM_AUTH_REQUIRED",
      needsAuth: true,
      platform: "wechat",
    });
    expect(publishToPlatform).not.toHaveBeenCalled();
    expect(prisma.publishHistory.create).not.toHaveBeenCalled();
  });
});
