# 前端重设计交接

Web 当前是功能原型。视觉取样来自 Atelier Atlas 的暖纸色、群青和编辑式工作台。桌面布局由左导航、中央画布和右侧检查器组成，窄屏通过导航抽屉和底部检查器适配。

## 重设计入口

| 文件 | 负责内容 |
| --- | --- |
| `packages/client/src/styles.css` | Token、字体、布局、响应式与初版组件样式 |
| `packages/client/src/workspace/workspace-app.tsx` | 路由式页面状态、工作空间切换、同步状态与检查器入口 |
| `packages/client/src/workspace/workflows.tsx` | 研究、来源、知识关系、导出与归档恢复 |
| `packages/client/src/workspace/library-pages.tsx` | 资料收件箱、结论维护、版本、回收站 |
| `packages/client/src/workspace/study-page.tsx` | 学习目标、阶段任务、复习卡片 |
| `packages/client/src/workspace/schedules-page.tsx` | 研究和网页监测计划 |
| `packages/client/src/workspace/collaboration.tsx` | 空间成员和版本批注 |
| `packages/client/src/lib/platform.ts` | Web、Windows、Android 与后续原生端的能力接口 |
| `packages/client/src/workspace/artifact-editor.tsx` | 块级编辑、Tiptap Adapter、视图配置和选区 |
| `packages/client/src/workspace/artifact-renderer.tsx` | 统一 Renderer Registry，正文、提案和版本预览共用 |
| `packages/client/src/workspace/projection-views.tsx` | 同一知识数据上的思维导图、时间脉络和关系图谱 |
| `packages/contracts/src/projection.ts` | 视图属性、节点、边及纯数据投影函数 |
| `packages/client/src/lib/api.ts` | 同源 API Client、错误映射与服务类型 |
| `packages/client/src/lib/local-repository.ts` | IndexedDB、草稿、Outbox 与 ACK 重放 |
| `packages/contracts/src/index.ts` | 共享数据协议，客户端可以从同一包引入 |
| `packages/contracts/src/merge.ts` | 浏览器与服务端共用的保守三方合并 |

生产 API 契约由 `GET /v1/openapi.json` 提供。Web 当前通过 Next.js 的 `/api/v1/*` 代理访问。Windows Tauri 已复用相同 UI 和数据契约，通过受限 IPC 接入本机 API、文件、SQLite 和通知。Android 调试版通过 Capacitor 接入同一平台接口，原生桥接 API、SQLite 与剪贴板。其他原生端可以继续实现该接口。

## 可组合 Workspace

- 文档可以切换正文、思维导图、时间脉络和关系图谱。切换偏好保存在当前设备。编辑模式可以把任一视图作为块插入正文，并选择节点及起点。
- `mindmap`、`timeline` 和 `graph_embed` 块使用 `view_version:1`、`node_ids`、可选 `root_id` 和标题。节点和关系仍由 Knowledge 域管理。节点的日期支持年、年月和年月日，并可引用原文证据。
- `GET /v1/artifacts/{id}/projection` 提供有项目范围的图数据和视图版本。空节点列表使用当前项目及共享节点。视图块本身不会复制日期或关系。ZIP 恢复会重映射引用，Markdown、PDF 和 Word 导出以结构化文字表达视图。
- `ArtifactRendererProvider` 可以注入 `createArtifactRendererRegistry` 生成的替换组件，供正文、提案和版本预览使用。渲染器接收块、模式、投影数据和证据回调。未知类型保留原始块并显示回退。
- LaTeX 使用随客户端打包的 KaTeX，支持行内、独立公式、多行对齐、矩阵和常见数学符号。源文本保持可编辑，无法排版的公式保留源文本。Word 和 PDF 当前以源文本表示公式。

## 交互契约

- 加载 Artifact 时保留未知块原始数据，后续 Renderer 可以逐步替换。引用按钮以 `evidence_id` 查询来源定位。
- 编辑成功提示以平台持久化事务完成为准。Web 用 IndexedDB，Windows 和 Android 调试版使用 SQLite。同步状态来自 Outbox，版本号来自服务端。
- AI 选区提交 `block_id`、UTF-16 范围和 `base_revision_id`。提案独立预览并审核。
- 研究及导出由 Run ID 和持久事件驱动。目前采用轮询，后续推送可以保留相同的补偿拉取接口。
- 工作空间归档先预检再恢复。恢复成功后选中新工作空间。
- 知识关系页包括筛选、关系审核和相邻节点聚焦图。重设计可以直接复用 `GET /v1/knowledge/graph` 的节点和边。
