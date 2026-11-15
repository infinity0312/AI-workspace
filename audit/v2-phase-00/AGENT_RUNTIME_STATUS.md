# Agent Runtime 状态

| 能力 | 状态 | 代码与限制 |
| --- | --- | --- |
| 业务运行及合同 | partial | [jobs.ts](../../apps/api/src/domain/jobs.ts) 将业务请求、actor、状态、预算与阶段保存在 `jobs`；[task-contract.ts](../../apps/api/src/quality-engine/task-contract.ts) 的 v1 合同绑定运行/工作空间、输入哈希、输出 Schema 和基线版次。没有合同变更提案、原子要求 DAG 或按节点派发 Agent。 |
| Agent 与工作流 | partial | [agent.ts](../../apps/api/src/runtime/agent.ts) 为固定研究阶段；[document-research.ts](../../apps/api/src/runtime/document-research.ts) 为检索、草稿、检查、有限修复；[selection.ts](../../apps/api/src/runtime/selection.ts) 为局部改写。业务层有顺序阶段，不存在动态 DAG/Inbox/steer/follow-up、多 Agent 调度。 |
| Session | partial | [012_runtime_sessions.sql](../../apps/api/migrations/012_runtime_sessions.sql) 以 run ID 唯一连接 Session；[session.ts](../../apps/api/src/runtime/harness/session.ts) 提供增量游标、版本、开始/恢复/终态、step、模型、工具和质量投影。模型请求正文、tool args/result 正文和 reasoning 未进入事件；不是可重放模型消息的耐久日志。 |
| Loop / 工具 | partial | [loop.ts](../../apps/api/src/runtime/harness/loop.ts) 的 `read_evidence_excerpt` 仅文档初稿可用。UUID 严格 Schema，当前运行候选集、授权复核、超时、上限和重复限制；对真实证据回读再检查快照及项目权限。最多两轮工具、三次调用；无任意网络或写工具，无通用带版本 Registry。 |
| Prompt / Skill | partial | [context.ts](../../apps/api/src/runtime/harness/context.ts) 以任务模板 + 内置技能组合系统文本，资料作为用户数据。两个技能 `source-analysis.v1` 和 `faithful-edit.v1`；没有 metadata-first 动态技能目录或统一 operator 合同。 |
| Context / Token | partial | [budget.ts](../../apps/api/src/runtime/budget.ts) 以字节保守预约，按响应 usage 结算；[context-manifest.ts](../../apps/api/src/quality-engine/context-manifest.ts) 记录模板/数据哈希、模型配置、证据快照。长摘录预览可从只读工具重读；没有长会话窗口、语义压缩或跨任务 Agent 记忆。 |
| 恢复、租约和取消 | partial | SQL `FOR UPDATE SKIP LOCKED`、45 秒租约、约 3.5 秒心跳、UUID fence、领用尝试上限。新路径从首个租约记录绝对 deadline。终态/提案事务验 fence。取消先持久化终态并清租约；包括同进程在内的 Worker 由心跳发现租约丢失，再触发 AbortSignal。已完成阶段恢复；工具轮中断时不能续接原消息。 |
| UI 回放 | implemented | [runtime-timeline.tsx](../../packages/client/src/workspace/runtime-timeline.tsx) 按 cursor 拉取并去重；支持取消、刷新后恢复投影。旧工作流继续读 Job 事件。V2.0 四层状态和完整 Run Snapshot 仍待建设。 |
| Harness 官方 PoC | unknown | 前次源码审计选择 `REIMPLEMENT_CONTRACT`，固定 SHA 和许可证已记录。本地接口比较含自研 SSE；没有官方 Runtime B 实跑或多 Agent D/F 数据。是否采用 Cordis 留待 Phase 01 的当前源码与 PoC。 [前次采用记录](../official/ADOPTION_MATRIX.md) |

取消、阶段重领、事件投影和关闭准入后旧会话可读的本地证据见 [harness.test.ts](../../apps/api/tests/harness.test.ts)。SQL 锁行为在真实多 Worker 中仍须单独演练。
