# AI Knowledge Workspace：云端与本地数据管理架构深化设计

DATA ARCHITECTURE REVIEW · CLOUD & LOCAL · V2.0

我认为这部分值得重新进行一次比较彻底的架构设计。

因为对于 AI Knowledge Workspace 来说，数据管理不是普通的数据库选型问题，而是直接决定产品能否长期成立的核心基础设施。

我们的产品有几个特殊条件：

1. 用户会积累大量长期使用的知识资产，而不只是聊天记录。
2. Artifact 支持字符级编辑、结构化编辑和 AI 局部修改。
3. 用户可以在 Windows、macOS、Android、iOS、鸿蒙和 Web 之间切换。
4. 用户可能导入大量 PDF、图片、论文、视频和其他资料。
5. Agent 在云端自主执行，可能运行较长时间，并产生中间结果。
6. 用户需要基础离线能力，但并不要求完全脱离云端。
7. 用户应该拥有自己的知识资产，能够备份、迁移和删除。
8. 部分资料可能具有隐私性，不能默认全部上传到第三方模型。

这些条件决定了我们不能简单地采用：

- 所有数据都放云端。
- 所有数据都放本地。
- 每台设备保存一份完整数据库，然后定时覆盖同步。

这三种方案都存在明显问题。

## 一、先确定核心架构：云端权威 + 本地持久化副本

最终推荐方案

我建议采用：

Cloud-Authoritative + Local-First Interaction + Offline-Capable Architecture

也就是：

- 云端是正式知识资产的权威数据来源。
- 本地保存用户当前工作所需的数据副本。
- 用户的本地编辑可以立即生效，不必等待网络。
- 离线修改进入本地持久化队列。
- 联网后通过 Sync Engine 增量同步。
- 云端负责统一版本管理、权限校验和数据一致性。
- AI Agent 主要在云端运行，执行结果通过标准数据协议回传。

这里需要明确一个概念：

本地优先的交互体验，不等于本地优先的数据权威架构。

我们不需要让每台设备都成为一套独立的知识数据库，也不需要在所有设备上运行完整 Agent Runtime。

但必须保证：即使网络突然断开，用户已经完成的本地编辑也不会丢失。

### 1.1 整体架构

\#chatgpt-mermaid-_r_6eg_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-_r_6eg_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_6eg_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_6eg_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-_r_6eg_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-_r_6eg_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-_r_6eg_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-_r_6eg_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-_r_6eg_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-_r_6eg_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-_r_6eg_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-_r_6eg_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_6eg_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_6eg_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-_r_6eg_ p{margin:0;}#chatgpt-mermaid-_r_6eg_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_6eg_ .cluster-label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-_r_6eg_ .cluster-label span{color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_6eg_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-_r_6eg_ .label text,#chatgpt-mermaid-_r_6eg_ span{fill:rgb(237, 237, 237);color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_6eg_ .node rect,#chatgpt-mermaid-_r_6eg_ .node circle,#chatgpt-mermaid-_r_6eg_ .node ellipse,#chatgpt-mermaid-_r_6eg_ .node polygon,#chatgpt-mermaid-_r_6eg_ .node path{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-_r_6eg_ .rough-node .label text,#chatgpt-mermaid-_r_6eg_ .node .label text,#chatgpt-mermaid-_r_6eg_ .image-shape .label,#chatgpt-mermaid-_r_6eg_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-_r_6eg_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-_r_6eg_ .rough-node .label,#chatgpt-mermaid-_r_6eg_ .node .label,#chatgpt-mermaid-_r_6eg_ .image-shape .label,#chatgpt-mermaid-_r_6eg_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-_r_6eg_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-_r_6eg_ .root .anchor path{fill:rgb(175, 175, 175)!important;stroke-width:0;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_6eg_ .arrowheadPath{fill:rgb(175, 175, 175);}#chatgpt-mermaid-_r_6eg_ .edgePath .path{stroke:rgb(175, 175, 175);stroke-width:1px;}#chatgpt-mermaid-_r_6eg_ .flowchart-link{stroke:rgb(175, 175, 175);fill:none;}#chatgpt-mermaid-_r_6eg_ .edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-_r_6eg_ .edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-_r_6eg_ .edgeLabel rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-_r_6eg_ .labelBkg{background-color:rgba(0, 0, 0, 0.5);}#chatgpt-mermaid-_r_6eg_ .cluster rect{fill:rgb(48, 48, 48);stroke:rgba(255, 255, 255, 0.15);stroke-width:1px;}#chatgpt-mermaid-_r_6eg_ .cluster text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-_r_6eg_ .cluster span{color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_6eg_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(48, 48, 48);border:1px solid rgba(255, 255, 255, 0.15);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-_r_6eg_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237, 237);}#chatgpt-mermaid-_r_6eg_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-_r_6eg_ .icon-shape,#chatgpt-mermaid-_r_6eg_ .image-shape{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-_r_6eg_ .icon-shape p,#chatgpt-mermaid-_r_6eg_ .image-shape p{background-color:rgb(0, 0, 0);padding:2px;}#chatgpt-mermaid-_r_6eg_ .icon-shape .label rect,#chatgpt-mermaid-_r_6eg_ .image-shape .label rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-_r_6eg_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-_r_6eg_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-_r_6eg_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-_r_6eg_ [data-look="neo"].node rect,#chatgpt-mermaid-_r_6eg_ [data-look="neo"].cluster rect,#chatgpt-mermaid-_r_6eg_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-_r_6eg_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_6eg_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-_r_6eg_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-_r_6eg_-gradient);stroke-width:1px;}#chatgpt-mermaid-_r_6eg_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_6eg_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-_r_6eg_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-_r_6eg_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_6eg_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-_r_6eg_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-_r_6eg_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_6eg_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-_r_6eg_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_6eg_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(232, 232, 232);}#chatgpt-mermaid-_r_6eg_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(232, 232, 232);}#chatgpt-mermaid-_r_6eg_ .node tspan[font-weight="normal"],#chatgpt-mermaid-_r_6eg_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-_r_6eg_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(19, 19, 19);stroke:rgb(47, 47, 47);stroke-width:1px;}#chatgpt-mermaid-_r_6eg_ .node rect,#chatgpt-mermaid-_r_6eg_ .node circle,#chatgpt-mermaid-_r_6eg_ .node ellipse,#chatgpt-mermaid-_r_6eg_ .node polygon,#chatgpt-mermaid-_r_6eg_ .node path{fill:rgb(24, 24, 24);stroke:rgba(255, 255, 255, 0.1);stroke-width:1px;}#chatgpt-mermaid-_r_6eg_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-_r_6eg_ .mermaid-decision .label-container{fill:rgb(19, 19, 19);stroke:rgb(47, 47, 47);stroke-dasharray:2,2;}#chatgpt-mermaid-_r_6eg_ .edgePaths .flowchart-link{stroke:rgb(175, 175, 175);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-_r_6eg_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_6eg_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}Cloud StorageCloud Data LayerLocal Data LayerClient DevicesPostgreSQLVector IndexObject StorageRedisAPI GatewaySync ServiceDomain ServicesAgent RuntimeEvent LogLocal DatabaseContent CacheLocal FilesMutation OutboxSync EngineWindows / macOSAndroid / iOSHarmonyOSWeb / PWA

这里有一个重要原则：

所有客户端使用同一套数据协议，但不要求使用同一种本地数据库。

Windows、iOS、鸿蒙可以有不同的本地存储实现，只要遵循统一的 Entity Schema、Mutation Protocol 和 Sync Protocol 即可。

# 二、首先要重新划分数据：哪些应该在云端，哪些应该在本地？

这是整个设计最重要的决策。

我建议将数据分成五大类，而不是简单区分云端和本地。

## 2.1 五类数据

| 数据类型     | 典型内容                            | 主要存储位置                |
| ------------ | ----------------------------------- | --------------------------- |
| 核心业务数据 | Workspace、Artifact、知识节点、关系 | 云端 + 本地副本             |
| 原始资料数据 | PDF、图片、视频、文档               | 云端对象存储 + 按需本地缓存 |
| AI 派生数据  | Embedding、解析结果、索引           | 云端为主                    |
| 执行状态数据 | Agent Run、Checkpoint、任务事件     | 云端权威 + 本地状态缓存     |
| 临时运行数据 | UI 状态、短期缓存、临时文件         | 本地为主                    |

进一步细化：

A. 核心知识资产

- Workspace
- Project
- Artifact
- KnowledgeNode
- KnowledgeEdge
- Claim
- Evidence
- 用户批注
- 用户编辑历史

