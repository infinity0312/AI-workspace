# AI Knowledge Workspace v2.0 · Phase 00 审计报告

**Phase 00 Gate 通过。Proceed 到 Phase 01 审计，生产上线 Hold。** 本次执行范围按 v2.0 的首次任务限定在仓库审计与隔离基线验证。2026-11-12 在 `F:/ai-knowledge-workspace` 核查了调用链、业务状态、数据模型、覆盖算法、取消/恢复、多端和生产依赖。Phase 01 保持待执行。

## 交付清单

| 审计项 | 报告 |
| --- | --- |
| 仓库、Git、技术栈与 CI | [REPOSITORY_MAP.md](REPOSITORY_MAP.md) |
| 工作台到真实 DeepSeek | [CURRENT_CALL_CHAIN.md](CURRENT_CALL_CHAIN.md) |
| Session、Agent、工具、上下文和恢复 | [AGENT_RUNTIME_STATUS.md](AGENT_RUNTIME_STATUS.md) |
| 知识、Artifact、Revision、Export 与 Sync | [KNOWLEDGE_DOMAIN_MAP.md](KNOWLEDGE_DOMAIN_MAP.md) |
| Coverage、检索、证据、修复 | [QUALITY_ENGINE_MAP.md](QUALITY_ENGINE_MAP.md) |
| Windows、Web、Android 和离线 | [PLATFORM_STATUS.md](PLATFORM_STATUS.md) |
| PostgreSQL、S3、灰度和生产 | [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) |
| 测试命令、当前结果与历史质量基线 | [BASELINE_TESTS.md](BASELINE_TESTS.md) |

## 关键差异与后续决策

| 当前实现 | v2.0 目标及差异 | 影响与推荐处理 |
| --- | --- | --- |
| 扁平 facet 与模型 verdict 计算覆盖，结果正向绑定正文块 | 四层 Ledger、原子必答项、最终 Revision 反向审核 | 引用存在、解答完成、产物写入会被合并。Phase 04 优先拆开四层，沿用既有事件和块 ID。 |
| 固定工作流和阶段检查点，加一份持久化进度投影 | Run 合同/DAG 与完整 Agent 消息、工具结算分别持久化 | 能重领阶段，不能从工具轮中间续接。Phase 03/11 先定义状态边界和恢复粒度。 |
| 文档分析输出带证据段落，独立研究才持久化 proposed Claim | 跨视图使用同一 Claim、证据与节点集合 | 正文和视图仍可有事实断层。Phase 06/08 复用现有 ID 衔接两种生成路径。 |
| 论文已能按 DOI 检索摘要，图片依赖后续落地，HTML 文本化有公式损失 | 精确检索、可交付许可图、结构化数学和最终核验 | 用户点名资料可检索但未必完整进入产物。Phase 07/09 分别固定检索、格式和产物用例。 |
| 官方源码曾审计，自研契约运行，当前无官方 PoC 数据 | Phase 01 要核实当前依赖、许可、测试与 PoC | 把旧官方 SHA 当历史证据；Phase 01 重新核对选型成本。 |
| 本机库、Web/Windows 和试点回退已验证 | 生产 PG/S3、负载、备份恢复、Android 真机与真实灰度 | 保持现有本机验收口径，生产放量按 Phase 13–15 实证决策。 |

## 安全、数据与性能影响

- 仓库 `main` 无 HEAD 提交。新增审计材料统一放到 `audit/v2-phase-00/`，保留旧版根目录的同名仓库地图和既有报告。共 223 份源码、测试和部署配置在审计前后 SHA-256 相同；见 [本次源码清单](SOURCE_MANIFEST.sha256)。运行产物存入隔离或忽略目录。
- 审查覆盖认证与权限、证据读取范围、工具超时、来源校验、取消和采纳 fence。本轮未更新生产路径、模型开关、正式数据或迁移。回滚仅需移走本目录的审计文档，现有服务不依赖它。
- 通过 API 43/43、Web 8/8、真实 DeepSeek 4/4、Windows 原生冒烟、类型检查和 lint。真实合成测试消耗 2,369 输入、778 输出 tokens。记录没有账户费率，未推算费用。历史开放域人工结果仍为 4 通过、3 部分通过。
- 官方 API 只核对本轮正在使用的 Chat Completions 及相关 tool/thinking 契约。许可证和官方 Runtime 当前 PoC 属下一阶段。 [DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/) · [DeepSeek Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode/)

## Phase 00 验收

- [x] 定位 Git、技术栈、数据、队列、CI 与测试。
- [x] 从正常 UI/API 入口定位真实模型端点、配置和写入边界。
- [x] 定位 Runtime 事件、租约、取消、恢复、预算与权限。
- [x] 解释现有 Coverage 算法与正文不一致原因。
- [x] 映射领域 ID、提案、版本、投影、导出和同步。
- [x] 区分本机已证、多端和生产待验的能力。
- [x] 复跑隔离基线并核查源码清单。
