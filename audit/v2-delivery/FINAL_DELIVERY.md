# AI Knowledge Workspace v2.0 · 全阶段交付与验收

本轮接续已完成的 Phase 00，按交接包逐阶段实施、复跑和核对。**Windows 本机可试用，生产发布 Hold。** 下表列出各阶段的实际产物及剩余验收条件。项目采用自研兼容协议，保留旧 Runtime 默认路径和原有知识、版本与同步表。

## 阶段验收

| 阶段 | 交付与证据 | 结论 |
| --- | --- | --- |
| 00 仓库审计 | F 盘真实源码、路径、数据、技术栈和基线已定位。 [Phase 00 报告](../v2-phase-00/PHASE_00_COMPLETION_REPORT.md) | 通过 |
| 01 官方 Harness | 再核对 master 固定源码 `e8f7b93a344964de3dca1ace9e72b6e4d6de87cb`、正式预发布 tag `dsh-v0.2.2-rc.2` 及 NOTICE。21 个隔离安装包的 npm lock 记录为 MIT。官方发布 Session v4 PoC 将合成 user、assistant、tool 事件还原为对应消息，并验证 AgentLoop 包可导入；应用继续沿用 `REIMPLEMENT_CONTRACT`。 [前次模块审计](../official/ADOPTION_MATRIX.md) · [本次 PoC](official-session-poc.mjs) | 源码与小型 PoC 通过，官方完整 Runtime 模型对照待验 |
| 02 基准 | 固化七个场景、人工 rubric 与机器结果；真实浏览器 7 个流程及 NIST/论文定向复测。 [验收口径](BENCHMARK_RUBRIC.md) · [结构化结果](RESULTS.json) | 本机通过；官方 B、多 Agent 对照及人工大样本待验 |
| 03 架构与 ADR | 已确定兼容输出、Runtime/Quality/Knowledge 分层、采纳事务和上线边界。 [架构与 ADR](ARCHITECTURE.md) | 通过 |
| 04 Requirement Fulfillment | 四层状态、叶项分母、人工问题组、独立指定来源/图片、采纳反向定位与版本绑定上线到本机。必答问题或必需图片缺失会阻止生成适用提案。 | 部分通过，自动原子化与跨来源综合仍待完善 |
| 05 Research Operators | 生成与核查接收 typed answer contract。定量结果与构造题有可测试的门控，已有证据、比较与归因提示可复用。 | 部分通过；独立推导、时序、冲突、图表和比较矩阵等 Operator 还需完整实现与标定 |
| 06 Evidence/Claim | 已采纳分析段落持久化 proposed Claim 与 evidence links，Ledger 可定位 source、evidence、claim、block 与 revision。 | 部分通过；结构化量值/时间和直接/部分/矛盾支持类型仍未覆盖 |
| 07 Retrieval | DOI 切换优先 Crossref 标准路径并保留兼容请求；显式 DOI 需引用实际正文，URL 可关联受控重定向的最终材料。论文实例通过一次真实 DOI 复测，前一轮曾短暂失败。 | 部分通过；通用搜索未启用，统一提供方和要求级检索尚未完整验收 |
| 08 Canonical Artifact | 采纳时反向校验 Ledger 对正文及证据的映射。已验证结构化科学计数法，复用共享视图与版本。 | 部分通过；自动生成整套多视图、各视图的语义一致性及依赖重算未验收 |
| 09 质量与修复 | 检查必答项、引用、数值、术语、构造描述与图像落地；已有草稿可在修复中复用，保留缺项。论文公式有结构化指数；拒绝无证据和扩大适用范围。 | 部分通过；诺奖合作者归因、照片和 NIST 两侧构造、等长摘要措辞仍未通过 |
| 10 DeepSeek Adapter | 旧非流式与 SSE 都跑通真实同输入无写入对照，旧路径默认。SSE、429、协议分片、停止原因和取消由现有回归验证。 | 默认非思考路径通过；真实 thinking + tools 历史尚未验 |
| 11 Agent、Session、Tools | 已有阶段恢复、只读证据工具、版本化模板、上下文节省和安全事件游标；真实任务和 API 回归都验证取消与回放。 | 部分通过；消息级恢复、跨任务语义记忆、动态 DAG 与多 Agent 未达标 |
| 12 前端 | 共享四层要求面板能查看证据、缺项与采纳后正文位置；预览、差异、取消和回放沿用。 | 本机通过；完整规范 Run Snapshot 与所有阶段事件待扩展 |
| 13 生产基础设施 | 真实隔离 PostgreSQL 17.11，两个连接池并发 48 项，重复请求幂等、过期租约重领。S3 兼容端点模拟器的 Put/Get、缺键拒绝和副本完整性通过。 | 部分通过；完整 pgvector、生产 S3、故障切换、备份恢复、负载与监控验收缺失 |
| 14 平台 | 新 Windows EXE 本机 WebView2 与 SQLite 冒烟通过。新版 Android APK 安装于 API 36 模拟器，离线保存、强制关闭重开、重新同步通过。 | Windows 本机和 Android 模拟器通过；物理设备、跨设备冲突及发布签名待验 |
| 15 Shadow、Canary、回滚 | 无写入的真实模型对照中，旧路径和 SSE 都输出可定位的合成结果；本地 Workspace canary 与关闭准入回旧路由有测试。 | 本机通过；真实流量 shadow、生产 canary 和生产回滚待验 |
| 16 最终交付 | 本报告、机器结果、架构、rubric、复跑和回退脚本。 [本机运维](OPERATIONS.md) | 交付完成，生产上线 Hold |

