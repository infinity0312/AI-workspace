# AI Knowledge Workspace：Agent 端与后端完整技术架构设计

ARCHITECTURE MASTER SPECIFICATION · V2.0 · 2026-11-08

这次我建议对之前的架构进行一次真正的重构，而不是简单增加几个 Agent、几个 Worker 和几个验证器。

你现在提出的要求实际上涉及三个核心问题：

1. Agent 如何规范化工作？ 不同 Agent 如何接收任务、执行任务、提交结果，避免每个 Agent 都有自己的工作方式？
2. 如何保证输出质量？ 如何验证 Agent 是否完成任务、输出是否符合 Schema、事实是否可靠、证据是否充分？
3. 如何合理解耦？ 哪些模块必须独立，哪些模块应该合并，怎样避免过度微服务化和多层调用造成的性能损失？

我认为需要首先确立一个架构原则：

> Agent 可以自主思考和选择执行策略，但不能自主定义系统的数据协议、权限规则和质量标准。

也就是说：

- Agent 的执行策略可以灵活。
- Agent 的工具可以扩展。
- Agent 的模型可以替换。
- Agent 的输出必须规范化。
- Agent 的关键操作必须经过验证。
- 知识数据的正式修改必须遵循统一规则。
- 整个任务必须可以追踪、恢复和审计。

这比单纯使用多 Agent 协作更重要。

# 第一部分：最终架构总览

## 1.1 核心架构决策

我建议将整个系统设计为：

Modular Knowledge Backend + Agent Runtime + Durable Workflow Orchestrator + Validation & Governance Layer

中文可以理解为：

模块化知识后端 + Agent 执行环境 + 持久化工作流调度 + 统一验证与治理层。

不建议把整个后端做成微服务，也不建议让 Agent 自己承担所有工作流管理。

采用：

- 业务后端：模块化单体。
- Agent Runtime：独立执行进程。
- 数据处理：独立 Worker Pool。
- 工作流：MVP 自研 DAG + Celery，后期可迁移 Temporal。
- 数据库：PostgreSQL + pgvector。
- 文件存储：S3 兼容存储。
- 消息与缓存：Redis。
- 模型：DeepSeek API。
- 前端通信：REST + SSE。

## 1.2 最终系统架构

![mermaid-diagram (7)](C:\Users\Y9000P-2025\Downloads\mermaid-diagram (7).png)

这里有一个需要特别强调的地方：

Validation & Governance 不是一个普通的 Agent，而是一组位于 Agent 执行路径上的系统级控制机制。

不能让 Agent 自己说自己完成了验证，然后系统就接受它的结果。

## 1.3 系统划分与解耦边界

我建议将系统分成六个逻辑层，但只部署为有限数量的运行单元。

| 层级                  | 核心职责                                     | 部署建议                 |
| --------------------- | -------------------------------------------- | ------------------------ |
| Application Layer     | 用户、项目、Workspace、Artifact API          | FastAPI                  |
| Orchestration Layer   | 任务规划、DAG、状态、调度                    | 独立 Orchestrator Worker |
| Agent Runtime         | Agent 执行、模型调用、工具调用               | 独立 Agent Worker        |
| Governance Layer      | Schema、权限、证据、质量门控                 | 同进程库 + 验证 Worker   |
| Knowledge Layer       | Source、Evidence、Claim、Knowledge、Artifact | FastAPI 模块化单体       |
| Data Processing Layer | PDF、OCR、图片、Embedding、导出              | 独立 Worker Pool         |

为什么不把每一层都部署成微服务？

因为我们现在仍然处于产品构建阶段。

如果把 Agent、Validator、Evidence、Knowledge、Artifact、Tool Registry 全部拆成独立服务，会产生：

- 大量网络调用。
- 复杂的服务发现。
- 重复序列化。
- 事务一致性问题。
- 部署和监控成本。
- 更复杂的调试过程。

我建议采用逻辑强解耦、物理适度合并：

- 模块之间通过稳定接口通信。
- 同进程的轻量调用直接使用函数或 Python 对象。
- 跨进程的耗时任务使用队列。
- 需要持久化和恢复的任务使用 Workflow Engine。
- 不允许因为模块独立就强制增加一次 HTTP 请求。

这会是本项目更合适的工程取舍。

# 第二部分：Agent Runtime——整个系统的执行标准

我认为这是这次架构最需要重点设计的部分。

之前的架构虽然有 Research Agent、Knowledge Agent、Literature Agent 等专业角色，但缺少一个非常关键的东西：

所有 Agent 必须遵循统一的执行协议。

否则后期会出现：

- Research Agent 输出 Markdown。
- Literature Agent 输出自定义 JSON。
- Knowledge Agent 输出一组 Python 对象。
- Verification Agent 输出自然语言评价。
- Artifact Agent 直接修改数据库。

最终 Orchestrator 无法统一管理。

所以我建议建立一个：

Standard Agent Execution Protocol（SAEP）

它规定所有 Agent 的任务输入、执行状态、工具调用、结果输出和失败行为。

## 2.1 Agent 的标准结构

每个 Agent 由六个部分组成：

```
Agent
│
├── Agent Manifest
│
├── Instruction Profile
│
├── Input Contract
│
├── Execution Strategy
│
├── Skill / Tool Permissions
│
└── Output Contract
```

具体解释：

| 部分                | 职责                        |
| ------------------- | --------------------------- |
| Manifest            | 描述 Agent 身份、能力、版本 |
| Instruction Profile | 定义角色和任务要求          |
| Input Contract      | 定义允许接收的数据          |
| Execution Strategy  | 定义执行模式和循环          |
| Skill Permissions   | 定义可使用的工具            |
| Output Contract     | 定义必须提交的结果格式      |

Agent 不能直接随意调用系统内所有功能。

每个 Agent 只获得完成自身任务所需要的权限。

## 2.2 Agent Manifest

建议采用 YAML 作为开发期配置，运行时转换为 Pydantic 模型。

例如：

```
agent:
  id: literature_research
  name: Literature Research Agent
  version: "1.0.0"

  description: >
    负责学术文献检索、筛选、元数据提取
    和研究内容分析。

  capabilities:
    - literature_search
    - metadata_extraction
    - paper_analysis
    - citation_extraction

  execution:
    strategy: react
    max_iterations: 8
    timeout_seconds: 300

  model_profile:
    task: literature_research
    reasoning_effort: high

  allowed_skills:
    - search_papers
    - fetch_paper
    - parse_pdf
    - extract_metadata

  input_contract:
    schema: LiteratureTaskInput
    version: "1.0"

  output_contract:
    schema: LiteratureTaskOutput
    version: "1.0"

  validation:
    required:
      - schema_validation
      - source_validation
      - metadata_validation

    optional:
      - relevance_evaluation
```

这里的重点是：

Agent Manifest 负责声明能力和约束，不能让 LLM 自己决定权限。

另外，`execution.strategy` 不应该限制所有 Agent 使用同一种算法。

可以是：

- react
- plan_execute
- map_reduce
- structured_extraction
- synthesis
- evaluator

但这些都是 Runtime 支持的执行策略，不是 Agent 自己任意编写和加载代码。

## 2.3 Agent 标准输入协议

所有 Agent 都接收一个统一的 Task Envelope。

```
{
  "task_id": "task_001",
  "run_id": "run_001",
  "workspace_id": "ws_001",

  "agent_id": "literature_research",
  "agent_version": "1.0.0",

  "task_type": "literature_search",

  "objective": {
    "description": "查找尖晶石材料GNN物性预测相关论文",
    "expected_outcomes": [
      "相关论文列表",
      "研究方法总结",
      "关键实验结论"
    ]
  },

  "input_refs": {
    "source_ids": [],
    "artifact_ids": [],
    "knowledge_node_ids": []
  },

  "constraints": {
    "max_sources": 30,
    "time_range": null,
    "language": ["en", "zh"],
    "allowed_domains": [],
    "excluded_domains": []
  },

  "permissions": {
    "read_sources": true,
    "read_knowledge": true,
    "write_knowledge": false,
    "write_artifact": false
  },

  "budget": {
    "max_model_calls": 20,
    "max_tool_calls": 30,
    "max_tokens": 30000,
    "timeout_seconds": 600
  },

  "output_schema": "LiteratureTaskOutput@1.0"
}
```

这里有几个设计细节：

第一，尽可能传引用，不传大型原始数据。

例如：

```
{
  "source_ids": ["src_001", "src_002"]
}
```

比直接传入两篇 PDF 的全文更好。

Agent 需要内容时，通过受控 Retrieval Skill 获取。

这样能够降低上下文长度、网络传输和序列化成本。

第二，权限必须由后端生成。

不能允许 Planner 通过 LLM 生成的 JSON 自行赋予 Agent 权限。

第三，预算由 Orchestrator 控制。

Agent 只能在预算范围内执行，不能自行提高上限。

# 第三部分：Agent 输出标准化——核心数据协议

这是我认为整个系统最应该投入设计时间的地方。

我建议所有 Agent 的输出统一为：

Agent Result Envelope + Typed Payload + Evidence References + Execution Metadata

不允许专业 Agent 随意定义顶层输出结构。

## 3.1 统一 Agent Result Envelope

所有 Agent 无论完成什么任务，都必须返回统一的顶层结构。

```
{
  "protocol_version": "1.0",

  "task_id": "task_001",
  "run_id": "run_001",

  "agent": {
    "id": "literature_research",
    "version": "1.0.0"
  },

  "status": "succeeded",

  "result": {
    "schema": "LiteratureTaskOutput",
    "schema_version": "1.0",
    "data": {}
  },

  "references": {
    "source_ids": [],
    "evidence_ids": [],
    "knowledge_node_ids": [],
    "artifact_ids": []
  },

  "quality": {
    "validation_status": "pending",
    "warnings": [],
    "missing_fields": []
  },

  "execution": {
    "model_calls": 4,
    "tool_calls": 7,
    "input_tokens": 8000,
    "output_tokens": 2500,
    "duration_ms": 32000
  },

  "uncertainties": [],

  "errors": []
}
```

这里要区分：

- `status`：Agent 是否成功执行。
- `validation_status`：结果是否通过系统验证。

这两个状态不能合并。

例如：

Agent 成功检索到论文，但输出的 DOI 全部无法验证。

此时：

```
Agent Status = SUCCEEDED
Validation Status = FAILED
```

这是一种非常重要的系统状态。

Agent 运行成功不代表结果可信。

## 3.2 Agent 输出状态规范

建议统一以下状态：

