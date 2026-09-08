import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, PATCH } from "./route";
import { buildBaselineBrief } from "@/lib/content-brief/baseline-generator";
import type {
  ProjectSnapshotV1,
  VisibilitySuggestionSnapshotV1,
} from "@/contracts/content-creation-brief-v1";
import createBriefRequest from "../../../../../contracts/fixtures/create-brief-request-valid.json";

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

const FIXED_NOW = new Date("2026-09-08T10:00:00.000Z");

const project: ProjectSnapshotV1 = {
  schemaVersion: 1,
  projectId: "project-1",
  name: "云途科技",
  industry: "企业服务",
  productName: "云途助手",
  productKeywords: ["AI 搜索优化"],
  productDescription: "云途助手帮助企业追踪并优化品牌在 AI 搜索场景下的表现。",
};

function buildRow(overrides: Record<string, unknown> = {}) {
  const baseline = buildBaselineBrief({
    briefId: "brief_1",
    workspaceId: "ws-1",
    projectId: "project-1",
    snapshot: createBriefRequest.sourceSnapshot as VisibilitySuggestionSnapshotV1,
    projectSnapshot: project,
    sourceHash: "a".repeat(64),
    now: FIXED_NOW,
  });
  return {
    id: "brief_1",
    workspaceId: "ws-1",
    projectId: "project-1",
    createdByUserId: "test-user-id",
    schemaVersion: 1,
    revision: 1,
    status: "baseline_ready",
    sourceType: "visibility_suggestion",
    sourceSuggestionId: "154",
    sourceHash: "a".repeat(64),
    sourceSnapshot: JSON.stringify(createBriefRequest.sourceSnapshot),
    projectSnapshot: JSON.stringify(project),
    baselineBrief: JSON.stringify(baseline),
    refinedCandidate: null,
    effectiveBrief: JSON.stringify(baseline),
    generationMeta: JSON.stringify(baseline.generationMeta),
    idempotencyKey: "key-001",
    idempotencyRequestHash: "b".repeat(64),
    refinementStatus: "queued",
    refinementAttempts: 0,
    refinementNextAttemptAt: null,
    refinementLockedBy: null,
    refinementLockedUntil: null,
    refinementLastError: null,
    confirmedAt: null,
    expiresAt: null,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  };
}

function patchReq(body: unknown, headers: Record<string, string> = { "idempotency-key": "key-2" }) {
  return new Request("http://localhost/api/content-briefs/brief_1", {
    method: "PATCH",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("GET /api/content-briefs/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the brief view without the source snapshot", async () => {
    (prisma.contentBrief.findFirst as any).mockResolvedValue(buildRow());
    const res = await GET(new Request("http://localhost/api/content-briefs/brief_1"), {
      params: Promise.resolve({ id: "brief_1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.id).toBe("brief_1");
    expect(body.data.brief.topic).toContain("云途科技");
    expect(body.data.source.suggestionId).toBe("154");
    expect(body.data.sourceSnapshot).toBeUndefined();
    expect(body.data.eligibility.requiresConfirmation).toBe(false);
  });

  it("scopes lookups to the current workspace and project", async () => {
    (prisma.contentBrief.findFirst as any).mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/content-briefs/brief_1"), {
      params: Promise.resolve({ id: "brief_1" }),
    });
    expect(res.status).toBe(404);
    expect(prisma.contentBrief.findFirst).toHaveBeenCalledWith({
      where: { id: "brief_1", workspaceId: "ws-1", projectId: "project-1" },
    });
  });
});

describe("PATCH /api/content-briefs/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("applies an edit with optimistic locking and bumps revision", async () => {
    // 第二次 findFirst 返回 updateMany 实际写入的 effectiveBrief。
    const written = { value: "" as string };
    (prisma.contentBrief.findFirst as any).mockImplementation(async () =>
      written.value
        ? buildRow({ revision: 2, status: "ready", effectiveBrief: written.value })
        : buildRow(),
    );
    (prisma.contentBrief.updateMany as any).mockImplementation(async (args: any) => {
      written.value = args.data.effectiveBrief;
      return { count: 1 };
    });

    const res = await PATCH(
      patchReq({
        expectedRevision: 1,
        editorial: { topic: "更新后的主题", keywords: ["AI 搜索"] },
        selectedPlatforms: ["wechat"],
      }),
      { params: Promise.resolve({ id: "brief_1" }) },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.revision).toBe(2);
    expect(body.data.status).toBe("ready");
    expect(body.data.brief.topic).toBe("更新后的主题");

    const updateArgs = (prisma.contentBrief.updateMany as any).mock.calls[0][0];
    expect(updateArgs.where.revision).toBe(1);
    expect(updateArgs.data.revision).toBe(2);
    const saved = JSON.parse(updateArgs.data.effectiveBrief);
    expect(saved.editorial.topic).toBe("更新后的主题");
    expect(saved.generationMeta.effectiveSource).toBe("user");
    // locked 约束不可被编辑请求覆盖。
    expect(saved.constraints.locked.factualityPolicy).toBe("verified_sources_only");
  });

  it("returns 409 BRIEF_VERSION_CONFLICT with the current revision when stale", async () => {
    (prisma.contentBrief.findFirst as any)
      .mockResolvedValueOnce(buildRow())
      .mockResolvedValueOnce(buildRow({ revision: 5 }));
    (prisma.contentBrief.updateMany as any).mockResolvedValue({ count: 0 });

    const res = await PATCH(
      patchReq({ expectedRevision: 1, editorial: { topic: "过期的编辑" } }),
      { params: Promise.resolve({ id: "brief_1" }) },
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error.code).toBe("BRIEF_VERSION_CONFLICT");
    expect(body.currentRevision).toBe(5);
  });

  it("rejects unsupported platforms in selectedPlatforms with 422", async () => {
    (prisma.contentBrief.findFirst as any).mockResolvedValue(buildRow());
    const res = await PATCH(
      patchReq({ expectedRevision: 1, selectedPlatforms: ["zhihu"] }),
      { params: Promise.resolve({ id: "brief_1" }) },
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("PLATFORM_NOT_SUPPORTED");
  });

  it("rejects edits to archived briefs", async () => {
    (prisma.contentBrief.findFirst as any).mockResolvedValue(buildRow({ status: "archived" }));
    const res = await PATCH(
      patchReq({ expectedRevision: 1, editorial: { topic: "x" } }),
      { params: Promise.resolve({ id: "brief_1" }) },
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("BRIEF_ARCHIVED");
  });

  it("requires an idempotency key", async () => {
    const res = await PATCH(patchReq({ expectedRevision: 1 }, {}), {
      params: Promise.resolve({ id: "brief_1" }),
    });
    expect(res.status).toBe(400);
  });
});
