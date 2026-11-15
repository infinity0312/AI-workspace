# AI Knowledge Workspace --- Backend Specification Pack

**版本：** 1.0\
**状态：** Architecture Baseline\
**用途：** 作为 Codex 实施后端、Agent、数据层与同步系统的权威交接文档。

## 1. 文档使用规则

Codex
必须先读取本文件，再按编号顺序读取其余文档。若单次任务只涉及某个模块，也必须先检查本文件中的全局约束，以及相关
ADR、领域模型和 API 契约。

### 文档顺序

  ------------------------------------------------------------------------------------------------------------------------
  顺序                    文件                                               目的
  ----------------------- -------------------------------------------------- ---------------------------------------------
  00                      本文件                                             交接规则、实施顺序、冲突处理

  01                      `01_PRODUCT_SCOPE_AND_SYSTEM_OVERVIEW.md`          产品边界、系统上下文、模块总览

  02                      `02_ARCHITECTURE_PRINCIPLES_AND_ADR.md`            架构原则、技术决策、禁止事项

  03                      `03_DOMAIN_MODEL_AND_ARTIFACT_SCHEMA.md`           核心领域模型、Artifact Schema

  04                      `04_AGENT_RUNTIME_AND_GOVERNANCE.md`               DeepSeek、Orchestrator、Agent、Skills、门控

  05                      `05_RESEARCH_INGESTION_AND_RETRIEVAL.md`           搜索、抓取、解析、检索、文档质量

  06                      `06_KNOWLEDGE_EVIDENCE_AND_LIFECYCLE.md`           Source、Evidence、Claim、知识图谱和生命周期

  07                      `07_CLOUD_LOCAL_DATA_AND_SYNC.md`                  云端/本地存储、同步、冲突、离线

  08                      `08_API_EVENTS_AND_INTEGRATION_CONTRACTS.md`       API、事件、幂等、错误协议

  09                      `09_SECURITY_PRIVACY_AND_DATA_GOVERNANCE.md`       安全、权限、隐私、版权、删除

  10                      `10_EXPORT_IMPORT_BACKUP_AND_MIGRATION.md`         导出、导入、备份、恢复、Schema 迁移

  11                      `11_DEPLOYMENT_OBSERVABILITY_AND_COST.md`          部署、队列、监控、成本和容量

  12                      `12_TESTING_ACCEPTANCE_AND_FAILURE_SCENARIOS.md`   测试策略、质量指标、故障测试

  13                      `13_CODEX_IMPLEMENTATION_ROADMAP.md`               分阶段开发任务、交付门槛
  ------------------------------------------------------------------------------------------------------------------------

## 2. Codex 必须遵守的工作方式

1.  开始编码前先检查现有仓库、语言、框架、目录和已实现功能，不得假设仓库为空。
2.  先输出差异分析：现状、缺失、冲突、迁移风险，再实施。
3.  不得为了符合文档而无理由重写已经稳定且符合契约的代码。
4.  按 Phase 和依赖顺序实施；每个阶段先完成测试再进入下一阶段。
5.  不得一次性创建所有微服务。默认采用模块化单体与独立异步 Worker。
6.  所有跨模块调用通过定义好的接口，不允许循环依赖或直接访问其他模块内部
    Repository。
7.  所有数据库变更必须有迁移脚本；不得通过手工改生产数据库结构解决问题。
8.  所有外部
    API、模型、搜索、对象存储调用必须有超时、重试边界、幂等策略和错误分类。
9.  不得把 API Key、访问令牌、用户文件正文或完整敏感 Prompt 写入日志。
10. 任何 Agent 输出都视为不可信输入，必须经过解析、Schema
    校验、权限校验和业务验证。
11. 不得让 Agent 直接操作数据库、任意文件系统或任意网络；只能使用授权
    Tool。
12. 不得静默覆盖用户正式 Artifact、Evidence 原始记录或用户编辑。
13. 不得把 Embedding、缓存、缩略图作为知识资产权威来源。
14. 不得把客户端时间戳作为全局版本排序依据。
15. 不得把 WebSocket 作为唯一同步机制。
16. 不得在 MVP 引入没有明确业务需要的图数据库、消息平台、微服务或 CRDT。
17. 对无法实现或文档之间存在冲突的要求，先提出决策问题，不得自行猜测。

## 3. 每个开发任务的标准交付

每个任务至少交付： - 实现代码。 - 数据库迁移（如有）。 -
API/事件契约更新（如有）。 - 单元测试。 - 集成测试或可复现测试。 -
配置和环境变量说明。 - 日志、指标和错误处理。 - README
或模块文档更新。 - 未实现项和已知限制。

## 4. 技术选择的约束

-   主业务数据库：PostgreSQL。
-   向量检索：pgvector，初期与 PostgreSQL 共用基础设施。
-   对象存储：S3 兼容接口；本地开发可用 MinIO。
-   缓存与短期协调：Redis。
-   后端：沿用仓库现有成熟技术栈；若尚未确定，优先 TypeScript/NestJS 或
    Python/FastAPI 中选定一种作为主 API，不得两套并行实现同一领域逻辑。
-   Agent Runtime：独立模块/进程，可使用 Python；通过稳定 API
    或消息契约与主后端交互。
-   客户端同步协议与本地数据库 Adapter 不绑定具体 UI 框架。
-   模型供应商通过 Model Gateway 抽象，DeepSeek 为首个主要供应商。

## 5. 全局优先级

**P0：** 数据不丢失、权限安全、Artifact
可编辑、来源可追溯、任务可恢复、基础同步、备份导出、成本限制。\
**P1：** 学习旅程、知识维护、自动化研究、智能冲突合并。\
**P2：** 团队协作、实时多人编辑、Skill
Marketplace、企业部署和本地模型生态。

## 6. 决策冲突优先级

1.  安全、隐私、数据完整性。
2.  用户明确确认的产品决策。
3.  本文档中的 ADR。
4.  模块级实现细节。
5.  Codex 的临时实现偏好。

若实现与契约冲突，以契约为准；若契约本身冲突，停止相关实现并报告。