| 状态        | 含义             |
| ----------- | ---------------- |
| SUCCEEDED   | 成功提交结果     |
| PARTIAL     | 部分完成         |
| NEEDS_INPUT | 需要用户提供信息 |
| BLOCKED     | 被权限或依赖阻塞 |
| FAILED      | 执行失败         |
| CANCELLED   | 被取消           |
| TIMED_OUT   | 超时             |

不要只使用 `success / error` 两种状态。

尤其是研究任务，经常会遇到资料不足但已经完成部分研究的情况。

这时不应该直接将所有结果丢弃。

## 3.3 专业 Agent 使用不同 Payload Schema

统一顶层 Envelope，不意味着所有 Agent 必须输出同一种业务 JSON。

应该使用：

统一 Envelope + 不同的 Typed Payload。

例如：

### Literature Agent

```
{
  "papers": [
    {
      "source_id": "src_001",
      "title": "Graph Neural Networks for Materials Science",
      "doi": "10.xxxx/example",
      "year": 2024,
      "relevance": 0.92,
      "research_question": "...",
      "methods": [],
      "findings": [],
      "limitations": [],
      "evidence_ids": []
    }
  ]
}
```

### Knowledge Agent

```
{
  "nodes": [
    {
      "temporary_id": "tmp_node_001",
      "name": "GraphSAGE",
      "node_type": "method",
      "definition": "...",
      "evidence_ids": []
    }
  ],

  "suggested_edges": [
    {
      "source_temporary_id": "tmp_node_001",
      "target_temporary_id": "tmp_node_002",
      "relation_type": "related_to",
      "reason": "...",
      "evidence_ids": []
    }
  ]
}
```

注意，这里只能生成 `suggested_edges`，不能直接创建用户正式知识关系。

### Verification Agent

```
{
  "claims": [
    {
      "claim_id": "claim_001",
      "verdict": "supported",
      "supporting_evidence_ids": [
        "ev_001"
      ],
      "contradicting_evidence_ids": [],
      "limitations": [],
      "reason": "..."
    }
  ]
}
```

### Artifact Agent

```
{
  "artifact_draft": {
    "artifact_type": "document",
    "title": "GNN物性预测研究",
    "blocks": []
  },

  "source_links": [],
  "evidence_links": [],
  "knowledge_links": []
}
```

这些 Payload 必须有明确的 Pydantic Schema 和 JSON Schema。

不能让 Agent 每次自己决定字段名称。

## 3.4 Pydantic 与 JSON Schema 双层约束

建议 Python 后端采用 Pydantic V2。

例如：

```
from pydantic import BaseModel, Field
from typing import Literal, Generic, TypeVar

T = TypeVar("T")


class AgentIdentity(BaseModel):
    id: str
    version: str


class AgentReferenceSet(BaseModel):
    source_ids: list[str] = []
    evidence_ids: list[str] = []
    knowledge_node_ids: list[str] = []
    artifact_ids: list[str] = []


class QualityReport(BaseModel):
    validation_status: Literal[
        "pending",
        "passed",
        "failed",
        "partial"
    ]

    warnings: list[str] = []
    missing_fields: list[str] = []


class AgentResult(BaseModel, Generic[T]):
    protocol_version: str = "1.0"

    task_id: str
    run_id: str

    agent: AgentIdentity

    status: Literal[
        "succeeded",
        "partial",
        "needs_input",
        "blocked",
        "failed",
        "cancelled",
        "timed_out"
    ]

    result: T

    references: AgentReferenceSet

    quality: QualityReport
```

正式工程中还需要：

- 使用 `default_factory` 管理可变默认值。
- 为每个 Payload 定义独立 Schema。
- 定义严格的字段类型。
- 定义枚举值。
- 定义最大数组长度和字符串长度。
- 为协议增加版本管理。
- 对不允许的额外字段使用严格校验。
- 对时间、数值、ID 等进行格式校验。

关键原则：LLM 生成的是候选数据，Pydantic 验证后才是系统接受的结构化数据。

但要注意，Pydantic 只能验证结构，不能证明事实正确。

这就引出下一部分。

# 第四部分：Validator 与 Gate 系统

我建议将验证系统设计成独立的架构模块：

Validation & Governance Engine（VGE）

它不是一个单独的大模型，也不是一个 Agent。

它由多个不同性质的验证器组成。

其中：

- 结构验证尽量使用代码。
- 权限验证必须使用代码。
- 引用验证尽量使用原始数据和外部接口。
- 证据支持程度可以结合规则和模型。
- 内容质量可以使用专门的 Evaluator。
- 最终写入由 Commit Gate 控制。

不要把所有验证工作都交给 LLM。

## 4.1 验证系统整体架构

![mermaid-diagram (8)](C:\Users\Y9000P-2025\Downloads\mermaid-diagram (8).png)

但这里不能简单地理解为每一个 Agent 都必须串行经过七次验证。

这是验证能力的集合，实际执行应当根据输出类型和风险等级选择验证路径。

例如：

- 一个 Query Rewrite 任务只需要结构验证和长度检查。
- 一个 Literature Agent 需要来源与元数据验证。
- 一个 Claim Extraction 任务需要证据验证。
- 一个 Artifact 修改任务需要 Schema、版本和权限验证。

这样才能避免验证系统本身成为性能瓶颈。

## 4.2 七类验证器的具体职责

| 验证器               | 验证内容                        | 实现方式                 | 失败处理             |
| -------------------- | ------------------------------- | ------------------------ | -------------------- |
| Protocol Validator   | JSON、字段、类型、Schema 版本   | Pydantic / JSON Schema   | 拒绝或修复           |
| Permission Validator | 用户权限、Agent 权限、资源范围  | RBAC / ACL / Policy      | 直接阻止             |
| Reference Validator  | Source、Evidence、Node 是否存在 | 数据库查询、URL 校验     | 拒绝或补充           |
| Provenance Validator | 引用内容是否来自指定来源        | 原文定位、Hash、解析记录 | 隔离或修复           |
| Evidence Validator   | 证据是否支持 Claim              | 规则 + LLM Evaluator     | 补充证据或标记不确定 |
| Semantic Validator   | 内容是否矛盾、遗漏、越界        | 规则 + 模型评估          | 局部修复             |
| Quality Evaluator    | 完整性、相关性、可读性          | 指标 + LLM Judge         | 局部修复或部分通过   |

这里我建议把 Reference Validator 和 Provenance Validator 分开。

例如：

某个 Evidence ID 确实存在，说明它通过了 Reference Validator。

但它关联的原文可能并不包含 Agent 声称的那句话，这时 Provenance Validator 就应该失败。

同样，原文确实包含这句话，也不代表它足以支持当前 Claim，这属于 Evidence Validator 的工作。

这样每种验证都有明确边界。

## 4.3 Validation Report：统一验证结果协议

每个验证器都必须返回相同的 Validation Report。

```
{
  "validation_id": "val_001",
  "task_id": "task_001",
  "target_type": "agent_result",
  "target_id": "result_001",

  "status": "partial",

  "checks": [
    {
      "check_id": "schema_check",
      "status": "passed",
      "severity": "critical",
      "validator": "protocol_validator",
      "code": null,
      "message": "Schema validation passed"
    },
    {
      "check_id": "evidence_check",
      "status": "failed",
      "severity": "high",
      "validator": "evidence_validator",
      "code": "INSUFFICIENT_EVIDENCE",
      "message": "Claim is not adequately supported",
      "affected_refs": ["claim_002"]
    }
  ],

  "repairable": true,

  "repair_instructions": [
    {
      "target": "claim_002",
      "action": "retrieve_more_evidence",
      "reason": "Missing supporting source"
    }
  ],

  "approved_fields": [],
  "rejected_fields": ["claim_002"],

  "created_at": "2026-11-08T10:00:00Z"
}
```

统一状态：

- `PASSED`
- `FAILED`
- `PARTIAL`
- `WARNING`
- `SKIPPED`
- `NEEDS_HUMAN_REVIEW`

统一严重程度：

- `CRITICAL`
- `HIGH`
- `MEDIUM`
- `LOW`
- `INFO`

这里有一个关键设计：

验证结果必须精确定位到失败的字段、Block、Claim 或关系，而不是只返回一个整体分数。

否则 Agent 无法进行针对性修复。

## 4.4 Hard Gate 与 Soft Gate

验证器不能全部采用同一种处理方式。

建议分为两种门控。

### Hard Gate：硬性门控

只要失败，就不能继续相关操作。

例如：

- JSON 无法解析。
- 必填字段缺失。
- 用户没有资源读取权限。
- Tool 参数不合法。
- 引用的资源不存在。
- Artifact 版本发生冲突。
- 用户没有批准高风险操作。
- 知识关系违反数据完整性约束。

这些检查必须由程序完成。

不能让 LLM 以高置信度绕过。

### Soft Gate：质量门控

允许部分通过，但需要明确记录问题。

例如：

- 来源数量不足。
- 某个 Claim 只有一篇论文支持。
- 研究范围没有完全覆盖。
- 某些结论存在争议。
- 某个图表缺少解释。
- 某个 Artifact Block 可读性较差。

这些问题可以：

- 局部修复。
- 补充检索。
- 降低结论确定性。
- 标记待确认。
- 将结果作为部分产物交给用户。

不要因为一个非关键结论存在不确定性，就丢弃整个研究成果。

## 4.5 按风险等级选择验证路径

我不建议所有 Agent 都经过七个验证器。

应该建立 Validation Profile。

| 风险等级 | 示例                               | 验证策略                                |
| -------- | ---------------------------------- | --------------------------------------- |
| L0       | Query Rewrite、普通摘要            | Schema + 基础检查                       |
| L1       | 资料提取、网页摘要                 | Schema + Source                         |
| L2       | Claim、知识节点候选                | Schema + Provenance + Evidence          |
| L3       | Artifact 正式修改                  | Schema + Permission + Version + Quality |
| L4       | 删除、发布、跨项目写入等高风险操作 | 全部必要检查 + 用户确认                 |

具体例子：

用户问：

「GraphSAGE 是什么？」

不需要启动完整的七层验证。

但用户要求：

「综合 30 篇论文，判断某种 GNN 是否适合尖晶石物性预测，并自动建立知识关系。」

就应该触发完整的研究质量门控。

这可以明显减少验证成本。

## 4.6 目标修复，而不是无限反思

这是 Validator 设计中最重要的效率优化。

不建议：

```
生成
  ↓
检查
  ↓
重新生成全部内容
  ↓
再次检查
  ↓
再生成全部内容
```

建议：

```
生成完整结果
      │
      ▼
验证失败
      │
      ▼
定位失败字段
      │
      ▼
生成 Repair Task
      │
      ▼
指定 Agent 修复局部内容
      │
      ▼
只重新验证受影响部分
      │
      ▼
通过 / 部分通过 / 人工处理
```

例如：

