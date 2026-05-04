import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

vi.mock("@/lib/db", () => ({
  prisma: {
    genieSource: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
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

vi.mock("@/lib/genie/url-fetcher", () => ({
  fetchURL: vi.fn(),
  isContentSubstantial: vi.fn(),
}));

vi.mock("@/lib/genie/analyzer", () => ({
  analyzeContent: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { fetchURL, isContentSubstantial } from "@/lib/genie/url-fetcher";
import { analyzeContent } from "@/lib/genie/analyzer";

describe("/api/genie/sources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes source listings to the current workspace", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws-1", role: "owner" });
    (prisma.genieSource.findMany as any).mockResolvedValue([]);

    const response = await GET(
      { url: "http://localhost:3000/api/genie/sources" } as Request
    );

    expect(response.status).toBe(200);
    expect(prisma.genieSource.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "ws-1",
        enabled: true,
      },
      orderBy: {
        lastAnalyzedAt: "desc",
      },
    });
  });

  it("rejects a mismatched workspace id in the query string", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws-1", role: "owner" });

    const response = await GET(
      { url: "http://localhost:3000/api/genie/sources?workspaceId=ws-2" } as Request
    );

    expect(response.status).toBe(403);
  });

  it("creates sources under the current workspace only", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(getCurrentWorkspace).mockReturnValue({ workspaceId: "ws-1", role: "owner" });
    (prisma.genieSource.findFirst as any).mockResolvedValue(null);
    vi.mocked(fetchURL).mockResolvedValue("source content");
    vi.mocked(isContentSubstantial).mockReturnValue(true);
    vi.mocked(analyzeContent).mockResolvedValue({
      analyzedAt: new Date("2026-05-03T00:00:00.000Z"),
      confidence: 0.91,
      insights: {
        businessType: "SaaS",
        keyProducts: ["Product A"],
        brandTone: "professional",
        targetAudience: "marketers",
        recurringTopics: ["automation"],
      },
    } as never);
    (prisma.genieSource.create as any).mockResolvedValue({ id: "source-1" });

    const response = await POST({
      json: async () => ({
        workspaceId: "ws-1",
        url: "https://example.com/source",
      }),
    } as Request);

    expect(response.status).toBe(200);
    expect(prisma.genieSource.findFirst).toHaveBeenCalledWith({
      where: {
        workspaceId: "ws-1",
        url: "https://example.com/source",
      },
    });
    expect(prisma.genieSource.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "ws-1",
        url: "https://example.com/source",
      }),
    });
  });
});
