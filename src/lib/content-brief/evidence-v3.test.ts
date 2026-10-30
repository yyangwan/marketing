import { describe, expect, it } from "vitest";
import fixture from "../../../contracts/fixtures/evidence-brief-v3-valid.json";
import { checkedEvidenceBrief, evidenceToGenerationInput } from "./evidence-v3";
import { requestHash } from "@/lib/contracts/hash";

describe("evidence Brief v3", () => {
  const checked = (value: unknown) => checkedEvidenceBrief(value, "p1", fixture.approval.id, Date.parse("2026-10-26T00:00:00Z"));
  it("retains approved scopes and distinguishes AI platform from channel", () => {
    const brief = checked(fixture);
    const input = evidenceToGenerationInput(brief)!;
    expect(input.platforms).toEqual(["wechat"]);
    expect(input.keyPoints[0]).toContain(fixture.ownFacts[0].scope);
    expect(brief.actionRevision.taskSignature).toBe(requestHash(brief.taskPack));
    expect(brief.aiTargets[0].platform).toBe(fixture.aiTargets[0].platform);
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
  it("retains more than five distinct questions and targets, without promoting diagnostic statements", () => {
    const value = structuredClone(fixture);
    value.taskPack.delivery.questions = Array.from({ length: 8 }, (_, i) => ({ prompt_hash: requestHash([i]), text: `第${i}个完整原问题` }));
    value.taskPack.ai_targets = value.taskPack.delivery.questions.map(q => ({ ...fixture.taskPack.ai_targets[0], prompt_hash: q.prompt_hash }));
    value.aiTargets = value.taskPack.ai_targets.map((row, i) => ({ ...fixture.aiTargets[0], promptHash: row.prompt_hash, prompt: value.taskPack.delivery.questions[i].text }));
    value.actionRevision.taskSignature = requestHash(value.taskPack);
    value.diagnosticContext.observedFacts = ['竞品声称效果翻倍'];
    const brief = checked(value), input = evidenceToGenerationInput(brief)!;
    expect(brief.aiTargets).toHaveLength(8);
    expect(input.notes).toContain('第7个完整原问题');
    expect(input.notes).toContain(brief.taskPack.delivery.outline[0]);
    expect(input.notes).not.toContain('竞品声称效果翻倍');
    expect(input.context?.boundaries?.allowedClaims?.join(' ')).not.toContain('竞品声称效果翻倍');
    value.aiTargets.pop(); expect(() => checked(value)).toThrow('task_targets_incomplete');
  });
  it("rejects changed task signatures, fact sources, selected IDs and foreign evidence", () => {
    const changed = structuredClone(fixture); changed.taskPack.deliverable += '篡改';
    expect(() => checked(changed)).toThrow('task_revision_mismatch');
    const source = structuredClone(fixture); source.ownFacts[0].source.evidence.quote = '未经批准的替换声明';
    expect(() => checked(source)).toThrow();
    const ids = structuredClone(fixture); ids.ownFacts[0].id = 'other';
    expect(() => checked(ids)).toThrow('task_facts_mismatch');
    const foreign = structuredClone(fixture); foreign.ownFacts[0].source.evidence.project_id = 'p2';
    expect(() => checked(foreign)).toThrow('evidence_reference_invalid');
  });
});
