/**
 * 内容工作流故障停用开关（设计 §20/§21，评审 R7）。
 *
 * `CONTENT_WORKFLOW_DISABLED=true` 时：
 * - 拒绝新提交：Brief 创建、工作流创建、人工重试均返回 503；
 * - 暂停领取：生成与提炼批次（cron 与 inline kick 共同入口）直接空转返回；
 * - 已保存的数据不动，恢复（删除该变量或置 false）后继续。
 */

export function isContentWorkflowDisabled(): boolean {
  return process.env.CONTENT_WORKFLOW_DISABLED === "true";
}

/** 暂停领取时批次的统一返回（不抛错，cron 正常 200）。 */
export function disabledBatchResult<T extends { claimed: number }>(shape: T): T & { disabled: boolean } {
  return { ...shape, claimed: 0, disabled: true };
}
