# 13 --- Codex Implementation Roadmap

## 1. 实施总规则

先审查仓库现状，再建立模块边界和测试基线。不得一次性并行实现所有模块。每个
Phase 通过验收后再进入下一阶段。

## 2. Phase 0 --- Repository Audit & Foundation

任务： - 仓库结构审计。 - 识别现有语言、框架、数据库和部署方式。 -
输出现有实现与本规范差异。 - 建立 ADR 目录。 -
建立配置管理、日志、错误协议、迁移工具。 - 建立
CI、格式化、Lint、测试命令。 - 建立 OpenAPI 和 Schema 目录。

验收： - 可重复构建。 - 测试可运行。 - 环境变量有示例文件。 -
无密钥提交。 - 模块依赖边界明确。

## 3. Phase 1 --- Core Domain & Persistence

任务： - Tenant / User / Workspace / Project。 - Artifact / Revision /
Patch。 - Source / Asset / Evidence / Claim。 - KnowledgeNode / Edge。 -
PostgreSQL migrations。 - S3 Adapter。 - 权限与审计基础。

验收： - 领域 CRUD 和权限测试通过。 - Artifact revision 不可变。 -
用户正式内容不能被 Agent 直接覆盖。 - Asset 元数据与文件对象分离。

## 4. Phase 2 --- Agent Runtime

任务： - Model Gateway / DeepSeek Adapter。 - Execution Policy
Engine。 - Orchestrator。 - Single Agent path。 - Typed DAG path。 -
Tool Registry / Executor。 - Run state machine。 - Checkpoint / Resume /
Cancel。 - Cost accounting。 - Schema / Permission / Evidence / Artifact
validators。

验收： - Simple 任务不启动多 Agent。 - Complex 任务可恢复。 - Agent
无数据库直连。 - 所有 Tool 经过授权。 - 预算耗尽安全停止。 - 输出 Schema
合规。

## 5. Phase 3 --- Research & Ingestion

任务： - Search Provider Adapter。 - Source normalization。 - Upload
sessions。 - PDF / HTML / Office 基础解析。 - Document IR。 - Quality
reports。 - Chunking。 - pgvector。 - Hybrid retrieval。 - Evidence /
Claim extraction。

验收： - 资料可追溯。 - 解析质量不足有明确 warning。 -
权限过滤在检索层执行。 - SSRF 和文件安全测试通过。

## 6. Phase 4 --- Artifact Production & Editing Contract

任务： - Canonical Artifact Schema。 - Editor Adapter。 - Patch
operations。 - Diff。 - Patch validation。 - revision commit。 - AI
proposal workflow。 - Export Markdown / PDF / DOCX。

验收： - 字符级编辑。 - Block ID 稳定。 - Patch 目标定位可验证。 -
用户编辑优先。 - 导出引用与结构正确。

## 7. Phase 5 --- Sync & Local Persistence

任务： - Local DB Adapter。 - Mutation Outbox。 - Sync API。 - Change
Feed Cursor。 - ACK / idempotency。 - Version conflict。 - Block
merge。 - Snapshot reconciliation。 - Asset upload resume。 - Offline
pinning。

验收： - 断网编辑不丢。 - 重复提交幂等。 - 两设备冲突可见。 -
不使用客户端时间戳判胜负。 - 清缓存不影响未同步数据。

## 8. Phase 6 --- Governance, Backup & Operations

任务： - Data classification。 - External model consent policy。 -
Source rights metadata。 - Data deletion lifecycle。 - Workspace ZIP
export/import。 - PostgreSQL backup / PITR。 - Object storage backup。 -
Observability。 - Quota / cost dashboard。 - Recovery drills。

验收： - 用户可完整导出。 - 可从备份恢复。 - 删除执行依赖分析。 -
成本和任务可追踪。 - 权限撤销即时生效。

## 9. Phase 7 --- P1 Product Capabilities

-   Capture Inbox。
-   Source Library。
-   Learning Journey。
-   Active Recall / Spaced Repetition。
-   Knowledge Maintenance Center。
-   Research Monitor / Automation。
-   用户偏好。
-   更高级图谱筛选。

## 10. Phase 8 --- P2 Expansion

-   Team Workspace。
-   评论与审核。
-   多人实时协作。
-   CRDT 评估与实施。
-   Skill / Template Marketplace。
-   API / SDK / MCP。
-   企业管理和私有部署。
-   本地模型与 Private Workspace。

## 11. 推荐仓库目录

根据现有仓库调整，不要求机械照搬：

``` text
backend/
  apps/
    api/
    agent-runtime/
    workers/
  modules/
    identity/
    tenancy/
    workspace/
    project/
    artifact/
    source/
    asset/
    document/
    evidence/
    knowledge/
    research/
    learning/
    sync/
    export/
    governance/
    billing-usage/
  infrastructure/
    database/
    object-storage/
    queue/
    cache/
    model-gateway/
    search-providers/
  contracts/
    api/
    events/
    schemas/
  migrations/
  tests/
  docs/
```

## 12. Codex 每轮任务提示模板

``` text
请先读取：
- 00_README_CODEX_EXECUTION_ORDER.md
- 相关模块规范
- 对应 ADR

先检查仓库当前实现，不要直接重写。

请输出：
1. 当前实现与规范差异
2. 本次任务范围
3. 依赖模块
4. 数据库/API/事件变更
5. 实施步骤
6. 风险和迁移方案
7. 测试计划

然后分步实现。不得超出任务范围，不得绕过权限、版本、幂等和验证门控。

完成后运行相关测试，并汇报：
- 修改文件
- 数据库迁移
- API/Schema 变化
- 测试结果
- 未完成项
- 已知风险
```

## 13. Definition of Done

一个模块只有同时满足以下条件才算完成： - 契约定义清晰。 -
权限和租户边界正确。 - 错误处理完整。 - 幂等和重试策略明确。 -
日志和指标可观测。 - 单元与集成测试通过。 - 数据迁移可执行。 -
文档已更新。 - 无未说明的临时绕过方案。
