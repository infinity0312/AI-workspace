# AI Knowledge Workspace：技术设计修订版 V1.1



根据你确定的四项选择，我建议正式将产品技术路线调整为：

| 决策      | 最终方案                            |
| --------- | ----------------------------------- |
| Android   | Capacitor + React + Kotlin 原生插件 |
| 导出      | 单个 Artifact + 完整 Workspace      |
| Workspace | AI 自适应组合，用户可以调整         |
| 离线      | 基础离线阅读、编辑和同步            |

这四项决策会影响三个核心模块：

1. Artifact 系统：从简单的内容容器升级为可组合、可编辑、可导出的知识产物协议。
2. Export 系统：从前端下载功能升级为独立的后端导出服务。
3. Android 系统：从 Web 页面适配升级为具有原生文件交互、离线缓存和后台同步能力的移动客户端。

我还建议增加一个横向模块：Workspace Layout Engine（工作空间布局引擎）。

它负责根据知识类型、设备尺寸和用户偏好决定如何展示 Artifact，而不是让 Agent 直接生成一份固定页面。

整体架构变为：

```
                  AI KNOWLEDGE WORKSPACE
                           │
          ┌────────────────┼────────────────┐
          │                │                │
       FRONTEND          AGENT           DATA
          │                │                │
     Workspace UI     Orchestrator     PostgreSQL
          │                │                │
     Layout Engine     Specialists      Knowledge
          │                │                │
     Artifact Engine   Skills / Tools    Sources
          │                │                │
          └────────────────┼────────────────┘
                           │
                   Artifact Protocol
                           │
             ┌─────────────┴─────────────┐
             │                           │
       Export Service              Android Client
             │                           │
       PDF/DOCX/ZIP              Capacitor + React
       JSON/MD/SVG                Kotlin Plugins
             │                           │
        Object Storage             Local Cache
```

下面将这三个核心模块细化到可以开始编码的程度。

# Part 1. Artifact Schema：统一知识产物协议

## 1. 为什么需要重新设计 Artifact？

之前的设计中，Artifact 主要由以下字段构成：

```
{
  "id": "artifact_001",
  "type": "knowledge_workspace",
  "title": "GNN",
  "blocks": []
}
```

这个设计适合概念验证，但不够支撑长期使用。

我们还需要解决：

- 一个 Workspace 可以包含多个 Artifact。
- Artifact 可以包含多个不同类型的 Block。
- Block 可以引用知识节点、来源和证据。
- AI 可以修改其中一部分内容。
- 用户可以手动修改布局。
- 同一个 Artifact 可以有不同的桌面端和移动端布局。
- 同一个知识内容可以被不同 Artifact 复用。
- Artifact 可以独立导出，也可以随 Workspace 一起导出。
- AI 生成的新内容不能覆盖用户已有内容。

因此，我建议将 Artifact 体系拆成五个层次。

## 1.1 五层数据结构

| 层次 | 对象         | 职责                            |
| ---- | ------------ | ------------------------------- |
| L1   | Workspace    | 整个知识工作空间                |
| L2   | Artifact     | 一个具体知识产物                |
| L3   | Block        | 最小内容和交互单元              |
| L4   | Resource     | 被 Block 引用的知识、来源、证据 |
| L5   | Presentation | 展示布局、排序和设备适配        |

关系：

```
Workspace
   │
   ├── Artifact A
   │      ├── Block 1
   │      ├── Block 2
   │      └── Block 3
   │
   ├── Artifact B
   │      ├── Block 4
   │      └── Block 5
   │
   └── Artifact C
          ├── Block 6
          └── Block 7

Block
   │
   ├── Knowledge Node
   ├── Source
   ├── Evidence
   └── Other Artifact
```

这里有一个关键原则：

Block 保存展示和交互结构，Knowledge Node 保存长期知识，Resource 保存外部资料。

不要让三者互相替代。

## 1.2 完整 Artifact Schema

建议采用 JSON Schema + TypeScript 双重定义。

- JSON Schema：负责后端数据校验、API 协议和导出验证。
- TypeScript：负责前端类型安全。
- Pydantic：负责 Python Agent 输出验证。

三者使用同一份协议定义，避免前后端和 Agent 各自维护不同的数据格式。

### A. Workspace Schema

```
{
  "schema_version": "1.1",
  "id": "ws_001",
  "project_id": "project_001",
  "title": "Graph Neural Networks",
  "goal": "系统学习图神经网络及其材料科学应用",
  "description": "GNN 系统学习工作空间",
  "status": "active",
  "layout_policy": {
    "mode": "adaptive",
    "allow_user_override": true,
    "desktop_preset": "research",
    "mobile_preset": "reading"
  },
  "active_artifact_id": "artifact_001",
  "artifact_ids": [
    "artifact_001",
    "artifact_002",
    "artifact_003"
  ],
  "created_at": "2026-11-08T10:00:00Z",
  "updated_at": "2026-11-08T10:30:00Z"
}
```

`layout_policy.mode` 定义三种可能：

| 模式     | 说明                              |
| -------- | --------------------------------- |
| adaptive | AI 选择内容组合，布局引擎自动适配 |
| manual   | 用户完全控制布局                  |
| hybrid   | AI 提供建议，用户调整             |

默认使用 `adaptive`。

### B. Artifact Schema

```
{
  "schema_version": "1.1",
  "id": "artifact_001",
  "workspace_id": "ws_001",
  "type": "knowledge_document",
  "title": "GNN 基础知识",
  "description": "系统介绍图神经网络",
  "status": "published",
  "version": 3,
  "blocks": [
    "block_001",
    "block_002",
    "block_003"
  ],
  "metadata": {
    "language": "zh-CN",
    "subject": "machine_learning",
    "difficulty": "intermediate"
  },
  "provenance": {
    "created_by": "agent",
    "research_run_id": "run_001"
  },
  "permissions": {
    "editable": true,
    "exportable": true,
    "ai_modifiable": true
  },
  "created_at": "2026-11-08T10:00:00Z",
  "updated_at": "2026-11-08T10:30:00Z"
}
```

建议第一版支持以下 Artifact 类型：

```
type ArtifactType =
  | "knowledge_document"
  | "knowledge_graph"
  | "mind_map"
  | "timeline"
  | "comparison"
  | "research_dossier"
  | "interactive_artifact";
```

注意：Artifact 类型代表一个产物的主要用途，而不是限制内部只能使用一种 Block。

例如 `knowledge_document` 内部完全可以包含图表、公式和图片。

### C. Block Schema

Block 是最重要的可编辑单元。

建议使用带判别字段的联合类型（Discriminated Union）。

```
interface BaseBlock {
  id: string;
  type: BlockType;
  version: number;
  title?: string;
  position: number;

  editable: boolean;
  ai_modifiable: boolean;

  resource_refs: ResourceRef[];
  provenance?: Provenance;

  created_at: string;
  updated_at: string;
}
```

Block 类型：

```
type BlockType =
  | "markdown"
  | "formula"
  | "image"
  | "table"
  | "knowledge_graph"
  | "mind_map"
  | "timeline"
  | "source_list"
  | "evidence"
  | "code"
  | "interactive";
```

每种类型有独立的 Content Schema。

例如：

Markdown Block

```
{
  "id": "block_001",
  "type": "markdown",
  "version": 2,
  "position": 0,
  "editable": true,
  "ai_modifiable": true,
  "content": {
    "format": "markdown",
    "body": "# GNN\n\n图神经网络是一类..."
  },
  "resource_refs": [
    {
      "type": "knowledge_node",
      "id": "node_gnn"
    }
  ]
}
```

