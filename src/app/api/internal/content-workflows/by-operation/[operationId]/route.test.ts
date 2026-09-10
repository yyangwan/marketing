import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/db";

const OP = "content-workflow:ws-1:" + "a".repeat(64);
const SECRET = "shared-secret-1";

function req(headers: Record<string, string> = {}) {
  return new Request(
    `http://localhost/api/internal/content-workflows/by-operation/${encodeURIComponent(OP)}`,
    { headers },
  );
}

describe("GET /api/internal/content-workflows/by-operation/[operationId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CONTENT_USAGE_CALLBACK_SECRET", SECRET);
  });

  it("returns 503 without the shared secret configured", async () => {
    vi.stubEnv("CONTENT_USAGE_CALLBACK_SECRET", "");
    const res = await GET(req(), { params: Promise.resolve({ operationId: OP }) });
    expect(res.status).toBe(503);
  });

  it("returns 401 on wrong credentials", async () => {
    const res = await GET(req({ authorization: "Bearer nope" }), {
      params: Promise.resolve({ operationId: OP }),
    });
    expect(res.status).toBe(401);
  });

  it("returns workflow reconciliation data for a valid operation", async () => {
    (prisma.contentWorkflow.findUnique as any).mockResolvedValue({
      id: "wf_1",
      status: "generating",
      usageStatus: "committed",
      contentPieceId: "piece_1",
      workspaceId: "ws-1",
      projectId: "project-1",
    });
    const res = await GET(req({ authorization: `Bearer ${SECRET}` }), {
      params: Promise.resolve({ operationId: OP }),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toMatchObject({ status: "generating", usageStatus: "committed" });
    expect(prisma.contentWorkflow.findUnique).toHaveBeenCalledWith({
      where: { usageOperationId: OP },
      select: expect.objectContaining({ usageStatus: true, status: true }),
    });
  });

  it("returns 404 when no workflow matches the operation", async () => {
    (prisma.contentWorkflow.findUnique as any).mockResolvedValue(null);
    const res = await GET(req({ authorization: `Bearer ${SECRET}` }), {
      params: Promise.resolve({ operationId: OP }),
    });
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("WORKFLOW_NOT_FOUND");
  });
});
