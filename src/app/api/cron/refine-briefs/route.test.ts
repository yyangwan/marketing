import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/content-brief/refinement-worker", () => ({
  runRefinementBatch: vi.fn().mockResolvedValue({
    claimed: 1,
    succeeded: 1,
    fallback: 0,
    retainedOnly: 0,
  }),
}));

import { runRefinementBatch } from "@/lib/content-brief/refinement-worker";

describe("GET /api/cron/refine-briefs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "cron-secret-1");
  });

  it("runs a batch with the correct bearer secret", async () => {
    const res = await GET(
      new Request("http://localhost/api/cron/refine-briefs", {
        headers: { authorization: "Bearer cron-secret-1" },
      }),
    );
    expect(res.status).toBe(200);
    expect(runRefinementBatch).toHaveBeenCalledWith("cron");
    expect((await res.json()).data.claimed).toBe(1);
  });

  it("rejects wrong credentials", async () => {
    const res = await GET(
      new Request("http://localhost/api/cron/refine-briefs", {
        headers: { authorization: "Bearer wrong" },
      }),
    );
    expect(res.status).toBe(401);
    expect(runRefinementBatch).not.toHaveBeenCalled();
  });

  it("returns 500 when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await GET(new Request("http://localhost/api/cron/refine-briefs"));
    expect(res.status).toBe(500);
  });
});
