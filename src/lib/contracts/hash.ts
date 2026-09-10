// 稳定 JSON 序列化 + SHA-256 哈希。
// 与 GeniLink Portal src/lib/billing/idempotency.ts 保持逐字符一致，
// 用于跨服务 sourceHash / requestHash 对账（序列化规范化后双方哈希必然相同）。

import crypto from "node:crypto";

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

export function requestHash(body: unknown): string {
  return sha256(stableStringify(body));
}

export function getIdempotencyKey(req: Request): string | null {
  const value = req.headers.get("idempotency-key")?.trim();
  return value ? value : null;
}

export function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
  );
}
