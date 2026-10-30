import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth/service-auth", () => ({ getServiceSession: vi.fn().mockResolvedValue({ user: { id: "user" } }) }));
vi.mock("@/lib/auth/service-context", () => ({ getServiceWorkspace: vi.fn().mockResolvedValue({ userId: "user", projectId: "p1", scope: "project" }) }));
import { POST } from "./route";
import fixture from "../../../../../contracts/fixtures/evidence-brief-v3-valid.json";

describe("live evidence preparation", () => {
  beforeEach(() => { vi.stubEnv("CONTENT_EVIDENCE_BRIEF_ENABLED", "true"); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture), { status: 200 }))); });
  const req = (body = { approvalId: fixture.approval.id }) => new Request("http://localhost/api/evidence-briefs/preview", { method: "POST", headers: { "Content-Type": "application/json", "x-visibility-authorization": "Bearer test-visibility-token" }, body: JSON.stringify(body) });
  it("always rereads the authoritative approval before preparation", async () => {
    const response = await POST(req()); expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining(`/draft-approvals/${fixture.approval.id}/brief`), expect.objectContaining({ headers: { Authorization: "Bearer test-visibility-token" } }));
    expect((await response.json()).data.publicationAllowed).toBe(false);
  });
  it("refuses stale authority and browser-provided Brief content", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 409 }));
    expect((await POST(req())).status).toBe(409);
    expect((await POST(req({ approvalId: "2".repeat(32), brief: fixture } as { approvalId: string }))).status).toBe(422);
  });
});
