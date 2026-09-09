/**
 * DB 租约工具（设计 §12.4）：
 * 条件更新领取任务（MySQL 无 SKIP LOCKED，沿用 /api/cron/publish 的
 * findFirst → updateMany 条件更新模式），count===1 才算领取成功。
 */

/** 默认租约 5 分钟；生成期间每 30 秒续租。 */
export const LEASE_DURATION_MS = 5 * 60_000;
export const LEASE_RENEW_INTERVAL_MS = 30_000;

/** 退避间隔加随机抖动（设计 §9.3）。 */
export function withJitter(baseMs: number, ratio = 0.2): number {
  const spread = Math.round(baseMs * ratio);
  return baseMs + Math.floor((Math.random() * 2 - 1) * spread);
}

export function leaseExpiresAt(now: Date): Date {
  return new Date(now.getTime() + LEASE_DURATION_MS);
}

export interface LeaseClaimResult {
  claimed: boolean;
  /** 可用于诊断：候选存在但被其他 worker 抢走。 */
  reason?: "race-lost" | "none";
}