Knowledge Graph Block

```
{
  "id": "block_002",
  "type": "knowledge_graph",
  "version": 1,
  "position": 1,
  "editable": true,
  "ai_modifiable": true,
  "content": {
    "graph_id": "graph_001",
    "node_ids": [
      "node_gnn",
      "node_gcn",
      "node_gat"
    ],
    "relation_ids": [
      "rel_001",
      "rel_002"
    ],
    "layout": {
      "algorithm": "force_directed",
      "direction": "horizontal"
    }
  },
  "resource_refs": []
}
```

Timeline Block

```
{
  "id": "block_003",
  "type": "timeline",
  "version": 1,
  "position": 2,
  "editable": true,
  "ai_modifiable": true,
  "content": {
    "events": [
      {
        "id": "event_001",
        "date": "2009",
        "title": "早期 GNN 模型",
        "description": "图神经网络早期研究"
      },
      {
        "id": "event_002",
        "date": "2017",
        "title": "GCN",
        "description": "图卷积网络的发展"
      }
    ]
  },
  "resource_refs": []
}
```

这里的年份仅作为 Schema 示例，正式内容必须经过来源核验。

### D. Resource Reference

Block 不应该直接复制所有知识和来源内容。

统一使用 Resource Reference。

```
interface ResourceRef {
  type:
    | "knowledge_node"
    | "source"
    | "source_fragment"
    | "claim"
    | "evidence"
    | "artifact";

  id: string;
  relation?: string;
}
```

这样可以避免：

- 同一知识在多个 Artifact 中重复存储。
- 用户修改知识后，其他引用仍然保留旧版本。
- 来源和证据无法追溯。
- Workspace 导出时遗漏关联内容。

### E. Presentation Schema

这是此次架构升级新增的部分。

内容和布局必须分开保存。

```
{
  "workspace_id": "ws_001",
  "device_class": "compact",
  "layout_version": 1,
  "mode": "adaptive",
  "sections": [
    {
      "artifact_id": "artifact_001",
      "display_mode": "full_width",
      "order": 0
    },
    {
      "artifact_id": "artifact_002",
      "display_mode": "canvas",
      "order": 1
    },
    {
      "artifact_id": "artifact_003",
      "display_mode": "list",
      "order": 2
    }
  ]
}
```

设备类型：

- compact：手机。
- medium：小平板、展开的折叠屏。
- expanded：大屏设备。

建议建立独立数据库表：

```
workspace_layouts
├── id
├── workspace_id
├── user_id
├── device_class
├── layout_mode
├── layout_json
├── version
└── updated_at
```

同一个 Workspace 在不同设备上可以有不同布局，但内容保持一致。

## 1.3 Adaptive Layout Engine

这里需要明确一个非常重要的边界：

AI 决定应该生成什么内容，Layout Engine 决定内容应该如何展示。

不要让 LLM 直接决定屏幕上的每一个坐标。

建议采用以下流程：

```
User Learning Goal
       │
       ▼
Orchestrator
       │
       ▼
Artifact Planning
       │
       ▼
Artifact Composition
       │
       ▼
Schema Validation
       │
       ▼
Adaptive Layout Engine
       │
       ├── Desktop Layout
       ├── Tablet Layout
       └── Mobile Layout
                │
                ▼
          Renderer Registry
                │
                ▼
          User Workspace
```

例如：

| 知识类型 | AI 推荐组合              |
| -------- | ------------------------ |
| 编程语言 | 文档 + 代码 + 示例       |
| 历史事件 | 时间轴 + 地图 + 文档     |
| 数学理论 | 文档 + 公式 + 推导       |
| 材料科学 | 文档 + 晶体结构 + 图表   |
| 论文研究 | 文献库 + 证据链 + 对比表 |
| 算法学习 | 流程图 + 公式 + 算法对比 |

布局引擎再根据设备调整呈现形式。

例如桌面端使用左右双栏，手机端改为单列。

用户手动修改后，布局应保存为用户偏好，后续 AI 更新时不能擅自重置用户布局。

## 1.4 AI 修改 Artifact 的协议

建议增加 `Artifact Patch Protocol`。

AI 不直接覆盖 Artifact，而是提交修改操作。

例如：

```
{
  "artifact_id": "artifact_001",
  "base_version": 3,
  "operations": [
    {
      "op": "insert_block",
      "after": "block_001",
      "block": {
        "id": "block_004",
        "type": "formula",
        "content": {
          "latex": "H^{(l+1)}=\\sigma(\\hat A H^{(l)}W^{(l)})"
        }
      }
    },
    {
      "op": "update_block",
      "block_id": "block_002",
      "changes": {
        "title": "GNN 算法关系图"
      }
    }
  ]
}
```

执行顺序：

1. Agent 提交 Patch。
2. 后端验证 Schema。
3. 检查 `base_version`。
4. 计算修改 Diff。
5. 前端展示修改预览。
6. 用户接受后提交。
7. 创建新版本。

用户可以选择：

- 接受全部修改。
- 逐条接受。
- 拒绝。
- 自己修改后再保存。

如果是用户明确授权的自动整理任务，可以按其授权策略自动提交，但仍必须保留版本和撤销能力。

## 1.5 数据库调整

在原有数据库基础上新增或调整：

```
workspaces
workspace_artifacts
workspace_layouts

artifacts
artifact_blocks
artifact_versions
block_versions

artifact_resources
```

其中：

- `workspaces` 保存工作空间。
- `workspace_artifacts` 保存 Artifact 与 Workspace 的多对多关系。
- `artifact_blocks` 保存 Block。
- `artifact_versions` 保存产物版本快照。
- `block_versions` 保存 Block 级历史。
- `artifact_resources` 保存资源引用索引。

这样一个 Artifact 可以被多个 Workspace 引用，而不会复制实际知识数据。

# Part 2. Export Service：统一导出架构

## 2.1 导出系统的设计原则

导出系统必须独立于前端。

不要让 Web、Android 各自实现 PDF、Word 和 ZIP 生成逻辑。

推荐：

```
                  Export API
                      │
                      ▼
                 Export Job
                      │
                      ▼
                Export Worker
                      │
           ┌──────────┼──────────┐
           │          │          │
       Data Loader  Renderer  Packager
           │          │          │
           └──────────┼──────────┘
                      │
                      ▼
                 Object Storage
                      │
              ┌───────┴───────┐
              │               │
           Web 下载        Android 下载
```

核心原则：

- 导出任务在服务器执行。
- 导出时固定数据版本。
- 导出文件保存在对象存储。
- Web 和 Android 使用同一套 API。
- 下载链接具有有效期。
- 用户可以重新导出历史版本。

## 2.2 导出功能矩阵

正式确定第一版导出能力：

| 格式         | 单个 Artifact | 完整 Workspace | 优先级 |
| ------------ | ------------- | -------------- | ------ |
| Markdown     | 支持          | 支持           | P0     |
| PDF          | 支持          | 支持           | P0     |
| DOCX         | 支持          | 支持           | P0     |
| HTML         | 支持          | 支持           | P1     |
| JSON         | 支持          | 支持           | P0     |
| PNG          | 图表类        | 支持           | P1     |
| SVG          | 图表类        | 支持           | P1     |
| ZIP          | 不适用        | 支持           | P0     |
| CSV          | 表格类        | 支持           | P1     |
| XLSX         | 表格类        | 支持           | P1     |
| GraphML      | 图谱类        | 支持           | P2     |
| BibTeX / RIS | 来源类        | 支持           | P1     |

