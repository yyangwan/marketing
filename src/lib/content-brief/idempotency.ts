/**
 * Brief 创建幂等（设计 §12.1）：
 * 相同幂等键 + 相同请求哈希 = replay；相同键不同哈希 = 409。
 * Owner 范围 = workspaceId + projectId（数据库唯一约束），读取时再校验用户权限。
 */

export type IdempotencyResolution =
  | { type: "new" }
  | { type: "replay" }
  | { type: "conflict" };

export function resolveIdempotency(params: {
  existingKey: string | null | undefined;
  existingHash: string | null | undefined;
  key: string;
  hash: string;
}): IdempotencyResolution {
  if (!params.existingKey) return { type: "new" };
  if (params.existingKey !== params.key) return { type: "conflict" };
  if (params.existingHash === params.hash) return { type: "replay" };
  return { type: "conflict" };
}
