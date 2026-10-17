import { describe, expect, it } from "vitest";
import fixture from "../../../contracts/fixtures/evidence-brief-v2-valid.json";
import { checkedEvidenceBrief, evidenceToGenerationInput } from "./evidence-v2";

describe("evidence Brief v2", () => {
  const checked = (value: unknown) => checkedEvidenceBrief(value, "p1", "2".repeat(32), Date.parse("2026-10-14T00:00:00Z"));
  it("retains approved scopes and distinguishes AI platform from channel", () => {
    const brief = checked(fixture);
    const input = evidenceToGenerationInput(brief)!;
    expect(input.platforms).toEqual(["wechat"]);
    expect(input.keyPoints[0]).toContain("中国大陆X系列产品");
    expect(brief.aiTargets[0].platform).toBe("qwen");
  });
  it("never falls back from a website task to automatic generation", () => {
    const brief = checked({ ...fixture, execution: { channel: "website", mode: "manual_task" } });
    expect(evidenceToGenerationInput(brief)).toBeNull();
    expect(() => checked({ ...fixture, execution: { channel: "website", mode: "generate_draft" } })).toThrow();
  });
  it("rejects scope, expired authorization and extra fields", () => {
    expect(() => checked({ ...fixture, projectId: "p2" })).toThrow();
    expect(() => checked({ ...fixture, approval: { ...fixture.approval, expiresAt: "2020-01-01T00:00:00Z" } })).toThrow();
    expect(() => checked({ ...fixture, injectedClaim: "fake" })).toThrow();
  });
});
