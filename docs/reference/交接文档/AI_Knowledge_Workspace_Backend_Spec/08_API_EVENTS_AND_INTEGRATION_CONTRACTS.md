# 08 --- API, Events & Integration Contracts

## 1. API 规范

-   REST API，版本前缀 `/v1`。
-   JSON 请求/响应。
-   OpenAPI 作为契约来源。
-   统一分页、过滤、排序。
-   所有资源访问进行服务端权限校验。
-   写请求支持 Idempotency-Key。
-   长任务返回 Run ID，不阻塞 HTTP 请求。
-   统一错误结构和 trace_id。

## 2. 统一错误格式

``` json
{
  "error": {
    "code": "ARTIFACT_VERSION_CONFLICT",
    "message": "The artifact has changed since the supplied base revision.",
    "retryable": false,
    "details": {},
    "trace_id": "tr_01"
  }
}
```

错误码分组：
`AUTH_*, PERMISSION_*, VALIDATION_*, CONFLICT_*, RATE_LIMIT_*, PROVIDER_*, STORAGE_*, TASK_*, INTERNAL_*`

## 3. 核心 API 资源

### Workspace / Project

-   `POST /v1/workspaces`
-   `GET /v1/workspaces`
-   `GET /v1/workspaces/{id}`
-   `POST /v1/workspaces/{id}/projects`
-   `PATCH /v1/projects/{id}`
-   `POST /v1/projects/{id}/relations`

### Artifact

-   `POST /v1/artifacts`
-   `GET /v1/artifacts/{id}`
-   `GET /v1/artifacts/{id}/revisions`
-   `POST /v1/artifacts/{id}/patches`
-   `POST /v1/artifacts/{id}/patches/{patchId}/accept`
-   `POST /v1/artifacts/{id}/patches/{patchId}/reject`
-   `POST /v1/artifacts/{id}/merge-proposals`

### Research Run

-   `POST /v1/research-runs`
-   `GET /v1/research-runs/{id}`
-   `POST /v1/research-runs/{id}/pause`
-   `POST /v1/research-runs/{id}/resume`
-   `POST /v1/research-runs/{id}/cancel`
-   `GET /v1/research-runs/{id}/events`

### Capture / Source

-   `POST /v1/capture-items`
-   `GET /v1/capture-items`
-   `POST /v1/capture-items/{id}/process`
-   `GET /v1/sources`
-   `GET /v1/sources/{id}`
-   `GET /v1/sources/{id}/dependencies`
-   `POST /v1/sources/{id}/revalidate`

### Knowledge

-   `GET /v1/knowledge/nodes`
-   `POST /v1/knowledge/nodes`
-   `GET /v1/knowledge/edges`
-   `POST /v1/knowledge/edges/suggestions`
-   `POST /v1/knowledge/reviews/{id}/resolve`
-   `GET /v1/knowledge/impact-analysis`

### Sync

-   `POST /v1/sync/mutations`
-   `GET /v1/sync/changes?cursor=...`
-   `POST /v1/sync/ack`
-   `POST /v1/sync/snapshot`
-   `GET /v1/devices`

### Assets

-   `POST /v1/assets/upload-sessions`
-   `POST /v1/assets/upload-sessions/{id}/complete`
-   `GET /v1/assets/{id}`
-   `POST /v1/assets/{id}/download-authorizations`

### Export / Import

-   `POST /v1/exports`
-   `GET /v1/exports/{id}`
-   `POST /v1/imports`
-   `GET /v1/imports/{id}`

### Usage / Preferences

-   `GET /v1/usage`
-   `GET /v1/usage/costs`
-   `GET /v1/usage/quotas`
-   `GET /v1/preferences`
-   `PATCH /v1/preferences`

## 4. 异步任务响应

创建长任务返回：

``` json
{
  "run_id": "run_01",
  "status": "QUEUED",
  "status_url": "/v1/research-runs/run_01",
  "events_url": "/v1/research-runs/run_01/events"
}
```

客户端可轮询；实时事件可用 SSE。事件必须可从持久化记录恢复。

## 5. Domain Events

建议事件： - `WorkspaceCreated` - `ProjectUpdated` - `ArtifactCreated` -
`ArtifactRevisionCommitted` - `ArtifactPatchProposed` -
`ArtifactPatchAccepted` - `ArtifactDeleted` - `AssetUploaded` -
`DocumentParsed` - `DocumentQualityAssessed` - `EvidenceCreated` -
`ClaimStatusChanged` - `KnowledgeEdgeProposed` -
`KnowledgeEdgeReviewed` - `ResearchRunStateChanged` -
`ResearchRunCompleted` - `SourceStatusChanged` - `ExportCompleted`

## 6. Transactional Outbox

业务修改与 Outbox Event 必须在同一数据库事务中提交。Dispatcher
异步投递，消费者必须幂等。事件失败可重试并进入死信状态。

## 7. Event Envelope

``` json
{
  "event_id": "evt_01",
  "event_type": "ArtifactRevisionCommitted",
  "schema_version": "1.0",
  "tenant_id": "tenant_01",
  "workspace_id": "ws_01",
  "aggregate_type": "artifact",
  "aggregate_id": "art_01",
  "aggregate_version": 12,
  "occurred_at": "2026-11-08T10:00:00Z",
  "payload": {}
}
```

## 8. Integration Ports

外部服务必须通过 Adapter / Port： - Model Provider。 - Search
Provider。 - Object Storage。 - OCR / Parser。 - Email /
Notification。 - Payment（后续）。 - Browser Extension。

不得将供应商专有数据结构泄漏到 Domain Model。
