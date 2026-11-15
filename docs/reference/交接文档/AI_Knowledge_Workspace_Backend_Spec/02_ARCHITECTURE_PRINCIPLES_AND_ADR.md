# 02 --- Architecture Principles & ADR

## 1. 架构原则

1.  模块化单体优先，按真实负载拆分服务。
2.  领域逻辑与 Agent Prompt 解耦。
3.  Agent 不直接写数据库。
4.  结构化协议优先于自由文本。
5.  确定性验证优先于 LLM Judge。
6.  用户数据权威性优先于模型便利性。
7.  云端权威、本地持久化副本。
8.  原始资产与知识派生物分离。
9.  事件可靠性优先于实时推送。
10. 可观测性、成本和安全是基础设施，不是后期补丁。

## 2. ADR 清单

### ADR-001：模块化单体 + Worker

**决定：** 主 API 采用模块化单体；耗时任务使用独立 Worker；Agent Runtime
可独立部署。\
**原因：** 降低早期运维复杂度，同时隔离长任务和 CPU/IO 密集任务。\
**后续拆分条件：** 独立扩缩容、故障隔离或团队边界有明确收益。

### ADR-002：Cloud-authoritative

**决定：** 云端是正式知识资产的权威版本；本地是可持久化工作副本。\
**原因：** 跨设备一致性、云端 Agent 和权限治理需要统一权威源。\
**约束：** 本地未同步 Mutation 不得被清理；离线编辑必须持久化。

### ADR-003：PostgreSQL + pgvector

**决定：** 结构化业务数据和早期向量检索使用 PostgreSQL / pgvector。\
**不做：** MVP
不引入独立图数据库、向量数据库或搜索集群，除非压测证明必要。

### ADR-004：S3-compatible Object Storage

**决定：**
原始文件、大型产物和备份进入对象存储；数据库仅保存元数据和对象键。\
**约束：** 对象 Key 不使用用户原始路径；下载采用短期授权或受控服务。

### ADR-005：Mutation-based Sync

**决定：** 本地 Mutation Outbox + 服务端版本校验 + Change Feed Cursor。\
**不做：** 全量数据库覆盖、客户端时间戳胜出、WebSocket 唯一同步。

### ADR-006：No CRDT in MVP

**决定：** MVP 使用版本号、Optimistic Locking、Block-level merge 和冲突
UI。\
**后续：** 多人实时协作成为真实需求时再评估 Yjs/CRDT。

### ADR-007：Agent Proposal, not Direct Write

**决定：** Agent 对正式 Artifact 生成 Patch
Proposal；通过验证、冲突检测和策略门控后提交。\
**约束：** 禁止静默覆盖用户编辑。

### ADR-008：Canonical Artifact Schema

**决定：** 定义平台无关的自有 Artifact Schema；编辑器 JSON 是 Adapter
层格式，不是系统唯一数据协议。

### ADR-009：Evidence-first Knowledge

**决定：** 重要 Claim 必须关联 Evidence；Agent 间传递 Claim ID /
Evidence ID，不只传自然语言摘要。

### ADR-010：Data Portability

**决定：** 支持完整结构化导出、资源包、导入和 Schema 迁移。\
**约束：**
导出包括用户拥有的内容、关系、必要版本与资源引用；版权受限内容按策略处理。

## 3. 技术选型约束

  层              选型
  --------------- --------------------------------------
  业务数据库      PostgreSQL
  向量            pgvector
  对象存储        S3 API / MinIO
  缓存/短期协调   Redis
  Web 本地        IndexedDB；大文件可用 OPFS
  桌面本地        SQLite
  Android/iOS     SQLite 插件/原生桥接
  HarmonyOS       ArkData 或验证过的 SQLite 适配
  模型            DeepSeek via Model Gateway
  编辑器          Tiptap / ProseMirror Adapter
  任务队列        初期选一种可靠队列，避免多套队列并存

## 4. 依赖方向

允许： - API → Domain Services。 - Domain Services → Repository /
Ports。 - Agent Runtime → Domain API / Tool API。 - Worker → Application
Use Cases。 - Client → Public API Contracts。

禁止： - Agent → 直接数据库连接。 - UI → 直接依赖数据库表结构。 -
一个领域模块 → 直接读写另一个模块内部表。 - Domain 层 → 依赖具体
DeepSeek SDK。 - 同步服务 → 依赖 UI 实现。 - 业务事务 → 依赖 Redis
成功。

## 5. 可靠性原则

-   所有外部调用设置连接/读取超时。
-   重试必须有上限、退避和抖动。
-   非幂等操作必须有幂等键或补偿机制。
-   重要状态持久化，不依赖进程内存。
-   事件使用 Transactional Outbox。
-   失败任务进入可观察的失败/死信状态。
-   业务数据提交不能依赖 Embedding、缓存或通知成功。
