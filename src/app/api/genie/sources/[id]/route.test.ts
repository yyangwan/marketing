import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "./route";

vi.mock("@/lib/db", () => ({
  prisma: {
    genieSource: {
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

vi.mock("@/lib/genie", () => ({
  fetchURL: vi.fn(),
  analyzeContent: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";

describe("/api/genie/sources/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when the source is outside the current workspace", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws-1", role: "owner" });
    (prisma.genieSource.findFirst as any).mockResolvedValue(null);

    const response = await GET(
      {} as Request,
      { params: Promise.resolve({ id: "source-2" }) }
    );

    expect(response.status).toBe(404);
    expect(prisma.genieSource.findFirst).toHaveBeenCalledWith({
      where: {
        id: "source-2",
        workspaceId: "ws-1",
      },
    });
  });

  it("checks workspace ownership before updating a source", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws-1", role: "owner" });
    (prisma.genieSource.findFirst as any).mockResolvedValue({ id: "source-1", workspaceId: "ws-1" });
    (prisma.genieSource.update as any).mockResolvedValue({ id: "source-1", enabled: false });

    const response = await PUT(
      { json: async () => ({ enabled: false }) } as Request,
      { params: Promise.resolve({ id: "source-1" }) }
    );

    expect(response.status).toBe(200);
    expect(prisma.genieSource.findFirst).toHaveBeenCalledWith({
      where: {
        id: "source-1",
        workspaceId: "ws-1",
      },
    });
    expect(prisma.genieSource.update).toHaveBeenCalledWith({
      where: { id: "source-1" },
      data: expect.objectContaining({ enabled: false }),
    });
  });
});
