# Knowledge Backend 实现盘点

状态说明。已实现表示找到数据表、执行入口及至少一种现有回归或可定位使用路径。部分实现表示产品能力存在，和目标 Harness 合同仍有差距。

| 领域 | 状态 | 数据与执行证据 | 边界 |
| --- | --- | --- | --- |
| Workspace / 身份 | 已实现 | `001_core.sql` 的租户、成员、Workspace，`access.ts::workspace/Workspaces`，`platform/security.ts::authenticate` | Workspace 成员角色为 owner/editor/viewer。外部调用受策略和数据敏感级别控制。 |
| Project / Project Relation | 已实现 | `001_core.sql` 的 projects、project_relations，`Workspaces.relateProjects` | Project 是 Workspace 内的组织及检索范围。关系有方向，显式来源可受允许关系影响，默认语料仅项目与共享范围。 |
| Source / Snapshot | 已实现 | `002_knowledge.sql`、`004_library.sql`，`Knowledge.register/ingest/savePublicMaterial/lifecycle` | 来源带许可、敏感度、状态和最新快照。撤回会影响依赖证据和结论。 |
| Document / Passage | 已实现 | `documents/passages`，`Knowledge.persistDocument`、`parsing.ts::parseDocument` | PDF、OCR、HTML、纯文本、Office 支持已测。文档和片段是来源派生记录。 |
| Asset | 已实现 | `assets`、`010_workspace_assets.sql`，`Knowledge.upload/readAsset`、`platform/objects.ts` | Workspace 内的对象存储及再分发权利与类型检查。可用源材料和可导出文件使用不同门槛。 |
| Evidence | 已实现 | `evidence`，`Knowledge.evidenceIn/createEvidence`、`ai-evidence.ts::readAiEvidence` | 绑定来源、文档、快照、段落、页码或 UTF-16 定位与原文。AI 使用及采纳前可再次验证。 |
| Claim | 部分实现 | `claims/claim_evidence/claim_reviews`，`Library.createClaim/reviewClaim` 与 `Jobs.execute` 的研究写入 | 研究 Claim 以 proposed 写入，人工审阅可改变状态。现有链接尚无逐证据 direct/partial/contradiction/contextual 支持类型。文档分析主张以带引用内容块记录。 |
| Entity / Relation | 已实现 | `knowledge_nodes/knowledge_edges`，`Knowledge.createNode/proposeEdge/reviewEdge/projection` | Entity 以知识节点建模。边可提案和审阅，前端使用同一节点投影呈现关系与时间线。 |
| Artifact / Block / Revision | 已实现 | `artifacts/artifact_revisions/artifact_patches`、`Artifacts.applyPatch/editIn/proposeIn/resolve` | Block 存在修订 JSON。人工和 AI 修改以基线版本处理，带证据的 AI 提案采纳时校验收据。研究完成可直接创建新的研究文档。 |
| Export / Import | 已实现 | `Exports.create`、`Imports.inspect/restore` | Markdown、JSON、PDF、DOCX、SVG、PNG，以及 Workspace ZIP 归档与恢复。实际当前格式与权限以 `exports.ts` 和共享导出合同为准。 |
| Sync | 已实现 | `domain_outbox/devices/idempotency`，`Sync.submit/changes/snapshot/ack` 和共享客户端本地仓储 | 版本、冲突和 cursor 同步现有正式知识对象。Job checkpoint 与将来的 Agent Session 未走这套知识同步。 |
| RAG / 已确认记忆 | 部分实现 | `retrieval.ts::retrievePassages`、`009_embedding_profiles.sql` | 关键词与中文分词、PostgreSQL 全文和可选 pgvector，按模型 profile 匹配，复用有证据的已确认结论及关系。缺少跨主题召回评测基线。 |

官方 Harness 与本项目未来共用的是领域工具合同。当前模型传输层不会提交任意工具调用。研究的领域 SQL 由 Jobs 执行，文档提案和修订由 Artifact 服务执行。将来拆分时需保持现有 ID、权限、修订及同步语义。
