# AI Knowledge Workspace

以资料、证据和可编辑文档为中心的学习与研究工作台。当前版本包含 Windows 桌面、可安装 Web 工作台和 Android 调试客户端。项目在 `F:\ai-knowledge-workspace`，原始交接材料已收录在 `docs/reference`。

## 本机启动

Windows 桌面版的构建、启动和本机调试见 [Windows 适配交接](docs/WINDOWS_HANDOFF.md)。使用已构建的桌面版可运行 `npm.cmd run start:windows`。

Web 版需要 Node.js 22 或更新版本。已用 Node.js 24 和 Windows 验证。在 PowerShell 中运行：

```powershell
Set-Location F:\ai-knowledge-workspace
npm.cmd ci
npm.cmd run dev
```

- Web 工作台 http://127.0.0.1:3000
- API 健康检查 http://127.0.0.1:4100/v1/health
- OpenAPI 3.1 http://127.0.0.1:4100/v1/openapi.json

运行优化构建可使用 `npm.cmd run build`，随后运行 `npm.cmd start`。首次在线加载正式 Web 界面后，可离线重开已经缓存的文档。

默认使用嵌入式 PostgreSQL（PGlite 和 pgvector）与本机对象存储。API 自动执行 SQL 迁移，本机 Worker 同进程运行。数据位于 `.data/postgres` 和 `.data/objects`。本机模式使用回环地址和单用户身份，适用于个人开发验证。

## 试用流程

1. 在首页创建工作空间和项目。
2. 在「来源」粘贴正文、导入公开网页或上传 PDF、TXT、Markdown、HTML、DOCX、PPTX、XLSX、PNG、JPEG。打开来源查看解析质量与原文段落。
3. 选择「创建并分析」，或在现有文档中点击「AI 生成分析」。填写目标并授权后，工作台默认检索中英文百科、论文索引和开放许可图片。分析正文由内部证据校验筛选，原文、DOI 和图片许可可从引用打开。确认「写入当前文档」会保存为新版本。也可选用工作空间中已解析的来源。单独研究时，在「研究」选择来源、填写目标并提交。无模型凭据时可生成带原文证据的摘录，任务以「部分完成」标记。点击证据可查看来源及页码或段落偏移。
4. 打开产物，切换编辑模式，修改内容块。成功保存后，即使断网，本机编辑也会留在 IndexedDB；联网后通过 Mutation Outbox 提交。重叠冲突保留双方版本。
5. 在「学习」记录目标与复习卡片，在「知识维护」处理证据和来源变化。「监测」可以定期检查网页或重新执行研究。
6. 在「导出」下载 Markdown、JSON、PDF、DOCX 或工作空间 ZIP。ZIP 可以预检后恢复到新的工作空间，恢复时重建项目、文档版本、来源、证据和知识关系的 ID 引用。归档会标明未获再分发授权的原始资料。

在「知识关系」维护节点、事件日期和已确认关系。打开文档后可切换到思维导图、时间脉络或关系图谱，也可在编辑模式中将三种视图作为内容块加入正文。数学公式支持公式块和段落中的行内 LaTeX。

Agent 的门控、检索和长期知识复用详见 [运行时核对](docs/AGENT_RUNTIME_AUDIT.md)。任务契约、调用审计和修复流程见 [Quality Engine](docs/AI_QUALITY_ENGINE.md)。

## Android 本地调试

需要 JDK 21、Android SDK Platform 36 和平台工具。默认读取 `JAVA_HOME` 与 `ANDROID_HOME`，也可使用仓库 `.data/tooling` 内的本机工具。调试包连接通过 ADB 转发的 Windows 回环端口。

```powershell
npm.cmd run build:android
adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
adb reverse tcp:4100 tcp:4100
```

启动本机 API 后，在 Android 设备打开 AI Knowledge Workspace。调试版使用系统文件选择器、剪贴板和 SQLite 本地工作副本。生产 API 登录与签名发布另见项目覆盖表。

## 可选外部服务

将 `.env.example` 复制为 `.env`，配置需要的项后重启。DeepSeek 用于即时回答、结构化研究综合、选区修改和当前文档分析。Brave 用于搜索公开来源。Embedding 接口为可选的 OpenAI 兼容 JSON 服务，开启后可对公开来源使用向量与全文混合检索。

外部处理需要工作空间所有者开启策略，并由用户在发起任务时授权。敏感和受限工作空间禁止发送资料。真实模型、搜索与向量供应商需要自备凭据。

## 工程验证

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
```

Playwright 在有 Edge 的 Windows 上复用本机 Edge。其他环境先运行 `npx playwright install chromium`。端到端测试使用 3001／4101 端口和隔离的测试数据库。

## 仓库入口

| 路径 | 职责 |
| --- | --- |
| `packages/contracts/src` | Canonical Artifact、Patch、Mutation、事件契约与共用合并逻辑 |
| `apps/api/src/domain` | Workspace、Artifact、Knowledge、Sync、Jobs、Export、Import |
| `apps/api/src/runtime` | Agent 工作流、预算与供应商适配 |
| `apps/api/src/platform` | 数据库、对象存储、身份、受控网络访问 |
| `apps/api/migrations` | 版本化 PostgreSQL 迁移 |
| `packages/client/src` | Web 和桌面共用的工作台、编辑器、平台能力、API 和同步客户端 |
| `apps/web/app` | Next.js Web 壳 |
| `apps/windows` | Windows Tauri/Vite 桌面壳和原生桥接 |
| `apps/mobile` | Android Capacitor/Vite 调试客户端和 SQLite 桥接 |
| `docs/PROJECT_BASELINE.md` | 设计依据、范围、实现状态及已知差距 |
| `docs/FRONTEND_HANDOFF.md` | 前端重设计接口与保留契约 |
| `docs/DEPLOYMENT.md` | PostgreSQL、S3 兼容存储、独立 Worker 与上线验收边界 |
