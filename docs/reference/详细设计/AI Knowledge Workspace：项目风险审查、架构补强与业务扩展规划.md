# AI Knowledge Workspace：项目风险审查、架构补强与业务扩展规划

PRODUCT & ARCHITECTURE REVIEW · V1.0 · 2026-11-08

我认为现在是一个非常合适的时间点进行这次审查。

目前项目已经确定了产品方向、三层架构、Agent 运行机制、DeepSeek 接入、验证器体系、知识数据模型、Artifact 编辑系统，以及 Windows、Apple、Android、鸿蒙的跨平台方案。

下一步不应该继续无节制地增加技术模块，而应该换一个视角：

假设这个项目真的开发出来，并且有几万甚至几十万用户长期使用，它会在哪些地方出问题？哪些能力目前没有设计？哪些业务扩展会决定它能否从一个 AI 学习工具成长为一个真正的生产力平台？

我会从六个方面审查：

1. 产品定位与用户使用障碍。
2. 核心技术架构的潜在问题。
3. 知识资产、数据和 AI 可靠性。
4. 跨平台、性能、安全与商业成本。
5. 必须增加的业务功能。
6. 中长期产品扩展与商业化。

先给出我的总体判断。

## 一、总体审查结论

# 项目目前最需要解决的不是功能数量，而是系统完整性。

以下为架构审查判断，不是实际运行测试结果。

产品方向

方向合理

以知识工作空间为中心，而不是以聊天窗口为中心，有明确的差异化价值。

Agent 架构

基础完善

Orchestrator、专业 Agent、Skill、Validator 的分工已经比较完整，但需要进一步控制复杂度和失败恢复成本。

知识数据体系

需要补强

需要更加重视来源生命周期、知识版本、冲突、用户修订以及长期数据迁移。

编辑系统

高风险工程模块

字符级编辑、结构化对象、AI Patch、引用追踪、跨端一致性组合起来，实际复杂度远高于普通 Markdown 编辑器。

跨平台架构

实施风险较高

多平台方案可行，但不能同时追求所有平台的功能完全一致。

商业与运营体系

目前设计不足

需要补充成本控制、订阅权益、用户增长、数据治理、支持体系和长期留存机制。

我认为最值得警惕的是下面五个问题：

| 排名 | 潜在问题                                        | 可能造成的后果             |
| ---- | ----------------------------------------------- | -------------------------- |
| 1    | AI 生成内容很多，但用户真正使用和复用的内容很少 | 产品留存率低               |
| 2    | 来源、证据和知识关系长期维护困难                | 知识资产逐渐失去可信度     |
| 3    | Artifact 编辑与 AI 修改发生冲突                 | 用户不敢信任 AI 编辑       |
| 4    | Agent 自主程度过高，成本和执行时间不可控        | 研究任务昂贵、失败率高     |
| 5    | 一开始覆盖太多平台和功能                        | 开发周期过长，MVP 无法落地 |

接下来逐项分析。

# 二、产品层面的潜在问题

## 2.1 用户范围太广，初期产品容易失焦

目前的目标用户是：

所有有学习需求的普通用户。

这个目标适合作为长期市场定位，但不适合直接作为 MVP 的开发依据。

因为不同用户的学习需求差别很大：

| 用户类型   | 主要需求           | 典型产物               |
| ---------- | ------------------ | ---------------------- |
| 普通自学者 | 快速理解陌生知识   | 学习笔记、概念图       |
| 大学生     | 课程学习、考试复习 | 课程知识体系、复习资料 |
| 研究生     | 文献阅读、课题研究 | 文献综述、证据图谱     |
| 工程师     | 学习技术、解决问题 | 技术文档、方案         |
| 内容创作者 | 收集资料、整理观点 | 研究素材、主题知识库   |
| 教师       | 教学准备、知识组织 | 教案、知识结构         |
| 企业员工   | 行业研究、业务学习 | 分析报告、项目知识库   |

如果一开始同时满足这些用户，产品可能出现三个问题：

1. 功能越来越多，但没有一个场景做到足够好。
2. AI 自动化流程越来越复杂，用户却不知道应该如何使用。
3. 界面试图容纳所有产物形态，最终失去统一的交互逻辑。

### 我的建议：统一产品，分阶段切入市场

不要改变长期面向普通用户的定位，而是选择一个最容易形成完整使用闭环的初始场景。

我建议优先考虑：

资料驱动型学习与研究。

例如：

用户提出一个主题 → AI 搜集资料 → 解析内容 → 生成知识产物 → 用户编辑 → 后续继续学习和复用。

这个场景可以自然覆盖普通自学、大学学习、研究生文献阅读和技术学习。

同时，它能够完整验证目前已经设计的三层架构。

## 2.2 每次提问都生成 Artifact，可能反而增加用户负担

这是目前产品定义中值得重新审视的一点。

之前确定的方向是：

> 每次用户的搜索/提问都要转化为一个可编辑的产物。

这个理念有价值，但如果严格执行，可能产生大量低价值 Artifact。

例如：

- 用户问一个单词是什么意思。
- 用户临时问一个数学公式。
- 用户查询某个软件的快捷键。
- 用户询问一个简单概念。

如果每次都创建一份正式知识产物，Workspace 会迅速堆满碎片。

我建议保留「每次交互都可以沉淀为知识资产」的原则，但将产物分成三个生命周期。

Transient Response · 临时回答

默认轻量

解决即时问题，不自动创建正式 Artifact。

Knowledge Note · 知识片段

可沉淀

保存一个概念、解释、公式、观点或资料摘录。

Workspace Artifact · 完整产物

正式资产

生成可以长期编辑、组织、引用、导出的知识文档、图谱、时间线或研究报告。

建议 AI 自动判断初始形态，但用户可以随时：

- 保存回答。
- 转化为知识片段。
- 合并到已有 Artifact。
- 创建独立研究产物。
- 丢弃临时内容。

这样既不会丢失沉淀能力，也不会制造内容垃圾。

## 2.3 缺少一个非常重要的产品模块：学习任务管理

目前的设计比较关注：

- 用户提出问题。
- AI 检索资料。
- AI 生成知识产物。

但真实学习并不是一次性生成文档就结束了。

用户还会：

- 学到一半中断。
- 过几天继续。
- 发现某个概念不理解。
- 想知道哪些知识已经掌握。
- 想把几个不同主题串联起来。
- 想持续跟进某个领域的新研究。

因此，我建议增加：

Learning Journey Engine（学习旅程引擎）。

它不必是一个复杂的独立 AI Agent，而是管理用户学习过程的业务模块。

核心功能：

1. 学习目标管理。
2. 学习进度记录。
3. 学习任务拆分。
4. 已掌握、待学习、待确认知识标记。
5. 知识薄弱点识别。
6. 学习内容复习提醒。
7. 学习路径调整。

例如：

用户想学习 Graph Neural Networks。

系统不仅生成一份 GNN 介绍，还能形成：

```
学习目标：掌握 GNN

├── 图论基础
│   ├── 图结构
│   ├── 邻接矩阵
│   └── 图信号
│
├── GNN 基础
│   ├── Message Passing
│   ├── GCN
│   ├── GraphSAGE
│   └── GAT
│
├── 进阶模型
│   ├── MPNN
│   └── Equivariant GNN
│
└── 实践
    ├── PyTorch Geometric
    └── 材料物性预测
```

每个知识节点都可以关联对应的 Artifact、论文、学习任务和练习。

这会让产品从「AI 帮我整理资料」进一步变成「AI 帮我持续掌握知识」。

