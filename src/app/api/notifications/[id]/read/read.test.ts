import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/db", () => ({
  prisma: {
    notification: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/config", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/auth/workspace", () => ({
  getCurrentWorkspace: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";

describe("/api/notifications/[id]/read", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks a notification as read", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(getCurrentWorkspace).mockReturnValue({
      workspaceId: "ws1",
      role: "member",
    });
    (prisma.notification.findFirst as any).mockResolvedValue({
      id: "n1",
      userId: "user1",
      workspaceId: "ws1",
      isRead: false,
    });
    (prisma.notification.update as any).mockResolvedValue({
      id: "n1",
      userId: "user1",
      workspaceId: "ws1",
      isRead: true,
    });

    const response = await POST({} as Request, {
      params: Promise.resolve({ id: "n1" }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.isRead).toBe(true);
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: "n1" },
      data: { isRead: true },
    });
  });

  it("returns a structured 401 when the user is not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const response = await POST({} as Request, {
      params: Promise.resolve({ id: "n1" }),
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error.code).toBe("missing_session");
  });

  it("returns a structured 403 when no workspace is active", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(getCurrentWorkspace).mockReturnValue(null);

    const response = await POST({} as Request, {
      params: Promise.resolve({ id: "n1" }),
    });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error.code).toBe("no_workspace");
  });

  it("returns a structured 404 when the notification is not visible to the user", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(getCurrentWorkspace).mockReturnValue({
      workspaceId: "ws1",
      role: "member",
    });
    (prisma.notification.findFirst as any).mockResolvedValue(null);

    const response = await POST({} as Request, {
      params: Promise.resolve({ id: "n1" }),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error.code).toBe("notification_not_found");
    expect(data.error.param).toBe("id");
  });

  it("returns a structured 500 when the update fails", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(getCurrentWorkspace).mockReturnValue({
      workspaceId: "ws1",
      role: "member",
    });
    (prisma.notification.findFirst as any).mockResolvedValue({
      id: "n1",
      userId: "user1",
      workspaceId: "ws1",
      isRead: false,
    });
    (prisma.notification.update as any).mockRejectedValue(new Error("DB error"));

    const response = await POST({} as Request, {
      params: Promise.resolve({ id: "n1" }),
    });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error.code).toBe("database_error");
  });
});