说明：

- 完整 Workspace 的 ZIP 是完整知识包。
- 完整 Workspace 的 PDF 是将文档、图谱和表格组合成阅读报告。
- JSON 是结构化数据导出。
- ZIP 中的文件应当是可独立阅读和重新导入的标准文件。

不是每种 Artifact 都需要支持所有格式。例如知识图谱可以导出 SVG、PNG、JSON，但不应该强行导出 DOCX。

## 2.3 Export API

统一使用：

```
/api/v1/exports
```

### API 1：创建导出任务

```
POST /api/v1/exports
```

Request：

```
{
  "target": {
    "type": "workspace",
    "id": "ws_001"
  },
  "format": "zip",
  "options": {
    "include_sources": true,
    "include_evidence": true,
    "include_assets": true,
    "include_versions": false,
    "include_agent_logs": false,
    "include_layouts": true
  },
  "render_options": {
    "language": "zh-CN",
    "theme": "light"
  }
}
```

单个 Artifact 导出：

```
{
  "target": {
    "type": "artifact",
    "id": "artifact_001"
  },
  "format": "pdf",
  "options": {
    "include_sources": true,
    "include_evidence": true,
    "include_assets": true
  },
  "render_options": {
    "page_size": "A4",
    "orientation": "portrait",
    "include_toc": true,
    "include_page_numbers": true
  }
}
```

返回：

```
202 Accepted
{
  "export_id": "export_001",
  "status": "queued",
  "created_at": "2026-11-08T11:00:00Z"
}
```

建议客户端同时传递 `Idempotency-Key`，避免用户连续点击导出时重复创建任务。

### API 2：查询导出状态

```
GET /api/v1/exports/{export_id}
```

返回：

```
{
  "export_id": "export_001",
  "status": "processing",
  "progress": {
    "stage": "rendering",
    "percentage": 65
  },
  "created_at": "2026-11-08T11:00:00Z"
}
```

状态定义：

```
queued
  │
  ▼
processing
  │
  ├── completed
  │
  ├── failed
  │
  └── cancelled
```

### API 3：下载导出文件

```
GET /api/v1/exports/{export_id}/download
```

返回：

```
{
  "download_url": "https://storage.example.com/...",
  "expires_at": "2026-11-08T12:00:00Z",
  "filename": "GNN_Workspace.zip",
  "mime_type": "application/zip",
  "size_bytes": 1024000
}
```

下载 URL 必须由后端生成，不应该将对象存储永久公开。

### API 4：查询导出历史

```
GET /api/v1/exports?workspace_id=ws_001
```

用户可以看到：

- 导出时间。
- 导出格式。
- 导出版本。
- 导出状态。
- 文件大小。
- 是否过期。

### API 5：取消导出

```
POST /api/v1/exports/{export_id}/cancel
```

只允许取消尚未完成的任务。

### API 6：导入完整 Workspace

为了真正实现数据可迁移，建议同时规划：

```
POST /api/v1/imports
```

支持上传 ZIP。

流程：

```
Upload ZIP
    │
    ▼
Inspect Manifest
    │
    ▼
Validate Schema
    │
    ▼
Check Resource References
    │
    ▼
Check ID Conflicts
    │
    ▼
Generate Import Preview
    │
    ▼
User Confirmation
    │
    ▼
Import Transaction
    │
    ▼
Restore Workspace
```

导入时遇到相同 ID，不能直接覆盖用户已有数据。

应该支持：

- 保留原始 ID（无冲突时）。
- 冲突时重新映射 ID。
- 合并到现有项目。
- 创建新项目。

完整的 ZIP 导出和重新导入，是证明我们没有锁定用户数据的重要验收指标。

## 2.4 导出数据库

新增：

```
export_jobs
├── id
├── user_id
├── target_type
├── target_id
├── target_version
├── format
├── options
├── status
├── progress
├── storage_uri
├── filename
├── mime_type
├── file_size
├── checksum
├── error_code
├── error_message
├── expires_at
├── created_at
└── completed_at
```

这里的 `target_version` 非常重要。

例如用户发起导出时，Workspace 是 V5。

导出进行期间，用户又修改成 V6。

那么此次导出必须仍然使用 V5。

不能在导出过程中混合读取不同版本的数据。

建议使用版本快照或一致性数据库读取，确保导出结果对应一个确定的数据状态。

## 2.5 Export Renderer

建议后端建立 Renderer Registry：

```
EXPORT_RENDERERS = {
    "markdown": MarkdownExporter(),
    "pdf": PDFExporter(),
    "docx": DOCXExporter(),
    "html": HTMLExporter(),
    "json": JSONExporter(),
    "zip": WorkspacePackager(),
    "svg": GraphSVGExporter(),
    "png": GraphPNGExporter(),
}
```

不同 Artifact 使用不同导出策略。

例如：

```
Knowledge Document
    ├── Markdown
    ├── PDF
    ├── DOCX
    └── HTML

Knowledge Graph
    ├── SVG
    ├── PNG
    ├── JSON
    └── GraphML

Comparison
    ├── CSV
    ├── XLSX
    ├── PDF
    └── Markdown
```

对于不支持的组合，API 应返回明确错误：

```
{
  "error": "UNSUPPORTED_EXPORT_FORMAT",
  "message": "This artifact does not support DOCX export."
}
```

不要默默生成一个内容残缺的文件。

## 2.6 ZIP 完整知识包规范

正式定义：

```
AKW Package Format 1.0
```

建议结构：

```
AKW_Workspace/
│
├── manifest.json
├── README.md
│
├── workspace/
│   ├── workspace.json
│   └── layouts/
│       ├── desktop.json
│       └── mobile.json
│
├── artifacts/
│   ├── artifact_001/
│   │   ├── artifact.json
│   │   └── blocks/
│   │       ├── block_001.json
│   │       └── block_002.json
│   │
│   └── artifact_002/
│       ├── artifact.json
│       └── blocks/
│
├── knowledge/
│   ├── nodes/
│   ├── relations.json
│   ├── note_links.json
│   └── versions/
│
├── sources/
│   ├── sources.json
│   └── fragments.json
│
├── evidence/
│   ├── claims.json
│   └── claim_evidence.json
│
├── assets/
│   ├── images/
│   └── attachments/
│
└── metadata/
    ├── provenance.json
    └── checksums.json
```

`manifest.json`：

```
{
  "format": "akw-package",
  "format_version": "1.0",
  "schema_version": "1.1",
  "workspace_id": "ws_001",
  "exported_at": "2026-11-08T11:00:00Z",
  "contents": {
    "artifacts": 3,
    "knowledge_nodes": 12,
    "sources": 8,
    "assets": 5
  }
}
```

特别注意：

1. 所有路径必须经过安全校验，防止 ZIP 路径穿越。
2. 文件必须计算 SHA-256。
3. 图片和附件使用相对路径引用。
4. Markdown 双链应保留稳定节点 ID。
5. 关系必须保留方向和类型。
6. 导出时保存来源元数据和证据定位。
7. 不应默认打包未经授权的第三方论文全文。
8. Agent 的执行记录只导出经过整理的决策摘要，不导出隐藏思维链或内部提示词。

# Part 3. Android Client：Capacitor 技术架构

