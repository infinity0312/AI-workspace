# DeepSeek Harness · Phase 00 完成报告

**审计日期** 2026-11-12  
**项目** AI Knowledge Workspace  
**阶段判定** Phase 00 Gate 通过

## 范围

依据交接包 `DeepSeek_Harness_Runtime_Migration_Spec.md` 1.0.0 第 2 节。审计当前仓库、实际 DeepSeek HTTP 调用、固定工作流、知识领域、权限、取消、恢复与日志。生产代码、依赖、迁移和运行配置保持原样。诊断使用独立内存数据库与合成输入。

## 仓库基线

路径为 `F:\ai-knowledge-workspace`。分支为 `main`，无可解析的 HEAD，索引中有 0 个文件。本次基线使用 [源文件清单](SOURCE_MANIFEST.sha256)，覆盖 247 个非忽略文件，清单 SHA-256 为 `8c1c62d12e56cd98576718fcd3db34b1f0dce4faddc92e5885da45a54ffb1ec1`。现有文件的作者或改动时间无法通过 Git 历史确认。

## 交付

- [仓库地图](REPOSITORY_MAP.md)
- [真实模型调用链](CURRENT_MODEL_CALL_CHAIN.md)
- [当前 Agent 生命周期](CURRENT_AGENT_LIFECYCLE.md)
- [知识领域实现盘点](DOMAIN_MODULE_STATUS.md)
- [安全与权限差距](SECURITY_GAPS.md)
- [运行基线与复现步骤](CURRENT_BASELINE.md)
- [脱敏运行证据](PHASE_00_RUN_EVIDENCE.json) 与 [诊断脚本](scripts/phase-00-diagnostic.ts)

## 官方参考与当前架构

官方 Harness 仓库作为后续审计入口，Phase 01 再固定源码提交并评估许可证和依赖。本阶段核对了当前 Chat Completions 的完成原因和 JSON 模式。 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) · [Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/) · [JSON Output](https://api-docs.deepseek.com/zh-cn/guides/json_mode/)

当前链路为工作台 → NestJS API → SQL Job 与 Worker → 固定 Runtime 工作流 → DeepSeek 非流式 Chat Completions → Quality Engine 及领域服务。Runtime 与 Quality Engine 是同级模块。恢复依赖 Job 租约、阶段检查点和运行事件。完整的 Session 回放、模型工具循环、Skill Loader、上下文压缩与跨模型路由属于待评估能力。

## 测试与证据

| 验收项 | 结果 |
| --- | --- |
| API 回归、类型检查、Lint | 32 项 API 回归通过，类型检查和 Lint 通过。 |
| Web 与 Windows | 8 项 Web 端到端测试通过，隔离 Windows WebView2 冒烟通过。 |
| DeepSeek 真机调用 | 问答、研究、选段改写、分析四条路径通过。合成选段的单次调用返回 `stop`，用户采纳后版本 1 → 2。 |
| 可复现失败 | 模拟供应商返回可解析 JSON 和 `finish_reason=length`。运行失败，记录 `PROVIDER_OUTPUT_TRUNCATED/Q008`，0 份提案，版本仍为 1。 |
| 安全与数据 | 诊断日志通过内容与内部推理脱敏断言。诊断阶段未接触既有 Workspace 数据库，也未执行生产数据库迁移。 |

真实诊断的单次选段调用消耗 99 输入和 5 输出 tokens，模型耗时 1,107 毫秒。该数据用于本次调用追踪。跨主题质量、费用、尾延迟和生产并发需要独立实验。

## 主要故障点与缺失信息

1. 用户指定官网和标准仍可能缺失，模型计划覆盖可能误判准确性。语义检查曾放过丢失「室内」限定的改写。
2. 当前模型适配仅覆盖 Chat Completions 非流式路径。重试、跨进程累计期限、事件回放和工具副作用恢复有差距。
3. 当前项目缺可回滚 Git 提交。真实 PostgreSQL 多 Worker、S3、生产配置、租户并发和备份恢复未在本阶段实测。官方固定提交、包版本、直接和传递依赖许可证仍待 Phase 01 确认。

本阶段新增内容位于 `audit/`，生产切流、正式数据或依赖没有变更。回退此交付只涉及审计文件，无需数据库回滚。

## 建议

**Proceed 到 Phase 01。** 进入官方源码、接口、测试和许可证审计。Runtime 采用策略、包引入和切流判定留待后续阶段。