# 三、核心技术架构的潜在问题

这里我会更严格一些，因为有些问题在开发初期不容易发现，但后期修复成本非常高。

## 3.1 Agent 架构可能过度工程化

目前我们已经规划：

- Orchestrator。
- 多种专业 Agent。
- Skill Registry。
- Tool Executor。
- 七类 Validator。
- Typed DAG。
- 多种执行策略。
- Evaluator-Repair。
- 多种 Worker。
- Model Gateway。

从长期架构角度，这些设计都有价值。

但是，如果全部一次性开发，会产生一个风险：

系统还没有形成稳定的用户价值，就已经承担了大型 Agent 平台的研发成本。

建议分成三种复杂度等级。

| 任务类型 | 执行方式                         | 例子                   |
| -------- | -------------------------------- | ---------------------- |
| Simple   | 普通 Service + Single Pass       | 概念解释、简单摘要     |
| Medium   | Single Agent + Tool Calling      | 单篇论文分析           |
| Complex  | Orchestrator + DAG + Multi-Agent | 多论文综述、系统性研究 |

另外，我建议增加一个重要组件：

### Execution Policy Engine

它负责决定：

- 是否启动 Agent。
- 是否启动多 Agent。
- 是否需要深度检索。
- 是否需要图片解析。
- 是否需要 Evidence Validator。
- 是否需要用户确认。
- 最大 Token 预算。
- 最大执行时间。
- 最大工具调用次数。

这应该是一个独立的策略模块，而不是将所有决策交给 Orchestrator 的 LLM。

这样能避免简单任务被复杂工作流拖慢。

## 3.2 Agent 执行中断和恢复还需要进一步设计

目前设计了 Task、TaskAttempt、Research Run 和事件日志。

但还需要重点补充以下场景：

- 用户关闭应用。
- 用户切换设备。
- DeepSeek API 超时。
- Worker 进程崩溃。
- 网络断开。
- 用户取消任务。
- 研究任务执行数小时。
- 一个 Agent 成功，另一个 Agent 失败。
- 任务已经产生部分结果，但还没有完成最终 Artifact。

建议明确：

Research Run 必须是可暂停、可取消、可恢复、可部分完成的持久化工作流。

具体增加：

| 能力               | 设计要求                 |
| ------------------ | ------------------------ |
| Checkpoint         | 保存重要执行状态         |
| Resume             | 从最近有效状态恢复       |
| Cancellation       | 取消未执行任务           |
| Compensation       | 处理已经发生的部分副作用 |
| Idempotency        | 重试不重复产生副作用     |
| Partial Completion | 保留已完成内容           |
| Timeout            | 区分任务超时和模型超时   |
| Budget Exhaustion  | 预算耗尽时安全终止       |
| User Intervention  | 支持等待用户确认后继续   |

特别建议增加 `WAITING_FOR_USER` 状态。

例如，用户要求 AI 研究一个主题，AI 发现范围过大，需要用户确定研究方向。

不应该因此让 Agent 无限猜测。

应该保存当前执行状态，等待用户补充信息，再恢复任务。

## 3.3 多 Agent 可能出现信息污染

这是一个比较容易被忽略的问题。

假设：

Literature Agent 发现论文 A，认为它支持某个结论。

Synthesis Agent 接收这个结论后，将其转述。

Verifier Agent 再接收转述后的结论进行验证。

如果原始信息在 Agent 之间多次被概括，最终可能出现：

- 原文没有的内容被补充进去。
- 结论的适用范围被扩大。
- 不确定的观点被变成确定结论。
- 原始证据丢失。

建议建立一个规则：

Agent 之间传递知识结论时，必须传递 Claim ID 和 Evidence ID，而不是只传递自然语言摘要。

例如：

```
{
  "claim_id": "claim_001",
  "statement": "某模型在指定数据集上取得更好的预测性能",

  "evidence_refs": [
    "evidence_001",
    "evidence_002"
  ],

  "scope": {
    "dataset": "dataset_A",
    "property": "band_gap",
    "model": "GNN_A"
  },

  "certainty": "supported"
}
```

这样下游 Agent 可以直接访问证据，而不是仅凭上游 Agent 的描述进行推理。

## 3.4 Validator 也可能成为新的错误来源

之前设计了多个 Validator，这非常必要。

但需要警惕：

Validator 并不天然等于正确。

尤其是 LLM Evaluator，可能出现：

- 错误拒绝正确内容。
- 接受没有证据支持的结论。
- 因为表达方式不同而产生误判。
- 不同模型对同一内容评价不一致。
- 反复修复导致原本正确的内容变差。

因此建议新增：

### Validator Calibration System

包括：

1. 每种 Validator 都有独立测试集。
2. 记录 False Positive 和 False Negative。
3. 定期使用人工标注样本校准。
4. 对重要结论使用确定性规则优先。
5. LLM Judge 不得直接决定高风险数据写入。
6. 保存每次验证器版本和评估依据。

另外，不要将多个 LLM Validator 的一致意见直接视为事实正确。

它们可能共享相同模型偏见和信息盲点。

## 3.5 知识数据可能缺少完整的生命周期管理

这是我认为目前后端知识体系中最需要补充的部分。

我们已经有：

- Source。
- Document。
- Passage。
- Claim。
- Evidence。
- KnowledgeNode。
- KnowledgeEdge。
- Artifact。

但知识不是创建后就永远正确。

例如：

用户在 2026 年保存了一篇论文，2027 年发现论文被撤稿，或者某个技术标准已经更新。

原有知识节点可能仍然保留着旧结论。

如果没有生命周期管理，用户的知识库会逐渐积累过时信息。

### 建议增加 Knowledge Lifecycle Management

![mermaid-diagram (15)](C:\Users\Y9000P-2025\Downloads\mermaid-diagram (15).png)

新增以下字段：

| 对象          | 建议增加字段                                           |
| ------------- | ------------------------------------------------------ |
| Source        | `retrieved_at`、`last_checked_at`、`source_status`     |
| Document      | `content_hash`、`parser_version`、`document_version`   |
| Evidence      | `source_snapshot_id`、`locator`、`verification_status` |
| Claim         | `valid_from`、`valid_until`、`review_status`           |
| KnowledgeNode | `last_verified_at`、`freshness_status`                 |
| KnowledgeEdge | `evidence_refs`、`review_status`                       |

尤其需要区分：

- 信息在历史上曾经正确。
- 信息在当前仍然正确。
- 信息存在争议。
- 信息已经过时。
- 信息尚未核实。

不要简单地用一个 `verified=true` 表示永久可信。

### 增加知识影响分析

例如，用户发现一篇重要论文被撤稿。

系统应该能够反向查找：

```
撤稿论文
   │
   ▼
相关 Evidence
   │
   ▼
相关 Claim
   │
   ▼
相关 Knowledge Node
   │
   ▼
引用该知识的 Artifact
```

然后提示用户：

「这篇论文已发生状态变化，你的 3 个知识结论和 2 份研究文档可能需要重新核查。」

这是一个非常有价值的长期能力。

## 3.6 知识图谱可能产生关系污染

之前已经决定：

- 用户自定义哪些项目关联。
- AI 只能建议知识关系。
- 用户可以修改、接受和拒绝。
- 支持 Markdown 双链。

这个设计是正确的。

但还需要处理一个问题：

知识关系数量会随着使用时间增长，最终可能变得非常混乱。

例如一个概念可以同时关联：

- 相关概念。
- 前置知识。
- 反向概念。
- 实例。
- 证据。
- 研究主题。
- 所属领域。
- 相似概念。

