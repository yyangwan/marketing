/**
 * 契约一致性测试（设计 §18）：
 * 1. fixtures 通过/按预期失败于对应 JSON Schema；
 * 2. TS 常量（平台枚举）与 schema enum 一致；
 * 3. contracts/ 目录所有文件的 sha256 与 SCHEMA_HASHES.json 一致
 *    （两仓库文件逐字节一致，清单必须相同 —— 跨仓库防漂移的最低要求）；
 * 4. 平台能力声明与编译期保守快照一致。
 */

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";
import {
  validateBriefV1,
  validateCapabilitiesV1,
  validateCreateBriefRequestV1,
  validateCreateWorkflowRequestV1,
  validateWorkflowViewV1,
} from "@/lib/contracts/validate";
import {
  SUPPORTED_GENERATION_PLATFORMS,
  type ContentCreationBriefV1,
} from "./content-creation-brief-v1";
import { buildUsageOperationId } from "./content-workflow-v1";
import { FALLBACK_CAPABILITIES } from "./content-platform-capabilities-v1";
import { getGenerationCapabilities } from "@/lib/platforms/capabilities";
import briefBaselineValid from "../../contracts/fixtures/brief-baseline-valid.json";
import briefInvalidOutline from "../../contracts/fixtures/brief-invalid-outline.json";
import createBriefRequestValid from "../../contracts/fixtures/create-brief-request-valid.json";
import createWorkflowRequestValid from "../../contracts/fixtures/create-workflow-request-valid.json";
import workflowViewPartial from "../../contracts/fixtures/workflow-view-partial.json";
import capabilitiesValid from "../../contracts/fixtures/capabilities-valid.json";
import workflowSchemaJson from "../../contracts/content-workflow-v1.schema.json";

const CONTRACTS_DIR = join(__dirname, "..", "..", "contracts");

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function listContractFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listContractFiles(full));
    } else if (entry.name !== "SCHEMA_HASHES.json") {
      out.push(full);
    }
  }
  return out;
}

describe("content-creation-brief-v1 contract", () => {
  it("accepts the golden baseline brief fixture", () => {
    const result = validateBriefV1(briefBaselineValid);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("rejects a brief with fewer than 4 outline sections", () => {
    const result = validateBriefV1(briefInvalidOutline);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("outline"))).toBe(true);
  });

  it("accepts the golden create-brief request fixture", () => {
    const result = validateCreateBriefRequestV1(createBriefRequestValid);
    expect(result.ok).toBe(true);
  });

  it("rejects an oversized suggestion text", () => {
    const bad = {
      ...(createBriefRequestValid as { sourceSnapshot: Record<string, unknown> }),
      sourceSnapshot: {
        ...(createBriefRequestValid as { sourceSnapshot: Record<string, unknown> }).sourceSnapshot,
        text: "x".repeat(501),
      },
    };
    const result = validateCreateBriefRequestV1(bad);
    expect(result.ok).toBe(false);
  });

  it("rejects non-http reference URLs in the snapshot", () => {
    const base = createBriefRequestValid as unknown as {
      sourceSnapshot: Record<string, unknown>;
    };
    const bad = {
      ...base,
      sourceSnapshot: { ...base.sourceSnapshot, evidenceSources: ["javascript:alert(1)"] },
    };
    const result = validateCreateBriefRequestV1(bad);
    expect(result.ok).toBe(false);
  });
});

describe("content-workflow-v1 contract", () => {
  it("TS platform constant matches the schema enum", () => {
    const schemaEnum = (
      workflowSchemaJson as unknown as {
        $defs: { platformEnum: { enum: string[] } };
      }
    ).$defs.platformEnum.enum;
    expect(new Set(schemaEnum)).toEqual(new Set(SUPPORTED_GENERATION_PLATFORMS));
    expect(schemaEnum).toHaveLength(4);
  });

  it("accepts the golden create-workflow request fixture", () => {
    const result = validateCreateWorkflowRequestV1(createWorkflowRequestValid);
    expect(result.ok).toBe(true);
  });

  it("rejects unsupported platforms (zhihu) in workflow requests", () => {
    const bad = {
      ...(createWorkflowRequestValid as Record<string, unknown>),
      platforms: ["zhihu"],
    };
    const result = validateCreateWorkflowRequestV1(bad);
    expect(result.ok).toBe(false);
  });

  it("rejects a malformed usageOperationId", () => {
    const bad = {
      ...(createWorkflowRequestValid as Record<string, unknown>),
      usageOperationId: "content-workflow:ws1:not-a-hash",
    };
    const result = validateCreateWorkflowRequestV1(bad);
    expect(result.ok).toBe(false);
  });

  it("buildUsageOperationId output passes schema validation", () => {
    const keyHash = "a".repeat(64);
    const op = buildUsageOperationId("ws_6b0c2d4e5f", keyHash);
    const body = {
      ...(createWorkflowRequestValid as Record<string, unknown>),
      usageOperationId: op,
    };
    expect(validateCreateWorkflowRequestV1(body).ok).toBe(true);
  });

  it("accepts the golden partial workflow view fixture", () => {
    const result = validateWorkflowViewV1(workflowViewPartial);
    expect(result.ok).toBe(true);
  });
});

describe("content-platform-capabilities-v1 contract", () => {
  it("accepts the golden capabilities fixture", () => {
    expect(validateCapabilitiesV1(capabilitiesValid).ok).toBe(true);
  });

  it("runtime capabilities match the compile-time fallback snapshot", () => {
    const caps = getGenerationCapabilities();
    expect(validateCapabilitiesV1(caps).ok).toBe(true);
    expect(caps).toEqual(FALLBACK_CAPABILITIES);
  });

  it("keeps zhihu/toutiao disabled with a machine-readable reason", () => {
    const caps = getGenerationCapabilities();
    expect(caps.platforms.zhihu).toEqual({ enabled: false, reason: "generator_not_implemented" });
    expect(caps.platforms.toutiao).toEqual({ enabled: false, reason: "generator_not_implemented" });
  });
});

describe("contracts directory hash manifest", () => {
  it("SCHEMA_HASHES.json matches the sha256 of every contract file", async () => {
    const manifestPath = join(CONTRACTS_DIR, "SCHEMA_HASHES.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, string>;

    const files = listContractFiles(CONTRACTS_DIR);
    expect(files.length).toBeGreaterThan(0);

    const computed: Record<string, string> = {};
    for (const file of files) {
      computed[relative(CONTRACTS_DIR, file).replace(/\\/g, "/")] = sha256File(file);
    }

    expect(Object.keys(computed).sort()).toEqual(Object.keys(manifest).sort());
    for (const [path, hash] of Object.entries(computed)) {
      expect(manifest[path], `hash mismatch for ${path}`).toBe(hash);
    }
  });

  it("manifest lists the three frozen schemas", () => {
    const manifest = JSON.parse(
      readFileSync(join(CONTRACTS_DIR, "SCHEMA_HASHES.json"), "utf8")
    ) as Record<string, string>;
    for (const name of [
      "content-creation-brief-v1.schema.json",
      "content-workflow-v1.schema.json",
      "content-platform-capabilities-v1.schema.json",
    ]) {
      expect(manifest[name], `${name} missing from manifest`).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
