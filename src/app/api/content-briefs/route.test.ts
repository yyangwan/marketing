import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";

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

import { prisma } from "@/lib/db";
import createBriefRequest from "../../../../contracts/fixtures/create-brief-request-valid.json";

function postReq(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/content-briefs", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const IDP_HEADERS = { "idempotency-key": "key-001" };

describe("POST /api/content-briefs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a baseline brief and returns 201", async () => {
    (prisma.contentBrief.create as any).mockResolvedValue({
      id: "brief_1",
      projectId: "project-1",
      revision: 1,
      status: "baseline_ready",
      refinementStatus: "queued",
      sourceSuggestionId: "154",
      effectiveBrief: (prisma.contentBrief.create as any).mock.calls?.[0] ?? "",
    });
    // 让 create 返回真实写入的 effectiveBrief：用 mockImplementation 捕获入参。
    (prisma.contentBrief.create as any).mockImplementation(async (args: any) => ({
      id: args.data.id,
      projectId: args.data.projectId,
      revision: 1,
      status: "baseline_ready",
      refinementStatus: "queued",
      sourceSuggestionId: args.data.sourceSuggestionId,
      effectiveBrief: args.data.effectiveBrief,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const res = await POST(postReq(createBriefRequest, IDP_HEADERS));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.meta.replayed).toBe(false);
    expect(body.data.id).toMatch(/^brief_/);
    expect(body.data.revision).toBe(1);
    expect(body.data.status).toBe("baseline_ready");
    expect(body.data.refinement.status).toBe("queued");
    expect(body.data.brief.topic).toContain("示例项目是什么");
    expect(body.data.brief.outline.length).toBeGreaterThanOrEqual(4);
    expect(body.data.eligibility.requiresConfirmation).toBe(false);

    const createArgs = (prisma.contentBrief.create as any).mock.calls[0][0].data;
    expect(createArgs.workspaceId).toBe("ws-1");
    expect(createArgs.projectId).toBe("project-1");
    expect(createArgs.createdByUserId).toBe("test-user-id");
    expect(createArgs.idempotencyKey).toBe("key-001");
    expect(createArgs.sourceHash).toMatch(/^[0-9a-f]{64}$/);
    // 不持久化完整建议正文以外的未知字段：快照来自白名单契约。
    expect(JSON.parse(createArgs.sourceSnapshot).suggestionId).toBe("154");
    // 响应不返回来源快照。
    expect(body.data.sourceSnapshot).toBeUndefined();
  });

  it("rejects missing idempotency key with 400", async () => {
    const res = await POST(postReq(createBriefRequest));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
  });

  it("rejects contract-invalid payloads with 422 SOURCE_PAYLOAD_INVALID", async () => {
    const bad = {
      ...createBriefRequest,
      sourceSnapshot: { ...(createBriefRequest as any).sourceSnapshot, text: "" },
    };
    const res = await POST(postReq(bad, IDP_HEADERS));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("SOURCE_PAYLOAD_INVALID");
    expect(prisma.contentBrief.create).not.toHaveBeenCalled();
  });

  it("rejects technical/ops suggestions with 422 SUGGESTION_NOT_CONTENT_ELIGIBLE", async () => {
    const bad = {
      ...createBriefRequest,
      sourceSnapshot: {
        ...(createBriefRequest as any).sourceSnapshot,
        text: "配置平台授权并绑定账号",
        description: "",
        category: "",
        actionType: "",
        typeTags: [],
      },
    };
    const res = await POST(postReq(bad, IDP_HEADERS));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("SUGGESTION_NOT_CONTENT_ELIGIBLE");
    expect(prisma.contentBrief.create).not.toHaveBeenCalled();
  });

  it("replays the original brief when the same key and body are resubmitted", async () => {
    const uniqueError = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    (prisma.contentBrief.create as any).mockRejectedValue(uniqueError);
    (prisma.contentBrief.findFirst as any).mockResolvedValue({
      id: "brief_existing",
      projectId: "project-1",
      revision: 1,
      status: "baseline_ready",
      refinementStatus: "queued",
      sourceSuggestionId: "154",
      effectiveBrief: "{}",
      idempotencyRequestHash: undefined, // 由下方第二次 mock 返回
    });
    // requestHash 需要真实计算匹配：直接用路由内部相同算法无法在这里算，
    // 因此回放用例通过 create 入参捕获 hash 再返回。
    const capturedHash = { value: "" as string };
    (prisma.contentBrief.create as any).mockImplementation(async (args: any) => {
      capturedHash.value = args.data.idempotencyRequestHash;
      throw uniqueError;
    });
    (prisma.contentBrief.findFirst as any).mockImplementation(async () => ({
      id: "brief_existing",
      projectId: "project-1",
      revision: 2,
      status: "ready",
      refinementStatus: "succeeded",
      sourceSuggestionId: "154",
      effectiveBrief: "{}",
      idempotencyRequestHash: capturedHash.value,
    }));

    const res = await POST(postReq(createBriefRequest, IDP_HEADERS));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta.replayed).toBe(true);
    expect(body.data.id).toBe("brief_existing");
  });

  it("returns 409 IDEMPOTENCY_KEY_REUSED when the same key maps to a different body", async () => {
    const uniqueError = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    (prisma.contentBrief.create as any).mockRejectedValue(uniqueError);
    (prisma.contentBrief.findFirst as any).mockResolvedValue({
      id: "brief_existing",
      idempotencyRequestHash: "0".repeat(64),
    });

    const res = await POST(postReq(createBriefRequest, IDP_HEADERS));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });
});
