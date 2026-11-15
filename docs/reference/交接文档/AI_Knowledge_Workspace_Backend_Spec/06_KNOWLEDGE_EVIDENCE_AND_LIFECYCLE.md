# 06 --- Knowledge, Evidence & Lifecycle

## 1. 知识链路

``` text
Source
  → Source Snapshot
  → Asset / Document
  → Passage / Figure / Table
  → Evidence
  → Claim
  → Knowledge Node
  → Knowledge Edge
  → Artifact
```

原始来源、证据、知识结论和用户表达必须分层保存。

## 2. Source

记录： - 来源类型、URL、DOI、作者、出版信息。 - 首次发现和抓取时间。 -
最后检查时间。 - 当前访问状态。 - 权利/许可状态。 - 内容哈希。 -
来源快照。 - 失效或撤稿等状态变化。

Source 的访问权限与内容再分发权限分离。

## 3. Evidence

Evidence 必须可定位： - source_id - document_id - source_snapshot_id -
passage_id - page / section / paragraph / figure / table locator - quote
or structured fact - extraction method - verification status -
confidence / warnings - created_at

Evidence 不应被原地覆盖。校正应形成新版本或 correction record。

## 4. Claim

Claim 表达可核查的陈述，必须支持： - statement -
scope（时间、数据集、材料、实验条件、指标等） - evidence_refs -
certainty - status - valid_from / valid_until - conflict_refs - review
history

Claim 状态建议：
`proposed, supported, partially_supported, disputed, unsupported, outdated, retracted`

不得把 LLM 的 confidence 当成事实概率。

## 5. Knowledge Graph

节点类型可扩展： - concept - method - person - organization - material -
dataset - paper - claim - learning_topic - project_topic

关系类型注册： - depends_on - is_a - part_of - contradicts - supports -
similar_to - related_to - example_of - derived_from - authored_by -
studied_in

关系必须有方向性定义、创建者、审核状态和可选 Evidence。

## 6. 用户控制关联

-   用户定义 Project 之间是否关联。
-   AI 只能提出关联建议。
-   AI 不得自行跨越用户设置的项目边界。
-   跨项目引用不代表跨项目资源访问权限。
-   关系可接受、拒绝、修改、撤销。
-   用户删除关系不应删除两端节点。

## 7. 多视图投影

知识图谱、思维导图、时间线、依赖图、证据网络是同一底层知识数据的不同
Projection，不分别维护独立事实。

视图状态可以保存在用户偏好中，但节点和关系内容以领域模型为准。

## 8. Knowledge Lifecycle

知识状态： - new - active - needs_review - disputed - outdated -
archived

来源发生变化时执行 Impact Analysis： Source → Evidence → Claim →
Knowledge Node / Edge → Artifact。

只将受影响结论标记为待复核，不要无差别删除整个知识链。

## 9. Source Lifecycle

-   discovered
-   registered
-   fetched
-   parsed
-   verified
-   inaccessible
-   updated
-   retracted
-   deleted

来源失效不代表历史引用自动失效；应保留历史快照与访问状态，并按权利和保留政策处理。

## 10. Knowledge Maintenance Center

后续产品模块提供： - 待核实知识。 - 争议结论。 - 来源失效。 -
撤稿/修订通知。 - AI 关系建议。 - 长期未更新知识。 - 证据不足结论。

## 11. 删除传播

删除 Source 时： 1. 检查资产和派生数据。 2. 检查 Evidence 依赖。 3.
检查是否有其他来源支持同一 Claim。 4. 失去唯一支持的 Claim 标记
needs_review。 5. 保留用户独立撰写内容。 6. 根据 retention policy
删除原始文件、快照和派生数据。 7. 写入审计事件。

## 12. 反向查询

必须支持： - 某篇论文被哪些 Artifact 引用？ - 哪些 Claim 仅由一个
Evidence 支持？ - 哪些知识节点依赖已撤稿来源？ - 某个节点关联哪些
Project？ - 某个结论有哪些相反证据？
