# 当前 Agent 生命周期

现有 Runtime 是受租约和检查点管理的固定工作流。下表用交接规范的 Turn 与 Step 术语对照现状。

| 场景 | 当前一次业务运行的内部步骤 |
| --- | --- |
| 即时回答 | 无显式来源、无 Workspace 检索时，只执行 `synthesis`，可用模型最多一次正常回答。外部授权不足或模型未配置时返回提示。响应在运行结果中，通常不创建 Artifact。 |
| 研究 | 固定 `plan → sources → evidence → synthesis → checkedSynthesis`。研究有模型时通常最多两次生成，失败可保留带引用摘录。研究预算允许 1–8 次调用、500–48,000 token 与 5–300 秒。重试也消耗调用预算。 |
| 文档分析 | 可有 `plan/plan_repair`，随后 `context → draft/format_repair → verdict`，必要时 `repair → recheck`。计划可用于联网、库内和选定单源。总预算 6 次模型调用、66,000 token、单次最多 3,000 输出 token，单次领取期限 160 秒。结果为提案。 |
| 选段改写 | 重写一次。引用段落发生实际文本变化时可调用语义核查，存在长度要求时可补写一次。预算通常 1–3 次模型调用，14,000 或 32,000 token。没有独立的选段阶段检查点。 |

## 入队、并发与恢复

1. `Jobs.enqueueIn` 在事务内保存输入、任务契约、`RunQueued`。业务运行 ID 是唯一入口。配置了 `Idempotency-Key` 的请求按租户、用户、scope 和请求摘要去重。
2. `Jobs.next` 按创建时间锁定一个任务。写入随机租约 ID，租约 45 秒，每约 3.5 秒续约。同一 Worker 逐个执行。多个 Worker 用数据库行锁和租约竞争。证据与修订的最终提交对当前租约做事务内检查。
3. 研究与文档分析每个已完成阶段把值保存到 `jobs.checkpoint`，同事务追加步骤完成事件。租约过期后重领，复用已保存阶段。未保存的阶段会重跑。重领次数达到限制后任务标为 FAILED。重领时重新创建计时器，累计调用预算仍保存在检查点。
4. 研究有 `pause/resume/cancel` HTTP 命令。暂停或取消清空租约，运行中的 Worker 在续约发现失效后触发 abort。进程关闭与运行超时也并入 AbortSignal，传递给模型、网络和支持取消的领域操作。分析与选段只有状态和事件读取接口。
5. 用户后续指令通过新运行处理。现有任务契约绑定原始输入，续跑无法直接改目标。没有多 Turn Inbox、steer 或 followup、递归委派与子 Agent 会话。各调用构造自己的消息数组，检查点在具体 Job 中保存，未发现跨任务共享可变 history。

## 与目标 Harness 的差异

| 能力 | 当前做法及缺口 |
| --- | --- |
| Tool Call 与结果 | 研究代码直接调用固定的 `discover/register/ingest/retrieve`，文档代码走固定来源和检索。结果作为下一阶段的 JSON 负载，不存在 provider 发起的 `tool_call`、call ID、tool role message 或模型自驱工具循环。 |
| Session | `job_events` 按序追加，`jobs` 保存输入、状态与 checkpoint。事件有序号、类型、payload 和时间。可分页读取过程，缺少完整消息投影、Session/Turn/Step 关系、事件 schema version 与端到端回放。 |
| Prompt Composer | `prompts.ts` 按阶段注册模板、版本与输出 schema 标签。当前按 system 模板 + user JSON 构造请求，未出现可排序 Section、Tool Schema 注入、Skill Loader 或 scope registry。 |
| Context 与 Compaction | 按阶段选择片段，研究最多取 6 条摘录，分析候选限量并按来源分配，模型负载由字节上界估算。缺少长期 Session 历史和 Compaction，也没有对会话消息的事件级保留策略。 |
| UI 与恢复 | 共享客户端轮询状态，研究页显示 Job 事件。分析和改写主要轮询结果。HTTP 已有 cursor，完整事件重放、流式增量和 session watermark 尚未形成。 |

证据复现见 `apps/api/tests/core.test.ts` 的租约恢复、空白输出修复与任务契约用例。本机通过了这些回归。真实 PostgreSQL 多 Worker 抢占、进程强杀和外部副作用的不确定性需要后续验证。