如果所有关系都展示在一张图上，图谱会失去可读性。

建议增加四个模块。

### A. Relation Type Registry

关系类型注册中心。

预设关系类型，但允许用户扩展：

| 关系类型      | 方向 | 示例                 |
| ------------- | ---- | -------------------- |
| `depends_on`  | 有向 | GAT 依赖图注意力机制 |
| `is_a`        | 有向 | GCN 是 GNN 的一种    |
| `part_of`     | 有向 | 某章节属于某课程     |
| `contradicts` | 有向 | 两个结论存在矛盾     |
| `supports`    | 有向 | Evidence 支持 Claim  |
| `similar_to`  | 无向 | 两个概念相似         |
| `related_to`  | 无向 | 两个知识点相关       |
| `example_of`  | 有向 | 某案例是某理论的实例 |

### B. Graph View Filter

允许用户按照以下条件筛选：

- 项目。
- 关系类型。
- 信息来源。
- 创建时间。
- 用户确认状态。
- 可信程度。
- 知识领域。

### C. Relationship Review Queue

AI 建议的关系进入待审核队列，而不是直接进入正式图谱。

用户可以批量：

- 接受。
- 拒绝。
- 修改关系类型。
- 修改关系方向。

### D. Graph Projection

同一批知识数据支持不同视图：

- 知识图谱。
- 思维导图。
- 树形结构。
- 时间线。
- 依赖关系图。
- 证据网络。

这里需要坚持一个原则：

图谱、思维导图和时间线是知识数据的不同展示投影，不应该各自维护一份独立的知识事实。

否则后期会出现同一个知识点在不同视图中内容不一致的问题。

## 3.7 Artifact 编辑器是一个潜在的高成本模块

目前已经决定采用：

- 字符级编辑。
- Tiptap / ProseMirror。
- 结构化文档。
- AI Patch。
- Diff。
- 版本控制。
- 公式和表格编辑。
- 图表与知识图谱编辑。

这实际上已经接近一个专业的文档编辑平台。

我建议重点补充以下问题。

| 风险        | 可能出现的问题              | 建议                          |
| ----------- | --------------------------- | ----------------------------- |
| Schema 演进 | 老文档无法打开              | Schema Migration              |
| 节点定位    | AI 修改错位置               | Stable Block ID + Anchor      |
| Unicode     | 中文、Emoji 编辑偏移错误    | 字素簇定位                    |
| 公式        | 公式渲染和编辑脱节          | 独立 Formula Model            |
| 图表        | 修改展示导致数据丢失        | 数据与 Renderer 分离          |
| 撤销        | AI Patch 与用户操作混在一起 | Transaction History           |
| 并发        | 两个设备同时修改            | Optimistic Concurrency        |
| 大文档      | 编辑器卡顿                  | Virtualization / Lazy Loading |
| 跨平台      | WebView 表现不一致          | 多端编辑器回归测试            |

### 特别建议：暂时不要引入完整 CRDT

未来多人实时协作可能需要 Yjs 或其他 CRDT 技术。

但是 MVP 主要是个人用户跨设备编辑。

先采用：

- Block 级稳定 ID。
- Artifact Version。
- Optimistic Locking。
- Patch。
- 冲突检测。
- 局部合并。

等真正需要多人实时编辑时，再引入 CRDT。

否则现在就要承担复杂的同步、撤销、格式冲突和持久化问题。

## 3.8 文档解析能力可能成为系统质量瓶颈

目前设计的 Ingestion Pipeline 已经考虑 PDF、OCR、图片和 Office。

但真正困难的是：

能否正确理解资料，而不仅仅是提取文本。

尤其是学术文献：

- 双栏论文。
- 跨页表格。
- 多级标题。
- 数学公式。
- 化学结构式。
- 图注与正文对应。
- 图片中的实验条件。
- 补充材料。
- 参考文献。

建议增加一个：

### Document Quality Assessment

每份文档解析后生成质量报告：

```
{
  "document_id": "doc_001",
  "quality": {
    "text_extraction": 0.98,
    "layout_detection": 0.93,
    "table_extraction": 0.81,
    "figure_extraction": 0.91,
    "formula_extraction": 0.67
  },
  "warnings": [
    {
      "type": "formula_extraction_uncertain",
      "pages": [4, 5]
    }
  ]
}
```

这些分数应由实际测试或可量化规则产生，而不是让 LLM 随意给出。

如果某份论文的公式提取质量较差，AI 就应该知道这一点，不能假设全文已经被完整理解。

建议增加：

- 解析失败区域定位。
- 原始 PDF 对照。
- 重新解析。
- 局部 OCR。
- 人工修正。
- 解析版本追踪。

这会显著提高后续 Evidence Validation 的可靠性。

## 3.9 检索系统需要区分「找到资料」和「找到答案」

目前 Hybrid Retrieval 已经规划了 BM25、Vector、RRF 和 Reranker。

但还需要区分三个层次：

1. 找到相关文档。
2. 找到文档中的相关段落。
3. 找到能够回答问题的证据。

这三者不能混为一谈。

建议增加：

Retrieval Quality Evaluation。

至少测试：

- Recall@K。
- Precision@K。
- MRR。
- NDCG。
- Evidence Hit Rate。
- Citation Accuracy。

另外，检索结果应该能够区分：

- 原始研究。
- 综述论文。
- 官方文档。
- 新闻报道。
- 社区讨论。
- 用户上传资料。

不要只依据语义相似度决定来源权重。

例如用户研究某个材料的实验性能，原始实验论文通常比一篇没有具体实验数据的科普文章更有价值。

# 四、目前缺失的重要系统模块

除了上述技术问题，我认为还应该增加六个相对独立的业务基础设施。

## 4.1 User Preference & Personalization Engine

目前用户可以控制：

- 项目关系。
- 知识关系。
- Artifact 编辑。
- 研究任务。

但还没有充分设计用户偏好系统。

例如：

- 用户喜欢简洁解释还是深入推导？
- 用户希望优先使用论文还是官方文档？
- 用户更喜欢思维导图还是线性笔记？
- 用户是否允许 AI 自动修改草稿？
- 用户是否希望所有结论附上来源？
- 用户偏好中文还是英文资料？

建议增加：

```
Personalization Engine
│
├── Language Preference
├── Explanation Depth
├── Source Preference
├── Citation Preference
├── Artifact Preference
├── AI Autonomy Preference
├── Notification Preference
└── Privacy Preference
```

但不要让个性化系统变成一个不可见的黑箱。

用户应该能够查看和修改这些偏好。

而且不同 Project 可以拥有不同的偏好配置。

## 4.2 Inbox / Capture Center

这是我认为 MVP 就应该增加的功能。

用户的学习资料并不总是通过 AI 主动搜索得到的。

很多时候资料来自：

- 浏览器。
- 微信或其他聊天工具。
- 邮件。
- PDF。
- 图片。
- 课程课件。
- 本地文件。
- 手机拍摄。
- 其他 AI 工具。

建议增加统一的资料收集中心。