## 3.1 最终技术决策

我建议正式采用：

Next.js Web + Vite React Android + Capacitor + Kotlin Native Plugins。

为什么不直接将 Next.js 项目打包成 Android？

因为 Next.js 可能依赖：

- Server Components。
- 服务端渲染。
- 服务端 API Routes。
- 服务端运行时。
- 动态路由处理。

这些能力不能直接等同于一个静态 WebView 应用。

所以建议把共享业务组件抽离出来，让 Android 使用独立的 Vite 入口。

两端共享核心代码，但拥有独立的应用 Shell。

## 3.2 Monorepo 结构

```
ai-knowledge-workspace/
│
├── apps/
│   │
│   ├── web/
│   │   ├── app/
│   │   ├── next.config.ts
│   │   └── package.json
│   │
│   └── android/
│       ├── src/
│       │   ├── app/
│       │   ├── pages/
│       │   ├── navigation/
│       │   └── main.tsx
│       │
│       ├── android/
│       │   └── Native Android Project
│       │
│       ├── capacitor.config.ts
│       ├── vite.config.ts
│       └── package.json
│
├── packages/
│   │
│   ├── domain/
│   │   ├── workspace/
│   │   ├── artifact/
│   │   ├── knowledge/
│   │   └── schemas/
│   │
│   ├── ui-core/
│   │   ├── buttons/
│   │   ├── dialogs/
│   │   └── common/
│   │
│   ├── workspace-engine/
│   │   ├── layout-engine/
│   │   └── workspace-state/
│   │
│   ├── editors/
│   │   ├── markdown/
│   │   └── wiki-link/
│   │
│   ├── renderers/
│   │   ├── markdown/
│   │   ├── graph/
│   │   ├── timeline/
│   │   └── table/
│   │
│   ├── api-client/
│   │
│   ├── sync-engine/
│   │
│   └── local-storage/
│
├── backend/
│   ├── app/
│   ├── worker/
│   └── migrations/
│
├── infrastructure/
│
└── docs/
    ├── ARCHITECTURE.md
    ├── ARTIFACT_SCHEMA.md
    ├── EXPORT_PROTOCOL.md
    └── ANDROID_DESIGN.md
```

## 3.3 共享和独立模块

| 模块                  | Web          | Android      |
| --------------------- | ------------ | ------------ |
| Knowledge Schema      | 共享         | 共享         |
| Artifact Schema       | 共享         | 共享         |
| Markdown Editor       | 共享         | 共享         |
| Wiki Link             | 共享         | 共享         |
| Graph Renderer        | 共享         | 共享         |
| Layout Engine         | 共享核心规则 | 共享核心规则 |
| API Client            | 共享         | 共享         |
| Sync Engine           | 共享逻辑     | 共享逻辑     |
| Application Shell     | 独立         | 独立         |
| Navigation            | 独立         | 独立         |
| Native Plugins        | 不需要       | 独立         |
| Local Storage Adapter | IndexedDB    | SQLite       |

这里建议使用 Turborepo 或 pnpm Workspaces 管理 Monorepo。

## 3.4 Android 原生插件

不需要自己实现所有原生功能。

优先使用 Capacitor 官方插件，只有必要时才写 Kotlin。

| 功能         | 实现                      |
| ------------ | ------------------------- |
| 文件读写     | Filesystem Plugin         |
| 文件分享     | Share Plugin              |
| 网络状态     | Network Plugin            |
| App 生命周期 | App Plugin                |
| 推送         | Push Notifications Plugin |
| 复杂文件选择 | Kotlin SAF Plugin         |
| 接收外部分享 | Kotlin Intent Integration |
| 后台同步     | Kotlin WorkManager        |
| 本地数据库   | SQLite Plugin             |

Capacitor 当前官方文档采用 V8 技术线，支持通过 Native Plugin 将 JavaScript 与 Android Java/Kotlin 能力连接起来。建议项目初始化时统一锁定同一主版本的 Capacitor Core、CLI 和 Android 插件。

Capacitor Documentation+2



### 插件 A：FileBridge

提供：

```
interface FileBridge {
  openFile(options: {
    mimeTypes: string[];
  }): Promise<{
    uri: string;
    name: string;
    mimeType: string;
    size: number;
  }>;

  saveFile(options: {
    filename: string;
    mimeType: string;
    contentUri?: string;
  }): Promise<{
    saved: boolean;
  }>;
}
```

Android 实现：

- 打开文件：`ACTION_OPEN_DOCUMENT`。
- 保存文件：`ACTION_CREATE_DOCUMENT`。
- 获取用户授权的 URI。
- 读取 `content://` 文件。
- 将导出文件写入用户选择的位置。

这里不要使用旧式的全盘存储权限方案。

Android Storage Access Framework 允许通过系统文件选择器访问用户明确选择的文件，不需要申请广泛的存储权限。

Android Developers+1



### 插件 B：IncomingShare

这是一个值得重点开发的功能。

用户在 Chrome、文件管理器或其他应用中点击分享，可以直接把内容发送给我们的 App。

```
interface IncomingSharePayload {
  type: "text" | "url" | "file" | "multiple_files";
  text?: string;
  url?: string;
  files?: Array<{
    uri: string;
    name: string;
    mimeType: string;
  }>;
}
```

Android 端处理：

```
External Application
       │
       ▼
Android Sharesheet
       │
       ▼
Incoming Intent
       │
       ▼
IncomingShare Plugin
       │
       ▼
Import Queue
       │
       ▼
AI Processing
       │
       ▼
Knowledge Workspace
```

例如：

用户在浏览器中看到一篇论文，点击分享，选择：

```
发送到 AI Knowledge Workspace
```

随后：

1. App 接收网页 URL。
2. 用户选择目标项目。
3. Agent 抓取并解析资料。
4. 建立 Source。
5. 提取 Claim 和 Evidence。
6. 更新对应 Workspace。

这会成为 Android 端非常重要的产品入口。

Capacitor 官方 Share 插件支持向其他应用分享文本、URL 和文件；接收外部应用分享则需要额外配置 Android Intent 和接收逻辑。

Capacitor Documentation+1



## 3.5 本地存储架构

这是 Android 离线能力的核心。

建议建立统一的 Local Repository Interface。

```
interface LocalRepository {
  getWorkspace(id: string): Promise<Workspace | null>;

  saveWorkspace(workspace: Workspace): Promise<void>;

  getArtifact(id: string): Promise<Artifact | null>;

  saveArtifact(artifact: Artifact): Promise<void>;

  enqueueOperation(
    operation: SyncOperation
  ): Promise<void>;

  getPendingOperations(): Promise<SyncOperation[]>;

  markOperationSynced(id: string): Promise<void>;
}
```

不同平台使用不同实现：

```
LocalRepository
      │
      ├── Web
      │     └── IndexedDB Adapter
      │
      └── Android
            └── SQLite Adapter
```

为什么 Android 建议使用 SQLite？

因为离线状态下需要处理：

- 多个 Artifact。
- 大量知识节点。
- 双链关系。
- 编辑操作队列。
- 同步状态。
- 版本冲突。

SQLite 更适合这些结构化数据的事务管理。

另外，图片、PDF 等二进制文件不建议直接塞进 SQLite。

使用 App 私有文件目录保存，SQLite 只保存文件路径、哈希和元数据。

## 3.6 Android 离线同步

建议使用 Outbox Pattern。

本地编辑不直接覆盖云端，而是先记录一个操作。

