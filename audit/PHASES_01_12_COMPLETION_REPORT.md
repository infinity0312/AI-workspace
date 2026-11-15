# DeepSeek Harness 阶段执行与验收

Phase 00 沿用已有 `PHASE_00_COMPLETION_REPORT.md`。项目工作区没有基线 Git commit 可供引用；Phase 00 清单描述改造前文件，官方源码 SHA 在 `official/REPO_PIN_AND_LICENSE.md`，迁移实现和复跑脚本位于当前工作区。

| 阶段 | 实施及证据 | 验收决定 |
| --- | --- | --- |
| 01 官方源码审计 | 固定提交、许可、源码及测试入口，逐模块记录采用矩阵。用本项目重实现协议契约。 | 采用决定完成。官方 Vitest 未执行；无依赖或直接移植。 |
| 02 基线与根因 | 基线 API 32/32；文档用例人工验收；24 条用例目录；A/C/E 的受控真实调用样本。 | 基线可复跑。官方 B、多人 Agent D/F 和压力测试无结果。 |
| 03 目标架构 | ADR、模块依赖、数据库 ERD、HTTP 和事件契约。 | Runtime 与 Quality Engine 独立，保留既有知识与版本域。 |
| 04 DeepSeek Adapter | SSE 解析跨分片工具 JSON、UTF-8、用量、错误和取消；真实非思考调用与工具轮回。 | 本地试点通过；思考模式仅协议夹具验证。 |
| 05 Session 和 Loop | 有序游标事件、授权、持久化 deadline、阶段检查点重领、取消及过期写入隔离。 | 阶段级恢复通过。没有工具中段消息级续接、原地追加指令或任意事件重放后再次执行。 |
| 06 Composer / Tools / Skills | 任务模板、受信内置技能、作用域与权限绑定的只读证据工具。 | 测试覆盖允许/拒绝与真实工具读取。未采用 Shell、动态扩展或多 Agent。 |
| 07 上下文与预算 | 对可回读摘录压缩，保留要求；供应商用量和上界预约。 | 受控摘要预览通过；长会话语义压缩和跨任务 Agent 记忆未实施。 |
| 08 Knowledge Backend | 来源、证据、提案及版本由既有领域服务提交；写入复核证据与权限。 | 本地 PGlite 测试通过；生产库及对象存储待验。 |
| 09 Quality Engineering | 指定来源正文和引用门控、必答问题、数量覆盖、选区限定词、一轮聚焦修复。 | 拒绝和保真场景可验收；开放域复合报告仍待达到质量门槛。 |
| 10 前端事件 | 文档分析、选段改写和研究工作流用同一个安全时间线；刷新回放和取消。 | 本地 Web 实测通过；Windows 既有工作台通过；Android 仅构建。 |
| 11 灰度和回滚 | 默认关闭，按 Workspace 准入，回退后旧路径新开且历史会话可读。 | 可做本机灰度。生产双写或无写入影子流量、真实 PostgreSQL 多 Worker、S3 和压力测试未验。 |
| 12 交付 | ADR、契约与运维文档，复跑代码、用例及分组测量、用户使用与验收报告。 | 允许本机试用；正式切流保留。 |

## 复现与运维入口

- 适配器对照 `scripts/compare-harness-transport.ts` 及 `evaluation/TRANSPORT_RESULTS.json`。
- 工作台 `evaluation/workbench/playwright.config.ts` 和 `evaluation/WORKBENCH_RESULTS.json`。后者区分运行状态、实际正文和人工结论。
- 设计和运维入口 `docs/engineering/deepseek-harness-migration/ADR.md`、`CONTRACTS.md`、`OPERATIONS.md`。
- 安全边界为外部模型同意、工作空间授权、白名单事件和只读工具。试点生产门槛包括实际证据覆盖、发布前质量评审、数据库/对象存储并发与回滚。