30 篇论文中，只有 2 篇论文的 DOI 无法验证。

不需要重新检索另外 28 篇。

只创建：

```
{
  "repair_task": {
    "type": "verify_paper_metadata",
    "target_ids": [
      "paper_012",
      "paper_021"
    ],
    "max_attempts": 2
  }
}
```

建议默认最多进行两轮自动修复。

如果仍然失败：

- 保留已通过的内容。
- 将失败项标记为待核实。
- 将错误原因写入 Validation Report。
- 必要时请求用户确认。

不要允许 Agent 在修复失败后无限自我循环。

## 4.7 Validator 如何解耦而不影响性能？

我建议采用三级执行方式。

Level 1 · Inline Validation

同步执行

- JSON 解析。
- Pydantic 校验。
- 字段检查。
- 枚举检查。
- 权限检查。
- ID 格式检查。

本地函数调用，尽量在毫秒级完成，不经过网络。

Level 2 · Data Validation

同步或批量执行

- Source 是否存在。
- Evidence 是否存在。
- 原文定位是否正确。
- Artifact 版本是否冲突。
- DOI / URL 是否有效。

批量 SQL 查询，尽可能一次性验证一组引用。

Level 3 · Semantic Validation

异步或按需执行

- Claim 是否被证据支持。
- 内容是否矛盾。
- 是否遗漏重要信息。
- Artifact 是否满足研究目标。

只在必要时调用 DeepSeek Evaluator，避免每个小字段都调用一次模型。

最重要的优化：Validator 在逻辑上独立，在物理上不必独立部署。

例如：

```
class ValidationEngine:

    def __init__(
        self,
        protocol_validator,
        permission_validator,
        reference_validator,
        evidence_validator,
        quality_evaluator
    ):
        self.protocol = protocol_validator
        self.permission = permission_validator
        self.reference = reference_validator
        self.evidence = evidence_validator
        self.quality = quality_evaluator

    async def validate(self, result, profile):

        report = await self.protocol.validate(result)

        if report.has_critical_error:
            return report

        report += await self.permission.validate(result)

        if profile.requires_reference:
            report += await self.reference.validate_batch(result)

        if profile.requires_evidence:
            report += await self.evidence.validate(result)

        if profile.requires_semantic:
            report += await self.quality.evaluate(result)

        return report
```

实际实现中，可以将互相独立的检查并行执行，但权限检查、数据完整性和写入检查必须保持正确的先后关系。

这样既能获得模块化，也不会为了每个验证器单独增加一次 HTTP 请求。

# 第五部分：Agent 标准执行生命周期

有了统一协议和验证器之后，还需要规定 Agent 从启动到结束的完整生命周期。

我建议所有 Agent 只能通过 Standard Agent Runtime 执行。

不能允许每个 Agent 自己创建一个独立的无限循环。

## 5.1 标准生命周期

```
TASK RECEIVED
      │
      ▼
1. Input Validation
      │
      ▼
2. Context Assembly
      │
      ▼
3. Execution Strategy
      │
      ▼
4. Model Invocation
      │
      ▼
5. Tool Call Parsing
      │
      ▼
6. Tool Permission Gate
      │
      ▼
7. Tool Execution
      │
      ▼
8. Observation Integration
      │
      ├──────► Continue
      │
      ▼
9. Final Result Generation
      │
      ▼
10. Output Validation
      │
      ▼
11. Result Submission
      │
      ▼
TASK COMPLETED
```

其中 4–8 可以重复执行，但必须受到预算和迭代次数限制。

## 5.2 Runtime 统一控制循环

建议实现类似这样的核心逻辑：

```
async def execute_agent(task, agent_manifest):

    # 1. Validate task
    input_result = validate_task(
        task,
        agent_manifest
    )

    if not input_result.passed:
        return blocked_result(input_result)

    # 2. Assemble context
    context = await context_builder.build(
        task.input_refs,
        task.permissions
    )

    # 3. Initialize budget
    budget = BudgetController(task.budget)

    # 4. Initialize execution state
    state = AgentExecutionState(
        task_id=task.task_id,
        context=context
    )

    # 5. Agent loop
    while not state.finished:

        budget.check()

        response = await model_gateway.invoke(
            agent_manifest=agent_manifest,
            state=state
        )

        parsed = response_parser.parse(response)

        if parsed.is_tool_call:

            tool_result = await tool_executor.execute(
                parsed.tool_call,
                task.permissions,
                budget
            )

            state.add_observation(tool_result)

        elif parsed.is_final:

            state.final_output = parsed.output
            state.finished = True

        else:

            state.record_warning(
                "Unexpected model response"
            )

    # 6. Validate output
    result = result_normalizer.normalize(
        state.final_output
    )

    validation = await validation_engine.validate(
        result,
        agent_manifest.validation_profile
    )

    # 7. Return standardized result
    return build_agent_result(
        result,
        validation,
        state
    )
```

这是架构示意，不是最终可直接部署的代码。正式实现还必须处理取消、超时、模型截断、流式中断、工具幂等和恢复。

## 5.3 Execution Strategy 必须可插拔

Runtime 负责控制生命周期，Strategy 负责执行方式。

建议第一版只实现五种：

| Strategy           | 用途                 | 是否采用 |
| ------------------ | -------------------- | -------- |
| Single Pass        | 一次模型调用完成提取 | 必须     |
| ReAct              | 多轮工具调用         | 必须     |
| Plan-and-Execute   | 复杂任务规划         | 必须     |
| Map-Reduce         | 大批量资料处理       | 必须     |
| Evaluator-Repair   | 定向修复             | 必须     |
| Multi-Agent Debate | 多视角辩论           | 暂缓     |
| Autonomous Swarm   | 多 Agent 自由协作    | 不采用   |

尤其建议增加 Single Pass。

例如：

用户上传一篇简单论文，要求提取标题、作者、摘要和 DOI。

没有必要启动一个完整的 ReAct Agent。

直接：

```
PDF Parser
    ↓
DeepSeek Structured Extraction
    ↓
Schema Validation
    ↓
Result
```

就足够了。

这样可以避免为了 Agent 而 Agent。

# 第六部分：Orchestrator 与 Workflow Engine

现在进一步明确 Orchestrator 的职责。

Orchestrator 不负责具体研究，不负责解析 PDF，也不负责写知识文档。它负责决定整个任务如何执行。

## 6.1 Orchestrator 内部组件

```
Orchestrator
│
├── Request Classifier
│
├── Context Resolver
│
├── Task Planner
│
├── Plan Validator
│
├── DAG Scheduler
│
├── Agent Router
│
├── Budget Controller
│
├── Policy Manager
│
├── Result Aggregator
│
├── Replanner
│
└── Workflow State Manager
```

### Request Classifier

识别用户意图。

建议使用规则 + DeepSeek 轻量调用。

不需要每次都使用高推理模型。

### Context Resolver

解析当前任务可以访问哪些信息：

- 当前 Workspace。
- 当前 Project。
- 用户指定的来源。
- 用户授权关联的知识节点。
- 已有 Artifact。
- 历史研究任务。

特别注意：不能因为两个项目存在知识关联，就自动将它们的全部资料放入上下文。

### Task Planner

生成结构化 Task DAG。

### Plan Validator

这是之前架构中需要补充的重要组件。

Planner 生成的 DAG 不能直接执行。

必须验证：

1. DAG 是否存在循环依赖。
2. Task 类型是否受支持。
3. Agent 是否存在。
4. 输入输出 Schema 是否兼容。
5. 权限是否足够。
6. 预算是否超过限制。
7. 并发数量是否合理。
8. 任务数量是否超过上限。
9. 是否存在无法满足的依赖。
10. 是否有不必要的重复任务。

例如：

```
{
  "task_id": "task_001",
  "agent": "literature_agent",
  "input_schema": "LiteratureTaskInput@1.0",
  "output_schema": "LiteratureTaskOutput@1.0",
  "dependencies": [],
  "acceptance_criteria": [
    "source_count >= 5",
    "metadata_validity >= 0.9"
  ]
}
```

如果 Agent 输出类型与下一个 Task 的输入类型不兼容，Plan Validator 应当在执行之前就拒绝这个计划。

这可以避免执行一半才发现任务无法衔接。

## 6.2 Task DAG 必须有类型系统

我建议不仅规定任务之间的依赖，还要规定输入输出类型。

例如：

```
SearchTask
    │
    ▼
SourceCollection
    │
    ▼
DocumentParsingTask
    │
    ▼
ParsedDocumentCollection
    │
    ▼
ClaimExtractionTask
    │
    ▼
ClaimCollection
    │
    ▼
EvidenceValidationTask
    │
    ▼
VerifiedClaimCollection
    │
    ▼
ArtifactCompositionTask
    │
    ▼
ArtifactDraft
```

每个节点都要声明：

- 输入类型。
- 输出类型。
- 前置依赖。
- 失败策略。
- 预算。
- 验收标准。

这实际上是一个面向知识生产的有类型工作流系统。

它比普通的 Agent-to-Agent 自然语言传递可靠得多。

## 6.3 复杂任务示例：尖晶石 GNN 研究

用户提出：

「研究尖晶石材料中使用 GNN 进行物性预测的可行性，比较不同模型并整理研究路线。」

Planner 生成：

![mermaid-diagram (9)](C:\Users\Y9000P-2025\Downloads\mermaid-diagram (9).png)

这里不需要让每个节点都对应一个独立 Agent。

例如：

- GNN 论文的 PDF 解析可以由普通 Worker 完成。
- 多篇论文的知识提取可以使用 Map-Reduce。
- 只有需要复杂推理的部分才交给 Literature Agent。
- 最后的综合分析交给 Synthesis Agent。

这样更高效。

## 6.4 Workflow 状态管理

Research Run 与 Task 必须分别维护状态。

Research Run：

```
CREATED
QUEUED
PLANNING
RUNNING
WAITING_FOR_USER
VALIDATING
COMPLETED
PARTIAL
FAILED
CANCELLED
```

Task：

```
PENDING
READY
RUNNING
SUCCEEDED
PARTIAL
FAILED
RETRYING
BLOCKED
SKIPPED
CANCELLED
```

还需要独立的 TaskAttempt。

例如某个 Task 执行三次：

```
Task T1
  ├── Attempt 1: Timeout
  ├── Attempt 2: Invalid Output
  └── Attempt 3: Success
```

不能直接覆盖之前的执行记录。

这样才能分析问题和进行成本统计。

# 第七部分：Skill 与 Tool 架构

我建议将 Skill 作为系统可复用能力的标准接口，而不是简单地把 Python 函数注册给模型。

Skill 是内部能力，Tool 是 Agent 可以调用的外部接口。

