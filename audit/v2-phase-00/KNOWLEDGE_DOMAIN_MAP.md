# Knowledge、Artifact 与 Revision

```text
Tenant → Workspace → Project / ProjectRelation
Workspace → Source → Snapshot → Document → Passage → Evidence
Evidence ← ClaimEvidence → Claim
Evidence → KnowledgeNode / KnowledgeEdge
Artifact → Revision → content_json (blocks、citations、relations)
Artifact → Patch(base_revision_id、operations、ai_validation)
Revision / Source / Knowledge 领域事件 → Outbox → Sync Cursor / Device
```

| 实体 | 状态 | 真实模型及 v2.0 差异 |
| --- | --- | --- |
| Workspace / Project / Relation | implemented | [001_core.sql](../../apps/api/migrations/001_core.sql) 与 [access.ts](../../apps/api/src/domain/access.ts)。Workspace 属租户，成员角色用于访问控制；关联项目在服务端持久化。知识关系是另一层表，建议经过确认才能投影。 |
| Source / Asset / Snapshot / Document | implemented | [002_knowledge.sql](../../apps/api/migrations/002_knowledge.sql)、[004_library.sql](../../apps/api/migrations/004_library.sql) 与 [knowledge.ts](../../apps/api/src/domain/knowledge.ts)。Workspace URL 唯一，源快照含内容哈希和获取时间，Document 含解析版本，Passage 含段落和页码。图片存 Asset 字节及权利元数据，署名/许可随公共来源和图片块持久化。 |
| Evidence | implemented | 绑定 Source、Document、Passage、Snapshot，保留 quote 与 UTF-16 起止偏移、PDF 页码、验证状态。AI 读写检查原文 slice、活动来源、当前快照和项目范围。 [ai-evidence.ts](../../apps/api/src/domain/ai-evidence.ts)。 |
| Claim / 支持关系 | partial | `claims` 保存 statement、scope、状态和版本，`claim_evidence` 保存 Claim/Evidence ID，存在评审和来源撤回联动。独立研究产生正式 Claim ID、初始状态 proposed；文档分析生成的段落仅标记 `ai_claim` 并挂 Evidence ID，未普遍转为 canonical Claim。支持关系尚未统一枚举为直接/部分/矛盾/推导，缺结构化条件、量值、时间等语义字段。 |
| Entity / Event / Relation | implemented | `knowledge_nodes` / `knowledge_edges` 用稳定 ID，节点具类型、版本、可选事件日期与证据。确认边及权限过滤用于投影。Markdown Wiki 双链由 inline 节点 ID 与服务端反链索引支持。 [008_composable_knowledge.sql](../../apps/api/migrations/008_composable_knowledge.sql)、[knowledge.ts](../../apps/api/src/domain/knowledge.ts)。 |
| Artifact / Block / Revision / Patch | implemented | [artifacts.ts](../../apps/api/src/domain/artifacts.ts) 与 [共享契约](../../packages/contracts/src/index.ts)。Block UUID 位于版本 JSON，版本保留父 ID、内容哈希及作者，基线冲突不静默覆盖，AI 采纳复核策略版本、patch hash、证据当前快照及权限。恢复历史写入新版本。 |
| Projection / View | partial | 思维导图、关系图谱、时间线可通过 canonical node/edge ID 共用范围，文档视图编辑可调整筛选或布局。正文 claim、比较表、公式和媒体并未普遍共享一套 canonical claim ID，也没有已验证的 AI 自动生成全套视图、依赖差异自动提案和事实改动联动。 [projection.ts](../../packages/contracts/src/projection.ts)、[artifact-renderer.tsx](../../packages/client/src/workspace/artifact-renderer.tsx)。 |
| 公式、表格、图像 | partial | 结构块含 LaTeX、表格行、图表 series/表格引用、图片 Asset 和署名。输入 HTML/论文摘要仍可把 MathML 上标压平，缺科学计数法尾数/指数结构与论文表格完整语义。 [workspace-blocks.ts](../../packages/contracts/src/workspace-blocks.ts)、[html-text.ts](../../apps/api/src/domain/html-text.ts)。 |
| Export / Sync | implemented | 导出由 [exports.ts](../../apps/api/src/domain/exports.ts) 选定版本，支持 Markdown、HTML、PDF、JSON/归档及权利检查。 [sync.ts](../../apps/api/src/domain/sync.ts) 与 [merge.ts](../../packages/contracts/src/merge.ts) 用基线版本、幂等 mutation、outbox cursor 和三方合并；冲突需显式处理。 |

现有最小风险路径是沿用 Source/Evidence/Claim、Revision 和 Projection IDs，先在 v2.0 建立 Claim 与最终块的可查映射。独立研究自动新建 Artifact 与文档分析需采纳是两套行为，应在 Phase 03 确认审批边界与兼容计划。
