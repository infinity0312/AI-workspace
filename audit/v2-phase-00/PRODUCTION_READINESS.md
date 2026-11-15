# 生产就绪度

**本机通过，生产放量 Hold。** 本轮测试通过 PGlite、测试对象目录和隔离 Workspace 进行。当前环境未在 PATH 定位 Docker 或 psql，未连接目标服务器。部署配置或 SQL 实现不作为生产演练证据。

| 检查项 | 状态 | 证据、差距和影响 |
| --- | --- | --- |
| PostgreSQL 事务与迁移 | partial | [database.ts](../../apps/api/src/platform/database.ts) 有 Pg pool、BEGIN/COMMIT/ROLLBACK、15 秒 statement timeout、独立模式迁移 advisory lock。存在 001–012；本地迁移成功。目标生产库的实际迁移状态、并发和故障切换 unknown。 |
| Multi-worker、心跳和 fence | partial | [jobs.ts](../../apps/api/src/domain/jobs.ts) 有 SQL 锁、领取、到期重领、心跳、写入 fence 和最多五次执行尝试。PGlite 有模拟租约失效和恢复测试，真实双 Worker、进程故障、连接中断和负载未验。未定位独立死信队列/调度退避；请求级暂态重试有短延迟和调用预算。 |
| 幂等和 outbox | partial | Workspace/Artifact/API 命令与 sync mutation 有事务幂等；`domain_outbox` 服务领域事件同步。尚未见独立 Worker inbox/outbox 投递和跨 SQL/S3 的恢复。模型用量写入与终态 fence 在不同事务，生产演练应明确迟到响应和重复扣账口径。 |
| S3 / MinIO | partial | [objects.ts](../../apps/api/src/platform/objects.ts) 有配置化 S3 Put/Get、SDK 有限重试和上传超时；[knowledge.ts](../../apps/api/src/domain/knowledge.ts) 有应用级内容哈希、工作空间前缀及权限。实际服务的版本控制、加密、保留、断点恢复、孤儿清理、备份演练 unknown；未定位现有预签名流程。 |
| 监控与压力 | partial | 现有 health、Job events、用量、错误与耗时、结构化 Worker 错误日志。生产可用的延迟、队列、丢租约、对象失败指标、告警和端到端 tracing 证据 unknown。没有吞吐/P95/SLA 测量。 |
| 数据备份与恢复 | partial | 测试覆盖 Workspace 压缩归档检查与恢复。PG 备份/PITR、对象备份及联合恢复演练 unknown。应用归档不能代表数据库和对象存储灾备。 |
| 灰度和回滚 | partial | 新路径默认关闭；Workspace allowlist 或仅本地的全开选项，任务入队记录开关。测试关闭新准入后新任务回旧路径，历史 Session 可读。无真实流量 Shadow、Canary、生产回退演练。 |
| 权限与资料安全 | partial | [security.ts](../../apps/api/src/platform/security.ts)、[access.ts](../../apps/api/src/domain/access.ts)、[ai-evidence.ts](../../apps/api/src/domain/ai-evidence.ts) 和 [public-web.ts](../../apps/api/src/platform/public-web.ts) 提供服务端权限、外部同意、证据快照、用户 URL 的公网解析/重定向校验和限流量边界。本轮是代码审计及已有防御回归。全服务真实租户隔离、上传解析沙箱和基础设施硬化仍缺证据。 |

阶段 13/15 的上线证据至少应覆盖真实多 Worker 重领/隔离、对象与元数据一致性、压力与故障、可恢复备份及回滚演练。 [本地灰度运维记录](../../docs/engineering/deepseek-harness-migration/OPERATIONS.md)
