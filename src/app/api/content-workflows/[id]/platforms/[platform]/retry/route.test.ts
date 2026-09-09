import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/db";

vi.mock("@/lib/auth/service-auth", () => ({
  getServiceSession: vi.fn(() =>
    Promise.resolve({ user: { id: "test-user-id", workspaceId: "ws-1" } }),
  ),
}));

vi.mock("@/lib/auth/service-context", () => ({
  getServiceWorkspace: vi.fn(() =>
    Promise.resolve({ workspaceId: "ws-1", projectId: "project-1", userId: "test-user-id", role: "member" }),
  ),
}));

vi.mock("@/lib/auth/workspace", () => ({
  getCurrentWorkspace: vi.fn(() => ({ workspaceId: "ws-1" })),
}));

vi.mock("@/lib/content-workflow/worker", () => ({
  runGenerationBatch: vi.fn().mockResolvedValue({
    claimed: 0,
    succeeded: 0,
    failedRetryable: 0,
    failedTerminal: 0,
    skipped: 0,
  }),
}));

function workflowRow(runs: Array<{ platform: string; status: string; id: string }>) {
  return {
    id: "wf_1",
    workspaceId: "ws-1",
    projectId: "project-1",
    status: "partial",
    runs,
  };
}

function postReq(headers: Record<string, string> = { "idempotency-key": "key-1" }) {
  return new Request(
    "http://localhost/api/content-workflows/wf_1/platforms/xiaohongshu/retry",
    { method: "POST", headers },
  );
}

const PARAMS = Promise.resolve({ id: "wf_1", platform: "xiaohongshu" });

describe("POST /api/content-workflows/[id]/platforms/[platform]/retry（设计 §10.7）", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requeues a failed_retryable run without adding usage", async () => {
    (prisma.contentWorkflow.findFirst as any)
      .mockResolvedValueOnce(
        workflowRow([{ id: "run_xhs", platform: "xiaohongshu", status: "failed_retryable" }]),
      )
      .mockResolvedValue(
        workflowRow([{ id: "run_xhs", platform: "xiaohongshu", status: "queued" }]),
      );
    (prisma.contentGenerationRun.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.contentGenerationRun.findMany as any).mockResolvedValue([
      { platform: "xiaohongshu", status: "queued" },
    ]);
    (prisma.contentWorkflow.updateMany as any).mockResolvedValue({ count: 1 });

    const res = await POST(postReq(), { params: PARAMS });
    const body = await res.json();

    expect(res.status).toBe(202);
    expect(body.data.platforms[0].status).toBe("queued");

    const requeueArgs = (prisma.contentGenerationRun.updateMany as any).mock.calls[0][0];
    expect(requeueArgs.where).toMatchObject({ id: "run_xhs", status: "failed_retryable" });
    expect(requeueArgs.data.status).toBe("queued");
    expect(requeueArgs.data.nextAttemptAt).toBeNull();
  });

  it("refuses to overwrite a succeeded run (409)", async () => {
    (prisma.contentWorkflow.findFirst as any).mockResolvedValue(
      workflowRow([{ id: "run_xhs", platform: "xiaohongshu", status: "succeeded" }]),
    );
    const res = await POST(postReq(), { params: PARAMS });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("RUN_ALREADY_SUCCEEDED");
  });

  it("refuses non-retryable states (409)", async () => {
    (prisma.contentWorkflow.findFirst as any).mockResolvedValue(
      workflowRow([{ id: "run_xhs", platform: "xiaohongshu", status: "failed_terminal" }]),
    );
    const res = await POST(postReq(), { params: PARAMS });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("RUN_NOT_RETRYABLE");
  });

  it("requires an idempotency key", async () => {
    const res = await POST(postReq({}), { params: PARAMS });
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown workflow", async () => {
    (prisma.contentWorkflow.findFirst as any).mockResolvedValue(null);
    const res = await POST(postReq(), { params: PARAMS });
    expect(res.status).toBe(404);
  });
});