两者有关联，但不是同一个概念。

## 7.1 三层结构

```
Agent
  │
  ▼
Tool Definition
  │
  ▼
Skill Adapter
  │
  ▼
Domain Service / Infrastructure
```

例如：

```
Literature Agent
       │
       ▼
search_papers Tool
       │
       ▼
Literature Search Skill
       │
       ▼
Search Provider
       │
       ├── DeepSeek Search
       ├── Semantic Scholar
       ├── Crossref
       └── Other Providers
```

Agent 只知道 `search_papers`，不需要知道底层使用哪个搜索服务。

## 7.2 Skill Manifest

每个 Skill 必须具有统一声明：

```
skill:
  id: search_papers
  version: "1.0.0"

  description: >
    搜索学术论文并返回标准化的论文来源记录。

  input_schema: PaperSearchInput
  output_schema: PaperSearchResult

  execution:
    mode: async
    timeout_seconds: 60
    idempotent: true

  permissions:
    required:
      - source.search

  side_effect:
    type: read_only

  resource:
    cost_class: low
    concurrency_group: search

  retry:
    max_attempts: 2
    strategy: exponential_backoff
```

`side_effect` 建议使用四种类型：

| 类型            | 含义       | 示例                |
| --------------- | ---------- | ------------------- |
| READ            | 只读       | 搜索论文            |
| WRITE_DRAFT     | 写入草稿   | 生成 Artifact Draft |
| WRITE_COMMIT    | 正式修改   | 保存正式知识节点    |
| EXTERNAL_ACTION | 外部副作用 | 发布、分享、发送    |

不同类型需要不同的 Tool Gate。

## 7.3 Tool Input / Output 标准化

所有 Skill 返回统一 Tool Result：

```
{
  "tool_call_id": "call_001",
  "skill_id": "search_papers",
  "skill_version": "1.0.0",

  "status": "succeeded",

  "data": {
    "source_ids": [
      "src_001",
      "src_002"
    ]
  },

  "references": {
    "source_ids": [
      "src_001",
      "src_002"
    ]
  },

  "metrics": {
    "duration_ms": 1200,
    "items_returned": 2
  },

  "error": null
}
```

Tool Result 不能直接将任意原始 Python 对象传给 Agent。

必须经过 Result Normalizer。

例如搜索工具返回的论文结果应该是统一 Source 数据结构，不应该有的返回：

```
{"title": "...", "url": "..."}
```

有的返回：

```
{"paper_name": "...", "link": "..."}
```

有的返回：

```
{"name": "...", "href": "..."}
```

这些差异必须在 Provider Adapter 内解决。

## 7.4 Tool Registry 必须支持版本管理

例如：

```
search_papers@1.0.0
search_papers@1.1.0
parse_pdf@1.0.0
extract_claims@2.0.0
```

已有的 Research Run 需要记录当时使用的 Skill 版本。

不能在任务执行过程中悄悄切换 Skill 的行为。

否则同一个任务恢复执行时，可能得到完全不同的结果。

## 7.5 第一阶段 Skill 清单

我建议先实现以下 18 个 Skill：

| 类别         | Skill                 | 优先级 |
| ------------ | --------------------- | ------ |
| Search       | search_web            | P0     |
| Search       | search_papers         | P0     |
| Search       | fetch_url             | P0     |
| Source       | register_source       | P0     |
| Document     | parse_pdf             | P0     |
| Document     | extract_tables        | P1     |
| Document     | extract_figures       | P1     |
| Document     | extract_metadata      | P0     |
| Retrieval    | search_fulltext       | P0     |
| Retrieval    | search_vector         | P0     |
| Retrieval    | retrieve_evidence     | P0     |
| Knowledge    | extract_claims        | P0     |
| Knowledge    | suggest_nodes         | P0     |
| Knowledge    | suggest_relations     | P0     |
| Verification | verify_citation       | P0     |
| Verification | verify_claim          | P0     |
| Artifact     | create_artifact_draft | P0     |
| Artifact     | create_artifact_patch | P0     |

不要一开始就实现 50 个 Skill。

先让这些能力能够形成完整闭环。

# 第八部分：DeepSeek Model Gateway

这部分需要根据 DeepSeek 的实际 API 特性调整，而不能只把 API Key 和 Base URL 换一下。

截至 2026 年 11 月，DeepSeek 官方文档列出的 Responses API 模型为 `deepseek-flash` 和 `deepseek-v4-pro`。官方 2026 年 10 月的更新说明，`deepseek-flash` 已经升级到 V4.1-Flash-1017，因此建议把模型名称作为配置别名管理，不要在代码中绑定模型具体代际。

DeepSeek API Docs+1



## 8.1 Model Gateway 架构

```
Agent Runtime
      │
      ▼
Model Gateway
      │
      ├── Model Registry
      │
      ├── Model Router
      │
      ├── Prompt Manager
      │
      ├── Context Builder
      │
      ├── Request Normalizer
      │
      ├── DeepSeek Adapter
      │
      ├── Response Parser
      │
      ├── Stream Normalizer
      │
      └── Usage Tracker
```

这些模块不需要全部独立部署。

Model Gateway 可以是 Agent Runtime 内部的一个模块。

## 8.2 必须支持的模型接口抽象

```
class ModelProvider:

    async def generate(self, request):
        ...

    async def generate_stream(self, request):
        ...

    async def generate_structured(self, request):
        ...

    async def execute_tool_turn(self, request):
        ...

    async def get_usage(self, response):
        ...
```

DeepSeek 实现：

```
class DeepSeekProvider(ModelProvider):

    async def generate(self, request):
        ...

    async def generate_stream(self, request):
        ...

    async def generate_structured(self, request):
        ...

    async def execute_tool_turn(self, request):
        ...
```

注意：

不要假设所有供应商的参数完全相同。

例如：

- `reasoning_effort`。
- `temperature`。
- `response_format`。
- `tool_choice`。
- `max_output_tokens`。

这些参数必须经过 Provider Adapter 转换。

不支持的参数应该明确报错或按照策略降级，而不是静默丢弃后假装成功。

## 8.3 DeepSeek Responses API 的特殊处理

有三个必须纳入设计的地方。

第一：Responses API 是无状态的。

每次多轮请求都需要由我们自己管理完整上下文。因此 Model Conversation State 必须持久化在后端。

DeepSeek API Docs+1



第二：需要正确处理流式事件。

DeepSeek Responses API 的 SSE 使用带 `sequence_number` 的语义事件，并以 `response.completed`、`response.incomplete` 或 `response.failed` 结束。

不能只读取文本增量就认为模型已经成功完成任务。

DeepSeek API Docs



建议统一映射为内部事件：

| DeepSeek 事件                         | 内部事件                |
| ------------------------------------- | ----------------------- |
| response.created                      | model.started           |
| response.reasoning_text.delta         | model.reasoning.updated |
| response.output_text.delta            | model.output.delta      |
| response.function_call_arguments.done | tool.call.ready         |
| response.completed                    | model.completed         |
| response.incomplete                   | model.incomplete        |
| response.failed                       | model.failed            |

特别是 `response.incomplete`，必须识别为不完整响应，不能把截断的 JSON 当成成功结果。

第三：图片和文件需要分开处理。

当前 Responses API 文档支持 `deepseek-flash` 的图片输入，但不支持直接的文件输入。

所以 PDF 仍然应该先经过我们的 Ingestion Pipeline，提取文本、表格和图片，再按需要把图片交给模型。

DeepSeek API Docs+1



## 8.4 如何保证 DeepSeek 的结构化输出？

这是本项目最值得重点处理的问题之一。

DeepSeek 提供 JSON Output，可以让模型输出合法 JSON，但这不等于模型一定遵守我们所有业务 Schema。

官方文档还特别提示：JSON Output 可能出现空白内容，需要检测并处理。

DeepSeek API Docs



此外，DeepSeek Tool Calling 的 `strict` 模式目前属于 Beta，需要使用 Beta 接口，并且仅支持一部分 JSON Schema 特性。

DeepSeek API Docs



因此我的建议是采用四层约束：

```
第一层：Prompt Schema
    │
    ▼
第二层：DeepSeek JSON / Strict Tool Schema
    │
    ▼
第三层：Pydantic Runtime Validation
    │
    ▼
第四层：Business Semantic Validation
```

具体职责：

| 层                    | 能保证什么                    |
| --------------------- | ----------------------------- |
| Prompt Schema         | 指导模型理解输出格式          |
| API Structured Output | 尽量保证 JSON / Tool 参数格式 |
| Pydantic              | 保证数据结构合法              |
| Semantic Validator    | 检查业务逻辑和事实依据        |

不要把 DeepSeek 的 Strict Tool Calling 当成完整的业务验证器。

也不要因为返回了合法 JSON，就直接提交数据库。

## 8.5 Reasoning 与可解释性

我建议将推理内容和执行审计分开存储。

DeepSeek Responses API 有 `reasoning_text` 相关事件，但不应该将它作为产品的稳定解释协议。

DeepSeek API Docs



产品真正需要记录的是：

```
{
  "decision_id": "decision_001",
  "task_id": "task_001",

  "decision": "优先使用学术论文作为证据来源",

  "reason_summary": "任务要求比较模型的实验性能，因此需要优先收集原始研究论文。",

  "inputs": [
    "task_001"
  ],

  "evidence_refs": [],

  "timestamp": "2026-11-08T10:00:00Z"
}
```

前端展示：

- 研究计划。
- 当前步骤。
- 工具调用。
- 关键决策摘要。
- 来源。
- 证据。
- 结论置信程度。
- 未解决的问题。
- Artifact 修改记录。

不把原始隐藏思维链作为产品功能。

这也使得将来切换模型供应商时，可解释性界面不需要重做。

# 第九部分：Knowledge Production Engine

我建议保留四个核心引擎，但进一步明确它们的职责和数据边界。

## 9.1 四个核心引擎

01 · Research Engine

资料发现

负责理解研究目标、制定检索计划、发现资料、解析文献、提取研究内容。

02 · Evidence Engine

事实依据

负责 Claim、Evidence、Source 的关联、原文定位、证据验证和冲突检测。

03 · Knowledge Engine

知识组织

负责知识节点、用户自定义关系、AI 关系建议、双链和知识检索。

04 · Artifact Engine

知识产物

负责 Artifact Schema、Block、Patch、版本、布局和导出。

四个引擎之间不应该直接共享内部数据库对象。

应该使用统一 Domain Contracts。

但它们可以部署在同一个 FastAPI 进程中。

## 9.2 数据关系