```
{
  "operation_id": "op_001",
  "entity_type": "artifact_block",
  "entity_id": "block_001",
  "operation_type": "update",
  "base_version": 3,
  "payload": {
    "content": "用户修改后的内容"
  },
  "created_at": "2026-11-08T12:00:00Z",
  "sync_status": "pending"
}
```

数据流：

```
用户编辑
   │
   ▼
Local SQLite
   │
   ▼
Outbox Queue
   │
   ▼
Network Available
   │
   ▼
Sync Worker
   │
   ▼
Backend API
   │
   ├── 成功
   │     └── 标记 synced
   │
   └── 冲突
         └── 保存冲突记录
               │
               ▼
          Conflict UI
```

### 同步 API

```
POST /api/v1/sync/push
{
  "device_id": "device_001",
  "operations": [
    {
      "operation_id": "op_001",
      "entity_type": "artifact_block",
      "entity_id": "block_001",
      "base_version": 3,
      "payload": {}
    }
  ]
}
```

拉取服务器更新：

```
GET /api/v1/sync/pull?cursor=sync_100
```

返回：

```
{
  "next_cursor": "sync_110",
  "changes": [
    {
      "entity_type": "artifact",
      "entity_id": "artifact_001",
      "version": 4,
      "change_type": "updated"
    }
  ]
}
```

### 冲突处理

第一版不要引入复杂 CRDT。

使用乐观锁 + Diff 冲突处理即可。

例如：

- 用户手机编辑 V3。
- 用户电脑已经保存 V4。
- 手机尝试提交基于 V3 的修改。
- 后端发现版本不一致。
- 返回冲突。
- 客户端显示 V3、V4 和本地修改之间的差异。
- 用户选择合并。

对于同一 Block 的纯文本修改，可以尝试三方合并；无法安全合并时交给用户处理。

对于用户明确修改的内容，AI 不能静默覆盖。

### 后台同步

Android 可以使用 WorkManager：

- 网络恢复后上传修改。
- 继续上传未完成文件。
- 重试失败操作。
- 同步完成后更新本地状态。

WorkManager 是 Android 官方推荐的持久化后台任务方案，支持网络约束和重试，但不应把长时间 Agent 研究任务放在手机上执行。Agent 仍然运行在云端。

Android Developers+1



## 3.7 Android 离线功能边界

正式确定 MVP：

| 功能                 | 离线状态                 |
| -------------------- | ------------------------ |
| 查看已下载 Workspace | 支持                     |
| 阅读 Markdown        | 支持                     |
| 编辑 Markdown        | 支持                     |
| 编辑表格             | 支持                     |
| 浏览知识图谱         | 支持                     |
| 修改知识关系         | 暂存后同步               |
| 添加本地笔记         | 支持                     |
| 阅读已下载 PDF       | 支持                     |
| 搜索云端资料         | 不支持                   |
| AI 研究任务          | 不支持                   |
| 云端 Agent 执行状态  | 恢复联网后同步           |
| 导出 Markdown        | 支持                     |
| 导出完整 Workspace   | 需要相关附件已缓存或联网 |

这里有一个细节：

用户可以离线编辑文档，但如果某些图片或 PDF 尚未下载，就不能承诺完整离线访问。

因此需要提供：

```
Download Workspace for Offline Use
```

用户可以选择：

- 仅下载知识内容。
- 下载知识内容和图片。
- 下载完整 Workspace 及指定 PDF 附件。

## 3.8 Android 自适应 Workspace

Android 端应该根据窗口宽度，而不是设备名称选择布局。

建议：

| 窗口     | 布局                    |
| -------- | ----------------------- |
| Compact  | 单列、底部导航          |
| Medium   | 目录 + 内容双栏         |
| Expanded | 目录 + 内容 + Inspector |

在 Android 中尤其要考虑：

- 系统状态栏。
- 底部导航栏。
- 手势导航安全区域。
- 软键盘弹出。
- 横屏。
- 分屏。
- 折叠屏展开和折叠。
- 外接键盘和鼠标。

### Android 页面组件

建议：

```
AndroidAppShell
│
├── BottomNavigation
│
├── WorkspaceNavigation
│
├── WorkspaceContent
│   ├── DocumentRenderer
│   ├── GraphRenderer
│   ├── TimelineRenderer
│   └── TableRenderer
│
├── BottomActionSheet
│
├── InspectorSheet
│
└── OfflineStatusIndicator
```

不要为每种 Artifact 重新开发一套 Android 页面。

继续使用共享 Renderer，只替换布局容器和交互方式。

### 生命周期管理

需要处理：

- App 进入后台时保存编辑状态。
- App 恢复时重新检查同步状态。
- 软键盘打开时调整编辑区域。
- 系统回退按钮优先关闭弹窗和侧面板，其次返回上一页面。
- Android 系统回收 Activity 后恢复未完成的文件选择和分享流程。

Capacitor App Plugin 提供前后台状态、深链接、Android 回退按钮以及外部 Activity 结果恢复事件。

Capacitor Documentation+1



## 3.9 Android 项目初始化

正式开发时建议统一采用 Capacitor 8 技术线。

开发环境要求需要在项目启动时锁定：

- Node.js 22 或更高版本。
- Android Studio。
- Android SDK。
- Capacitor Core / CLI / Android 统一主版本。

Capacitor 8 的官方环境要求包括 Node.js 22+ 和相应的 Android Studio 工具链。

Capacitor Documentation+1



建议初始化流程：

```
# Android App
cd apps/android

# Install dependencies
pnpm install

# Build React application
pnpm build

# Add Android platform
pnpm exec cap add android

# Sync web assets and native dependencies
pnpm exec cap sync android

# Open Android Studio
pnpm exec cap open android
```

生产环境使用本地打包的 Web 资源，不依赖开发服务器。

# Part 4. 完整开发任务清单

现在把上述架构转换成实际工程任务。

我建议按依赖关系分为八个阶段。

## Phase 0：项目基础设施

P0 · 必须完成

| ID    | 任务               | 交付物           |
| ----- | ------------------ | ---------------- |
| P0-01 | 建立 Monorepo      | pnpm Workspace   |
| P0-02 | 配置 Turborepo     | 构建任务管理     |
| P0-03 | 初始化 Next.js     | Web 项目         |
| P0-04 | 初始化 Vite React  | Android 前端项目 |
| P0-05 | 初始化 Capacitor   | Android 工程     |
| P0-06 | 初始化 FastAPI     | 后端服务         |
| P0-07 | PostgreSQL + Redis | 数据基础设施     |
| P0-08 | Docker Compose     | 本地运行环境     |
| P0-09 | CI/CD              | 自动测试与构建   |
| P0-10 | API Client         | 前后端通信层     |

验收标准：

- Web 可以独立运行。
- Android 可以在模拟器运行。
- API 可以连接 PostgreSQL。
- Web 和 Android 可以访问同一套测试数据。

## Phase 1：Artifact Domain

P0 · 核心数据层

| ID     | 任务                     | 交付物            |
| ------ | ------------------------ | ----------------- |
| ART-01 | 定义 Workspace Schema    | JSON Schema       |
| ART-02 | 定义 Artifact Schema     | JSON Schema       |
| ART-03 | 定义 Block 联合类型      | TypeScript Types  |
| ART-04 | 定义 Resource Reference  | 引用协议          |
| ART-05 | 定义 Presentation Schema | 布局协议          |
| ART-06 | 实现 Pydantic 校验       | Python Validation |
| ART-07 | 创建数据库表             | SQL Migration     |
| ART-08 | 实现 Artifact CRUD       | REST API          |
| ART-09 | 实现 Block CRUD          | REST API          |
| ART-10 | 实现版本管理             | Version Service   |
| ART-11 | 实现 Artifact Patch      | Patch Service     |
| ART-12 | 实现 Diff 预览           | Diff API          |

