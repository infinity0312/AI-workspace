# 03 --- Domain Model & Artifact Schema

## 1. 核心领域

``` text
Tenant
 └── User / Membership
      └── Workspace
           ├── Projects
           ├── Artifacts
           ├── Sources / Assets
           ├── Knowledge Nodes / Edges
           ├── Learning Goals
           └── Automations
```

Project 关联由用户显式控制。跨 Project
的知识引用不自动授予文件读取权限。

## 2. 核心实体

### Workspace

字段：`id, tenant_id, owner_id, name, settings, data_policy, created_at, updated_at, version`

### Project

字段：`id, workspace_id, name, description, relation_policy, created_at, updated_at, version`

### Artifact

字段：`id, workspace_id, project_id nullable, title, artifact_type, schema_version, canonical_revision_id, status, created_by, created_at, updated_at, deleted_at`

### ArtifactRevision

字段：`id, artifact_id, revision_number, parent_revision_id, content_json, content_hash, author_type, author_id, created_at, change_summary`

### ArtifactPatch

字段：`id, artifact_id, base_revision_id, proposer_type, proposer_id, operations_json, validation_report_id, status, created_at, resolved_at`

### Source

字段：`id, workspace_id, canonical_url nullable, source_type, title, author_metadata, publication_metadata, rights_status, source_status, created_at`

### Asset

字段：`id, tenant_id, owner_id, content_hash, mime_type, size_bytes, storage_key, storage_status, retention_policy, created_at`

### Evidence

字段：`id, source_id, document_id, passage_id nullable, locator_json, quote_or_fact, verification_status, source_snapshot_id, created_at`

### Claim

字段：`id, workspace_id, statement, scope_json, certainty, review_status, valid_from, valid_until, current_version_id`

### KnowledgeNode

字段：`id, workspace_id, project_id nullable, node_type, title, description, status, last_verified_at, freshness_status`

### KnowledgeEdge

字段：`id, workspace_id, from_node_id, to_node_id, relation_type, directionality, status, created_by, review_status`

### KnowledgeEdgeEvidence

关联关系边与 Evidence。

## 3. Artifact Schema 设计原则

-   自有 Schema 与编辑器内部 JSON 分离。
-   所有 Block 有稳定 ID。
-   内容可精细到行内文本节点和 Mark。
-   公式、表格、图表、图片、引用、知识关系为结构化节点。
-   引用使用稳定 `evidence_id`，不能只保存普通文本 URL。
-   Schema 有版本号和迁移器。
-   不把编辑器光标、临时 UI 状态放入正式 Artifact 内容。

## 4. Artifact Schema 示例

``` json
{
  "artifact_id": "art_01",
  "schema_version": "2.0",
  "type": "document",
  "title": "Graph Neural Networks",
  "content": {
    "type": "document",
    "blocks": [
      {
        "id": "blk_01",
        "type": "heading",
        "attrs": {"level": 1},
        "children": [
          {"type": "text", "text": "Graph Neural Networks", "marks": []}
        ]
      },
      {
        "id": "blk_02",
        "type": "paragraph",
        "children": [
          {"type": "text", "text": "GCN 通过"},
          {
            "type": "text",
            "text": "邻居节点特征聚合",
            "marks": [{"type": "bold"}]
          },
          {"type": "text", "text": "更新节点表示。"}
        ],
        "annotations": []
      },
      {
        "id": "blk_03",
        "type": "math_block",
        "attrs": {
          "latex": "H^{(l+1)}=\\\\sigma(\\\\hat D^{-1/2}\\\\hat A\\\\hat D^{-1/2}H^{(l)}W^{(l)})"
        }
      },
      {
        "id": "blk_04",
        "type": "evidence_reference",
        "attrs": {
          "evidence_id": "ev_01",
          "display_style": "inline"
        }
      }
    ]
  },
  "relations": {
    "knowledge_node_ids": ["kn_01"],
    "source_ids": ["src_01"]
  }
}
```

## 5. 支持的 Block / Inline 类型

### Block

`paragraph, heading, bullet_list, ordered_list, list_item, quote, code_block, math_block, table, image, figure, chart, callout, divider, evidence_reference, knowledge_embed, timeline, mindmap, graph_embed`

### Inline

`text, hard_break, link, inline_math, mention, citation, footnote, inline_annotation`

### Marks

`bold, italic, underline, strike, code, highlight, text_color, background_color`

未知类型必须保留原始 payload 或以安全占位符展示，不能静默丢弃。

## 6. 字符级定位

不得只依赖 `anchor_text`。Patch 定位至少支持： - `block_id` -
文本节点路径或稳定 node ID - UTF-16 offset（若编辑器需要） - Unicode
grapheme-aware offset 映射 - 前后文 - 原文片段 hash - base revision

系统需要统一 offset 约定，并在 Editor Adapter 中处理 UTF-16 与 Unicode
字素簇的转换。

## 7. Patch Operation

支持： - `insert_text` - `delete_text` - `replace_text_range` -
`set_mark` - `remove_mark` - `split_block` - `merge_blocks` -
`move_block` - `update_node` - `update_cell` - `update_formula` -
`set_block_attrs` - `add_relation` - `remove_relation`

Patch 必须声明
`base_revision_id`。服务端执行时重新校验目标对象、权限、版本和范围。

## 8. Artifact 编辑事务

用户编辑： 1. 本地生成 transaction / mutation。 2. 本地持久化。 3. UI
乐观更新。 4. 同步服务提交。 5. 服务端创建 revision。 6. 返回 ACK
和新版本。

AI 编辑： 1. Agent 读取指定 revision。 2. 输出 Patch Proposal。 3.
Schema / semantic / evidence / policy validation。 4. 检查当前 revision
与 base revision。 5. 无冲突则按策略提交或进入审核。 6.
有冲突则保留双方版本，产生 merge proposal。 7.
所有接受/拒绝均写入审计记录。

## 9. 版本策略

-   MVP 采用 Artifact revision + Block stable ID。
-   重要版本不可变。
-   每次用户或 Agent 正式提交产生 revision。
-   可定期压缩编辑历史，但不能破坏用户可恢复版本。
-   逻辑分支用于 Agent Proposal 和冲突解决，不要求实现完整 Git。
-   不在 MVP 引入 CRDT。

## 10. 数据库索引建议

-   所有实体按 `tenant_id/workspace_id` 建立隔离索引。
-   Artifact：`workspace_id, project_id, updated_at`。
-   Revision：`artifact_id, revision_number` 唯一。
-   KnowledgeEdge：`from_node_id, to_node_id, relation_type`。
-   Evidence：`source_id, document_id, verification_status`。
-   Source：canonical URL / DOI / content hash 组合去重策略。
-   JSONB 仅用于确实需要灵活扩展的属性，核心查询字段应结构化。
