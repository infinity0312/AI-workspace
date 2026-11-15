# 11 --- Deployment, Observability & Cost

## 1. 部署拓扑

MVP 推荐： - API Application。 - Agent Runtime Worker。 - Document / OCR
Worker。 - Embedding / Index Worker。 - Export / Backup Worker。 -
PostgreSQL。 - Redis。 - S3-compatible storage。 - 监控与日志系统。

主 API 模块化单体部署；Worker 可独立扩容。避免一开始拆成大量微服务。

## 2. 环境

-   Local Development。
-   CI / Test。
-   Staging。
-   Production。

密钥、数据库、对象存储和模型供应商配置必须按环境隔离。

## 3. 队列与任务

任务必须： - 持久化。 - 幂等。 - 可重试。 - 有 timeout。 - 有最大
attempts。 - 有 backoff + jitter。 - 有 dead-letter 状态。 -
支持取消或安全终止。 - 可追踪 run_id / task_id。

不要只依赖 Redis 内存队列保存长时间任务的唯一状态。

## 4. Observability

统一： - structured logs - metrics - distributed traces -
correlation_id - run_id - task_id - tenant_id（日志中使用安全标识） -
provider request ID

关键指标： - API latency / error rate。 - Queue depth / age。 - Worker
success / retry / dead-letter。 - Agent Run duration / completion。 -
Tool call failures。 - Validator rejection / false positive samples。 -
Sync lag。 - Mutation conflict rate。 - Upload failure rate。 - Document
parse quality。 - Embedding freshness。 - Storage usage。 - Cost per
run。

## 5. 成本管理

Cost Management Engine 记录： - model input/output usage。 - search
provider usage。 - OCR / vision usage。 - embedding usage。 - storage
usage。 - export / processing usage。

每个 Run 有： - estimated budget - actual cost - token limit - tool call
limit - max agents - max duration - max documents/pages - repair limit

预算耗尽时： - 保存 checkpoint。 - 保留 partial result。 -
停止新增昂贵调用。 - 返回可解释状态。 - 允许用户确认继续。

## 6. Execution Policy Engine

根据任务类型和用户策略决定： - Single Agent 或 Multi-Agent。 -
搜索深度。 - 是否 OCR。 - 是否需要 Evidence Validator。 - 最大并行数。 -
最大 Token / 成本。 - 最大运行时间。 - 是否需要人工确认。

策略规则在代码中可测试，不把预算和权限全部交给 LLM 决定。

## 7. 容量与性能

初期关注： - PostgreSQL 连接池。 - JSONB 查询索引。 - pgvector
索引与召回。 - 大文件直传对象存储。 - Worker 独立扩容。 -
文档分页解析。 - 大 Artifact 编辑器分页/虚拟化。 - 本地缓存容量控制。

不提前做过度分片或复杂多区域架构。

## 8. 灾难恢复

定义并实测： - RPO。 - RTO。 - 数据库恢复。 - 对象存储恢复。 -
队列积压恢复。 - Agent Run 恢复。 - 事件重放。 - 密钥轮换。

备份存在不等于恢复可用，必须定期演练。