验收标准：

1. 能创建一个 Workspace。
2. 能创建多个 Artifact。
3. 每个 Artifact 能包含不同类型 Block。
4. Block 可以引用知识节点。
5. 用户修改 Block 后产生新版本。
6. AI 修改必须经过 Schema 校验。
7. 版本冲突不能静默覆盖。

## Phase 2：Adaptive Workspace Engine

P0 · 前端核心

| ID    | 任务                    | 交付物       |
| ----- | ----------------------- | ------------ |
| WS-01 | Workspace Shell         | 工作空间框架 |
| WS-02 | Renderer Registry       | 渲染注册机制 |
| WS-03 | Markdown Renderer       | 文档展示     |
| WS-04 | Formula Renderer        | 数学公式     |
| WS-05 | Table Renderer          | 表格         |
| WS-06 | Image Renderer          | 图片         |
| WS-07 | Graph Renderer          | 知识图谱     |
| WS-08 | Timeline Renderer       | 时间轴       |
| WS-09 | Layout Engine           | 自适应布局   |
| WS-10 | User Layout Persistence | 布局持久化   |
| WS-11 | Block Toolbar           | Block 操作栏 |
| WS-12 | AI Patch Preview        | AI 修改预览  |

验收标准：

- 桌面端和移动端读取同一个 Artifact Schema。
- 不同设备展示不同布局。
- 用户修改布局后可以保存。
- 新增 Block Renderer 不需要重构 Workspace Shell。
- 未知 Block 类型不会导致整个 Workspace 崩溃。

## Phase 3：Export Service

P0 · 用户数据可迁移

| ID     | 任务               | 交付物            |
| ------ | ------------------ | ----------------- |
| EXP-01 | Export Job 数据表  | 数据库迁移        |
| EXP-02 | Export API         | 创建导出任务      |
| EXP-03 | Export Worker      | 后台执行          |
| EXP-04 | Markdown Exporter  | MD 导出           |
| EXP-05 | PDF Exporter       | PDF 导出          |
| EXP-06 | DOCX Exporter      | Word 导出         |
| EXP-07 | JSON Exporter      | 结构化数据导出    |
| EXP-08 | ZIP Packager       | 完整 Workspace 包 |
| EXP-09 | Manifest Generator | 导出清单          |
| EXP-10 | Asset Resolver     | 附件处理          |
| EXP-11 | Download Service   | 安全下载          |
| EXP-12 | Export History     | 导出历史          |

验收标准：

- 单个 Artifact 可以导出。
- 完整 Workspace 可以导出。
- 导出期间用户继续编辑不会污染快照。
- ZIP 内所有文件可以通过 Manifest 定位。
- 导出的双链不会因为节点标题变化而失效。
- 文件校验和正确。
- 用户不能下载其他用户的导出文件。

## Phase 4：Android Native Integration

 P1 · 移动端能力

| ID     | 任务               | 交付物         |
| ------ | ------------------ | -------------- |
| AND-01 | Capacitor 初始化   | Android 项目   |
| AND-02 | Android App Shell  | 原生应用入口   |
| AND-03 | Native File Bridge | 文件选择和保存 |
| AND-04 | Incoming Share     | 接收外部分享   |
| AND-05 | Outgoing Share     | 文件分享       |
| AND-06 | Push Notification  | 推送通知       |
| AND-07 | Deep Link          | 深链接         |
| AND-08 | App Lifecycle      | 生命周期管理   |
| AND-09 | Back Button        | 系统返回键     |
| AND-10 | Status Bar         | 状态栏适配     |
| AND-11 | Keyboard Handling  | 软键盘适配     |
| AND-12 | Safe Area          | 安全区域适配   |

验收标准：

- 可以安装 Android APK。
- 可以从其他应用分享 URL 到我们的 App。
- 可以从手机导入 PDF。
- 可以将 PDF 导出到系统文件目录。
- 可以通过 Android 分享面板分享文件。
- App 关闭后重新打开可以恢复主要工作状态。

## Phase 5：Offline & Sync

 P1 · 基础离线能力

| ID      | 任务                       | 交付物           |
| ------- | -------------------------- | ---------------- |
| SYNC-01 | Local Repository Interface | 本地存储抽象     |
| SYNC-02 | IndexedDB Adapter          | Web 本地存储     |
| SYNC-03 | SQLite Adapter             | Android 本地存储 |
| SYNC-04 | Offline Workspace Cache    | 离线下载         |
| SYNC-05 | Outbox Queue               | 操作队列         |
| SYNC-06 | Sync Push API              | 上传修改         |
| SYNC-07 | Sync Pull API              | 拉取修改         |
| SYNC-08 | Conflict Detection         | 冲突检测         |
| SYNC-09 | Conflict UI                | 冲突处理界面     |
| SYNC-10 | WorkManager Integration    | 后台同步         |
| SYNC-11 | Sync Status UI             | 同步状态         |

验收标准：

- 离线打开已下载 Workspace。
- 离线修改 Markdown。
- 离线添加知识关系。
- 恢复网络后自动同步。
- 同一内容发生版本冲突时不会丢失数据。
- 同步操作具有幂等性。
- 用户可以查看未同步修改。

## Phase 6：AI Artifact Integration

P0 · 产品核心闭环

| ID    | 任务                  | 交付物   |
| ----- | --------------------- | -------- |
| AI-01 | Artifact Planning     | 产物规划 |
| AI-02 | Artifact Composition  | 组合生成 |
| AI-03 | Schema Validation     | 产物校验 |
| AI-04 | Layout Recommendation | 布局建议 |
| AI-05 | Patch Generation      | 局部修改 |
| AI-06 | Provenance Tracking   | 来源追踪 |
| AI-07 | Evidence Linking      | 证据关联 |
| AI-08 | Artifact Verification | 产物验证 |

这里必须特别强调：

Agent 不直接输出 HTML 页面，也不直接执行任意 JavaScript。

Agent 输出结构化 Artifact JSON，前端根据 Schema 渲染。

这既能保证安全，也方便 Android 复用。

## Phase 7：测试和发布

| ID    | 任务                       | 交付物       |
| ----- | -------------------------- | ------------ |
| QA-01 | Schema Unit Tests          | 协议测试     |
| QA-02 | Artifact Integration Tests | 产物测试     |
| QA-03 | Export Round-trip Tests    | 导出导入测试 |
| QA-04 | Android UI Tests           | 移动端测试   |
| QA-05 | Offline Sync Tests         | 离线测试     |
| QA-06 | Network Interruption Tests | 断网测试     |
| QA-07 | Large PDF Tests            | 大文件测试   |
| QA-08 | Security Tests             | 权限测试     |
| QA-09 | Performance Tests          | 性能测试     |
| QA-10 | Release Build              | APK / AAB    |

## 4.1 开发依赖关系

不能简单地按照上面的序号全部串行开发。

建议采用以下依赖：

