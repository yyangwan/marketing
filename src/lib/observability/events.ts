/**
 * 结构化事件（设计 §15.1/§15.2）：
 * 只输出关联 ID、状态与错误码，不输出业务正文与提示词。
 */

export type ContentEventName =
  | "content_brief.baseline_created"
  | "content_brief.refinement_started"
  | "content_brief.refinement_succeeded"
  | "content_brief.refinement_fallback"
  | "content_brief.user_updated"
  | "content_workflow.created"
  | "content_workflow.usage_committed"
  | "content_generation.started"
  | "content_generation.succeeded"
  | "content_generation.failed"
  | "content_generation.retried"
  | "content_workflow.completed"
  | "content_usage.reconcile_required"
  | "content_usage.reconciled";

export function emitContentEvent(
  name: ContentEventName,
  fields: Record<string, string | number | boolean | null | undefined>,
): void {
  // 结构化 JSON 行日志：部署侧按 event 字段聚合指标与告警。
  console.log(
    JSON.stringify({
      event: name,
      ts: new Date().toISOString(),
      ...fields,
    })
  );
}
