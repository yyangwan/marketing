import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/db", () => ({
  prisma: {
    contentSchedule: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    contentPiece: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    platformContent: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    platformApiConfig: {
      findUnique: vi.fn(),
    },
    publishHistory: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/platform", () => ({
  getPlatformPublisher: vi.fn(),
}));

vi.mock("@/lib/notifications/trigger", () => ({
  notifyContentStatus: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { getPlatformPublisher } from "@/lib/platform";
import { notifyContentStatus } from "@/lib/notifications/trigger";

function authorizedRequest(secret = "test-secret") {
  const headers = new Headers();
  headers.set("authorization", `Bearer ${secret}`);
  return new Request("http://localhost/api/cron/publish", { headers });
}

describe("/api/cron/publish", () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  afterEach(() => {
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
    }
  });

  it("returns 500 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;

    const response = await GET(new Request("http://localhost/api/cron/publish"));

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe("cron_not_configured");
  });

  it("returns 401 when the authorization header is invalid", async () => {
    const response = await GET(authorizedRequest("wrong-secret"));

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("unauthorized");
  });

  it("returns success when there are no due schedules", async () => {
    (prisma.contentSchedule.findFirst as any).mockResolvedValue(null);

    const response = await GET(authorizedRequest());

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toMatchObject({
      success: true,
      processed: 0,
      published: 0,
      failed: 0,
    });
    expect(prisma.contentSchedule.updateMany).not.toHaveBeenCalled();
  });

  it("publishes claimed content and records publish history", async () => {
    const publisher = {
      publish: vi.fn().mockResolvedValue({
        success: true,
        publishedUrl: "https://example.com/post/1",
        platformPostId: "post-1",
      }),
    };

    (prisma.contentSchedule.findFirst as any)
      .mockResolvedValueOnce({
        id: "schedule1",
        contentId: "content1",
        status: "scheduled",
        scheduledAt: new Date("2026-05-02T08:00:00Z"),
      })
      .mockResolvedValueOnce(null);
    (prisma.contentSchedule.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.contentSchedule.update as any).mockResolvedValue({});
    (prisma.contentPiece.findUnique as any).mockResolvedValue({
      id: "content1",
      title: "Launch update",
      project: { workspaceId: "ws1" },
    });
    (prisma.contentPiece.update as any).mockResolvedValue({});
    (prisma.platformContent.findMany as any).mockResolvedValue([
      {
        id: "pc1",
        platform: "wechat",
        content: "Hello world",
      },
    ]);
    (prisma.platformApiConfig.findUnique as any).mockResolvedValue({
      enabled: true,
      accessToken: "token-1",
      appId: null,
      appSecret: null,
      refreshTokn: null,
      tokenExpiresAt: null,
    });
    (prisma.publishHistory.create as any).mockResolvedValue({
      id: "history1",
      platformContentId: "pc1",
    });
    (prisma.publishHistory.update as any).mockResolvedValue({});
    (prisma.publishHistory.findUnique as any).mockResolvedValue({
      id: "history1",
      platformContentId: "pc1",
    });
    (prisma.platformContent.update as any).mockResolvedValue({});
    vi.mocked(getPlatformPublisher).mockReturnValue(publisher as any);
    vi.mocked(notifyContentStatus).mockResolvedValue(undefined);

    const response = await GET(authorizedRequest());

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toMatchObject({
      success: true,
      processed: 1,
      published: 1,
      failed: 0,
    });
    expect(prisma.contentSchedule.updateMany).toHaveBeenCalledWith({
      where: {
        id: "schedule1",
        status: "scheduled",
      },
      data: { status: "publishing" },
    });
    expect(prisma.contentPiece.update).toHaveBeenNthCalledWith(1, {
      where: { id: "content1" },
      data: { status: "publishing" },
    });
    expect(prisma.contentPiece.update).toHaveBeenNthCalledWith(2, {
      where: { id: "content1" },
      data: { status: "published" },
    });
    expect(getPlatformPublisher).toHaveBeenCalledWith(
      "wechat",
      expect.objectContaining({ accessToken: "token-1" })
    );
    expect(publisher.publish).toHaveBeenCalledWith({
      title: "Launch update",
      content: "Hello world",
      images: [],
    });
    expect(prisma.publishHistory.update).toHaveBeenCalledWith({
      where: { id: "history1" },
      data: expect.objectContaining({
        status: "success",
        publishedUrl: "https://example.com/post/1",
        platformPostId: "post-1",
        attemptCount: 1,
      }),
    });
    expect(prisma.platformContent.update).toHaveBeenCalledWith({
      where: { id: "pc1" },
      data: {
        status: "published",
        publishedUrl: "https://example.com/post/1",
      },
    });
    expect(notifyContentStatus).toHaveBeenCalledWith(
      "content1",
      "published",
      "ws1"
    );
  });

  it("does not mark a successful publish as failed when notifications fail", async () => {
    (prisma.contentSchedule.findFirst as any)
      .mockResolvedValueOnce({
        id: "schedule1",
        contentId: "content1",
        status: "scheduled",
        scheduledAt: new Date("2026-05-02T08:00:00Z"),
      })
      .mockResolvedValueOnce(null);
    (prisma.contentSchedule.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.contentSchedule.update as any).mockResolvedValue({});
    (prisma.contentPiece.findUnique as any).mockResolvedValue({
      id: "content1",
      title: "Launch update",
      project: { workspaceId: "ws1" },
    });
    (prisma.contentPiece.update as any).mockResolvedValue({});
    (prisma.platformContent.findMany as any).mockResolvedValue([]);
    vi.mocked(notifyContentStatus).mockRejectedValue(new Error("notify failed"));

    const response = await GET(authorizedRequest());

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toMatchObject({
      success: true,
      processed: 1,
      published: 1,
      failed: 0,
    });
    expect(prisma.contentSchedule.update).toHaveBeenCalledTimes(1);
    expect(prisma.contentSchedule.update).toHaveBeenCalledWith({
      where: { id: "schedule1" },
      data: expect.objectContaining({ status: "published" }),
    });
    expect(prisma.contentPiece.update).toHaveBeenNthCalledWith(1, {
      where: { id: "content1" },
      data: { status: "publishing" },
    });
    expect(prisma.contentPiece.update).toHaveBeenNthCalledWith(2, {
      where: { id: "content1" },
      data: { status: "published" },
    });
  });

  it("marks the schedule as failed when the content record is missing", async () => {
    (prisma.contentSchedule.findFirst as any)
      .mockResolvedValueOnce({
        id: "schedule1",
        contentId: "content1",
        status: "scheduled",
        scheduledAt: new Date("2026-05-02T08:00:00Z"),
      })
      .mockResolvedValueOnce(null);
    (prisma.contentSchedule.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.contentSchedule.update as any).mockResolvedValue({});
    (prisma.contentPiece.findUnique as any).mockResolvedValue(null);
    (prisma.contentPiece.update as any).mockResolvedValue({});

    const response = await GET(authorizedRequest());

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toMatchObject({
      success: true,
      processed: 1,
      published: 0,
      failed: 1,
    });
    expect(data.errors).toEqual([
      {
        id: "content1",
        title: "content1",
        error: "Content piece not found",
      },
    ]);
    expect(prisma.contentSchedule.update).toHaveBeenCalledWith({
      where: { id: "schedule1" },
      data: { status: "failed" },
    });
    expect(prisma.contentPiece.update).toHaveBeenCalledWith({
      where: { id: "content1" },
      data: { status: "failed" },
    });
    expect(notifyContentStatus).not.toHaveBeenCalled();
  });
});
