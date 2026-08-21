import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ "x-genilink-project-id": "project-a" })),
}));

vi.mock("@/lib/auth/service-auth", () => ({
  getServiceSession: vi.fn().mockResolvedValue({ user: { id: "user-a" } }),
}));

vi.mock("@/lib/auth/service-context", () => ({
  getServiceWorkspace: vi.fn().mockResolvedValue({
    workspaceId: "workspace-a",
    projectId: "project-a",
    userId: "user-a",
    role: "owner",
  }),
}));

vi.mock("@/lib/auth/workspace", () => ({ getCurrentWorkspace: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    platformApiConfig: {
      findUnique,
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { GET } from "./route";

describe("platform configuration scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUnique.mockResolvedValue(null);
  });

  it("loads configuration only for the authenticated user and project", async () => {
    const response = await GET(new Request("http://localhost/api/platform-config/wechat"), {
      params: Promise.resolve({ platform: "wechat" }),
    });

    expect(response.status).toBe(200);
    expect(findUnique).toHaveBeenCalledWith({
      where: {
        workspaceId_projectId_userId_platform: {
          workspaceId: "workspace-a",
          projectId: "project-a",
          userId: "user-a",
          platform: "wechat",
        },
      },
    });
  });
});