[Get the most out of what you read with Readwise • Ness Labs](https://images.openai.com/static-rsc-4/Mk5tsZW3Sk1788fXhuuAS7yFD6xon1SHE3IPsAv1z1crj7PYIaNENiGO43DJmt8cgrSYPfzqM4yJqcNeJjE1J5KOCOfy7habA-K6WUEcWvih8so-8UFQrxr8RhctTBmz0NoNoeJq3DG7ibfsoG1Oc07SPnp2HAV9kDNWDZsGPGM?purpose=inline)

[nesslabs.com](https://nesslabs.com/readwise-featured-tool?utm_source=chatgpt.com)

主要功能：

- 暂存资料。
- 批量导入。
- 自动识别来源类型。
- 指定 Project。
- 添加备注。
- 标记稍后阅读。
- 合并重复资料。
- 批量交给 Agent 处理。

建议数据流：

```
External Content
      │
      ▼
Capture Inbox
      │
      ▼
Source Normalization
      │
      ▼
Duplicate Detection
      │
      ▼
User Organization
      │
      ▼
Ingestion Pipeline
      │
      ▼
Knowledge Workspace
```

这样用户不必每次都先设计一个复杂的研究任务。

## 4.3 Source Library

Source 不应该只是数据库里一个后台对象。

它应该成为用户可以直接操作的业务模块。

建议实现：

- 来源列表。
- 来源搜索。
- 来源分类。
- 标签。
- 阅读状态。
- 收藏。
- 资料质量。
- 来源重复检测。
- 失效链接检测。
- 论文 DOI。
- 作者和出版信息。
- 资料与 Artifact 的反向关联。

用户应该能够直接问：

「哪些 Artifact 引用了这篇论文？」

「我收藏了哪些尚未阅读的资料？」

「哪些结论只由一篇论文支持？」

这些问题会让知识资产真正可管理。

## 4.4 Knowledge Maintenance Center

这是上一节知识生命周期管理在产品层面的落地。

建议提供一个统一维护中心：

Knowledge Maintenance

待核实知识

12

来源失效

3

存在争议的结论

5

AI 建议的新关联

18

长期未更新的知识

7

概念功能示意，数字不代表实际数据。

这样 Workspace 不仅能生产知识，还能维护知识。

## 4.5 Import / Export / Backup Manager

目前已经确定支持 Markdown、PDF、DOCX 等导出。

但我认为还需要从「导出文件」升级为「完整数据可迁移」。

建议增加：

| 功能                 | 说明             |
| -------------------- | ---------------- |
| Markdown Export      | 导出普通笔记     |
| DOCX Export          | 编辑型文档       |
| PDF Export           | 阅读型文档       |
| HTML Export          | 网页阅读         |
| JSON Export          | 完整结构化数据   |
| ZIP Workspace Backup | 完整工作空间备份 |
| Markdown Import      | 导入其他笔记     |
| Obsidian Import      | 导入双链笔记     |
| Notion Import        | 导入文档和数据库 |
| Zotero Import        | 导入文献元数据   |
| Restore              | 恢复备份         |

尤其要支持：

- Artifact 内容。
- 图片和附件。
- 来源信息。
- 知识节点。
- 关系。
- 引用。
- 版本历史。

建议将 JSON + 文件资源包作为完整数据迁移的基础格式。

用户必须能够完整带走自己的知识资产。

这不仅是一个导出功能，也是建立用户信任的重要手段。

## 4.6 Notification & Automation Engine

用户会有一些持续性任务：

- 每周追踪某个研究主题的新论文。
- 当某篇论文有修订版本时提醒。
- 当某个资料来源失效时提醒。
- 当研究任务完成时通知。
- 每周整理某个 Project 的新资料。
- 定期检查知识库中的过时结论。

建议增加统一 Automation Engine。

但自动化必须有权限和预算限制。

例如：

```
{
  "automation_id": "auto_001",
  "type": "research_monitor",

  "schedule": {
    "frequency": "weekly"
  },

  "target": {
    "query": "Spinel GNN property prediction",
    "project_id": "project_001"
  },

  "actions": [
    "search_new_sources",
    "deduplicate",
    "generate_update_summary"
  ],

  "policy": {
    "auto_create_draft": true,
    "auto_publish": false,
    "max_budget": 100
  }
}
```

自动研究结果默认形成 Draft，不能未经用户授权直接修改正式知识资产。

# 五、安全、隐私与法律风险

这是一个不能等到产品上线之后再处理的部分。

因为你的产品会处理：

- 用户个人知识。
- 用户上传的文件。
- 私人研究资料。
- 学术论文。
- 商业文档。
- 个人学习记录。
- 外部网页内容。
- 用户自己的观点和修改记录。

其中有些内容可能具有很高的隐私和商业价值。

## 5.1 DeepSeek API 带来的数据治理问题

目前 Agent 统一使用 DeepSeek API，这没有架构上的问题，但需要明确数据传输边界。

建议增加：

AI Data Governance Layer。

每次模型调用之前，根据内容敏感等级决定能否发送。

| 数据类型      | 建议策略                         |
| ------------- | -------------------------------- |
| 公开网页      | 可以发送                         |
| 公开学术论文  | 可以发送，但遵循来源使用规则     |
| 用户普通笔记  | 根据用户授权发送                 |
| 私人研究文件  | 明确告知外部模型处理             |
| 企业机密      | 默认禁止发送至未经批准的外部模型 |
| 密码、API Key | 永远不应进入模型上下文           |

进一步增加：

- 用户数据处理授权。
- 数据保留期限。
- 模型供应商数据处理政策管理。
- 敏感字段检测。
- 日志脱敏。
- 数据删除。
- 账号注销。
- 数据导出。
- 供应商切换机制。

尤其需要注意：模型供应商的 API 数据处理、保留和训练政策可能随合同、产品和地区变化，不能仅凭使用 API 就假定所有内容都不会被保留。

## 5.2 Web 抓取和版权风险

这是一个很容易被忽略的商业风险。

产品会自动搜索和抓取：

- 论文。
- 书籍。
- 网站。
- 图片。
- 新闻。
- 付费内容。
- 用户上传文件。

建议增加 Source Rights Management。

每个来源记录：

```
{
  "source_id": "src_001",

  "rights": {
    "access_type": "public",
    "license": "unknown",
    "redistribution": "restricted",
    "commercial_use": "unknown"
  },

  "processing": {
    "allowed": true,
    "full_text_storage": "policy_controlled",
    "image_redistribution": false
  }
}
```

实际字段应该由可信元数据和法律规则确定，不能让 Agent 自己判断版权许可。

产品层面需要：

1. 区分来源访问权限和内容再分发权限。
2. 对版权不明确的来源谨慎保存和展示全文。
3. 图片、论文和书籍内容保留原始出处。
4. 不提供绕过付费墙的功能。
5. 建立侵权投诉和内容下架流程。
6. 为用户上传内容明确责任和处理规则。
7. 支持来源删除后追踪受影响的知识资产。

还需要特别注意：即使 AI 生成的是摘要，也不代表可以无限量复制受版权保护的内容。

## 5.3 外部资料中的 Prompt Injection

之前已经设计了 Prompt Injection 防护，但建议再向前推进一步。

将系统输入划分为：

```
Trusted Instructions
    │
    ├── System Policy
    ├── User Instructions
    └── Authorized Tool Definitions

Untrusted Content
    │
    ├── Web Pages
    ├── PDF
    ├── Images
    ├── Emails
    └── Retrieved Documents
```

所有外部资料只能作为待分析的数据。

必须阻止：

- 网页指令修改 Agent 权限。
- PDF 指令要求 Agent 导出用户文件。
- 搜索结果诱导 Agent 调用未授权工具。
- 外部内容要求模型泄露其他项目的信息。
- 通过文档解析触发 SSRF 或恶意文件执行。

尤其是网页抓取器，要限制：

- 内网地址。
- 本地回环地址。
- 云服务元数据地址。
- 非法重定向。
- 超大文件。
- 无限递归链接。
- 非法 MIME 类型。

## 5.4 多租户隔离

如果未来面向团队和企业，数据库必须保证：

- 用户 A 不能读取用户 B 的项目。
- Agent 不能越过 Task 权限。
- 跨项目关系不能自动授予资源访问权限。
- 文件下载链接不能被其他用户复用。
- 缓存键必须包含租户和权限上下文。

建议从 MVP 就引入明确的 `tenant_id` / `owner_id` 数据隔离设计。

即使初期只有个人 Workspace，也不要等到企业版再重新设计数据隔离。

# 六、跨平台与客户端的潜在问题

你现在的目标平台包括：

- Windows。
- macOS。
- iOS。
- Android。
- HarmonyOS。
- Web。

这个目标合理，但六个平台不能按照相同的方式验收。

## 6.1 最大风险：功能一致不等于体验一致

例如：

用户在 Windows 上可以打开四个窗口、拖动知识节点、使用键盘快捷键。

但是在 iPhone 上，如果仍然要求展示同样的四个面板，体验会非常糟糕。

建议明确平台功能等级。

| 功能               | Web        | Windows / Mac | 平板       | 手机       |
| ------------------ | ---------- | ------------- | ---------- | ---------- |
| 完整 Artifact 编辑 | 支持       | 完整支持      | 支持       | 轻量支持   |
| 字符级编辑         | 支持       | 完整支持      | 支持       | 支持       |
| 知识图谱           | 支持       | 完整支持      | 支持       | 局部视图   |
| 多窗口             | 浏览器能力 | 完整支持      | 按系统支持 | 不作为核心 |
| PDF 批注           | 支持       | 完整支持      | 完整支持   | 基础支持   |
| AI 深度研究        | 云端       | 云端          | 云端       | 云端       |
| 本地文件导入       | 支持       | 完整支持      | 支持       | 支持       |
| 离线编辑           | 基础       | 完整          | 基础       | 基础       |

## 6.2 编辑器的跨平台兼容性

特别关注以下问题：

- 中文输入法组合输入。
- 公式输入。
- 粘贴复杂格式。
- 拖放图片。
- 表格编辑。
- 触控选择文字。
- Apple Pencil。
- 鸿蒙 ArkWeb 兼容性。
- Windows WebView2 与 macOS WKWebView 的差异。

建议建立独立的 Editor Compatibility Test Suite。

不要只测试页面能否打开，而要测试完整编辑事务：

```
输入中文
  ↓
选中部分文字
  ↓
插入链接
  ↓
修改公式
  ↓
撤销
  ↓
保存
  ↓
同步至另一设备
  ↓
再次打开
  ↓
验证内容一致
```

## 6.3 本地存储可能出现数据膨胀

用户的资料可能包含：

- PDF。
- 图片。
- 论文图表。
- 公式。
- 多个 Artifact 版本。
- 本地缓存。
- Embedding。

如果所有设备都缓存全部文件，移动端很容易出现存储压力。

建议增加 Storage Manager：

- 缓存容量管理。
- 自动清理可重新下载的缓存。
- 用户锁定重要离线文件。
- 图片压缩和缩略图。
- 大文件分块上传。
- 断点续传。
- 存储占用统计。
- 设备间缓存策略。

注意：缓存清理不能删除尚未同步的用户修改。

## 6.4 增加 Accessibility

这是目前设计中容易遗漏的一项。

建议支持：

- 屏幕阅读器。
- 键盘完整导航。
- 足够的对比度。
- 可调整字体。
- 系统字体缩放。
- 减少动态效果。
- 公式替代文本。
- 图表文字描述。
- 色盲友好的图谱状态表达。

因为产品长期面向普通用户，不能只针对熟悉复杂软件的技术用户。

# 七、性能、成本和商业可持续性

我认为这是当前架构中最大的经营风险之一。

你设计的产品具有：

- 多轮模型调用。
- 多 Agent。
- 搜索 API。
- 文档解析。
- OCR。
- Embedding。
- Reranker。
- 图片理解。
- AI 编辑。
- 深度研究。
- 后台持续任务。

这些能力叠加起来，单个用户的成本可能相当高。

## 7.1 必须增加 Cost Management Engine

建议把成本管理独立出来。

```
Cost Management
│
├── Model Cost Tracker
├── Search Cost Tracker
├── Embedding Cost Tracker
├── OCR / Vision Cost Tracker
├── Storage Cost Tracker
├── Export Cost Tracker
├── User Quota Manager
├── Budget Controller
└── Cost Attribution
```

每个 Research Run 都要记录成本。

例如：

```
{
  "run_id": "run_001",

  "cost_breakdown": {
    "model_input": 0,
    "model_output": 0,
    "search": 0,
    "embedding": 0,
    "ocr": 0,
    "storage": 0
  },

  "budget": {
    "estimated": 0,
    "actual": 0,
    "limit": 0
  }
}
```

这里的数字只是结构示意，正式实现时需要接入各供应商实际账单和价格表。

### 需要重点优化的成本

| 成本来源      | 优化方法                |
| ------------- | ----------------------- |
| DeepSeek 调用 | 小任务使用轻量模型      |
| 多 Agent      | 只在必要时并行          |
| 文档解析      | 渐进式解析              |
| OCR           | 仅处理需要的页面        |
| Embedding     | 内容哈希去重            |
| 搜索          | 缓存、批量检索          |
| Reranker      | 只重排候选集            |
| 长上下文      | Context Compression     |
| 反复研究      | 复用已有资料和 Evidence |

另外，不能仅依赖 Token 数量计算成本。

要考虑完整的每次任务成本：

\[ C_{\text{run}} = C_{\text{model}}+ C_{\text{search}}+ C_{\text{parse}}+ C_{\text{storage}}+ C_{\text{other}} \]

## 7.2 需要引入用户预算机制

建议允许用户设置：

- 快速回答。
- 标准研究。
- 深度研究。
- 自定义研究预算。

例如：

Research Budget

交互示意，不代表最终套餐定价

快速模式

优先速度，限制检索和模型调用

标准模式

多来源检索、基本验证、完整产物

深度研究模式

多 Agent、深度检索、证据核查、局部修复

当前选择



另外要注意，用户预算不应该只是一个 Token 上限。

还需要限制：

- 最大并行 Agent 数。
- 最大工具调用数。
- 最大执行时间。
- 最大资料数量。
- 最大文件处理量。
- 最大自动修复次数。

预算达到上限后，系统应该保存已完成结果，并向用户说明继续执行需要什么资源。

## 7.3 建议建立成本与价值的联合指标

我不建议只追求降低 Token 成本。

如果为了节约成本，导致资料检索不足、证据错误、Artifact 质量下降，反而会降低产品价值。

建议跟踪：

\[ \text{Cost per Accepted Artifact} = \frac{\text{总生产成本}}{\text{用户接受的完整 Artifact 数量}} \]

还应该跟踪：

- 每个被复用知识节点的成本。
- 每个成功研究任务的成本。
- 每个用户每月的平均推理成本。
- 不同模型路线的质量成本比。
- 不同任务类型的毛利贡献。

这会成为未来订阅定价的重要依据。

# 八、应该增加哪些业务功能？

前面主要是补漏洞。

现在从产品增长角度考虑：除了目前的核心功能，还有哪些扩展能真正增加用户价值？

我建议将业务扩展分成四个方向。

## 8.1 第一方向：从知识生产扩展到知识学习

值得优先开发

这是与现有架构结合最自然的方向。

建议增加：

| 功能                    | 价值             |
| ----------------------- | ---------------- |
| Learning Path           | 自动规划学习路线 |
| Knowledge Mastery       | 标记掌握程度     |
| Flashcards              | 生成记忆卡片     |
| Spaced Repetition       | 间隔复习         |
| Concept Quiz            | 自动生成测试     |
| Weakness Detection      | 发现薄弱知识点   |
| Knowledge Prerequisites | 前置知识关系     |
| Learning Progress       | 学习进度追踪     |

特别推荐增加：

### AI Active Recall

AI 不只是重新解释知识，还会通过提问检查用户是否真正掌握。

例如：

用户学习完 GCN 后，系统可以询问：

「GCN 中为什么需要使用对称归一化邻接矩阵？」

如果用户答错，AI 可以：

1. 定位对应知识节点。
2. 找到原来的学习材料。
3. 重新解释。
4. 生成一个更简单的例子。
5. 更新学习掌握状态。

这样学习闭环变成：

```
发现知识
   ↓
收集资料
   ↓
理解知识
   ↓
建立知识关系
   ↓
主动回忆
   ↓
检测掌握程度
   ↓
间隔复习
```

相比单纯生成笔记，这个方向更容易形成持续使用习惯。

## 8.2 第二方向：从个人 Workspace 扩展到团队 Workspace

中期扩展

这是商业化非常重要的方向。

很多知识工作本来就不是个人独立完成的：

- 研究小组。
- 学生团队。
- 教研组。
- 企业研发部门。
- 产品团队。
- 咨询团队。

建议增加 Team Workspace。

主要功能：

| 功能                   | 说明         |
| ---------------------- | ------------ |
| Team Workspace         | 团队共享空间 |
| Member Management      | 成员管理     |
| Role Permissions       | 角色权限     |
| Shared Sources         | 共享资料库   |
| Shared Artifacts       | 共享知识产物 |
| Comments               | 评论与讨论   |
| Review Workflow        | 内容审核     |
| Version History        | 团队版本管理 |
| Shared Knowledge Graph | 团队知识图谱 |
| Activity Log           | 操作记录     |

### 必须注意团队数据边界

团队知识图谱不能简单地把所有成员的私人知识图谱合并。

应该区分：

```
Personal Workspace
      │
      ▼
Explicit Sharing
      │
      ▼
Team Workspace
      │
      ├── Shared Artifacts
      ├── Shared Sources
      └── Shared Knowledge
```

个人知识默认私有，用户主动共享后才进入团队空间。

## 8.3 第三方向：从资料搜索扩展到持续研究

中期扩展

这是与传统浏览器和普通 Chat 模型拉开差异的一个好方向。

增加：

### Research Monitor

用户可以创建一个持续研究主题。

例如：

「持续追踪尖晶石材料的 GNN 物性预测研究。」

系统定期：

1. 搜索新论文。
2. 去重。
3. 比较与已有资料的差异。
4. 提取新知识。
5. 检查已有结论是否受到影响。
6. 生成研究更新报告。
7. 等待用户审核后更新 Artifact。

还可以监测：

- 官方文档版本变化。
- 论文修订。
- 重要研究成果。
- 相关技术标准。
- 指定作者的新论文。

这可以让用户不再需要重复搜索同一主题。

## 8.4 第四方向：从封闭工作空间扩展到开放知识生态

长期扩展

这是我认为未来真正有潜力的方向。

可以增加：

- Skill Marketplace。
- Artifact Template Marketplace。
- Knowledge Template。
- Public Knowledge Collection。
- 插件和外部服务接入。
- API / SDK。
- MCP 接口。
- 第三方 AI Agent 接入。

例如：

开发者可以开发一个专门面向材料科学的 Skill：

```
Materials Science Skill Pack
│
├── Crystal Structure Parser
├── CIF File Analyzer
├── Materials Property Search
├── Phase Diagram Analysis
├── GNN Research
└── Literature Comparison
```

用户可以安装这个 Skill Pack，而不需要修改核心 Agent Runtime。

但这类生态建设应该放在产品已经验证用户需求之后。

不要现在就建设一个庞大的插件市场。

# 九、商业模式与产品增长风险

目前的技术架构比较完整，但商业模式还没有与架构充分结合。

我建议从一开始就考虑以下几个问题。

## 9.1 产品真正的竞争壁垒是什么？

这个项目会面对几类竞争产品：

| 产品类型     | 代表产品   | 主要能力             |
| ------------ | ---------- | -------------------- |
| AI 搜索      | Perplexity | 搜索与答案生成       |
| AI 文档学习  | NotebookLM | 基于用户资料进行分析 |
| 知识管理     | Notion     | 文档与工作空间       |
| 本地知识管理 | Obsidian   | 双链和知识组织       |
| AI 通用助手  | ChatGPT 等 | 通用智能和工具调用   |

我们的产品不能只靠「搜索更快」「回答更好」建立壁垒。

因为这些能力很容易被其他 AI 产品追上。

我认为真正的竞争壁垒应该是：

## Persistent Knowledge Asset

持续积累、可编辑、可追溯、可复用的个人知识资产

1. Knowledge Continuity

AI 了解用户过去研究过什么，避免每次从零开始。

2. Evidence Provenance

每个重要结论都能回到原始来源。

3. Editable Artifacts

用户可以精细修改和持续演化知识产物。

4. Personal Knowledge Graph

用户自己决定知识如何关联。

5. Cross-device Workflow

所有设备围绕同一套知识资产工作。

6. Continuous Learning

系统能够持续帮助用户学习、维护和更新知识。

换句话说：

用户真正依赖的不是 AI 曾经回答过多少问题，而是自己在这个系统中积累了多少有价值的知识。

这才是长期留存的基础。

## 9.2 订阅模式建议

我建议采用个人订阅 + 团队订阅 + 企业方案。

| 产品版本   | 目标用户       | 权益方向                           |
| ---------- | -------------- | ---------------------------------- |
| Free       | 普通体验用户   | 基础 Workspace、有限 AI 使用       |
| Plus       | 高频学习用户   | 更多研究额度、文档处理、跨设备同步 |
| Pro        | 深度研究用户   | 高级研究、更多 Agent、批量处理     |
| Team       | 研究小组、团队 | 共享空间、协作、权限管理           |
| Enterprise | 企业和机构     | 管理、审计、数据治理、定制部署     |

不建议把基本的知识资产编辑、数据导出和用户数据所有权做成昂贵套餐的专属权益。

真正适合差异化收费的是：

- AI 研究计算资源。
- 高级模型。
- 大批量文献解析。
- 自动化研究。
- 高级协作。
- 团队管理。
- 企业级安全与部署。

另外，建议为 Pro 用户考虑 BYOK（Bring Your Own Key），允许有能力的用户使用自己的模型 API Key，但要严格限制密钥权限和安全存储。

## 9.3 产品增长指标

不要把 DAU、提问数量和 AI 生成数量当作唯一成功指标。

对于这个项目，我更建议使用：

## North Star Metric

每周被用户再次编辑、引用或复用的知识产物数量。

Weekly Reused Knowledge Assets

其他关键指标：

- Time to First Useful Artifact：首次产生有价值产物的时间。
- Artifact Acceptance Rate：AI 产物接受率。
- Artifact Revision Rate：用户实际编辑率。
- Knowledge Reuse Rate：知识复用率。
- Source Reuse Rate：来源复用率。
- Research Completion Rate：研究任务完成率。
- 7-day / 30-day Retention：用户留存。
- Cost per Accepted Artifact：每个有效产物的成本。

我尤其重视 Knowledge Reuse Rate。

用户如果每次只是生成一份文档，然后再也不打开，说明系统虽然能够生产内容，却没有形成真正的知识资产。

反过来，如果用户经常回到以前的 Artifact，引用旧知识、补充新证据、建立新关系，才说明 Workspace 产生了长期价值。

# 十、建议新增的业务模块与架构组件

把前面的建议整合起来，我认为需要在原有架构中增加以下模块。

| 新模块                  | 主要职责             | 优先级 |
| ----------------------- | -------------------- | ------ |
| Learning Journey Engine | 学习目标、进度、复习 | P1     |
| Capture Inbox           | 资料收集与暂存       | P0     |
| Source Library          | 来源管理             | P0     |
| Knowledge Lifecycle     | 知识版本、过时、冲突 | P1     |
| Knowledge Maintenance   | 知识维护中心         | P1     |
| Personalization Engine  | 用户偏好             | P1     |
| Cost Management Engine  | 成本和预算           | P0     |
| Data Governance Layer   | 隐私、权限、数据保留 | P0     |
| Sync Engine             | 多端同步             | P0     |
| Automation Engine       | 持续研究和定时任务   | P1     |
| Import / Backup Manager | 数据迁移与备份       | P0     |
| Team Workspace          | 团队协作             | P2     |
| Integration Platform    | 第三方集成           | P2     |
| Skill Marketplace       | 能力生态             | P2     |
| Evaluation Platform     | 质量评测与回归       | P0     |

这里的优先级含义：

- P0：首个可用版本必须具备。
- P1：产品验证后尽快增加。
- P2：规模化之后再考虑。

注意，P0 不意味着每个模块都必须独立部署。它们可以是现有后端中的逻辑模块。

## 10.1 更新后的整体系统架构

我建议将产品扩展为下面的结构：

![mermaid-diagram (16)](C:\Users\Y9000P-2025\Downloads\mermaid-diagram (16).png)

这里最重要的调整是：

原来架构以 Agent 为核心执行系统。

扩展后，Agent 仍然负责智能任务，但产品本身增加了学习管理、资料管理、知识维护、成本治理和自动化能力。

也就是说，Agent 不再承担所有业务逻辑。

# 十一、建议增加的数据库和 API

为了避免以后重新设计数据库，我建议提前考虑以下扩展。

## 11.1 数据库新增表

| 表                         | 用途               |
| -------------------------- | ------------------ |
| `capture_items`            | 待处理资料         |
| `source_snapshots`         | 来源内容快照       |
| `source_rights`            | 来源使用规则记录   |
| `source_reviews`           | 来源审核状态       |
| `document_quality_reports` | 文档解析质量       |
| `claim_versions`           | Claim 历史版本     |
| `knowledge_reviews`        | 知识核查记录       |
| `knowledge_change_events`  | 知识变化事件       |
| `learning_goals`           | 学习目标           |
| `learning_tasks`           | 学习任务           |
| `learning_progress`        | 学习进度           |
| `review_cards`             | 记忆卡片           |
| `user_preferences`         | 用户偏好           |
| `cost_records`             | 资源成本           |
| `usage_quotas`             | 使用额度           |
| `automations`              | 自动化任务         |
| `automation_runs`          | 自动化执行记录     |
| `teams`                    | 团队               |
| `team_members`             | 团队成员           |
| `comments`                 | 协作评论           |
| `data_export_jobs`         | 数据迁移与导出任务 |

## 11.2 API 新增建议

```
# 资料收集
POST   /v1/capture-items
GET    /v1/capture-items
PATCH  /v1/capture-items/{id}
POST   /v1/capture-items/{id}/process

# 来源管理
GET    /v1/sources
GET    /v1/sources/{id}
GET    /v1/sources/{id}/dependencies
POST   /v1/sources/{id}/revalidate

# 知识维护
GET    /v1/knowledge/reviews
POST   /v1/knowledge/reviews/{id}/resolve
GET    /v1/knowledge/impact-analysis

# 学习管理
POST   /v1/learning-goals
GET    /v1/learning-goals
POST   /v1/learning-tasks
GET    /v1/learning-progress

# 用户偏好
GET    /v1/preferences
PATCH  /v1/preferences

# 成本管理
GET    /v1/usage
GET    /v1/usage/costs
GET    /v1/usage/quotas

# 自动化
POST   /v1/automations
GET    /v1/automations
PATCH  /v1/automations/{id}
POST   /v1/automations/{id}/pause

# 数据迁移
POST   /v1/exports/workspace
GET    /v1/exports/{id}
POST   /v1/imports/workspace
```

API 需要继续沿用现有的权限、版本、幂等性和审计机制。

# 十二、最终开发优先级：不要让扩展拖垮 MVP

我建议把所有问题分成三个阶段。

## Phase A · MVP 必须补齐

P0

目标：证明核心产品价值，并具备可靠的基本使用能力。

- Capture Inbox。

- Source Library 基础功能。

- 临时回答、知识片段、正式 Artifact 三种生命周期。

- 字符级富文本编辑。

- AI Patch / Diff / Undo。

- Source / Evidence / Claim 完整追溯。

- 基础知识关系审核。

- Research Run 暂停、取消、恢复。

- Cost Management。

- 数据权限和隐私治理。

- 基础多端同步。

- Markdown / PDF / DOCX / JSON 导出。

- Workspace 完整备份和恢复。

- Agent Evaluation 基础测试集。

  ## Phase B · 产品成熟期

  P1

  目标：提升用户留存、知识复用和产品差异化。

- Learning Journey。

- Active Recall 和间隔复习。

- Knowledge Lifecycle。

- Knowledge Maintenance Center。

- 跨来源观点冲突分析。

- 持续研究与自动监控。

- 高级浏览器扩展。

- 个性化学习偏好。

- 高级图谱视图。

- 多设备冲突解决优化。

  ## Phase C · 生态与商业化

  P2

  目标：扩大市场、建立团队和企业收入。

- Team Workspace。

- 实时协作。

- Skill Marketplace。

- Artifact Template Marketplace。

- 第三方 API / SDK。

- MCP 集成。

- 企业权限与审计。

- 私有模型和 BYOK。

- 企业部署。

- 高级跨设备协同。

## 12.1 我建议的 MVP 验收门槛

不要以「所有功能都已经开发」作为 MVP 完成标准。

应该以一个完整用户任务闭环作为验收对象。

例如：

用户输入：

「帮我系统学习 Graph Neural Networks，并重点理解它在材料物性预测中的应用。」

系统必须能够：

1. 理解用户的学习目标。
2. 生成合理的研究计划。
3. 检索并收集资料。
4. 解析论文、图片和其他资料。
5. 提取 Claim 和 Evidence。
6. 建立知识节点和关系建议。
7. 生成可编辑 Artifact。
8. 允许用户逐字修改。
9. 允许用户让 AI 修改指定内容。
10. 修改后保留来源和版本。
11. 支持知识图谱和其他视图。
12. 导出 Markdown、PDF、DOCX。
13. 在另一台设备打开并继续编辑。
14. 中断研究后可以恢复。
15. 用户可以完整导出自己的知识资产。

只要这个闭环稳定，产品就已经具有比较完整的核心价值。

# 十三、另外三个值得提前考虑的战略问题

这些不是必须立即开发的功能，但会影响未来的产品方向。

## 13.1 是否支持多模型供应商？

目前采用 DeepSeek 是合理的。

但建议从一开始保留 Model Gateway 的多供应商能力。

未来可能需要：

- DeepSeek：主要推理。
- 其他模型：视觉、OCR、复杂推理。
- Embedding 专用模型。
- 本地模型：隐私敏感任务。
- 用户自定义 API：高级用户。

我不建议现在就接入大量模型。

但一定不要让业务 Agent 直接依赖 DeepSeek 特有的参数和响应格式。

## 13.2 是否支持用户自己的本地知识库？

建议作为长期方向。

例如：

用户在 Windows 上有大量本地 PDF、Markdown、代码和研究资料。

可以提供：

- 用户授权目录。
- 本地文件索引。
- 增量扫描。
- 文件变化检测。
- 本地检索。
- 选择性上传。
- 私有资料处理模式。

这样可以进一步降低云端存储和文件上传成本。

但要注意，不能为了实现本地知识库而在所有设备上复制完整 Agent Runtime。

## 13.3 是否支持多模态学习？

建议后续扩展到：

| 类型   | 功能                     |
| ------ | ------------------------ |
| 图片   | 图片理解、图表解析、标注 |
| 音频   | 录音转写、课程笔记       |
| 视频   | 课程摘要、时间戳引用     |
| 幻灯片 | PPT 解析、演讲内容提取   |
| 手写   | 笔记识别、公式识别       |
| 代码   | 代码分析、技术知识图谱   |

其中我尤其建议增加音视频学习。

用户可以导入一节课程录音或视频，AI 自动：

1. 转写。
2. 按主题切分。
3. 提取关键概念。
4. 关联课件和论文。
5. 生成课程 Artifact。
6. 生成复习卡片。

这和现有的知识生产体系非常契合。

# 十四、最终审查结果：哪些问题必须在架构冻结前解决？

我将建议归纳成一张决策表。

| 问题                        | 我的建议                      | 是否需要修改现有架构 |
| --------------------------- | ----------------------------- | -------------------- |
| 每次提问都生成正式 Artifact | 改为三级产物生命周期          | 是                   |
| 学习过程缺少管理            | 增加 Learning Journey         | 是                   |
| 资料收集入口不足            | 增加 Capture Inbox            | 是                   |
| Source 缺少生命周期         | 增加快照和状态追踪            | 是                   |
| Knowledge 缺少时效管理      | 增加 Lifecycle                | 是                   |
| 多 Agent 信息污染           | 强制 Claim / Evidence ID 传递 | 是                   |
| Validator 误判              | 增加 Calibration              | 是                   |
| Artifact 编辑冲突           | 强化事务、版本和锚点          | 是                   |
| 文档解析质量不透明          | 增加质量报告                  | 是                   |
| 搜索结果不可靠              | 增加检索评估                  | 是                   |
| 用户隐私治理不足            | 增加 Data Governance          | 是                   |
| 版权风险                    | 增加 Source Rights Management | 是                   |
| Agent 执行成本不可控        | 增加 Cost Management          | 是                   |
| 多端存储压力                | 增加 Storage Manager          | 是                   |
| 知识资产不能完整迁移        | 增加 Workspace Backup         | 是                   |
| 团队协作                    | 后期扩展                      | 否，预留             |
| 学习复习系统                | 第二阶段                      | 否，预留             |
| 插件生态                    | 长期扩展                      | 否，预留             |
| 多模型接入                  | 保持 Gateway 抽象             | 不需要大改           |
| CRDT 实时协作               | 暂缓                          | 不需要现在引入       |

# 十五、我最终建议：项目应该向什么方向发展？

我认为这个项目有三个阶段的产品形态。

STAGE 01

# AI Knowledge Workspace

[Anara 3.0: A new kind of scientific instrument | Anara Updates](https://images.openai.com/static-rsc-4/pn-ibWmF2U_yiQxfMLj1EzAocytiqURfWRAIlLM3wit0RQ3j-N3LSn6A0PsYj3q0RQHjYKFDaRuFGIKt1sDHWL8PVSSjyXS1Arm0SM5Q68fNaDAYUl7RsNUZoXXScBWcSS4EYT4ETKlfwk_gE7Q8zHIxe16J_0R9NRtbbIG50KM?purpose=inline)

[anara.com](https://anara.com/updates/three?utm_source=chatgpt.com)

AI 知识生产工作空间

用户提出学习目标，AI 自动检索、解析、整理、生成可编辑知识产物。

核心价值：让学习和资料整理的效率大幅提升。

STAGE 02

# AI Learning Companion

[Gamification AI Learning Platform | Kode Desain by Muhammad Harun on Dribbble](https://images.openai.com/static-rsc-4/k8vfe7cadEQ1KYEEUMLH4PkFsx7qatUrFPtQGnxqq6o92QipWzbZmAcipsoHJEchxTV_1qiBX7pHiALvg6KK-NC-q4eB008EV4YEQ7-Xe5_7_34XiqNbBgnN2pNCVf5ISCWxe97GQqzfpNi7jpDyUlxINjY3nNDwpP2tVUwSxYY?purpose=inline)

[dribbble.com](https://dribbble.com/shots/27185620-Gamification-AI-Learning-Platform-Kode-Desain?utm_source=chatgpt.com)

AI 长期学习伙伴

系统持续了解用户已经学习过的知识，发现薄弱点，组织复习，追踪研究主题。

核心价值：帮助用户真正掌握和持续积累知识。

STAGE 03

# Personal Knowledge Operating System

[LLM Wiki: 문서를 자동으로 위키 형태 지식 베이스로 컴파일하는 데스크톱 애플리케이션 (feat. Karpathy LLM Wiki 패턴) - 읽을거리&정보공유 - PyTorchKR](https://images.openai.com/static-rsc-4/b4LxojBMCXz9ZJFFi8gSe3-L4OdW0lIyUTGXuK5A1N2KdGw3gHN0fZweOzzLT3EQFoXAC--YuMpXMSf5FDHoNL2UciSAxQ62OobsdSSBOVbm-VM_ilC6vwnhVTOUIUsu92j1mHRscKIES1nRUoviLUlqyjlDqk49b0z5A81-m9A?purpose=inline)

[discuss.pytorch.kr](https://discuss.pytorch.kr/t/llm-wiki-feat-karpathy-llm-wiki/10139?utm_source=chatgpt.com)

个人知识操作系统

整合浏览器、文件、研究、学习、工作、自动化和第三方工具。

核心价值：成为用户管理和利用知识的长期数字基础设施。

我不建议现在就把目标设定成开发一个取代浏览器、笔记软件、学习软件和研究软件的超级平台。

应该先把 Stage 01 做到非常好，再自然扩展到 Stage 02 和 Stage 03。

## 最后，我认为最值得优先做的五项调整

如果现在让我决定下一轮架构调整，我会按照以下顺序：

01

建立完整的知识生命周期

解决知识过时、来源失效、结论冲突和证据追踪问题。

02

建立 Capture Inbox + Source Library

让用户可以从任何地方收集资料，而不只是通过 AI 搜索。

03

强化 Artifact 的编辑和版本机制

确保字符级编辑、AI Patch、用户修改和跨设备同步不会互相破坏。

04

建立 Cost & Data Governance

解决模型成本、预算控制、隐私和版权问题。

05

增加 Learning Journey

让产品从资料整理工具发展为长期学习平台。

我的最终判断：这个项目目前最大的机会，是建立一个真正以用户知识资产为中心的 AI 系统；最大的风险，则是把过多精力花在 Agent、平台和功能数量上，却没有把知识的产生、编辑、维护和复用这条完整生命周期做好。

我建议下一轮不要继续大规模扩展 Agent 数量，而是先把上述五项调整落实为正式的架构决策和开发规范。这样既不会推翻现有架构，也能避免后期出现代价很高的返工。