# 内容证据合同 v3

正式证据内容路径统一使用 `schemaVersion: 3`，旧v2已替换，无历史迁移或双版本运行。开关仍为 `CONTENT_EVIDENCE_BRIEF_ENABLED=true`；能力接口声明v3及实际生成渠道。四个已实现渠道生成待审草稿，官网/知乎/头条保持人工任务，无自动发布。

`src/lib/content-brief/evidence-v3.ts` 按共享JSON Schema验证，并校验任务key、完整TaskPack哈希、原问题与平台目标一一对应、事实选择顺序、双分支来源、Unicode范围、项目、期限及2MB上限。任务目标不能截断；业务授权仍来自Portal实时回调或持有当前项目权限的审计导出接口，不能接收浏览器自带Brief。

`evidenceToGenerationInput` 只从ownFacts形成keyPoints、allowedClaims和参考URL。任务提纲、验收、材料缺口及全部问题/平台作为范围受限的写作要求；竞品观察、假设、未知与反证保存在冻结的diagnosticContext中，不进入我方允许陈述。来源与问题作为数据，不能覆盖允许事实边界。

工作流冻结完整v3载荷，并在额度提交前和模型调用前重新读取授权、比较完整快照hash。人工任务继续在创建、领取及交付时验证授权；历史读取不声称仍然有当前授权。底层租约、幂等操作、未确定结果处理和额度策略保持原有机制。

共享Schema/fixture与Visibility、Portal逐字节一致，并更新SCHEMA_HASHES.json。fixture里的签名与期限为测试构造，不是可用的真实授权。已记录的合同验证使用测试数据与模拟模型，不替代真实质量验收。2026-10-30 协调发布准备要求先发布本 v3 接收端，再发布审计API/worker及Portal，不能让旧消费者消费新合同；实际 CI、部署及线上核验结果另以发布记录为准。