\#chatgpt-mermaid-_r_3ku_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-_r_3ku_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_3ku_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_3ku_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-_r_3ku_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-_r_3ku_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-_r_3ku_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-_r_3ku_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-_r_3ku_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-_r_3ku_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-_r_3ku_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-_r_3ku_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_3ku_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_3ku_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-_r_3ku_ p{margin:0;}#chatgpt-mermaid-_r_3ku_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_3ku_ .cluster-label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-_r_3ku_ .cluster-label span{color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_3ku_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-_r_3ku_ .label text,#chatgpt-mermaid-_r_3ku_ span{fill:rgb(237, 237, 237);color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_3ku_ .node rect,#chatgpt-mermaid-_r_3ku_ .node circle,#chatgpt-mermaid-_r_3ku_ .node ellipse,#chatgpt-mermaid-_r_3ku_ .node polygon,#chatgpt-mermaid-_r_3ku_ .node path{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-_r_3ku_ .rough-node .label text,#chatgpt-mermaid-_r_3ku_ .node .label text,#chatgpt-mermaid-_r_3ku_ .image-shape .label,#chatgpt-mermaid-_r_3ku_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-_r_3ku_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-_r_3ku_ .rough-node .label,#chatgpt-mermaid-_r_3ku_ .node .label,#chatgpt-mermaid-_r_3ku_ .image-shape .label,#chatgpt-mermaid-_r_3ku_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-_r_3ku_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-_r_3ku_ .root .anchor path{fill:rgb(175, 175, 175)!important;stroke-width:0;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_3ku_ .arrowheadPath{fill:rgb(175, 175, 175);}#chatgpt-mermaid-_r_3ku_ .edgePath .path{stroke:rgb(175, 175, 175);stroke-width:1px;}#chatgpt-mermaid-_r_3ku_ .flowchart-link{stroke:rgb(175, 175, 175);fill:none;}#chatgpt-mermaid-_r_3ku_ .edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-_r_3ku_ .edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-_r_3ku_ .edgeLabel rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-_r_3ku_ .labelBkg{background-color:rgba(0, 0, 0, 0.5);}#chatgpt-mermaid-_r_3ku_ .cluster rect{fill:rgb(48, 48, 48);stroke:rgba(255, 255, 255, 0.15);stroke-width:1px;}#chatgpt-mermaid-_r_3ku_ .cluster text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-_r_3ku_ .cluster span{color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_3ku_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(48, 48, 48);border:1px solid rgba(255, 255, 255, 0.15);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-_r_3ku_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237, 237);}#chatgpt-mermaid-_r_3ku_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-_r_3ku_ .icon-shape,#chatgpt-mermaid-_r_3ku_ .image-shape{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-_r_3ku_ .icon-shape p,#chatgpt-mermaid-_r_3ku_ .image-shape p{background-color:rgb(0, 0, 0);padding:2px;}#chatgpt-mermaid-_r_3ku_ .icon-shape .label rect,#chatgpt-mermaid-_r_3ku_ .image-shape .label rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-_r_3ku_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-_r_3ku_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-_r_3ku_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-_r_3ku_ [data-look="neo"].node rect,#chatgpt-mermaid-_r_3ku_ [data-look="neo"].cluster rect,#chatgpt-mermaid-_r_3ku_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-_r_3ku_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_3ku_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-_r_3ku_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-_r_3ku_-gradient);stroke-width:1px;}#chatgpt-mermaid-_r_3ku_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_3ku_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-_r_3ku_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-_r_3ku_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_3ku_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-_r_3ku_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-_r_3ku_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_3ku_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-_r_3ku_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_3ku_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(232, 232, 232);}#chatgpt-mermaid-_r_3ku_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(232, 232, 232);}#chatgpt-mermaid-_r_3ku_ .node tspan[font-weight="normal"],#chatgpt-mermaid-_r_3ku_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-_r_3ku_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(19, 19, 19);stroke:rgb(47, 47, 47);stroke-width:1px;}#chatgpt-mermaid-_r_3ku_ .node rect,#chatgpt-mermaid-_r_3ku_ .node circle,#chatgpt-mermaid-_r_3ku_ .node ellipse,#chatgpt-mermaid-_r_3ku_ .node polygon,#chatgpt-mermaid-_r_3ku_ .node path{fill:rgb(24, 24, 24);stroke:rgba(255, 255, 255, 0.1);stroke-width:1px;}#chatgpt-mermaid-_r_3ku_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-_r_3ku_ .mermaid-decision .label-container{fill:rgb(19, 19, 19);stroke:rgb(47, 47, 47);stroke-dasharray:2,2;}#chatgpt-mermaid-_r_3ku_ .edgePaths .flowchart-link{stroke:rgb(175, 175, 175);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-_r_3ku_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_3ku_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}Monorepo + InfrastructureArtifact SchemaArtifact Database + APIWorkspace RendererExport ServiceAndroid ShellAdaptive LayoutAI Artifact IntegrationNative File IntegrationLocal StorageOffline SyncExport TestsEnd-to-End Tests

关键是：

- Artifact Schema 必须最先稳定。
- Export 和 Android 可以在 Artifact API 完成后并行开发。
- AI Artifact Integration 必须使用已经稳定的 Schema。
- Android 离线同步依赖本地数据模型和版本协议。

## 4.2 建议的 MVP 版本划分

| 版本 | 主要交付                       |
| ---- | ------------------------------ |
| V0.1 | Web + Workspace + Markdown     |
| V0.2 | Artifact + Wiki Link + Sources |
| V0.3 | AI Research-to-Artifact        |
| V0.4 | PDF / DOCX / ZIP 导出          |
| V0.5 | Android Capacitor App          |
| V0.6 | Android 文件导入与分享         |
| V0.7 | 离线编辑与同步                 |
| V1.0 | 完整 MVP 正式发布              |

这里的版本号代表交付顺序，不代表固定开发周期。

# Part 5. 关键工程约束与验收测试

前面已经定义了主要模块，但有几条约束需要提前写入项目开发规范。

## 5.1 数据一致性

| 场景             | 必须满足                        |
| ---------------- | ------------------------------- |
| 修改 Block       | 创建新版本                      |
| AI 修改 Block    | 通过 Patch                      |
| 用户调整布局     | 不改变知识数据                  |
| 修改知识节点名称 | 双链仍然有效                    |
| 删除 Artifact    | 不删除引用的知识节点            |
| 删除 Workspace   | 不误删其他 Workspace 使用的资源 |
| 导出期间修改     | 导出快照保持一致                |
| Android 离线编辑 | 本地修改不能丢失                |
| 多设备编辑       | 发生冲突必须可发现              |
| 重新导入 ZIP     | 关系和引用能够恢复              |

## 5.2 安全约束

Android 端尤其需要注意：

1. 不申请不必要的全盘文件访问权限。
2. 文件导入必须验证 MIME 类型、实际文件格式和大小。
3. 文件上传前计算哈希。
4. `content://` URI 不应直接当作普通文件路径处理。
5. 导出文件分享前验证文件权限。
6. 下载链接使用短期授权。
7. 本地缓存不得保存用户密码或长期访问令牌。
8. 多用户设备退出登录时清理对应账户的私有缓存。
9. Agent 不得访问未授权项目。
10. 本地同步操作必须具有幂等 ID。

## 5.3 关键自动化测试

我建议建立以下测试场景：