云端权威 + 本地副本

B. 原始资料

- PDF
- 图片
- 视频
- 音频
- Office 文件
- 网页快照
- 用户上传的压缩包

云端对象存储 + 选择性本地下载

C. AI 处理结果

- 文本提取结果
- OCR
- 文档结构
- Chunk
- Embedding
- Reranker 结果
- 图像描述
- 检索缓存

云端为主，可重新生成的派生数据

D. Agent 执行数据

- Research Run
- Agent Task
- Checkpoint
- Tool Call
- Validation Report
- Cost Record
- Partial Result

云端权威 + 本地展示缓存

E. 临时运行数据

- 编辑器光标位置
- 面板展开状态
- 临时搜索条件
- 未提交的表单
- 缩略图缓存
- UI 状态

本地优先

这里需要特别注意：AI 派生数据不应该被视为可以随意删除的普通缓存。

例如，Evidence 定位、用户确认的 OCR 修正、人工校对过的文档结构可能具有长期价值，应该与可重新生成的 Embedding、临时检索缓存分开管理。

## 2.2 一个容易忽略的问题：原始文件和知识资产必须分离

例如用户导入一篇论文。

不应该直接把整篇论文作为一个 Artifact 存储。

建议建立这样的数据关系：

```
Source
  │
  ▼
Source Asset
  │
  ├── Original PDF
  │
  ├── Metadata
  │
  ├── Parsed Document
  │     ├── Pages
  │     ├── Sections
  │     ├── Tables
  │     └── Figures
  │
  └── Evidence
        │
        ▼
      Claims
        │
        ▼
   Knowledge Nodes
        │
        ▼
     Artifacts
```

这样有几个好处：

- 一篇论文可以被多个 Project 使用。
- 同一份资料可以生成多个 Artifact。
- 原始文件不需要重复保存。
- 删除某个 Artifact 不会误删原始资料。
- 用户修改知识内容不会改变原始文献。
- 重新解析文档时可以保留旧版本的证据定位。

建议新增两个核心对象：

`Asset`：代表实际的原始文件或外部内容。

`DeviceFileBinding`：代表某个设备上的本地文件与 Asset 的关联。

例如，同一份 PDF 在 Windows 和 iPad 上可以有不同的本地缓存路径，但它们对应同一个 `asset_id`。

不要把 `C:\Users\...\paper.pdf` 这样的本地路径直接作为云端资料的唯一标识。

# 三、云端数据架构：不要把所有东西都塞进 PostgreSQL

目前已经考虑使用 PostgreSQL、pgvector、Redis 和 S3 / MinIO。

我认为这个方向合理，但需要明确各个组件的职责，避免后期出现数据重复和职责混乱。

## 3.1 云端存储分工

