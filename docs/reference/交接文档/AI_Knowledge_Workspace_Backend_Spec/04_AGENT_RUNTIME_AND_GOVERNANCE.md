# 04 --- Agent Runtime & Governance

## 1. 目标

Agent
负责理解任务、规划、检索、分析、综合和提出修改，但不拥有数据库写权限。所有正式数据变更必须通过
Domain API 和 Policy Gate。

## 2. 架构

``` text
Task API
  │
  ▼
Execution Policy Engine
  │
  ▼
Orchestrator
  ├── Task Classifier
  ├── Planner
  ├── DAG Scheduler
  ├── Context Builder
  ├── Budget Controller
  ├── Checkpoint Manager
  └── Result Composer
        │
        ├── Research Agent
        ├── Literature Agent
        ├── Web Search Agent
        ├── Document Analysis Agent
        ├── Knowledge Agent
        ├── Synthesis Agent
        └── Verification Agent
               │
               ▼
          Skill Registry
               │
               ▼
          Tool Executor
               │
               ▼
          Domain APIs
```

## 3. 任务复杂度路由

-   Simple：普通服务或单次模型调用；不启动多 Agent。
-   Medium：单 Agent + 必要工具。
-   Complex：Orchestrator + Typed DAG + 多 Agent。
-   高风险：额外审批、权限复核和更严格验证。

路由决策由规则和策略模型共同完成；不得完全依赖 LLM 自由决定预算。

## 4. DeepSeek Model Gateway

所有模型调用必须经过统一接口：

``` typescript
interface ModelGateway {
  generate(request: ModelRequest): Promise<ModelResponse>;
  stream(request: ModelRequest): AsyncIterable<ModelChunk>;
  estimateCost(request: ModelRequest): Promise<CostEstimate>;
}
```

统一处理： - Provider / model mapping。 - API Key 管理。 -
超时与重试。 - 限流。 - Token 计量。 - 请求追踪。 - JSON / tool calling
适配。 - 供应商错误归一化。 - Prompt 版本。 - 数据敏感级别检查。

业务 Agent 不得直接依赖 DeepSeek SDK 特有字段。

## 5. Orchestrator 工作规范

每个 Task 必须有： - `task_id` - `run_id` - `workspace_id` -
`requester_id` - `goal` - `scope` - `policy_snapshot` - `budget` -
`deadline` - `idempotency_key`

复杂任务使用 Typed DAG。节点定义： - 输入 Schema。 - 输出 Schema。 -
依赖节点。 - Tool 权限。 - Token / 时间预算。 - 重试策略。 - checkpoint
policy。 - validator set。

## 6. Run 状态机

建议状态：
`QUEUED, PLANNING, RUNNING, WAITING_FOR_USER, PAUSING, PAUSED, COMPLETED, PARTIAL, FAILED, CANCELLED, BUDGET_EXHAUSTED`

状态转换必须由服务端控制并持久化。

Run 必须支持： - Pause / Resume。 - Cancel。 - Checkpoint。 - Partial
completion。 - Retry failed node。 - User intervention。 - Budget
exhaustion safe stop。

## 7. Agent 间数据协议

Agent 传递结构化引用，不只传自然语言：

``` json
{
  "claim_id": "claim_01",
  "statement": "某模型在特定数据集上优于基线",
  "evidence_refs": ["ev_01", "ev_02"],
  "scope": {
    "dataset": "dataset_A",
    "metric": "MAE",
    "model": "model_A"
  },
  "certainty": "supported"
}
```

禁止把上游 Agent 的摘要直接视为已验证事实。

## 8. Skill / Tool 体系

Skill 是能力说明和工作流程模板；Tool 是受权限控制的具体操作。

每个 Tool 定义： - name / version - input schema - output schema -
required permissions - timeout - idempotency - side effect
classification - rate limit - audit policy

Tool Executor 必须校验参数、用户权限、租户边界、目标资源权限和预算。

## 9. 输出规范化

所有 Agent 输出必须： 1. 可解析。 2. 符合 JSON Schema / Pydantic 类型。
3. 带来源引用（适用时）。 4. 带不确定性状态。 5. 不含未授权副作用。 6.
可追踪模型、Prompt、Tool 和 Validator 版本。

建议统一 Envelope：

``` json
{
  "schema_version": "1.0",
  "run_id": "run_01",
  "agent": "literature_agent",
  "status": "completed",
  "result": {},
  "evidence_refs": [],
  "warnings": [],
  "validation": {
    "schema_valid": true,
    "policy_valid": true
  }
}
```

## 10. Validator / Gate

验证层： - Schema Validator：类型、必填、枚举、格式。 - Permission
Validator：租户、用户、项目、资源权限。 - Evidence
Validator：引用存在、定位有效、支持关系。 - Factual Consistency
Validator：矛盾、范围、数值和单位。 - Artifact Validator：结构、Block
ID、Schema 兼容。 - Safety Validator：敏感内容、Prompt
Injection、外部副作用。 - Budget Validator：成本、时长、工具次数。 -
Semantic Evaluator：LLM 辅助质量评估。

确定性规则优先。LLM Judge 不能独立批准高风险写入。

## 11. Repair Loop

-   限定最大修复次数。
-   每次修复保存输入、输出、错误和模型版本。
-   修复不得扩大原始任务范围。
-   修复后重新运行相关 Validator。
-   连续失败则降级为 Partial 或等待用户。
-   不允许无限循环。

## 12. Prompt Injection 防护

外部网页、PDF、图片 OCR、邮件和用户上传文档均是不可信数据。内容不能修改
System Policy、Tool 权限或租户边界。

Tool Executor 负责真实权限，不依赖 Prompt 声明。

## 13. Agent 可解释性

不公开模型私有思维链。提供可审计的过程解释： - 研究目标和计划。 -
搜索查询与来源。 - 使用的工具。 - 关键证据。 - 结论与不确定性。 -
验证结果。 - 失败和重试原因。 - 修改前后 Diff。 - 成本与执行时间。

不得把隐藏思维链作为产品功能承诺。面向用户展示可验证的依据和行动记录。

## 14. Agent 写入权限

-   新建 Draft：可按策略自动。
-   创建 Knowledge Note：可自动，但需标记 AI 来源。
-   新增关系建议：进入 review queue。
-   修改正式 Artifact：生成 Patch Proposal。
-   删除用户内容：必须用户明确确认。
-   修改原始 Evidence：禁止；只能新增校正记录或版本。
-   修改用户关联边界：禁止自动执行。
