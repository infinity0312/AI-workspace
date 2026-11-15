# 从工作台到真实 DeepSeek

| 用户入口 | 服务端路径 | 写入边界 |
| --- | --- | --- |
| 文档分析 | [document-analysis.tsx](../../packages/client/src/workspace/document-analysis.tsx) → POST `/v1/artifacts/{id}/analysis-runs` → Jobs → `executeAnalysis` → [researchDocument](../../apps/api/src/runtime/document-research.ts) 的 plan/context/draft/verdict/repair 阶段 | Job 成功可保存来源和提案；用户采纳提案后才产生目标文档新版本。 |
| 选段改写 | [workspace-app.tsx](../../packages/client/src/workspace/workspace-app.tsx) → POST `/v1/artifacts/{id}/ai-patch-runs` → Jobs → [rewriteSelection](../../apps/api/src/runtime/selection.ts) → 限定词、引用与语义检查 | 返回局部 Patch；采纳需当前版次及证据校验。 |
| 研究/即时回答 | [workflows.tsx](../../packages/client/src/workspace/workflows.tsx) → POST `/v1/research-runs` → Jobs → [runAgent](../../apps/api/src/runtime/agent.ts) | 无来源即时问答只返回文本。资料研究可由领域服务新建 Artifact，并将结构化 claims 存为 `proposed`。 |

共同路径为 [CoreController/RunsController](../../apps/api/src/http/controllers.ts) → [Jobs.enqueueIn / next / execute / callModel / modelAttempt](../../apps/api/src/domain/jobs.ts) → [Prompt Registry](../../apps/api/src/quality-engine/prompts.ts) 和 [Context Manifest](../../apps/api/src/quality-engine/context-manifest.ts) → 供应商适配器。API 认证、Workspace/Project 授权和外发同意在服务端，模型不持有写库接口。Web 通过 [Next rewrite](../../apps/web/next.config.ts)，桌面和移动共用 [客户端契约](../../packages/client/src/lib/api.ts) 与原生桥接。

| 路径 | 状态 | 协议及证据 |
| --- | --- | --- |
| 旧默认适配器 | implemented | [providers.ts](../../apps/api/src/runtime/providers.ts) 使用原生 `fetch`，Chat Completions 非流式，端点 `https://api.deepseek.com/chat/completions`，`DEEPSEEK_MODEL` 可覆盖。当前代码默认和本轮真实返回均为 `deepseek-flash`，显式关闭 thinking，单次请求超时 40 秒。没有 DeepSeek SDK 版本。 |
| SSE 适配器 | implemented | [adapter.ts](../../apps/api/src/runtime/harness/adapter.ts) 使用同一端点，解析 UTF-8/SSE、跨分片工具参数、结束原因与用量，受取消信号约束。经 Workspace 准入进入本地新运行时；之前真实 NIST 样本有两次只读证据调用，本轮 API 用例复测解析与假供应商。 |
| Thinking + tools | partial | 解析器能保留 reasoning，Loop 仅在显式 thinking 输入下把带 tool calls 的 assistant 协议字段放进内存历史。本地生产接线路径传入默认非思考，未实现耐久协议历史，也无跨 Turn 实测。若开启 thinking，需要覆盖工具请求后的所有后续调用，包括先前未发工具调用的回合。 |
| Responses / Anthropic Messages | planned | 项目只有 Chat Completions serializer；当前业务入口未使用其他协议。 |

[model-output.ts](../../apps/api/src/quality-engine/model-output.ts) 将 length、内容过滤、供应商资源不足、aborted、空白、非对象 JSON 分开拒绝，再由任务 Schema 检查。合法 tool_calls 交 Loop 处理。HTTP 429/暂态失败按预算有限重试。上游协议对照见 [Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/)、[Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode/) 和 [Tool Calls](https://api-docs.deepseek.com/guides/tool_calls/)。
