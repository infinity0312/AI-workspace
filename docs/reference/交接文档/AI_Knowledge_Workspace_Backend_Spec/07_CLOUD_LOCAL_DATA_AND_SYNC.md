# 07 --- Cloud / Local Data & Sync Architecture

## 1. 总体决策

Cloud-authoritative + Local-first interaction + Basic Offline。

云端保存正式权威版本；本地持久化工作副本。离线修改先写本地数据库和
Mutation Outbox，联网后同步。

## 2. 数据归属

  数据                     云端           本地
  ------------------------ -------------- ---------------
  Workspace / Project      权威           活跃副本
  Artifact / Revision      权威           当前/近期副本
  Knowledge Node / Edge    权威           按需副本
  Source metadata          权威           缓存
  Original Asset           对象存储       按需下载
  Evidence / Claim         权威           相关项目副本
  Embedding                主要云端       默认不下载
  Agent Run / Checkpoint   权威           状态缓存
  未同步 Mutation          接收后权威     必须持久保留
  UI 状态                  可选同步       本地优先
  API Key                  Secret Store   OS 安全存储

## 3. 平台本地存储

  平台            结构化存储                        文件
  --------------- --------------------------------- -----------------------------------
  Web/PWA         IndexedDB                         OPFS / Cache Storage
  Windows/macOS   SQLite                            App Sandbox / Application Support
  Android/iOS     SQLite 原生插件                   App Sandbox
  HarmonyOS       ArkData 或已验证 SQLite Adapter   应用沙箱

各平台实现可不同，但必须遵循统一 Local Repository、Mutation、Cursor 和
Schema 契约。

## 4. 本地逻辑分区

-   Workspace Cache
-   Knowledge Replica
-   Editing State
-   Sync State
-   Agent Status Cache
-   Local Asset Cache

MVP 可使用单个本地数据库分表实现，不需要六个独立数据库。

## 5. 本地保留规则

永久保留直到 ACK： - 未同步 Mutation。 - 当前编辑文档的本地保存状态。 -
未完成上传状态。 - 用户明确固定离线的内容。

可清理： - 缩略图。 - 可重新下载缓存。 - 临时检索结果。 -
非必要历史页面缓存。

清理前必须检查同步状态；不能删除 Outbox 或未同步附件。

## 6. 资料模式

### Cloud Managed

文件上传云端，可跨设备使用，云端 Agent 可在权限允许时处理。

### Local Only

原始文件不自动上传；云端 Agent
无法直接读取。若用户选择云端模型处理，必须单独授权并说明数据出设备。

### Temporary Processing

授权临时上传处理；明确原文件、快照、派生内容和用户保留结果各自的保留策略。

## 7. Mutation Protocol

``` typescript
interface Mutation {
  mutation_id: string;
  workspace_id: string;
  device_id: string;
  entity_type: string;
  entity_id: string;
  operation: string;
  base_version: number;
  client_sequence: number;
  payload: Record<string, unknown>;
  schema_version: string;
  created_at: string;
}
```

要求： - mutation_id 全局唯一。 - 同一设备 client_sequence 单调递增。 -
服务端按幂等键处理。 - 不用客户端时间戳决定版本胜负。 - base_version
用于冲突检测。 - payload 必须通过 Schema 和权限校验。

## 8. 同步流程

1.  客户端在本地事务中保存编辑和 Outbox Mutation。
2.  UI 立即反映本地持久化结果。
3.  Sync Engine 上传 Mutation。
4.  服务端检查身份、租户、资源权限、Schema、版本和业务规则。
5.  服务端在事务中提交领域修改、Revision 和 Outbox Event。
6.  返回 ACK、新版本和 server sequence。
7.  客户端标记 Mutation 已同步。
8.  客户端使用 cursor 拉取其他设备变更。

ACK 丢失时重发同一 mutation_id，服务端返回原结果，不重复提交。

## 9. Change Feed

每个 Workspace 或同步域维护 cursor： - `server_sequence` -
`next_cursor` - `has_more`

历史事件压缩后，客户端使用 Snapshot Reconciliation，而不是无限回放历史。

WebSocket / SSE 仅用于实时通知；断线后必须通过 cursor 恢复。

## 10. 冲突策略

-   不同 Block：尝试自动合并。
-   同一 Block 不同范围：安全定位后尝试合并。
-   同一范围冲突：保留两边，进入冲突 UI。
-   Node 字段：按字段语义合并。
-   Edge：检查删除/修改冲突。
-   Agent Patch：必须检查 base revision。
-   删除：不能静默覆盖未同步编辑。

## 11. Agent 与用户编辑竞争

Agent 读取指定 revision，产生独立 Patch Proposal。服务端提交前检查当前
revision。用户修改优先；若 base 已过期，要求重定位或生成 Merge
Proposal。绝不静默覆盖。

## 12. 本地存储安全

-   数据库敏感字段加密或使用平台安全能力。
-   API Token 放 OS Keychain / Keystore 等安全存储。
-   本地文件路径不作为云端 Asset ID。
-   缓存清理不得影响未同步数据。
-   多账号切换必须隔离本地数据。

## 13. MVP 同步边界

MVP 不引入 CRDT。采用 Mutation + Version + Optimistic Lock + Block
Merge。多人实时协作作为后续独立阶段。