```
Research Engine
       │
       ▼
Source Registry
       │
       ▼
Document / Passage
       │
       ▼
Evidence Engine
       │
       ├── Claim
       └── Evidence
              │
              ▼
       Knowledge Engine
              │
              ├── Knowledge Node
              ├── Suggested Edge
              └── Confirmed Edge
              │
              ▼
        Artifact Engine
              │
              ├── Artifact
              ├── Artifact Block
              ├── Artifact Version
              └── Artifact Patch
```

需要注意，这不是强制的单向流水线。

例如用户可以直接在已有 Artifact 中修改一个知识概念。

这种情况下 Artifact Engine 可以调用 Knowledge Engine 查询对应节点，而不需要重新执行 Research Engine。

## 9.3 数据库选型

第一阶段继续采用：

| 存储           | 用途                     |
| -------------- | ------------------------ |
| PostgreSQL     | 全部核心业务数据         |
| pgvector       | Embedding                |
| PostgreSQL FTS | 全文搜索                 |
| Redis          | 缓存、短期协调           |
| S3 / MinIO     | 原始文件、图片、导出文件 |

不建议现在引入 Neo4j。

用户可以自定义关系，知识图谱的数据量初期也不会特别巨大。

PostgreSQL 的关系表足以支持：

- 双链。
- 反向链接。
- 节点邻居。
- 关系过滤。
- 项目内知识图谱。
- 基础多跳查询。

未来性能测试证明需要复杂图遍历时，再引入图数据库。

# 第十部分：核心数据库设计

这里建议采用关系型数据作为权威存储，并用 JSONB 保存适合动态扩展的结构化内容。

## 10.1 核心数据表

| 表名                     | 主要用途       |
| ------------------------ | -------------- |
| users                    | 用户           |
| workspaces               | 工作空间       |
| projects                 | 项目           |
| workspace_permissions    | 权限           |
| research_runs            | 研究任务       |
| workflow_tasks           | DAG 任务       |
| task_attempts            | 任务执行记录   |
| agent_executions         | Agent 执行实例 |
| tool_calls               | 工具调用       |
| model_calls              | 模型调用       |
| sources                  | 外部来源       |
| documents                | 文档           |
| document_versions        | 文档版本       |
| passages                 | 文档段落       |
| claims                   | 论断           |
| evidence                 | 证据           |
| claim_evidence           | 论断与证据关系 |
| knowledge_nodes          | 知识节点       |
| knowledge_edges          | 知识关系       |
| artifacts                | 知识产物       |
| artifact_versions        | 产物版本       |
| artifact_blocks          | 内容 Block     |
| artifact_evidence_links  | 产物证据引用   |
| artifact_knowledge_links | 产物知识引用   |
| validation_reports       | 验证报告       |
| run_events               | 执行事件       |
| outbox_events            | 事务 Outbox    |

## 10.2 必须采用不可变版本记录的对象

建议以下数据采用 Append-only 或版本化管理：

- Research Run。
- Task Attempt。
- Agent Execution。
- Tool Call。
- Source Document Version。
- Evidence Snapshot。
- Artifact Version。
- Validation Report。

例如，Artifact 修改不应该直接覆盖历史版本。

```
Artifact A
   │
   ├── Version 1
   ├── Version 2
   ├── Version 3
   └── Version 4
```

用户可以回滚、比较和查看 AI 修改记录。

## 10.3 KnowledgeEdge 必须支持用户控制

继续执行你之前确定的知识关联规则：

```
{
  "id": "edge_001",
  "source_node_id": "node_001",
  "target_node_id": "node_002",

  "relation_type": "depends_on",

  "origin": "ai_suggested",

  "status": "pending",

  "created_by": "system",

  "accepted_by": null,

  "created_at": "2026-11-08T10:00:00Z"
}
```

状态：

- `PENDING`
- `CONFIRMED`
- `REJECTED`
- `REMOVED`

正式知识图谱只显示符合用户设定的关系。

AI 可以持续提出候选关系，但不能自动扩大用户的正式知识网络。

# 第十一部分：Ingestion Pipeline 与 Hybrid Retrieval

这两个系统应该独立于 Agent Runtime。

原因很简单：

解析一份 PDF、生成 Embedding、查询全文索引，并不需要一个自主 Agent。

如果把这些任务都交给 Agent，会产生不必要的模型调用和执行成本。

## 11.1 Ingestion Pipeline

建议采用标准数据流水线：

![mermaid-diagram (10)](C:\Users\Y9000P-2025\Downloads\mermaid-diagram (10).png)

### 解析器分工

| 类型         | 推荐技术                 |
| ------------ | ------------------------ |
| 普通 PDF     | PyMuPDF                  |
| 复杂版面 PDF | Docling                  |
| 扫描 PDF     | PaddleOCR                |
| Word         | python-docx              |
| Excel        | openpyxl                 |
| PPT          | python-pptx              |
| 图片         | Pillow + DeepSeek Vision |
| 网页         | HTTPX + HTML Parser      |
| 动态网页     | Browser Worker           |

采用渐进式解析：

```
普通文本解析
      │
      ▼
结构和版面解析
      │
      ▼
OCR / Vision Fallback
```

不要让所有文件都经过最昂贵的视觉模型。

### Canonical Document

所有解析结果应该转换成统一的 Canonical Document。

例如：

```
{
  "document_id": "doc_001",
  "version_id": "docv_001",

  "source_id": "src_001",

  "metadata": {
    "title": "Example Paper",
    "authors": [],
    "publication_year": 2024,
    "doi": null
  },

  "content": [
    {
      "block_id": "block_001",
      "type": "heading",
      "text": "Introduction",
      "location": {
        "page": 1
      }
    },
    {
      "block_id": "block_002",
      "type": "paragraph",
      "text": "..."
    },
    {
      "block_id": "block_003",
      "type": "figure",
      "asset_id": "asset_001",
      "caption": "...",
      "location": {
        "page": 3
      }
    }
  ]
}
```

这样 Literature Agent、Vision Agent 和 Evidence Engine 都能使用同一套文档数据。

## 11.2 Search Provider 抽象

搜索层应该同时支持不同供应商。

DeepSeek 在 2026 年 10 月已经开放自研 Search & Fetch API，可以作为一个搜索提供商接入。

DeepSeek API Docs



但不建议直接让 DeepSeek Search 成为唯一搜索来源。

建议：

```
Search Service
      │
      ├── DeepSeek Search Adapter
      │
      ├── Academic Search Adapter
      │
      ├── Crossref Adapter
      │
      ├── Semantic Scholar Adapter
      │
      └── Generic Web Search Adapter
```

统一输出：

```
{
  "source_id": "src_001",
  "title": "Paper Title",
  "url": "https://example.com",
  "source_type": "academic_paper",
  "provider": "academic_search",
  "published_at": null,
  "metadata": {},
  "retrieved_at": "2026-11-08T10:00:00Z"
}
```

Provider 只负责发现来源。

Source Registry 负责规范化、去重和存储。

这样更换搜索服务不需要修改 Agent。

## 11.3 Hybrid Retrieval

建议采用：

```
             Query
               │
               ▼
          Query Analyzer
               │
       ┌───────┼────────┐
       ▼       ▼        ▼
     BM25   Vector    Metadata
       │    Search    Filter
       └───────┼────────┘
               ▼
          Result Fusion
               │
               ▼
            Reranker
               │
               ▼
          Evidence Filter
               │
               ▼
           Evidence Pack
```

MVP：

- PostgreSQL FTS。
- pgvector。
- Metadata Filter。
- RRF 结果融合。
- 可选轻量 Reranker。

后期：

- OpenSearch。
- GraphRAG。
- 多跳知识检索。
- 跨项目授权检索。

GraphRAG 不应该默认用于所有问题。

普通问题走 Hybrid RAG。

复杂关系问题才增加 Knowledge Graph Retrieval。

# 第十二部分：Artifact Engine 与知识产物门控

这是 Agent 输出最终进入用户工作空间的最后一道业务关卡。

我建议 Agent 不直接生成和写入最终 Artifact。

采用：

Draft → Validate → Patch → Commit → Version

## 12.1 Artifact 生产流程

```
Agent Outputs
      │
      ▼
Artifact Composer
      │
      ▼
Artifact Draft
      │
      ▼
Schema Validation
      │
      ▼
Evidence Validation
      │
      ▼
Layout Validation
      │
      ▼
Patch Generation
      │
      ▼
Commit Gate
      │
      ▼
Artifact Version
      │
      ▼
Workspace Renderer
```

### Artifact Draft

Agent 输出一个符合 Artifact Schema 的草稿。

### Artifact Validation

验证：

- Block 类型是否支持。
- Block ID 是否唯一。
- 公式是否可解析。
- 图片引用是否存在。
- 表格结构是否正确。
- 引用是否存在。
- Evidence 是否关联。
- 知识关系是否经过用户确认。
- Layout 是否符合设备约束。

### Patch Generation

如果是修改已有 Artifact，不能直接覆盖。

生成：

```
{
  "patch_id": "patch_001",
  "artifact_id": "artifact_001",
  "base_version": 4,

  "operations": [
    {
      "op": "replace",
      "block_id": "block_003",
      "value": {
        "type": "paragraph",
        "text": "Updated content"
      }
    },
    {
      "op": "insert_after",
      "block_id": "block_003",
      "value": {
        "type": "formula",
        "content": "..."
      }
    }
  ],

  "evidence_refs": [
    "ev_001"
  ]
}
```

### Commit Gate

检查：

- 用户是否有编辑权限。
- 当前版本是否仍然为 4。
- Patch 是否可以应用。
- 是否覆盖了用户的修改。
- 新增内容是否通过必要验证。
- 是否需要用户确认。

通过后创建 Version 5。

如果版本已经变化，就拒绝直接覆盖，进入冲突处理。

## 12.2 AI 修改与用户修改必须区分

建议每个 Block 保存：

```
{
  "block_id": "block_001",
  "content": "...",

  "provenance": {
    "origin": "ai_generated",
    "agent_id": "artifact_agent",
    "research_run_id": "run_001"
  },

  "edit_history": {
    "last_modified_by": "user",
    "last_modified_at": "..."
  }
}
```

来源类型：

- `user_created`
- `ai_generated`
- `ai_modified`
- `imported`

这样后续可以实现：

- AI 修改对比。
- 用户修改追踪。
- 局部撤销。
- 历史版本回滚。
- 来源追溯。

# 第十三部分：后端 API 与事件架构

## 13.1 REST API

建议统一使用 `/v1`。