官方代码审计与 PoC 均隔离在 `.data`，未新增应用依赖。主仓库不存在 Git HEAD，Phase 00 源码哈希是历史审计基线。官方证据为 [DeepSeek Harness 源码固定版本](https://github.com/deepseek-ai/deepseek-harness/tree/e8f7b93a344964de3dca1ace9e72b6e4d6de87cb) 和 [官方发布](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.2-rc.2)。

## 测试与用量

- `npm.cmd test` **45/45**。类型检查及 lint 通过。独立 Web E2E **8/8**。真实工作台浏览器 **7/7**，加上 NIST 和论文 **2/2** 定向复测。人工核查按各场景最近样本为 **5 通过、2 部分通过**。
- 最新 DOI 样本约 **12.2 秒**，可查看原始论文、署名许可图和带尾数/指数的公式。居里夫人约 **19.8 秒**，NIST 约 **18.4 秒**，固定热泵资料约 **6.1 秒**。都为单次样本。
- 真实无写入合成对照仅各一次。旧模型适配器 1.64 秒，输入/输出 1,166/104 tokens；SSE 2.02 秒，1,164/102 tokens。每组 2 次调用，样本用于验证路径和成本记账。未估算生产时延分位和账户费用。
- PostgreSQL 48 项约 234 ms 为本机无外部模型的队列样本，不代表真实查询或生产容量。S3 结果来自本机模拟器。 

## 安全、数据与回退

- 任务仍按工作空间、项目、资料生命周期、外发同意和证据快照校验。没有把隐藏 reasoning、密钥或完整证据工具结果加入客户端事件。
- 本轮应用数据库迁移未新增，沿用既有表。Job 结果增加兼容 JSON 字段，采纳新提案会在同一事务绑定证据、Claim 和 Revision。阻断的必需图片没有可写入提案。用户可拒绝提案或恢复历史版次。
- 服务端关闭新 Runtime 准入可把新任务路由回旧适配器，历史试点会话仍可读。这项配置回退作用于 Runtime 路由；本轮共享质量代码需要随应用版本回退。现有迁移和正式库未操作。
- **生产解除 Hold 的条件**包括完整知识与视图一致性、可校准的开放域验收、完整 PG/S3 与灾备、物理 Android、多设备和真实流量回退证据。

[架构与 ADR](ARCHITECTURE.md) · [七场景人工口径](BENCHMARK_RUBRIC.md) · [结构化结果](RESULTS.json) · [复跑及回退](OPERATIONS.md)