[Postgresql Logo PNG Transparent With Clear Background ID 473068 |  TOPpng](https://images.openai.com/static-rsc-4/x6sDZ8oKI9URixQ5E82vqCQV1aR38qK7E8n0HKggx6_cD8G7QtlPuHlyO99GalHPJOycjs41bPgfrRTqdHFqayPWJl57hxNttQynREzHXSUSsui_zVAB_ssyc1xdm_msJ5GiDzf23C9Z2RuuoyVCc6J0AbuAqX5Aul_x1J78q2I?purpose=inline)

PostgreSQL

核心权威数据库

结构化业务数据、关系、版本、事务、权限。

[Exploring Advanced Features of Amazon S3](https://images.openai.com/static-rsc-4/7T_chb3fOSqnWROFDPww4zoN7GDdTNYemxsi1AoWiTXwKdtPp8b9DSzNuiuNfwN1_bT9NZpfrcGG_T4a2Uz6ZGf4Ft4pVoVliv2wEd1QHx4hOeaRSlBKuz0Fg7LiTd_J47tDt101w8190jseJ5GR8mzS6vYkKKMvCj_xz1YaQ80?purpose=inline)

S3 / MinIO

文件权威存储

原始文档、图片、音视频、导出文件、快照。

[What Is pgvector? PostgreSQL Vector Search Extension Explained](https://images.openai.com/static-rsc-4/xuYbz3ppqKnv98aZTX2H8CRTaTcjSqfecjfE9ONOLtCdfG9fOCJezqvSnu0leW8NGDpmLvVSdKH-9qrDnDjgQNf7Ge4s5aLW-6ot8VYGSg0H0aNCgRbXjoDS9-Xv8oYKf9Iy-qRMXhlapfnhPULXKNz18CPA9hPOSRbVyAXTleI?purpose=inline)

pgvector

向量检索

Embedding、语义检索、向量索引。

[What are the pricing options for Redis?](https://images.openai.com/static-rsc-4/cxD0mNwOFZou3c4Llf54BhJRBatnwNaB1PRyLFmIPi8T_DppI8Tx5eXaldNM50YFgyAVtop1YVxSro1--SPQPyUwd84VpfhigqOETDMxnOrMCs17WGKsFDxEhnu6gcrlkKs6d9R4wQpKeQAR5180qRPJtYD1UoA32ydSYxE5k1U?purpose=inline)

Redis

临时状态与缓存

缓存、限流、任务协调、短期锁。

我建议 MVP 阶段不要额外引入 Neo4j、MongoDB、Elasticsearch、Kafka 等多个数据库。

这不是说它们没有价值，而是目前的数据规模和开发阶段不需要同时承担这么多系统的运维成本。

### PostgreSQL 负责什么？

建议保存：

- 用户和租户。
- Workspace / Project。
- Artifact 元数据与版本。
- Artifact 结构化内容。
- KnowledgeNode / KnowledgeEdge。
- Source / Document 元数据。
- Claim / Evidence。
- Agent Run / Task。
- Sync Event。
- 用户权限。
- 数据删除状态。
- 成本和使用记录。

对于 Artifact，建议使用：

关系型元数据 + JSONB 结构化内容 + 独立版本记录。

不要把所有知识数据塞进一个巨型 JSONB，也不要把每一个文字节点都设计成独立数据库表。

应该按照实际查询和编辑需求进行合理拆分。

### S3 / MinIO 负责什么？

保存：

- 原始 PDF。
- 原始图片。
- 音视频。
- Office 文件。
- 页面快照。
- 大型导出文件。
- 文档解析中间文件。
- 用户备份包。

文件对象不要直接存储在 PostgreSQL 中。

数据库只记录：

```
{
  "asset_id": "asset_001",
  "object_key": "tenant_001/assets/asset_001/original.pdf",
  "content_hash": "sha256:...",
  "mime_type": "application/pdf",
  "size_bytes": 12582912,
  "storage_status": "available"
}
```

对象存储的 Key 应由服务端生成，不能直接暴露用户原始路径。

### pgvector 负责什么？

保存向量和检索所需的引用。

建议让 Embedding 记录具备：

- `document_id`
- `chunk_id`
- `embedding_model`
- `embedding_version`
- `content_hash`
- `vector_dimension`

这样未来更换 Embedding 模型时，可以重新生成索引，不必破坏原有知识数据。

### Redis 负责什么？

不要将 Redis 当成正式业务数据的权威存储。

它适合：

- 短期缓存。
- API 限流。
- 分布式任务协调。
- 短期任务状态。
- 防重复执行的辅助锁。
- 热点数据缓存。

但 Agent 的重要 Checkpoint、任务状态和执行事件必须能够持久化到 PostgreSQL 或可靠的持久化任务系统。

Redis 重启不应该让一个正在执行数小时的 Research Run 丢失。

## 3.2 要不要引入图数据库？

目前我建议不引入。

我们的知识图谱主要有：

- 节点。
- 关系。
- 关系类型。
- 来源。
- 权限。
- 版本。
- 用户自定义关联。

这些用 PostgreSQL 的关系表完全可以处理。

例如：

```
knowledge_nodes
knowledge_edges
knowledge_edge_evidence
knowledge_node_versions
```

通过索引、递归查询和适当的图查询优化，就可以满足早期需求。

当未来出现以下情况，再考虑图数据库：

- 图谱规模达到很大数量级。
- 多跳查询频繁且复杂。
- 图算法成为核心业务。
- PostgreSQL 图查询成为明确的性能瓶颈。

不要为了使用知识图谱而提前引入一套独立图数据库。

# 四、本地数据架构：每个平台应该怎样存储？

这里需要作出一个关键决定：

本地数据库不需要跨平台统一，但本地数据模型必须统一。

因为不同平台的文件系统、生命周期、数据库能力和安全存储机制并不相同。

## 4.1 各平台本地存储选型

| 平台         | 结构化数据库     | 文件存储             | 凭据存储                   |
| ------------ | ---------------- | -------------------- | -------------------------- |
| Web / PWA    | IndexedDB        | OPFS / Cache Storage | 安全 Cookie                |
| Windows      | SQLite           | AppData              | Windows Credential Manager |
| macOS        | SQLite           | Application Support  | Keychain                   |
| Android      | SQLite           | App Sandbox          | Android Keystore           |
| iOS / iPadOS | SQLite           | App Sandbox          | Keychain                   |
| HarmonyOS    | ArkData / SQLite | 应用沙箱             | 系统安全存储能力           |

这里有几个具体建议。

Windows / macOS：

使用 SQLite 作为本地数据库。

可以通过 Tauri 的 Rust 层统一提供数据库访问接口，避免前端直接操作数据库文件。

Android / iOS：

继续采用 Capacitor，但需要选择成熟的原生 SQLite 插件，而不是依赖浏览器 WebView 的 IndexedDB 作为唯一持久化方案。

HarmonyOS：

使用 ArkData 或经过目标 HarmonyOS SDK 验证的 SQLite 方案。不要假设其他平台的 SQLite 插件可以直接移植。

Web：

使用 IndexedDB 存储结构化数据。

OPFS 适合保存大型本地文件和编辑器缓存，但不要将其当成所有浏览器都具备完全相同能力的数据库替代品。

## 4.2 本地数据库应该存储什么？

我建议将本地数据库分为六个逻辑区域。

```
Local Database
│
├── 01. Workspace Cache
│   ├── workspaces
│   ├── projects
│   └── user_preferences
│
├── 02. Knowledge Replica
│   ├── artifacts
│   ├── artifact_blocks
│   ├── knowledge_nodes
│   ├── knowledge_edges
│   └── sources
│
├── 03. Editing State
│   ├── local_drafts
│   ├── pending_patches
│   ├── undo_metadata
│   └── local_versions
│
├── 04. Sync State
│   ├── mutation_outbox
│   ├── sync_cursors
│   ├── conflict_records
│   └── device_state
│
├── 05. Agent Cache
│   ├── research_runs
│   ├── task_progress
│   └── event_cache
│
└── 06. Local Cache
    ├── document_metadata
    ├── thumbnails
    ├── search_index
    └── downloaded_assets
```

需要注意，这些是逻辑分区，不一定要拆成六个 SQLite 数据库。

实际上，我更建议每个设备维护一个主要的本地数据库，按照业务域分表。

### 本地数据应该设置缓存优先级

不是所有内容都需要永久下载。

| 数据                    | 本地保留策略         |
| ----------------------- | -------------------- |
| 当前正在编辑的 Artifact | 持久保留             |
| 尚未同步的修改          | 永久保留直到确认同步 |
| 最近访问的 Artifact     | 优先缓存             |
| 用户标记离线的资料      | 持久保留             |
| 最近阅读的 PDF          | 按容量管理           |
| 图片缩略图              | 可清理重建           |
| Embedding               | 通常不下载           |
| Agent 完整执行日志      | 按需缓存             |
| 临时检索结果            | 可清理               |

这里我特别建议增加一个功能：

Pin for Offline（固定为离线可用）。

用户可以指定：

- 某个 Workspace。
- 某个 Project。
- 某个 Artifact。
- 某份 PDF。
- 某个完整学习资料包。

即使离线，也可以正常阅读和编辑。

## 4.3 本地文件与云端文件的关系

这是一个很容易设计错误的地方。

例如用户在 Windows 上导入：

```
D:\Research\paper.pdf
```

不能让其他设备通过这个路径访问文件。

应该这样处理：

```
Windows Local File
       │
       ▼
Asset Upload
       │
       ▼
Cloud Object Storage
       │
       ▼
Asset ID
       │
       ├── Windows Local Cache
       ├── iPad Local Cache
       ├── Android Local Cache
       └── HarmonyOS Local Cache
```

云端只保存逻辑 Asset ID 和对象存储位置。

每个设备独立管理自己的文件缓存路径。

另外，建议明确三种资料管理模式：

1. Cloud Managed

默认推荐

文件上传云端，经过授权后可被 AI 处理，并在不同设备间同步。

2. Local Only

隐私模式

原始文件只保留在本地设备，不自动上传。

其他设备无法直接访问，云端 Agent 也不能直接读取。

3. Temporary Processing

临时处理模式

用户授权后，文件临时上传用于云端解析或模型处理，按照明确的保留策略清理。

需要注意：如果处理结果中的知识、证据或摘录需要长期保存，它们仍然属于独立的云端数据，不能因为原始文件设置了临时保留就默认一起删除。

我认为这三种模式可以很好地兼顾普通用户、研究人员和对隐私敏感的用户。

尤其是 Local Only，不应该只是一个 UI 开关。它需要有真正的技术约束，防止文件内容被后台自动上传。

# 五、最重要的模块：Sync Engine 应该如何工作？

我认为这是整个云端与本地架构的技术核心。

同步不是简单地把两个数据库做比较。

它需要处理：

- 多设备同时编辑。
- 网络中断。
- 重复请求。
- 数据冲突。
- AI 修改与用户修改竞争。
- 版本变化。
- 文件上传失败。
- 应用被系统杀死。
- 设备长期离线后重新上线。

因此需要一个独立的同步协议。

## 5.1 推荐采用 Mutation-based Sync

我建议不要直接同步整个 Artifact JSON。

而是采用：

Mutation Outbox + Server Change Log + Versioned Snapshot。

基本原理：

用户每次修改都会产生一个 Mutation。

本地先持久化这个 Mutation，然后立即更新界面。

网络恢复后，再提交到云端。

云端验证后接受修改、合并或返回冲突。

### 数据流

Cloud DBSync ServiceOutboxLocal DBUserCloud DBSync ServiceOutboxLocal DBUser#chatgpt-mermaid-_r_6gj_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-_r_6gj_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_6gj_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_6gj_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-_r_6gj_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-_r_6gj_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-_r_6gj_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-_r_6gj_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-_r_6gj_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-_r_6gj_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-_r_6gj_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-_r_6gj_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_6gj_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_6gj_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-_r_6gj_ p{margin:0;}#chatgpt-mermaid-_r_6gj_ .actor{stroke:rgb(31, 78, 148);fill:rgb(9, 23, 44);stroke-width:1;}#chatgpt-mermaid-_r_6gj_ rect.actor.outer-path[data-look="neo"]{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_6gj_ rect.note[data-look="neo"]{stroke:rgb(58, 132, 63);fill:rgb(48, 48, 48);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_6gj_ text.actor>tspan{fill:rgb(237, 237, 237);stroke:none;}#chatgpt-mermaid-_r_6gj_ .actor-line{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_6gj_ .innerArc{stroke-width:1.5;stroke-dasharray:none;}#chatgpt-mermaid-_r_6gj_ .messageLine0{stroke-width:1.5;stroke-dasharray:none;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_6gj_ .messageLine1{stroke-width:1.5;stroke-dasharray:2,2;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_6gj_ [id$="-arrowhead"] path{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_6gj_ .sequenceNumber{fill:#505050;}#chatgpt-mermaid-_r_6gj_ [id$="-sequencenumber"]{fill:rgb(175, 175, 175);}#chatgpt-mermaid-_r_6gj_ [id$="-crosshead"] path{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_6gj_ .messageText{fill:rgb(237, 237, 237);stroke:none;}#chatgpt-mermaid-_r_6gj_ .labelBox{stroke:rgba(255, 255, 255, 0.15);fill:rgb(0, 0, 0);filter:none;}#chatgpt-mermaid-_r_6gj_ .labelText,#chatgpt-mermaid-_r_6gj_ .labelText>tspan{fill:rgb(237, 237, 237);stroke:none;}#chatgpt-mermaid-_r_6gj_ .loopText,#chatgpt-mermaid-_r_6gj_ .loopText>tspan{fill:rgb(237, 237, 237);stroke:none;}#chatgpt-mermaid-_r_6gj_ .sectionTitle,#chatgpt-mermaid-_r_6gj_ .sectionTitle>tspan{fill:rgb(237, 237, 237);stroke:none;}#chatgpt-mermaid-_r_6gj_ .loopLine{stroke-width:2px;stroke-dasharray:2,2;stroke:rgba(255, 255, 255, 0.15);fill:rgba(255, 255, 255, 0.15);}#chatgpt-mermaid-_r_6gj_ .note{stroke:rgb(58, 132, 63);fill:rgb(48, 48, 48);}#chatgpt-mermaid-_r_6gj_ .noteText,#chatgpt-mermaid-_r_6gj_ .noteText>tspan{fill:rgb(237, 237, 237);stroke:none;font-weight:normal;}#chatgpt-mermaid-_r_6gj_ .activation0{fill:rgb(48, 48, 48);stroke:hsl(0, 0%, 8.8235294118%);}#chatgpt-mermaid-_r_6gj_ .activation1{fill:rgb(48, 48, 48);stroke:hsl(0, 0%, 8.8235294118%);}#chatgpt-mermaid-_r_6gj_ .activation2{fill:rgb(48, 48, 48);stroke:hsl(0, 0%, 8.8235294118%);}#chatgpt-mermaid-_r_6gj_ .actorPopupMenu{position:absolute;}#chatgpt-mermaid-_r_6gj_ .actorPopupMenuPanel{position:absolute;fill:rgb(9, 23, 44);box-shadow:0px 8px 16px 0px rgba(0,0,0,0.2);filter:drop-shadow(3px 5px 2px rgb(0 0 0 / 0.4));}#chatgpt-mermaid-_r_6gj_ .actor-man circle,#chatgpt-mermaid-_r_6gj_ line{fill:rgb(9, 23, 44);stroke-width:2px;}#chatgpt-mermaid-_r_6gj_ g rect.rect{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));stroke:rgb(31, 78, 148);}#chatgpt-mermaid-_r_6gj_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-_r_6gj_ [data-look="neo"].node rect,#chatgpt-mermaid-_r_6gj_ [data-look="neo"].cluster rect,#chatgpt-mermaid-_r_6gj_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-_r_6gj_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_6gj_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-_r_6gj_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-_r_6gj_-gradient);stroke-width:1px;}#chatgpt-mermaid-_r_6gj_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_6gj_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-_r_6gj_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-_r_6gj_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_6gj_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-_r_6gj_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-_r_6gj_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_6gj_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-_r_6gj_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_6gj_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}alt[Accepted][Conflict]Edit ArtifactSave Local ChangeCreate MutationShow Updated ContentUpload MutationValidate VersionCommit / ConflictACK + New VersionMark SyncedConflict DetailsPreserve Local VersionDeliver Change EventsUpdate Local Replica

## 5.2 Mutation 的标准数据结构

建议统一定义：

```
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

其中：

- `mutation_id`：全局唯一，保证幂等性。
- `device_id`：识别修改来源。
- `entity_id`：定位被修改的数据。
- `base_version`：记录修改基于哪个版本。
- `client_sequence`：保证同一设备的本地操作顺序。
- `payload`：修改内容。
- `schema_version`：用于兼容未来数据格式变化。

不要依赖客户端时间戳判断哪个版本更新。

客户端时间可能不准确，也可能被修改。

最终版本顺序应该由服务端维护的版本号和事件序列决定。

## 5.3 同步的完整流程

建议分成六个步骤：

1. 本地写入 Mutation。
2. 本地更新 UI。
3. Outbox 发送待同步 Mutation。
4. 服务端执行权限、版本、Schema 和业务验证。
5. 服务端提交事务，生成新的版本和事件。
6. 客户端收到 ACK，标记 Mutation 已同步。

需要保证：

只有当服务端确认提交后，客户端才能将 Mutation 标记为已同步。

如果服务器处理成功，但客户端没有收到响应，客户端可以重新发送同一个 Mutation ID。

服务器必须返回之前的处理结果，而不是重复执行。

## 5.4 增量同步，而不是全量拉取

建议每个 Workspace 或同步域维护一个 Cursor。

例如：

```
{
  "workspace_id": "ws_001",
  "last_server_sequence": 12580
}
```

客户端只需要请求：

```
GET /v1/sync/changes?cursor=12580
```

服务器返回：

```
{
  "changes": [],
  "next_cursor": 12620,
  "has_more": false
}
```

每条变更应该包含：

- Entity ID。
- Entity Type。
- New Version。
- Change Type。
- 必要的变更数据。
- 删除标记。
- 服务端事件序号。

如果用户离线时间过长，历史事件已经被归档或压缩，就触发 Snapshot Reconciliation，而不是要求客户端从第一条历史事件开始重放。

建议同步策略：

| 时机           | 同步行为            |
| -------------- | ------------------- |
| 应用启动       | 检查增量变更        |
| 用户编辑后     | 防抖后提交 Mutation |
| 应用进入前台   | 增量同步            |
| 网络恢复       | 自动同步            |
| 切换 Workspace | 获取对应数据        |
| 用户手动刷新   | 强制同步            |
| Agent 完成     | 接收结果事件并同步  |

初期使用 HTTPS API + 增量拉取就可以。

后续再使用 WebSocket 或 Server-Sent Events 提供更及时的变化通知。

不要让 WebSocket 成为唯一的数据同步通道。

即使实时连接断开，增量同步仍然应该能够恢复全部变化。

# 六、冲突解决：必须区分不同数据类型

之前我们已经决定采用 Block-level Versioning。

我认为这个方向需要进一步细化。

不同类型的数据，不能使用同一种冲突解决策略。

## 6.1 冲突类型与处理规则

| 冲突对象                | 推荐处理                         |
| ----------------------- | -------------------------------- |
| Artifact 不同 Block     | 尝试自动合并                     |
| 同一 Block 不同文字范围 | 尝试安全重定位和合并             |
| 同一文字范围            | 保留冲突，要求用户处理           |
| KnowledgeNode 属性      | 按字段检查冲突                   |
| KnowledgeEdge           | 检查关系是否已被删除或修改       |
| 用户标签                | 可考虑集合合并                   |
| 用户偏好                | 根据字段语义处理                 |
| Agent 生成内容          | 不得覆盖更新版本的用户修改       |
| 原始文件                | 使用不可变版本与新 Asset Version |

特别是 Artifact 编辑。

例如：

Mac 修改了第一段，iPad 修改了第三段。

可以安全合并。

但如果 Mac 和 iPad 同时修改了第二段的同一句话，就不应该随意选择一个覆盖另一个。

### 冲突界面建议

Artifact Conflict Resolution

需要处理

同一段内容在两台设备上发生不同修改

原始版本 V5

GCN 通过聚合邻居节点的特征更新中心节点表示。

Mac · V6

GCN 聚合邻居节点的信息以更新中心节点表示。

iPad · Local

GCN 通过邻居节点特征加权聚合生成新的节点表示。

解决方式

- 保留 Mac 版本。
- 保留 iPad 版本。
- 手动合并。
- 使用 AI 生成合并建议。

示意交互。AI 合并建议必须经过 Diff 确认，不能直接覆盖。

## 6.2 要不要现在引入 CRDT？

我的建议仍然是：MVP 暂时不引入完整 CRDT。

但这里需要比之前更明确地划定边界。

| 阶段         | 同步方案                                |
| ------------ | --------------------------------------- |
| MVP          | Mutation + Version + Optimistic Locking |
| 成熟期       | 更智能的 Block / Text Range Merge       |
| 多人实时协作 | Yjs 等 CRDT 方案                        |

因为当前主要是个人跨设备编辑，不是多人实时共同编辑。

而且 CRDT 并不会自动解决：

- 知识关系语义冲突。
- 引用来源冲突。
- AI 与用户意图冲突。
- Artifact Schema 迁移。
- 权限变化。

因此不应该认为引入 CRDT 就解决了全部一致性问题。

# 七、Agent 与本地编辑如何协调？

这是我认为目前最需要额外设计的地方。

因为用户可能正在本地编辑一份 Artifact，同时云端 Agent 也在修改它。

例如：

1. 用户在 iPad 上修改一段内容。
2. Agent 在云端执行研究任务。
3. Agent 认为这段内容不够准确。
4. Agent 生成了新的 Patch。
5. 用户本地的修改还没有同步。

如果没有明确规则，就可能出现用户修改被覆盖的问题。

## 7.1 增加 Artifact Branch / Revision 概念

建议将 Artifact 的版本关系设计成：

```
Artifact
   │
   ▼
Canonical Revision V10
   │
   ├── User Mutation Branch
   │
   └── Agent Proposal Branch
          │
          ▼
       Validator
          │
          ▼
      Patch Review
          │
          ▼
    Conflict Detection
          │
          ▼
      Merge / Commit
          │
          ▼
    Canonical Revision V11
```

Agent 不应该直接修改用户正在编辑的正式版本。

它应该：

1. 读取某个明确版本的 Artifact。
2. 创建自己的修改提案。
3. 保存使用的 Base Version。
4. 生成 Patch。
5. 执行 Validator。
6. 检查当前 Artifact 是否已经变化。
7. 如果没有冲突，按策略提交。
8. 如果存在冲突，生成合并提案。

建议增加：

- `artifact_revisions`
- `artifact_branches`
- `artifact_patches`
- `patch_reviews`
- `revision_merges`

不一定需要真正建立 Git 式分支系统，但至少应该有逻辑上的版本分支和修改提案。

## 7.2 AI 的写入权限必须分级

| 操作                   | 默认权限           |
| ---------------------- | ------------------ |
| 新建 Artifact 草稿     | 允许               |
| 新增知识片段           | 允许               |
| 创建待审核关系         | 允许               |
| 修改 AI 自己创建的草稿 | 允许               |
| 修改用户正式 Artifact  | 需要授权           |
| 删除用户内容           | 必须确认           |
| 修改 Evidence 原始记录 | 禁止直接修改       |
| 更新知识结论           | 需要验证和版本记录 |

这与前面设计的 Agent Validator 和门控体系应该统一起来。

AI 的数据权限不能只由 Prompt 控制，必须由后端业务权限控制。

# 八、数据安全与隐私：云端与本地应该如何分工？

这部分我建议从架构第一天就建立，而不是产品上线后再补。

## 8.1 统一的数据敏感等级

建议建立四级数据分类。

| 等级          | 数据类型                   | 默认策略           |
| ------------- | -------------------------- | ------------------ |
| L0 Public     | 公开论文、公开网页         | 可正常云端处理     |
| L1 Personal   | 普通知识笔记、个人学习记录 | 授权后云端处理     |
| L2 Sensitive  | 私人研究、未公开文档       | 明确授权后处理     |
| L3 Restricted | 密码、密钥、极敏感信息     | 禁止进入模型上下文 |

每份 Asset、Artifact、Project 都可以具有自己的安全策略。

例如：

```
{
  "workspace_id": "ws_001",

  "data_policy": {
    "storage_mode": "cloud_managed",
    "sensitivity": "sensitive",

    "ai_processing": {
      "allowed": true,
      "external_provider": "requires_consent"
    },

    "offline": {
      "allowed": true,
      "require_encryption": true
    }
  }
}
```

这里的 `external_provider` 是指 DeepSeek 等第三方模型供应商。

## 8.2 不要混淆云端加密和端到端加密

这是一个非常重要的设计问题。

如果用户把文件上传到云端，由服务器调用 DeepSeek 进行文档分析，那么服务器必须能够在处理期间访问相应的明文内容。

因此不能简单地宣称：

「用户的所有数据都是端到端加密，服务器也无法读取。」

这与云端 AI 处理存在根本矛盾。

建议区分三种模式：

标准云端模式

- 传输加密。
- 服务端加密存储。
- 权限隔离。
- 敏感数据处理授权。
- 第三方模型处理受控。

增强隐私模式

- 更严格的访问控制。
- 可选的客户端加密缓存。
- 限制数据留存。
- 限制外部模型处理。
- 敏感资料单独管理。

本地私有模式（后期）

- 文件主要留在本地。
- 本地索引。
- 本地处理能力。
- 不依赖云端内容解析。
- 使用本地模型或用户明确授权的临时云端处理。

注意，增强隐私模式与真正的端到端加密不是一回事。

如果以后要支持真正的 E2EE Workspace，就必须重新设计密钥管理、搜索、同步和 AI 执行机制。

## 8.3 密钥管理

建议：

- 服务端主密钥放在 KMS。
- 对称加密使用信封加密。
- 不同租户的数据加密密钥逻辑隔离。
- 用户 API Key 使用专门的 Secret Store。
- 客户端凭据使用各平台安全存储。
- 不把 Token 或 API Key 存进普通 SQLite 表。
- 不在日志中打印密钥、文档正文或完整 Prompt。

如果未来提供企业版，还可以考虑客户自带密钥（BYOK）和独立密钥管理。

## 8.4 数据删除必须是完整的

例如用户删除一篇论文。

不能只删除 PostgreSQL 中的 Source 记录。

还需要检查：

```
Source
  │
  ├── Original Asset
  ├── Source Snapshot
  ├── Parsed Document
  ├── Chunks
  ├── Embeddings
  ├── Evidence
  ├── Claims
  └── Related Artifacts
```

这里不能简单地把所有下游数据一起删除，因为一些 Claim 可能同时被其他来源支持。

应该建立依赖分析：

1. 删除原始文件。
2. 删除或标记对应的来源快照。
3. 删除可识别的派生数据。
4. 检查 Evidence 依赖。
5. 将失去唯一证据支持的 Claim 标记为待核实。
6. 保留用户独立创建的知识内容。
7. 按保留策略清理备份和缓存。

建议增加统一的：

Data Lifecycle Manager

负责删除、保留、归档、备份和恢复。

# 九、文件上传、下载和大文件管理

我们的产品会处理大量论文、图片、视频和 Office 文件，因此文件系统需要独立设计。

不要让所有文件都通过普通 API 一次性上传。

## 9.1 大文件上传架构

建议采用：

Direct-to-Object-Storage + Multipart Upload + Resumable Upload。

流程：

\#chatgpt-mermaid-_r_6i1_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-_r_6i1_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_6i1_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_6i1_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-_r_6i1_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-_r_6i1_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-_r_6i1_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-_r_6i1_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-_r_6i1_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-_r_6i1_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-_r_6i1_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-_r_6i1_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_6i1_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_6i1_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-_r_6i1_ p{margin:0;}#chatgpt-mermaid-_r_6i1_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_6i1_ .cluster-label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-_r_6i1_ .cluster-label span{color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_6i1_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-_r_6i1_ .label text,#chatgpt-mermaid-_r_6i1_ span{fill:rgb(237, 237, 237);color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_6i1_ .node rect,#chatgpt-mermaid-_r_6i1_ .node circle,#chatgpt-mermaid-_r_6i1_ .node ellipse,#chatgpt-mermaid-_r_6i1_ .node polygon,#chatgpt-mermaid-_r_6i1_ .node path{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-_r_6i1_ .rough-node .label text,#chatgpt-mermaid-_r_6i1_ .node .label text,#chatgpt-mermaid-_r_6i1_ .image-shape .label,#chatgpt-mermaid-_r_6i1_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-_r_6i1_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-_r_6i1_ .rough-node .label,#chatgpt-mermaid-_r_6i1_ .node .label,#chatgpt-mermaid-_r_6i1_ .image-shape .label,#chatgpt-mermaid-_r_6i1_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-_r_6i1_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-_r_6i1_ .root .anchor path{fill:rgb(175, 175, 175)!important;stroke-width:0;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_6i1_ .arrowheadPath{fill:rgb(175, 175, 175);}#chatgpt-mermaid-_r_6i1_ .edgePath .path{stroke:rgb(175, 175, 175);stroke-width:1px;}#chatgpt-mermaid-_r_6i1_ .flowchart-link{stroke:rgb(175, 175, 175);fill:none;}#chatgpt-mermaid-_r_6i1_ .edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-_r_6i1_ .edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-_r_6i1_ .edgeLabel rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-_r_6i1_ .labelBkg{background-color:rgba(0, 0, 0, 0.5);}#chatgpt-mermaid-_r_6i1_ .cluster rect{fill:rgb(48, 48, 48);stroke:rgba(255, 255, 255, 0.15);stroke-width:1px;}#chatgpt-mermaid-_r_6i1_ .cluster text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-_r_6i1_ .cluster span{color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_6i1_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(48, 48, 48);border:1px solid rgba(255, 255, 255, 0.15);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-_r_6i1_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237, 237);}#chatgpt-mermaid-_r_6i1_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-_r_6i1_ .icon-shape,#chatgpt-mermaid-_r_6i1_ .image-shape{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-_r_6i1_ .icon-shape p,#chatgpt-mermaid-_r_6i1_ .image-shape p{background-color:rgb(0, 0, 0);padding:2px;}#chatgpt-mermaid-_r_6i1_ .icon-shape .label rect,#chatgpt-mermaid-_r_6i1_ .image-shape .label rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-_r_6i1_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-_r_6i1_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-_r_6i1_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-_r_6i1_ [data-look="neo"].node rect,#chatgpt-mermaid-_r_6i1_ [data-look="neo"].cluster rect,#chatgpt-mermaid-_r_6i1_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-_r_6i1_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_6i1_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-_r_6i1_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-_r_6i1_-gradient);stroke-width:1px;}#chatgpt-mermaid-_r_6i1_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_6i1_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-_r_6i1_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-_r_6i1_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_6i1_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-_r_6i1_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-_r_6i1_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_6i1_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-_r_6i1_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_6i1_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(232, 232, 232);}#chatgpt-mermaid-_r_6i1_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(232, 232, 232);}#chatgpt-mermaid-_r_6i1_ .node tspan[font-weight="normal"],#chatgpt-mermaid-_r_6i1_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-_r_6i1_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(19, 19, 19);stroke:rgb(47, 47, 47);stroke-width:1px;}#chatgpt-mermaid-_r_6i1_ .node rect,#chatgpt-mermaid-_r_6i1_ .node circle,#chatgpt-mermaid-_r_6i1_ .node ellipse,#chatgpt-mermaid-_r_6i1_ .node polygon,#chatgpt-mermaid-_r_6i1_ .node path{fill:rgb(24, 24, 24);stroke:rgba(255, 255, 255, 0.1);stroke-width:1px;}#chatgpt-mermaid-_r_6i1_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-_r_6i1_ .mermaid-decision .label-container{fill:rgb(19, 19, 19);stroke:rgb(47, 47, 47);stroke-dasharray:2,2;}#chatgpt-mermaid-_r_6i1_ .edgePaths .flowchart-link{stroke:rgb(175, 175, 175);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-_r_6i1_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_6i1_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}User Selects FileCalculate File HashCreate Upload SessionServer Issues UploadAuthorizationUpload Chunks Directly toObject StorageVerify Uploaded PartsComplete UploadServer Verifies Hash andFile TypeCreate Asset RecordStart Ingestion Pipeline

核心要求：

- 分块上传。
- 断点续传。
- 上传进度持久化。
- 上传失败重试。
- 文件哈希校验。
- 文件类型检测。
- 恶意文件扫描。
- 上传完成后才正式注册 Asset。
- 上传过程中不允许 Agent 读取未完成文件。

建议采用 SHA-256 作为文件完整性校验基础。

### 文件去重

可以通过内容哈希检测相同文件。

但是我不建议直接做全局跨租户去重。

因为如果不同用户共享全局去重状态，可能产生文件是否存在的侧信道问题。

建议：

- 同一用户或同一租户内部进行去重。
- 不同租户之间默认逻辑隔离。
- 对相同文件的不同版本保留独立 Asset Version。
- 对文件内容变化生成新的不可变版本。

## 9.2 文件下载架构

用户打开一个 Artifact 时，不需要同时下载其关联的所有原始资料。

建议使用按需加载：

```
Open Artifact
     │
     ▼
Load Artifact Metadata
     │
     ▼
Load Referenced Knowledge
     │
     ▼
Display Cached Content
     │
     ▼
User Opens PDF
     │
     ▼
Request Temporary Download URL
     │
     ▼
Download / Stream PDF
```

对象存储的文件访问应该通过短时有效的授权 URL 或受控下载服务完成。

不要将永久公开的对象存储 URL 写入 Artifact。

## 9.3 本地存储容量管理

建议建立 Storage Manager。

例如：

Local Storage Manager

# 2.8 GB

概念性存储占用示例

离线资料 45%

Artifact 25%

图片缓存 20%

其他 10%

离线资料

1.26 GB

Artifact 数据

700 MB

图片缓存

560 MB

其他缓存

280 MB

以上为功能示意，不是实际容量建议或设备检测结果。

建议提供：

- 当前占用空间。
- 已下载资料。
- 可清理缓存。
- 离线固定内容。
- 自动清理规则。
- 最大缓存容量。
- 手动清理。
- 未同步数据保护。

尤其注意：清理缓存绝不能误删本地 Outbox 中尚未同步的用户修改。

# 十、备份和恢复：必须区别于同步

我认为此前架构还有一个值得纠正的问题：

同步不等于备份。

如果用户误删一份 Artifact，而删除操作成功同步到所有设备，那么所有设备都会删除它。

同步系统只是让设备保持一致，不保证数据可恢复。

因此需要独立设计 Backup System。

## 10.1 三种备份

| 类型         | 主要用途               | 推荐策略                    |
| ------------ | ---------------------- | --------------------------- |
| 云端自动备份 | 数据库损坏、误操作恢复 | 定期备份                    |
| 用户完整导出 | 用户迁移和数据所有权   | 按需 ZIP                    |
| 本地设备备份 | 设备故障、离线数据保护 | 依赖系统能力 + 应用恢复机制 |

### 云端自动备份

建议：

- PostgreSQL 定期全量备份。
- WAL 归档。
- 支持 Point-in-Time Recovery。
- 对象存储开启版本保护。
- 重要备份异地保存。
- 定期进行恢复演练。

不要只验证备份文件是否存在。

必须真正测试能否恢复整个 Workspace。

### 用户完整导出

我建议将其设计为标准化的：

```
Workspace Archive Format
```

例如：

```
workspace-export.zip
│
├── manifest.json
│
├── workspace/
│   ├── workspace.json
│   ├── projects.json
│   └── preferences.json
│
├── artifacts/
│   ├── artifact_001.json
│   └── artifact_002.json
│
├── knowledge/
│   ├── nodes.json
│   ├── edges.json
│   └── claims.json
│
├── sources/
│   ├── sources.json
│   └── evidence.json
│
├── assets/
│   ├── paper_001.pdf
│   └── image_001.png
│
├── history/
│   └── revisions.json
│
└── checksums.json
```

这里建议支持两种导出模式：

完整备份：

包含原始文件、Artifact、知识关系、来源、证据、历史版本等。

轻量迁移：

包含结构化知识、Artifact、来源元数据和必要的引用，不一定携带所有原始文件。

### 备份格式需要版本化

例如：

```
{
  "format": "akw-workspace-archive",
  "format_version": "1.0",
  "exported_at": "2026-11-08T12:00:00Z",
  "workspace_id": "ws_001",
  "includes": [
    "artifacts",
    "knowledge",
    "sources",
    "evidence",
    "assets",
    "history"
  ]
}
```

未来即使修改 Artifact Schema，也要支持旧备份迁移。

建议将数据迁移器作为独立模块，而不是把兼容逻辑散落在导入代码中。

## 10.2 删除与恢复

建议设置：

- 软删除。
- 回收站。
- 删除确认。
- 恢复期限。
- 永久删除。
- 关联对象影响分析。

对于高价值对象，例如 Workspace、Project、Artifact，删除时应该明确告诉用户哪些内容会受到影响。

# 十一、云端与本地的数据一致性：还需要一套事件机制

前面的 Mutation Protocol 解决了用户如何提交修改。

但服务端还需要可靠地通知其他模块和设备。

例如：

用户修改 Artifact 后：

- 搜索索引需要更新。
- Embedding 可能需要重新生成。
- 相关知识图谱视图需要刷新。
- 版本记录需要写入。
- 其他设备需要收到变更。

不应该让每个业务服务自己直接调用所有下游模块。

建议增加：

Transactional Outbox Pattern。

## 11.1 事件流架构

```
User Mutation
     │
     ▼
Domain Service
     │
     ▼
Database Transaction
     │
     ├── Update Artifact
     ├── Create New Revision
     └── Write Outbox Event
              │
              ▼
        Event Dispatcher
              │
     ┌────────┼─────────┐
     ▼        ▼         ▼
  Sync     Search    Embedding
  Service  Index     Worker
     │        │         │
     ▼        ▼         ▼
  Devices  Search    Vector
           Index     Store
```

这里最重要的是：

Artifact 的正式修改和 Outbox Event 必须在同一个数据库事务中提交。

否则可能出现：

- Artifact 已经修改，但同步事件没有写入。
- 事件已经发送，但 Artifact 实际修改失败。

使用 Transactional Outbox 可以降低这种不一致风险。

### 事件分级

建议区分：

| 事件类型     | 例子                    | 处理方式   |
| ------------ | ----------------------- | ---------- |
| Domain Event | ArtifactUpdated         | 持久化     |
| Sync Event   | ArtifactRevisionCreated | 持久化     |
| AI Event     | AgentTaskCompleted      | 持久化     |
| Cache Event  | ThumbnailInvalidated    | 可重建     |
| UI Event     | PanelOpened             | 不需要同步 |

不要把所有前端行为都记录为正式业务事件。

否则数据库会被大量低价值日志占满。

## 11.2 不要让 Embedding 成为数据权威

这是一个重要原则。

假设用户修改了一段 Artifact。

应该先提交正式 Artifact 修改，再异步更新 Embedding。

如果 Embedding 更新失败：

- Artifact 修改仍然有效。
- 搜索索引标记为待更新。
- 后台重新生成。
- 用户可以看到索引更新状态。

不能因为向量数据库不可用，就导致用户无法保存自己的笔记。

知识资产保存优先级永远高于检索索引更新。

# 十二、我建议的云端数据分层

从长期成本和性能角度考虑，数据还需要分层管理。

不建议所有数据都永久放在高性能数据库或热存储中。

| 数据层      | 内容                            | 存储策略             |
| ----------- | ------------------------------- | -------------------- |
| Hot         | 最近使用的 Artifact、活跃任务   | 高性能数据库与缓存   |
| Warm        | 常用 Source、知识节点、历史版本 | 常规数据库和对象存储 |
| Cold        | 长期未访问的原始资料、旧快照    | 低成本对象存储       |
| Rebuildable | Embedding、缩略图、检索缓存     | 可重建存储           |

这里有一个重要区别：

Cold Data 不等于可以删除的数据。

一篇用户三年没有打开的论文，可能仍然具有很高的知识价值。

可以降低存储成本，但不能未经用户授权删除。

建议增加：

- 最近访问时间。
- 最近引用时间。
- 用户收藏状态。
- 是否固定保留。
- 是否参与自动化研究。
- 数据保留策略。

根据这些因素决定存储层级。

# 十三、建议重新设计数据权限与项目关联边界

我们之前已经确定：

用户完全自定义哪些 Project 关联，哪些不关联，并且可以随时修改关联关系。

这一原则在云端和本地架构中必须继续保持。

我建议明确区分：

1. 数据归属。
2. 数据可见性。
3. 知识关联。
4. 文件访问权限。

这四个概念不能混为一谈。

例如：

用户允许 Project A 和 Project B 建立知识关系，不代表 Project B 自动获得 Project A 中所有原始文件的读取权限。

建议采用：

```
Workspace
│
├── Project A
│    ├── Artifacts
│    ├── Sources
│    └── Knowledge
│
├── Project B
│    ├── Artifacts
│    ├── Sources
│    └── Knowledge
│
└── Relation Layer
     ├── Explicit Relations
     ├── Shared Knowledge References
     └── Cross-project References
```

关系可以跨 Project，但访问权限仍然要独立验证。

对于跨项目搜索，Agent 必须在每一次检索时检查用户对目标 Project 的权限，而不是只在创建 Research Run 时检查一次。

如果用户后来撤销了某个项目的权限，已经运行的 Agent 也必须重新检查权限，不能继续使用缓存中的受限内容。

# 十四、需要增加的数据库表与服务

综合以上内容，我建议原来的后端增加以下部分。

## 14.1 数据库新增表

| 数据表                  | 主要职责         |
| ----------------------- | ---------------- |
| `assets`                | 原始文件资产     |
| `asset_versions`        | 文件版本         |
| `asset_locations`       | 对象存储位置     |
| `device_file_bindings`  | 设备本地文件绑定 |
| `upload_sessions`       | 分块上传状态     |
| `upload_parts`          | 上传分块记录     |
| `artifact_revisions`    | Artifact 版本    |
| `artifact_patches`      | 修改提案         |
| `artifact_branches`     | 逻辑分支         |
| `sync_events`           | 增量同步事件     |
| `client_mutations`      | 客户端修改请求   |
| `sync_cursors`          | 同步位置         |
| `sync_conflicts`        | 冲突记录         |
| `device_storage_states` | 本地存储状态     |
| `data_policies`         | 数据处理策略     |
| `data_deletion_jobs`    | 删除任务         |
| `backup_jobs`           | 备份任务         |
| `restore_jobs`          | 恢复任务         |
| `schema_migrations`     | 数据 Schema 迁移 |

不需要一次性创建所有表。

但建议先完成领域模型和数据关系设计，避免以后同一概念出现多套定义。

## 14.2 服务拆分

我建议增加这些逻辑服务：

```
backend/
│
├── data/
│   ├── asset_service/
│   ├── storage_service/
│   ├── data_policy_service/
│   ├── lifecycle_service/
│   └── backup_service/
│
├── sync/
│   ├── sync_gateway/
│   ├── mutation_processor/
│   ├── conflict_resolver/
│   ├── change_feed/
│   └── snapshot_service/
│
├── artifact/
│   ├── revision_service/
│   ├── patch_service/
│   ├── merge_service/
│   └── migration_service/
│
└── infrastructure/
    ├── object_storage/
    ├── event_dispatcher/
    ├── cache/
    └── database/
```

这些是逻辑模块，不意味着每个模块都必须部署成独立微服务。

我的建议是：初期使用模块化单体 + 独立异步 Worker。

例如：

- API 服务负责业务请求。
- Worker 负责文件解析、Embedding、备份和事件处理。
- Agent Runtime 负责长时间研究任务。
- Sync Service 可以先作为 API 内部模块。

等实际出现性能瓶颈，再将热点模块独立部署。

这样既能解耦，也不会因为过度微服务化影响性能和开发效率。

# 十五、最终推荐的云端与本地数据架构

将所有设计合并后，我建议采用下面这套架构。

\#chatgpt-mermaid-_r_6jm_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-_r_6jm_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_6jm_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_6jm_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-_r_6jm_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-_r_6jm_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-_r_6jm_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-_r_6jm_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-_r_6jm_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-_r_6jm_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-_r_6jm_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-_r_6jm_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_6jm_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_6jm_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-_r_6jm_ p{margin:0;}#chatgpt-mermaid-_r_6jm_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_6jm_ .cluster-label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-_r_6jm_ .cluster-label span{color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_6jm_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-_r_6jm_ .label text,#chatgpt-mermaid-_r_6jm_ span{fill:rgb(237, 237, 237);color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_6jm_ .node rect,#chatgpt-mermaid-_r_6jm_ .node circle,#chatgpt-mermaid-_r_6jm_ .node ellipse,#chatgpt-mermaid-_r_6jm_ .node polygon,#chatgpt-mermaid-_r_6jm_ .node path{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-_r_6jm_ .rough-node .label text,#chatgpt-mermaid-_r_6jm_ .node .label text,#chatgpt-mermaid-_r_6jm_ .image-shape .label,#chatgpt-mermaid-_r_6jm_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-_r_6jm_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-_r_6jm_ .rough-node .label,#chatgpt-mermaid-_r_6jm_ .node .label,#chatgpt-mermaid-_r_6jm_ .image-shape .label,#chatgpt-mermaid-_r_6jm_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-_r_6jm_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-_r_6jm_ .root .anchor path{fill:rgb(175, 175, 175)!important;stroke-width:0;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_6jm_ .arrowheadPath{fill:rgb(175, 175, 175);}#chatgpt-mermaid-_r_6jm_ .edgePath .path{stroke:rgb(175, 175, 175);stroke-width:1px;}#chatgpt-mermaid-_r_6jm_ .flowchart-link{stroke:rgb(175, 175, 175);fill:none;}#chatgpt-mermaid-_r_6jm_ .edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-_r_6jm_ .edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-_r_6jm_ .edgeLabel rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-_r_6jm_ .labelBkg{background-color:rgba(0, 0, 0, 0.5);}#chatgpt-mermaid-_r_6jm_ .cluster rect{fill:rgb(48, 48, 48);stroke:rgba(255, 255, 255, 0.15);stroke-width:1px;}#chatgpt-mermaid-_r_6jm_ .cluster text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-_r_6jm_ .cluster span{color:rgb(237, 237, 237);}#chatgpt-mermaid-_r_6jm_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(48, 48, 48);border:1px solid rgba(255, 255, 255, 0.15);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-_r_6jm_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237, 237);}#chatgpt-mermaid-_r_6jm_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-_r_6jm_ .icon-shape,#chatgpt-mermaid-_r_6jm_ .image-shape{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-_r_6jm_ .icon-shape p,#chatgpt-mermaid-_r_6jm_ .image-shape p{background-color:rgb(0, 0, 0);padding:2px;}#chatgpt-mermaid-_r_6jm_ .icon-shape .label rect,#chatgpt-mermaid-_r_6jm_ .image-shape .label rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-_r_6jm_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-_r_6jm_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-_r_6jm_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-_r_6jm_ [data-look="neo"].node rect,#chatgpt-mermaid-_r_6jm_ [data-look="neo"].cluster rect,#chatgpt-mermaid-_r_6jm_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-_r_6jm_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_6jm_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-_r_6jm_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-_r_6jm_-gradient);stroke-width:1px;}#chatgpt-mermaid-_r_6jm_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_6jm_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-_r_6jm_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-_r_6jm_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_6jm_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-_r_6jm_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-_r_6jm_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_6jm_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-_r_6jm_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_6jm_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(232, 232, 232);}#chatgpt-mermaid-_r_6jm_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(232, 232, 232);}#chatgpt-mermaid-_r_6jm_ .node tspan[font-weight="normal"],#chatgpt-mermaid-_r_6jm_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-_r_6jm_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(19, 19, 19);stroke:rgb(47, 47, 47);stroke-width:1px;}#chatgpt-mermaid-_r_6jm_ .node rect,#chatgpt-mermaid-_r_6jm_ .node circle,#chatgpt-mermaid-_r_6jm_ .node ellipse,#chatgpt-mermaid-_r_6jm_ .node polygon,#chatgpt-mermaid-_r_6jm_ .node path{fill:rgb(24, 24, 24);stroke:rgba(255, 255, 255, 0.1);stroke-width:1px;}#chatgpt-mermaid-_r_6jm_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-_r_6jm_ .mermaid-decision .label-container{fill:rgb(19, 19, 19);stroke:rgb(47, 47, 47);stroke-dasharray:2,2;}#chatgpt-mermaid-_r_6jm_ .edgePaths .flowchart-link{stroke:rgb(175, 175, 175);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-_r_6jm_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-_r_6jm_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}Persistent StorageCloud Data InfrastructureClient LayerAsync ProcessingDomain ServicesLocal Data InfrastructurePlatform DevicesPostgreSQLS3 / MinIOpgvectorRedisAgent RuntimeDocument IngestionEmbedding WorkerEvent DispatcherBackup / RestoreWorkspace ServiceArtifact / Version ServiceAsset / Storage ServiceKnowledge ServiceSync ServiceData GovernanceAPI GatewaySQLite / IndexedDB /ArkDataCache ManagerLocal Asset ManagerLocal Editing EngineMutation OutboxLocal Sync EngineSecure Credential StorageWindows / macOSAndroid / iOSHarmonyOSWeb / PWA

## 十六、开发任务优先级

我建议不要一次性把所有数据管理能力实现出来，而是分成四个阶段。

## Phase 1：基础数据可靠性

P0 · MVP 必须完成

- 统一 Entity Schema。

- PostgreSQL 数据模型。

- S3 / MinIO 文件存储。

- 各平台本地数据库 Adapter。

- 本地 Outbox。

- Mutation Protocol。

- 增量同步。

- 幂等提交。

- Artifact 版本控制。

- 基础冲突检测。

- 本地未同步数据保护。

- 数据权限和租户隔离。

  ## Phase 2：数据管理完善

  P1

- 文件分块上传。

- 断点续传。

- Storage Manager。

- 离线资料固定。

- AI Patch 与用户编辑冲突处理。

- Transactional Outbox。

- 增量索引更新。

- 数据删除和依赖分析。

- 完整 Workspace 导出。

- 云端备份与恢复。

  ## Phase 3：高级数据管理

  P2

- Local Only Workspace。

- 更高级的隐私模式。

- 本地全文检索。

- 多设备智能冲突合并。

- 自动缓存优化。

- 多租户独立密钥管理。

- 历史数据分层存储。

  ## Phase 4：高级协作与分布式能力

  P3

- 多人实时协作。

- CRDT。

- 企业私有部署。

- 本地模型与私有数据处理。

- 高级跨设备接续。

- 企业级备份与灾难恢复。

## 十七、必须进行的压力测试和故障测试

这套架构不能只测试正常联网情况下的使用。

我建议把以下场景纳入自动化测试。

| 测试场景                  | 预期结果               |
| ------------------------- | ---------------------- |
| 编辑过程中断网            | 本地修改不丢失         |
| 编辑后直接关闭应用        | Mutation 保留          |
| 两台设备同时修改          | 检测冲突，不覆盖       |
| Agent 修改与用户修改竞争  | 产生独立 Patch         |
| 上传过程中断网            | 支持断点续传           |
| 上传完成但 API 超时       | 幂等恢复               |
| 服务端提交成功但 ACK 丢失 | 重试不重复执行         |
| Redis 重启                | 正式任务不丢失         |
| Embedding Worker 失败     | Artifact 正常保存      |
| 数据库恢复                | 能恢复一致的数据状态   |
| 删除 Source               | 正确处理关联 Evidence  |
| 旧版本客户端上线          | Schema 兼容或要求升级  |
| 用户长期离线              | Snapshot + 增量恢复    |
| 本地缓存空间不足          | 不能清理未同步修改     |
| 用户撤销项目权限          | Agent 停止访问受限数据 |

特别建议增加一个非常重要的测试：

在 Agent 执行、用户编辑、设备同步和文件上传同时发生时，系统能否保持数据一致。

这是这个项目真正复杂的地方。

# 十八、我认为最终需要确定的八项数据架构决策

下面是我建议正式冻结的 ADR（Architecture Decision Records）。

| 编号   | 决策           | 最终方案                               |
| ------ | -------------- | -------------------------------------- |
| ADR-01 | 数据权威来源   | Cloud-authoritative                    |
| ADR-02 | 本地交互       | Local-first interaction                |
| ADR-03 | 本地数据库     | SQLite / IndexedDB / ArkData           |
| ADR-04 | 云端结构化数据 | PostgreSQL                             |
| ADR-05 | 文件存储       | S3 / MinIO                             |
| ADR-06 | 数据同步       | Mutation + Event Log + Cursor          |
| ADR-07 | 冲突解决       | Versioning + Block-level Merge         |
| ADR-08 | AI 修改        | Proposal + Patch + Validation + Commit |

另外，我建议明确以下三个原则：

第一，用户修改优先于 AI 自动修改。

用户自己的修改永远不能因为 Agent 的后台执行而被静默覆盖。

第二，正式知识资产优先于索引和缓存。

Embedding、缩略图和检索索引可以重建，但 Artifact、Evidence、用户批注和知识关系不能因为辅助系统故障而丢失。

第三，数据迁移能力必须从第一天设计。

用户应该能够完整导出自己的 Workspace，而不是被迫长期依赖我们的服务。

# 十九、最后一个值得认真考虑的战略问题：是否应该发展为 Local-first 产品？

我认为现在不应该完全转向 Local-first，但应该保留这条路线。

这里有三种架构路线：

| 方案        | 优势                       | 缺点             |
| ----------- | -------------------------- | ---------------- |
| Cloud-first | 开发简单、AI 能力强        | 离线和隐私能力弱 |
| Local-first | 隐私、离线、数据控制强     | 同步和跨平台复杂 |
| Hybrid      | 兼顾云端 AI 和本地数据控制 | 架构复杂度较高   |

我推荐第三种。

原因在于，我们的核心产品价值来自云端 Agent 的自主研究能力，但用户真正拥有的是本地和云端共同维护的知识资产。

未来甚至可以增加两种高级工作模式：

Cloud Workspace

默认模式

云端保存正式知识资产，多个设备同步，Agent 可以直接执行研究任务。

Private Workspace

高级模式

尽量在本地保存敏感资料，限制云端处理范围，只有经过授权的数据才进入云端 Agent。

但是 Private Workspace 必须明确能力边界：如果使用 DeepSeek 云端 API 处理本地文件，就意味着相关内容需要在授权范围内离开设备。不能一边使用云端模型，一边承诺内容从未离开本地。

## 最终结论

我认为，这次数据架构调整中最重要的不是增加多少数据库或存储服务，而是建立一套明确的数据所有权和数据生命周期体系。

我建议把整个项目的数据管理理念正式确定为：

云端负责统一管理、智能处理和跨设备协调；本地负责即时交互、持久化编辑、缓存和离线工作；同步系统负责可靠地连接两者。

最终有四条底线：

1. 不能丢： 用户已经完成的编辑、知识资产和原始资料不能因为网络、应用或 Agent 故障而丢失。
2. 不能乱： 多设备、Agent 和用户同时操作时，必须有明确的版本与冲突处理机制。
3. 不能越权： 不同用户、项目和隐私等级的数据必须严格隔离。
4. 能够带走： 用户随时可以完整备份、导出和迁移自己的知识资产。

我还想特别强调一个架构取舍：不要把本地数据库设计成云端数据库的简单镜像，而要把它设计成一个具有独立持久化能力的工作副本。 这意味着即使云端暂时不可用，用户仍然可以继续阅读、编辑和组织知识；等网络恢复后，再可靠地合并变化。

这才是比较适合 AI Knowledge Workspace 长期发展的云端与本地数据架构。