| 模块        | 接口                   |
| ----------- | ---------------------- |
| Workspace   | `/v1/workspaces`       |
| Projects    | `/v1/projects`         |
| Research    | `/v1/research-runs`    |
| Tasks       | `/v1/tasks`            |
| Agent Trace | `/v1/agent-executions` |
| Sources     | `/v1/sources`          |
| Documents   | `/v1/documents`        |
| Evidence    | `/v1/evidence`         |
| Claims      | `/v1/claims`           |
| Knowledge   | `/v1/knowledge`        |
| Artifacts   | `/v1/artifacts`        |
| Validation  | `/v1/validations`      |
| Exports     | `/v1/exports`          |

### 研究任务

```
POST /v1/research-runs
{
  "workspace_id": "ws_001",
  "query": "研究尖晶石材料的GNN物性预测",
  "mode": "deep_research",
  "preferences": {
    "max_sources": 30,
    "include_figures": true,
    "include_knowledge_graph": true
  }
}
```

返回：

```
{
  "run_id": "run_001",
  "status": "queued",
  "event_url": "/v1/research-runs/run_001/events"
}
```

### 查看研究任务

```
GET /v1/research-runs/{run_id}
```

### 查看验证结果

```
GET /v1/validations/{validation_id}
```

### 提交 Artifact Patch

```
POST /v1/artifacts/{artifact_id}/patches
```

### 确认知识关系

```
POST /v1/knowledge/edges/{edge_id}/accept
```

### 修改知识关系

```
PATCH /v1/knowledge/edges/{edge_id}
```

这些接口应该有统一的：

- Authentication。
- Authorization。
- Idempotency Key。
- Request Validation。
- Error Format。
- Version Control。

## 13.2 SSE Event Protocol

Agent 执行进度使用 SSE。

统一事件格式：

```
{
  "event_id": "evt_001",
  "run_id": "run_001",
  "task_id": "task_001",

  "sequence": 12,

  "event_type": "validation.completed",

  "timestamp": "2026-11-08T10:00:00Z",

  "visibility": "user",

  "payload": {
    "status": "partial",
    "passed_checks": 5,
    "failed_checks": 1
  },

  "schema_version": "1.0"
}
```

建议事件类型：

```
run.created
run.started
run.completed
run.failed

plan.created
plan.validated
plan.replanned

task.created
task.started
task.completed
task.failed

agent.started
agent.completed

model.started
model.completed
model.failed

tool.started
tool.completed
tool.failed

source.discovered
source.parsed

claim.extracted
evidence.linked
evidence.verified

validation.started
validation.completed
validation.failed

artifact.drafted
artifact.validated
artifact.patch.proposed
artifact.patch.committed

knowledge.edge.suggested
knowledge.edge.accepted

approval.required
approval.completed
```

### 事件存储策略

不要把所有 Token Delta 都永久写入数据库。

建议：

| 事件              | 持久化 |
| ----------------- | ------ |
| Research Run 状态 | 是     |
| Task 状态         | 是     |
| Agent 启动和结束  | 是     |
| Tool Call         | 是     |
| 关键决策          | 是     |
| Source 发现       | 是     |
| Evidence 关联     | 是     |
| Validation Report | 是     |
| 普通 Token Delta  | 否     |
| 高频进度更新      | 可聚合 |
| 安全审计事件      | 是     |

这样可以避免事件表无限膨胀。

## 13.3 Outbox Pattern

所有重要业务事务采用 Outbox Pattern。

例如创建研究任务：

```
BEGIN TRANSACTION

INSERT ResearchRun

INSERT WorkflowTask

INSERT OutboxEvent

COMMIT
```

然后 Outbox Dispatcher 将事件发布到 Redis / Celery。

这样避免数据库已经创建任务，但队列消息发送失败导致任务永久丢失。

Worker 必须使用幂等键。

不能假设 Celery 或消息队列能够自动保证整个业务流程只执行一次。

# 第十四部分：部署架构与运行单元

这是我建议的实际部署方案。

注意：逻辑上分层，不等于部署时全部独立服务。

## 14.1 MVP 部署拓扑

![mermaid-diagram (11)](C:\Users\Y9000P-2025\Downloads\mermaid-diagram (11).png)

## 14.2 MVP 只需要五类运行单元

| 运行单元      | 职责                | 是否独立 |
| ------------- | ------------------- | -------- |
| API           | HTTP、业务操作、SSE | 是       |
| Orchestrator  | 计划、DAG、任务状态 | 是       |
| Agent Worker  | 模型调用、工具执行  | 是       |
| Data Worker   | PDF、OCR、Embedding | 是       |
| Export Worker | PDF、DOCX、ZIP      | 是       |

PostgreSQL 和 Redis 是基础设施，不属于应用运行单元。

Validation Engine 不需要单独部署。

- 轻量验证在 Agent Worker 内执行。
- 批量数据验证调用 Domain Service。
- 复杂语义验证作为独立的验证任务调度。

这能减少网络跳转。

## 14.3 为什么不让 Agent Worker 直接写数据库？

因为这样会破坏模块边界。

Agent Worker 只负责：

1. 接收任务。
2. 获取授权上下文。
3. 调用模型。
4. 调用 Skill。
5. 生成标准化结果。
6. 提交 Result。

由后端 Domain Service 决定是否正式写入。

特别是 KnowledgeEdge 和 ArtifactVersion，必须通过受控业务服务创建。

# 第十五部分：解耦程度与性能优化

这一部分我想给出明确的工程取舍。

不是解耦越多越好。

我们需要的是按变化频率、资源需求、故障边界和数据一致性划分模块。

## 15.1 哪些必须解耦？

| 模块               | 是否解耦   | 原因                          |
| ------------------ | ---------- | ----------------------------- |
| Model Provider     | 必须       | 模型供应商经常变化            |
| Agent Runtime      | 必须       | Agent 执行策略需要独立演进    |
| Orchestrator       | 必须       | 工作流控制不能依赖模型        |
| Skill Registry     | 必须       | 工具能力需要可扩展            |
| Validator          | 逻辑上必须 | 验证标准不能由 Agent 自己决定 |
| Knowledge Engine   | 逻辑上必须 | 知识资产是长期核心            |
| Artifact Engine    | 逻辑上必须 | 产物需要独立版本管理          |
| Ingestion Pipeline | 运行时必须 | CPU、内存和 IO 负载不同       |
| Export Engine      | 运行时必须 | 大文件处理不能阻塞 API        |
| Search Provider    | 必须       | 搜索供应商可能替换            |

## 15.2 哪些不应该过度解耦？

| 模块                                 | 推荐方式         | 原因                   |
| ------------------------------------ | ---------------- | ---------------------- |
| Pydantic Schema + Validator          | 同进程           | 低成本验证             |
| Tool Parser + Tool Gate              | 同进程           | 避免无意义网络调用     |
| Model Gateway + Agent Runtime        | 同进程模块       | 调用频繁               |
| Evidence Service + Knowledge Service | 初期同进程       | 共享事务和数据         |
| Artifact Composer + Renderer Schema  | 共享 Contracts   | 避免协议不一致         |
| Event Writer + Outbox                | 同数据库事务     | 保证事件一致性         |
| Request Classifier + Planner         | 逻辑独立、同进程 | 避免小任务多次网络调用 |

### 最终部署原则

```
逻辑边界：严格
接口边界：明确
数据边界：明确
进程边界：按资源需求划分
网络边界：只在必要时出现
```

这是我建议整个项目遵循的解耦原则。

## 15.3 三种执行通道

为了提高响应速度，建议设置三个执行通道。

Interactive Lane

低延迟

普通问答、概念解释、简单编辑、快速检索。

- 小型模型调用。
- 少量工具。
- 快速验证。
- 不启动复杂 DAG。

Research Lane

复杂任务

文献综述、深度学习、跨资料研究、复杂知识组织。

- Planner。
- DAG 并行。
- 多 Agent。
- Evidence Validation。
- Quality Gate。

Batch Lane

后台处理

PDF 解析、OCR、Embedding、批量导出、资料重建索引。

- CPU Worker。
- IO Worker。
- 批量任务。
- 独立并发配额。

## 15.4 并发控制

建议至少有四种并发限制：

1. 全局模型并发。
2. 单用户模型并发。
3. 单 Research Run 并发。
4. 单 Worker 类型并发。

例如：

```
concurrency:
  global:
    max_active_runs: 100

  per_user:
    max_active_runs: 3

  per_run:
    max_parallel_tasks: 5
    max_active_agents: 3

  worker_pools:
    agent: 10
    ingestion: 4
    embedding: 4
    export: 2
```

这些是初期容量配置示例，不是固定性能承诺。

真正部署时要根据模型并发限制、CPU、内存、文件规模和实际延迟压测调整。

还应为模型供应商设置独立的并发限制和 429 退避策略。DeepSeek 官方也明确区分了模型并发限制及其限流错误。

DeepSeek API Docs+1



## 15.5 上下文管理

不要让 Agent 每次都携带全部历史记录。

建议建立 Context Builder：

```
Task Input
    │
    ▼
Context Builder
    │
    ├── System Instructions
    ├── Agent Manifest
    ├── Task Objective
    ├── Relevant History
    ├── Evidence Pack
    ├── Current State
    └── Tool Definitions
    │
    ▼
DeepSeek
```

历史上下文应该采用：

- 最近交互记录。
- 任务状态摘要。
- 关键决策摘要。
- 相关 Evidence。
- 当前执行步骤。

不应该无限追加所有历史 Tool Output。

对于 DeepSeek Responses API，由于服务端不保存会话，后端需要自行保存和组装多轮上下文。

DeepSeek API Docs



同时可以利用 DeepSeek 官方提供的上下文缓存能力，但缓存只是性能优化，不能代替我们的持久化状态。

DeepSeek API Docs



# 第十六部分：安全与权限治理

Agent 拥有搜索、网页抓取、文件解析、知识写入等能力，因此必须建立独立的安全边界。

## 16.1 Prompt Injection 防护

所有外部资料均视为不可信输入。

包括：

- 网页正文。
- PDF。
- 图片中的文字。
- 论文附录。
- 用户上传的 Office 文档。
- 搜索结果。

不要让外部内容直接改变 Agent 的 System Instructions 或工具权限。

建议采用：

```
Trusted Instructions
        │
        ▼
Agent Runtime
        │
        ▼
Untrusted Source Content
        │
        ▼
Information Extraction
```

并且：

- 不允许 Agent 直接执行文档中的指令。
- Tool 白名单由后端维护。
- 所有工具参数经过校验。
- 外部网页抓取限制 SSRF。
- PDF / Office 在隔离 Worker 中解析。
- 禁止模型直接获得数据库凭据。

## 16.2 权限分层

建议采用：

```
User Permission
       │
       ▼
Workspace Permission
       │
       ▼
Project Permission
       │
       ▼
Task Permission
       │
       ▼
Agent Capability
       │
       ▼
Tool Permission
```

每次工具调用都应该检查权限。

