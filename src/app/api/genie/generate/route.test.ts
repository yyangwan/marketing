import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

vi.mock("@/lib/db", () => ({
  prisma: {
    project: {
      findFirst: vi.fn(),
    },
    genieSource: {
      findMany: vi.fn(),
    },
    contentPiece: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/config", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/auth/workspace", () => ({
  getCurrentWorkspace: vi.fn(),
}));

vi.mock("@/lib/genie/generator", () => ({
  generateContentIdeasFromSources: vi.fn(),
  ideasToContentPieces: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";

describe("/api/genie/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects generate requests that specify a different workspace id", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws-1", role: "owner" });

    const response = await POST({
      json: async () => ({
        workspaceId: "ws-2",
        projectId: "project-1",
      }),
    } as Request);

    expect(response.status).toBe(403);
    expect(prisma.project.findFirst).not.toHaveBeenCalled();
  });

  it("scopes draft history to projects in the current workspace", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws-1", role: "owner" });
    (prisma.project.findFirst as any).mockResolvedValue({ id: "project-1", workspaceId: "ws-1" });
    (prisma.contentPiece.findMany as any).mockResolvedValue([]);

    const response = await GET(
      { url: "http://localhost:3000/api/genie/generate?projectId=project-1" } as Request
    );

    expect(response.status).toBe(200);
    expect(prisma.project.findFirst).toHaveBeenCalledWith({
      where: {
        id: "project-1",
        workspaceId: "ws-1",
      },
    });
    expect(prisma.contentPiece.findMany).toHaveBeenCalledWith({
      where: {
        projectId: "project-1",
        status: "genie_draft",
        project: {
          workspaceId: "ws-1",
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
    });
  });
});
