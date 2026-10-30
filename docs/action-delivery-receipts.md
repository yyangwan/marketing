# 行动交付来源回执

GET `/api/evidence-briefs/delivery-receipt?kind=content_workflow|manual_content_task&referenceId=...`使用现有ContentOS项目JWT/session，查询范围固定当前workspace/project。开关CONTENT_EVIDENCE_BRIEF_ENABLED关闭时返回503。

工作流只接受succeeded且sourceType=evidence_v3；人工任务只接受completed。解析冻结Brief并核对完整快照哈希后，返回项目、行动、确切修订、原内容授权、快照哈希及完成状态。项目外记录404，不读取浏览器提供的Brief或任意URL。

回执仅表示已完成产物的来源关系，authorization_state=historical_origin_only，publication_allowed=false，content_quality_verified=false。旧授权过期不抹掉已完成产物的来源；`checkedHistoricalBrief`独立于实时`checkedEvidenceBrief`，不能用于新生成。Portal核对回执后签发限定请求的执行声明，审计后端继续核对原授权HMAC、当前行动修订与计划依赖。

此接口不创建内容、推进任务、调用模型或扣额度。是否正式交付和逐项验收由用户在行动中具名决定；不自动发布。此前专项5项及完整检查/构建通过；门户执行局部原型已获确认并接入本地实现。2026-10-30 协调发布仍需本轮检查、PR/CI与线上核验，先发布本接收端，再发布审计API/worker及Portal。Q01/Q02 的真实采集、OSS、独立语义和客户行动价值验收仍未完成，来源回执不能替代这些结论。