不能因为 Agent 有 `read_knowledge` 能力，就允许它读取所有项目。

特别是你之前设计的跨项目知识关联，需要将：

- 知识关联。
- 本次任务上下文授权。
- 资源读取权限。

严格区分。

## 16.3 高风险操作门控

建议分成：

| 操作                | 处理方式           |
| ------------------- | ------------------ |
| 搜索资料            | 自动               |
| 读取已授权资料      | 自动               |
| 生成 Artifact Draft | 自动               |
| 生成知识关系建议    | 自动               |
| 修改草稿            | 自动               |
| 正式建立知识关系    | 按用户设置确认     |
| 覆盖用户内容        | 必须确认或显式授权 |
| 删除知识节点        | 必须确认           |
| 删除项目            | 必须确认           |
| 向外部发布          | 必须确认           |
| 访问其他项目        | 检查授权           |

尤其是用户自定义关系，必须以用户确认结果为最终依据。

# 第十七部分：监控、可观测性与 Agent Evaluation

如果没有完整的监控体系，后期你会很难判断一个研究任务为什么失败。

例如：

- 是 Planner 规划错了？
- 是 DeepSeek 输出异常？
- 是工具返回了错误数据？
- 是 Evidence 不足？
- 是 Validator 过于严格？
- 是 Artifact Schema 不兼容？
- 还是 Worker 超时？

所以必须建立从用户请求到最终产物的完整 Trace。

## 17.1 Trace 结构

```
Research Run
│
├── Planner Trace
│
├── Task T1
│   ├── Agent Execution
│   ├── Model Call
│   ├── Tool Calls
│   └── Validation
│
├── Task T2
│   ├── Agent Execution
│   ├── Model Call
│   ├── Tool Calls
│   └── Validation
│
├── Synthesis
│
├── Evidence Validation
│
└── Artifact Commit
```

建议采用 OpenTelemetry 作为统一 Trace 协议。

## 17.2 监控指标

| 类别       | 指标                         |
| ---------- | ---------------------------- |
| Agent      | 成功率、失败率、平均迭代次数 |
| Model      | 延迟、Token、成本、错误率    |
| Tool       | 调用成功率、超时率           |
| Workflow   | DAG 完成时间、任务重试次数   |
| Validation | 通过率、修复率、拒绝率       |
| Evidence   | Claim 覆盖率、引用错误率     |
| Artifact   | Patch 接受率、冲突率         |
| System     | CPU、内存、队列长度          |

## 17.3 必须建立 Agent Evaluation Dataset

建议建立固定测试集。

第一批至少 30 个真实研究任务，覆盖：

- 普通知识解释。
- 系统性学习。
- 学术论文检索。
- PDF 分析。
- 图片和图表理解。
- 多论文比较。
- 知识关系建议。
- 证据核验。
- Artifact 生成。
- Artifact 修改。
- 复杂研究。
- 资料冲突。

每次修改：

- Agent Prompt。
- Model Profile。
- Planner。
- Skill。
- Validator。
- Artifact Schema。

都运行回归测试。

## 17.4 评价 Agent 的真正标准

我建议优先关注：

| 指标                   | 说明           |
| ---------------------- | -------------- |
| Task Completion Rate   | 任务完成率     |
| Schema Pass Rate       | 结构通过率     |
| Evidence Coverage      | 结论证据覆盖率 |
| Citation Accuracy      | 引用准确率     |
| Unsupported Claim Rate | 无依据结论比例 |
| Repair Success Rate    | 修复成功率     |
| Human Acceptance Rate  | 用户接受率     |
| Cost per Artifact      | 每个产物的成本 |
| Artifact Reuse Rate    | 产物后续复用率 |

不要单纯以 Agent 回答得是否流畅来判断它是否有效。

对本产品而言，证据可靠性、产物质量和用户后续复用价值比语言流畅度更重要。

# 第十八部分：最终项目目录结构

为了让 AI 编程 Agent 能够准确理解各模块职责，我建议使用以下目录结构。

```
ai-knowledge-workspace/
│
├── apps/
│   ├── web/
│   └── android/
│
├── packages/
│   ├── contracts/
│   │   ├── agent/
│   │   ├── task/
│   │   ├── skill/
│   │   ├── artifact/
│   │   ├── evidence/
│   │   └── events/
│   │
│   ├── shared-types/
│   └── api-client/
│
├── backend/
│   │
│   ├── api/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── dependencies/
│   │
│   ├── application/
│   │   ├── workspace/
│   │   ├── project/
│   │   ├── research/
│   │   ├── artifact/
│   │   └── knowledge/
│   │
│   ├── domain/
│   │   ├── models/
│   │   ├── services/
│   │   ├── policies/
│   │   └── events/
│   │
│   ├── infrastructure/
│   │   ├── database/
│   │   ├── storage/
│   │   ├── cache/
│   │   ├── queue/
│   │   └── outbox/
│   │
│   ├── knowledge/
│   │   ├── source/
│   │   ├── document/
│   │   ├── passage/
│   │   ├── evidence/
│   │   ├── claim/
│   │   ├── graph/
│   │   └── artifact/
│   │
│   ├── ingestion/
│   │   ├── fetchers/
│   │   ├── parsers/
│   │   ├── extractors/
│   │   ├── chunking/
│   │   └── indexing/
│   │
│   ├── retrieval/
│   │   ├── query/
│   │   ├── keyword/
│   │   ├── vector/
│   │   ├── fusion/
│   │   ├── reranking/
│   │   └── evidence_pack/
│   │
│   └── export/
│       ├── markdown/
│       ├── pdf/
│       ├── docx/
│       └── package/
│
├── agent-platform/
│   │
│   ├── contracts/
│   │
│   ├── runtime/
│   │   ├── executor/
│   │   ├── lifecycle/
│   │   ├── context/
│   │   ├── state/
│   │   ├── result/
│   │   └── strategies/
│   │
│   ├── orchestrator/
│   │   ├── classifier/
│   │   ├── planner/
│   │   ├── plan_validator/
│   │   ├── dag/
│   │   ├── scheduler/
│   │   ├── router/
│   │   ├── budget/
│   │   └── replanner/
│   │
│   ├── agents/
│   │   ├── research/
│   │   ├── literature/
│   │   ├── document/
│   │   ├── vision/
│   │   ├── knowledge/
│   │   ├── synthesis/
│   │   ├── verification/
│   │   └── artifact/
│   │
│   ├── skills/
│   │   ├── registry/
│   │   ├── search/
│   │   ├── fetch/
│   │   ├── document/
│   │   ├── retrieval/
│   │   ├── evidence/
│   │   ├── knowledge/
│   │   └── artifact/
│   │
│   ├── tools/
│   │   ├── definitions/
│   │   ├── parser/
│   │   ├── executor/
│   │   └── permission_gate/
│   │
│   ├── model_gateway/
│   │   ├── registry/
│   │   ├── router/
│   │   ├── adapters/
│   │   │   └── deepseek/
│   │   ├── prompt_manager/
│   │   ├── context_builder/
│   │   ├── response_parser/
│   │   └── usage_tracker/
│   │
│   ├── validation/
│   │   ├── engine/
│   │   ├── profiles/
│   │   ├── protocol/
│   │   ├── permission/
│   │   ├── reference/
│   │   ├── provenance/
│   │   ├── evidence/
│   │   ├── semantic/
│   │   ├── quality/
│   │   └── repair/
│   │
│   ├── workflows/
│   │   ├── quick_answer/
│   │   ├── learning/
│   │   ├── deep_research/
│   │   ├── literature_review/
│   │   └── document_analysis/
│   │
│   ├── evaluation/
│   │   ├── datasets/
│   │   ├── evaluators/
│   │   └── regression/
│   │
│   └── observability/
│
├── workers/
│   ├── agent_worker/
│   ├── ingestion_worker/
│   ├── embedding_worker/
│   ├── validation_worker/
│   └── export_worker/
│
├── infrastructure/
│   ├── docker/
│   ├── migrations/
│   ├── monitoring/
│   └── deployment/
│
└── docs/
    ├── ARCHITECTURE.md
    ├── AGENT_RUNTIME_SPEC.md
    ├── AGENT_PROTOCOL_SPEC.md
    ├── ORCHESTRATOR_SPEC.md
    ├── VALIDATION_ENGINE_SPEC.md
    ├── SKILL_PROTOCOL_SPEC.md
    ├── DEEPSEEK_ADAPTER_SPEC.md
    ├── KNOWLEDGE_DATA_MODEL.md
    ├── INGESTION_RETRIEVAL_SPEC.md
    ├── ARTIFACT_ENGINE_SPEC.md
    ├── BACKEND_API_SPEC.md
    ├── EVENT_PROTOCOL_SPEC.md
    ├── SECURITY_SPEC.md
    └── ADR/
```

这个结构不意味着每个目录都必须成为独立 Python Package，更不意味着每个目录都必须单独部署。

它主要用于保证代码职责清晰。

# 第十九部分：实际开发顺序与优先级

我建议不要一次性让 AI 写完整套系统。

应该按照依赖关系实施。

## Phase 0：Contracts First

最高优先级

首先定义所有系统的协议。

开发：

1. Agent Manifest。
2. Task Envelope。
3. Agent Result Envelope。
4. Skill Manifest。
5. Tool Result。
6. Validation Report。
7. Research Event。
8. Artifact Draft。
9. Artifact Patch。

交付：

```
packages/contracts/
```

验收标准：

- 所有协议具有版本号。
- Pydantic 和 JSON Schema 可以互相转换或保持一致。
- 具备合法和非法样例。
- 有 Schema 单元测试。
- 不允许各 Agent 私自定义顶层协议。

这是整个项目的地基。

## Phase 1：Backend Foundation

P0

- FastAPI。
- PostgreSQL。
- Redis。
- S3。
- SQLAlchemy。
- Alembic。
- Outbox。
- 权限系统。
- 事件记录。

交付：可以运行的业务后端。

## Phase 2：Knowledge Infrastructure

P0

- Source。
- Document。
- Passage。
- Claim。
- Evidence。
- KnowledgeNode。
- KnowledgeEdge。
- Artifact。
- ArtifactVersion。

交付：完整的知识数据模型。

## Phase 3：Agent Runtime

P0

先实现：

- Agent Registry。
- Manifest Loader。
- Context Builder。
- DeepSeek Adapter。
- Tool Executor。
- Runtime Loop。
- Budget Controller。
- Result Normalizer。

先只接入三个 Agent：

- Research Agent。
- Knowledge Agent。
- Artifact Agent。

交付：能够执行符合统一协议的 Agent。

## Phase 4：Validation Engine

P0

先实现：