| 测试编号 | 测试场景           | 通过标准             |
| -------- | ------------------ | -------------------- |
| T01      | 创建 Workspace     | 数据结构合法         |
| T02      | 创建混合 Artifact  | 所有 Block 正常渲染  |
| T03      | 桌面切换手机布局   | 内容不丢失           |
| T04      | 修改 Block         | 产生新版本           |
| T05      | AI Patch           | 只修改指定区域       |
| T06      | 导出单个 PDF       | 内容完整             |
| T07      | 导出整个 ZIP       | 结构完整             |
| T08      | ZIP 重新导入       | 节点、双链、关系恢复 |
| T09      | Android 导入 PDF   | 文件正确解析         |
| T10      | Android 分享网页   | 正确创建 Source      |
| T11      | Android 离线编辑   | 修改保存在本地       |
| T12      | 恢复网络           | 修改自动同步         |
| T13      | 多设备版本冲突     | 不静默覆盖           |
| T14      | 大文件导出         | 任务可以后台完成     |
| T15      | Android 进程被回收 | 可以恢复关键状态     |

### 5.4 最重要的端到端验收

整个产品至少要通过下面这个完整场景：

```
用户在电脑端提出学习需求
          │
          ▼
AI 自动研究并生成 Workspace
          │
          ▼
用户修改 Markdown 文档
          │
          ▼
用户修改知识图谱
          │
          ▼
导出完整 ZIP
          │
          ▼
用户在 Android 打开 App
          │
          ▼
查看同一个 Workspace
          │
          ▼
下载部分内容用于离线阅读
          │
          ▼
断网修改一篇知识文档
          │
          ▼
重新联网
          │
          ▼
自动同步修改
          │
          ▼
在电脑端看到更新后的内容
          │
          ▼
导出 DOCX 和 PDF
```

只要这条链路可靠，产品就已经拥有了真正的跨设备知识生产能力。

# Part 6. 最终架构决策记录

将此次讨论形成正式 ADR（Architecture Decision Records）。

| 编号    | 架构决策                      | 结果 |
| ------- | ----------------------------- | ---- |
| ADR-001 | Artifact 采用统一 Schema      | 确定 |
| ADR-002 | Workspace 与 Artifact 分离    | 确定 |
| ADR-003 | Block 作为最小编辑单元        | 确定 |
| ADR-004 | 内容和布局分离                | 确定 |
| ADR-005 | AI 通过 Patch 修改内容        | 确定 |
| ADR-006 | Export 使用独立后端服务       | 确定 |
| ADR-007 | 支持单产物与完整工作空间导出  | 确定 |
| ADR-008 | ZIP 使用开放 AKW Package 格式 | 确定 |
| ADR-009 | Android 使用 Capacitor        | 确定 |
| ADR-010 | Web 和 Android 共享业务组件   | 确定 |
| ADR-011 | Android 使用 SQLite 本地存储  | 确定 |
| ADR-012 | Android 使用 WorkManager 同步 | 确定 |
| ADR-013 | Agent 全部运行在云端          | 确定 |
| ADR-014 | 离线同步使用 Outbox + 乐观锁  | 确定 |
| ADR-015 | 首版暂不引入 CRDT             | 确定 |

# 最终建议：开发时优先完成什么？

我认为现在最值得注意的是，不要因为同时规划了 Web、Android、导出、离线和 AI，就一次性开发所有模块。

建议先完成三个技术基础：

第一优先级：Artifact Schema

先固定 Workspace、Artifact、Block、Resource、Presentation 五层数据协议。

立即开始

第二优先级：Artifact Renderer

先实现 Markdown、Table、Image、Graph 四种 Renderer，以及自适应 Workspace。

第三优先级：Export Service

优先实现 Markdown、PDF、DOCX 和完整 ZIP，验证用户数据的可迁移性。

Android 可以从第一阶段就建立 Monorepo 和 Capacitor 工程，但不需要立即完成所有原生插件。等共享 Artifact 和 Renderer 稳定后，再重点实现文件导入、分享、SQLite 和离线同步。

## 一个额外的重要建议：建立统一的协议版本管理

未来你可能不断增加新的 Artifact 类型，例如：

- Crystal Structure Renderer。
- Molecule Renderer。
- Interactive Mathematics。
- Code Execution。
- Scientific Visualization。

因此建议将以下协议全部纳入版本控制：

```
contracts/
│
├── workspace/
│   └── v1.1.json
│
├── artifact/
│   └── v1.1.json
│
├── blocks/
│   ├── markdown.v1.json
│   ├── graph.v1.json
│   ├── timeline.v1.json
│   └── table.v1.json
│
├── export/
│   └── v1.0.json
│
├── sync/
│   └── v1.0.json
│
└── agent/
    └── v1.0.json
```

这样 Agent、Web、Android 和 Export Service 都以同一套协议为准。

## 参考技术文档

开发时可以直接参考以下官方资料：

- [Capacitor 官方文档](https://capacitorjs.com/docs?utm_source=chatgpt.com)：跨平台原生运行时。
- [Capacitor Android Plugin Guide](https://next.capacitorjs.com/docs/next/plugins/android?utm_source=chatgpt.com)：Kotlin 原生插件。
- [Capacitor Share API](https://capacitorjs.com/docs/apis/share?utm_source=chatgpt.com)：文件和内容分享。
- [Android Storage Access Framework](https://developer.android.com/training/data-storage/shared/documents-files?hl=en&utm_source=chatgpt.com)：系统文件选择和保存。
- [Android WorkManager](https://developer.android.com/develop/background-work/background-tasks/persistent?gclsrc=aw.ds&utm_source=chatgpt.com)：持久化后台任务。

最终结论： 这次调整之后，产品的知识产物不再只是 AI 生成的页面，而是一套具有结构化数据、编辑能力、跨设备展示、独立导出和离线使用能力的知识资产体系。

这才是值得长期积累的产品核心。

下一步最有价值的工作，是把这份设计转化成真正可执行的 `ARTIFACT_SCHEMA.json`、`Pydantic Models`、数据库 Migration 和 TypeScript 类型定义，作为前后端与 Agent 团队共同遵循的第一份工程契约。## 最后一个需要提前锁定的工程问题

我建议将这次方案的技术基线定为：

推荐工程组合

| 模块               | 技术                                |
| ------------------ | ----------------------------------- |
| Monorepo           | pnpm + Turborepo                    |
| Web                | Next.js                             |
| Android            | Vite + React + Capacitor 8          |
| Android 原生       | Kotlin                              |
| 数据协议           | JSON Schema + Pydantic + TypeScript |
| 后端               | FastAPI                             |
| 数据库             | PostgreSQL + pgvector               |
| Android 本地数据库 | SQLite                              |
| Web 本地数据库     | IndexedDB                           |
| 后台任务           | Redis + Celery                      |
| Android 同步       | WorkManager                         |
| 文件存储           | S3 / MinIO                          |

其中 Capacitor 8 的开发环境要求需要特别留意，官方目前要求 Node.js 22+，Android Studio 2025.2.1 或更新版本。

Capacitor Documentation+1



我认为下一阶段不应该继续扩展架构图，而应该开始建立工程契约。

建议首先生成以下四个实际文件：

1. `ARTIFACT_SCHEMA.json`：完整 Workspace、Artifact、Block 协议。
2. `artifact_models.py`：对应的 Pydantic 模型。
3. `artifact.types.ts`：前端 TypeScript 类型。
4. `001_initial_schema.sql`：数据库建表与索引。

这四个文件确定之后，Web、Android、Agent 和 Export Service 就可以并行开发，而且不会各自发明一套数据格式。