- Protocol Validator。
- Permission Validator。
- Reference Validator。
- Provenance Validator。
- Evidence Validator。
- Validation Report。
- Targeted Repair。

Semantic Validator 和复杂 Quality Evaluator 可以先实现基础版本。

交付：Agent 输出不能未经检查直接进入正式知识数据。

## Phase 5：Orchestrator

P0

- Request Classifier。
- Planner。
- Plan Validator。
- Task DAG。
- Scheduler。
- Agent Router。
- Result Aggregator。
- Replanner。
- Workflow Persistence。

交付：单 Agent 和多 Agent 可以由统一 Orchestrator 调度。

## Phase 6：Ingestion & Retrieval

P0

- Web Fetch。
- PDF。
- Office。
- OCR。
- 图片提取。
- Chunking。
- Embedding。
- Hybrid Retrieval。

交付：完整资料摄取和证据检索能力。

## Phase 7：Artifact Production

P0

- Artifact Composer。
- Block Renderer Schema。
- Draft。
- Patch。
- Diff。
- Version。
- Commit Gate。
- Export。

交付：用户每次学习任务都能产生可编辑知识产物。

## Phase 8：高级能力

P1

- Literature Agent。
- Vision Agent。
- Synthesis Agent。
- Multi-Document Analysis。
- GraphRAG。
- Advanced Evaluator。
- 多视角冲突分析。
- 持续研究。

## Phase 9：Workflow Scale-up

P1

根据实际任务运行情况评估：

- 是否迁移 Temporal。
- 是否引入 LangGraph。
- 是否增加独立 Search Service。
- 是否需要 OpenSearch。
- 是否需要独立图数据库。

不要为了提前满足未来可能出现的需求而引入复杂基础设施。

# 第二十部分：需要新增的工程验收标准

我建议为这套系统增加一个明确的验收表。

这比单纯检查代码能否运行更重要。

| 验收项          | 通过标准                         |
| --------------- | -------------------------------- |
| Agent Protocol  | 所有 Agent 遵循统一 Envelope     |
| Schema          | 非法输出不能进入正式业务数据     |
| Tool Calling    | 所有调用经过权限和参数校验       |
| Planner         | 非法 DAG 无法启动                |
| Workflow        | 进程重启后可以恢复               |
| Idempotency     | 重复消息不产生重复业务副作用     |
| Validation      | 每个失败项有明确错误位置         |
| Repair          | 能够针对失败字段修复             |
| Evidence        | 关键结论可追溯到原文             |
| Knowledge Graph | AI 建议关系不会未经授权自动生效  |
| Artifact        | AI 修改有 Patch 和版本记录       |
| Concurrency     | 研究任务和批处理相互隔离         |
| Observability   | 每个研究任务可以追踪完整执行路径 |
| Security        | 外部资料不能直接控制 Agent 权限  |
| Provider        | DeepSeek 接口与业务 Agent 解耦   |

## 20.1 具体测试场景

我建议至少做以下 15 个系统测试：

1. Agent 返回合法 JSON，成功提交。
2. Agent 返回非法 JSON，拒绝提交。
3. Agent 缺少必填字段，定位失败字段。
4. Agent 引用了不存在的 Source，拒绝。
5. Evidence 无法定位到原文，标记失败。
6. Claim 与 Evidence 不匹配，生成修复任务。
7. Agent 请求无权限工具，阻止执行。
8. Planner 创建循环 DAG，拒绝执行。
9. Tool 超时，按策略重试。
10. DeepSeek API 返回 429，执行限流退避。
11. 模型输出被截断，识别不完整状态。
12. Worker 中途崩溃，恢复 Task。
13. 两个设备同时编辑 Artifact，检测版本冲突。
14. AI 提议知识关系，保持 Pending。
15. 只有经过授权和验证的 Artifact Patch 才能提交。

另外建议建立性能目标：

| 场景               | 初始目标                       |
| ------------------ | ------------------------------ |
| 纯结构校验         | P95 小于 50ms                  |
| 本地权限规则检查   | P95 小于 50ms                  |
| 批量引用存在性检查 | P95 小于 200ms                 |
| Agent Tool Gate    | 不产生额外模型调用             |
| 普通问答           | 不启动不必要的 DAG             |
| 并行文献任务       | 不因单个任务失败而全部失败     |
| 研究恢复           | 不重复执行已确认成功的幂等任务 |

这些是初期工程目标，应在实际硬件、数据量和部署环境下压测，而不是预先承诺的运行性能。

# 第二十一部分：最终架构决策表

这是我建议作为项目正式架构决策记录（ADR）的版本。

| 架构问题       | 最终决定                            |
| -------------- | ----------------------------------- |
| 总体架构       | 模块化后端 + 独立 Agent Runtime     |
| Agent 调度     | 自研 Orchestrator                   |
| 任务编排       | Typed Task DAG                      |
| 单任务算法     | Single Pass / ReAct                 |
| 复杂研究算法   | Plan-and-Execute                    |
| 多 Agent       | Supervisor-Worker                   |
| 批量处理       | Map-Reduce                          |
| 结果修复       | Evaluator-Repair                    |
| Agent 协作方式 | 结构化结果传递                      |
| Agent 输出     | Result Envelope + Typed Payload     |
| Agent 接口约束 | Manifest + Contract                 |
| 工具系统       | Skill Registry + Tool Executor      |
| 工具验证       | Tool Gate                           |
| 模型供应商     | DeepSeek API                        |
| 模型调用       | Model Gateway                       |
| API 适配       | DeepSeek Adapter                    |
| 模型状态       | 后端持久化                          |
| 输出结构验证   | Pydantic + JSON Schema              |
| 证据验证       | Provenance + Evidence Validator     |
| 语义验证       | Rules + LLM Evaluator               |
| 最终写入       | Commit Gate                         |
| 数据库         | PostgreSQL                          |
| 向量检索       | pgvector                            |
| 文件存储       | S3 / MinIO                          |
| 消息队列       | Redis + Celery                      |
| 长期工作流     | 按需迁移 Temporal                   |
| Agent 子流程   | 按需使用 LangGraph                  |
| 事件系统       | PostgreSQL Event Log + Outbox + SSE |
| 可观测性       | OpenTelemetry                       |
| 图数据库       | 暂不引入                            |
| 微服务         | 暂不全面采用                        |

# 第二十二部分：最终架构中最重要的设计思想

最后我想总结一下，这次架构实际上解决了三个层面的问题。

## 1. 让 Agent 从自由生成变成规范执行

传统 Agent：

```
接收任务
   ↓
自由思考
   ↓
自由调用工具
   ↓
自由输出
```

我们的 Agent：

```
接收标准任务
   ↓
验证输入和权限
   ↓
按照执行策略工作
   ↓
调用授权 Skill
   ↓
提交标准化结果
   ↓
通过 Validator
   ↓
进入下一阶段
```

Agent 依然拥有自主性，但自主性被限制在明确的任务边界内。

## 2. 让质量控制从模型自检变成系统验证

传统方式：

```
Agent 生成
   ↓
Agent 自己检查
   ↓
直接使用
```

我们的方式：

```
Agent 生成
   ↓
程序验证结构
   ↓
系统验证权限
   ↓
数据验证来源
   ↓
验证器检查证据
   ↓
Evaluator 检查质量
   ↓
Commit Gate
```

这会大幅减少模型自我评价造成的虚假可靠感。

## 3. 让模块解耦服务于扩展，而不是增加复杂度

我们不需要把每个 Agent、每个 Validator、每个 Skill 都变成一个独立微服务。

真正需要的是：

- Agent 有独立 Manifest。
- Skill 有独立 Contract。
- Model 有独立 Adapter。
- Workflow 有独立状态。
- Validator 有独立规则。
- Knowledge 有独立数据模型。
- Artifact 有独立版本系统。

但它们可以在同一个运行进程中协作。

逻辑独立不等于部署独立。

这是整个架构能同时兼顾可扩展性和执行效率的关键。

# 第二十三部分：我建议最终形成的五项核心技术规范

现在不建议继续讨论增加多少个 Agent。

我认为应该把架构正式冻结为以下五项基础规范。

01 · AGENT_PROTOCOL_SPEC.md

P0

定义 Agent Manifest、Task Envelope、Result Envelope、状态、版本和错误协议。

02 · ORCHESTRATOR_SPEC.md

P0

定义 Planner、Typed DAG、Plan Validator、Scheduler、Agent Router、预算和恢复机制。

03 · VALIDATION_ENGINE_SPEC.md

P0

定义七类验证器、Hard/Soft Gate、Validation Profile、修复机制和 Commit Gate。

04 · DEEPSEEK_RUNTIME_SPEC.md

P0

定义 DeepSeek Adapter、Model Gateway、Tool Calling、Context State、流式协议和模型路由。

05 · BACKEND_KNOWLEDGE_SPEC.md

P0

定义数据库、Source、Document、Claim、Evidence、Knowledge、Artifact、API 和事件。

这些文件应该成为 Codex 或其他 AI 编程 Agent 的权威开发依据。

如果各个文档发生冲突，以数据协议和权限规范为优先，不能让 AI 编程 Agent 自行选择一个版本。

# 最终结论：我建议采用的架构

# Knowledge Production Architecture

最终技术方案

Agent 层

自研 Standard Agent Runtime

Plan-and-Execute + ReAct + Map-Reduce

Supervisor-Worker + Typed Task DAG

模型层

DeepSeek API

Model Gateway + Provider Adapter

Context State + Tool Calling

规范与治理层

Agent Contract + Skill Contract

Protocol Validator + Evidence Validator

Quality Evaluator + Commit Gate

后端层

FastAPI Modular Monolith

PostgreSQL + pgvector

Redis + Celery

S3 / MinIO

知识生产层

Research Engine

Evidence Engine

Knowledge Engine

Artifact Engine

我的最终判断是：

这个项目真正需要重点研发的不是一个更复杂的 Agent，而是三个核心基础设施：

1. Agent Protocol： 让不同 Agent 能以统一、可验证的方式协作。
2. Validation Engine： 让 AI 的输出经过系统验证，而不是依赖模型自我保证。
3. Knowledge Production Engine： 让研究结果能够沉淀为可追溯、可编辑、可复用的知识资产。

这三者决定了产品未来能否从一个 AI 学习工具，成长为一个真正的 AI 知识工作平台。

我尤其建议把 `AGENT_PROTOCOL_SPEC` 和 `VALIDATION_ENGINE_SPEC` 放在最前面开发。它们一旦设计稳定，后续新增 Agent、接入新模型、替换搜索服务和增加新的 Artifact 类型，都会容易很多。

先统一协议，再建设执行能力；先建立质量门控，再扩大 Agent 自主程度。

这应该成为整个项目的技术路线。