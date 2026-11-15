# 本机试用、故障排查与回滚

## Windows 隔离环境

从仓库根目录在 PowerShell 执行，Node 22 或更高。先安装项目依赖并准备已授权的 DeepSeek 本地配置。以下目录和端口由验收配置隔离，真实模型调用会消耗账户额度。Playwright 默认使用 Windows Edge，可用 `AKW_QA_BROWSER` 指定路径。

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run test:e2e
npm.cmd exec -- playwright test --config audit/evaluation/workbench/playwright.config.ts
```

工作台复跑会在 `.data/harness-final` 保存合成材料、公开样本与隔离数据库。测试流程通过表示界面和状态符合预期，正文质量需对照原文复核。使用可用端口时也可以手工启动：

```powershell
$env:AKW_PROFILE='local'
$env:DATABASE_URL=''
$env:AKW_S3_BUCKET=''
$env:AKW_PGLITE_PATH=(Join-Path (Get-Location) '.data/harness-manual/db')
$env:AKW_OBJECTS_PATH=(Join-Path (Get-Location) '.data/harness-manual/objects')
$env:AKW_HARNESS_V2_ENABLED='true'
$env:AKW_HARNESS_V2_LOCAL_ALL='true'
$env:AKW_PORT='4193'
$env:PORT='3093'
$env:AKW_API_ORIGIN='http://127.0.0.1:4193'
$env:AKW_WEB_DIST='.next-harness-manual'
npm.cmd run build
npm.cmd run start
```

浏览 `http://localhost:3093`。Next API 地址在构建时确定。Windows 原生和 Android 继续使用共享工作台与同一个后端契约。Windows UI 测试可用 `AKW_WINDOWS_SMOKE_EXE` 指向已构建的测试 EXE。

## 灰度与回滚

1. 服务配置默认关闭新运行。试点用 `AKW_HARNESS_V2_ENABLED=true` 加逗号分隔的 `AKW_HARNESS_V2_WORKSPACES`。全开开关限本地档位。先在目标 SQL 环境验证增量迁移，再启动新 Worker。
2. 以工作空间对照引用缺失、必答缺失、提案采纳、取消、任务时长、模型调用及用量。运行使用入队时保存的配置；旧版任务沿既有执行路径。
3. 回滚时关闭准入或移除受影响 Workspace，重启应用与 Worker，确认新任务走旧路径，历史会话可读，已有试点任务正常结束或按需取消。保留增量表与提案版本。代码整体降版前排空仍绑定新运行时的任务。
4. `AKW_HARNESS_V2_TOOLS`、`AKW_HARNESS_V2_SKILLS`、`AKW_HARNESS_V2_COMPACTION` 可分别对新试点任务关闭。生产切流需要先完成真实 PostgreSQL 多 Worker、对象存储和质量负载验证。

| 现象 | 处理 |
| --- | --- |
| 创建了文档，正文未出现分析 | 从「创建并分析」输入目标、选择资料并同意分析；等待提案，再点「写入当前文档」。已有文档可从「AI 生成分析」发起。 |
| 没有取得指定来源 | 检查地址是否为原始正文，可先在「来源」导入并查看解析片段。指定网址应使用实际可抓取的 HTTPS 页面或 PDF 地址。 |
| 必答问题未生成可写入提案 | 用单行、可核对的问题描述一个必答项。对照原文补充确切段落；问题分拆有助于定位哪个条件、数值或比较缺失。 |
| 进度等待或刷新后不确定状态 | 同一文档打开分析面板，查看运行过程；检查 `runtime-runs/{id}` 和游标。活跃任务可取消，已取消任务可以重新发起。 |
| 401/402/429、超时或预算用尽 | 检查供应商账户、额度、速率限制及作业错误码。针对目标缩小范围后重试。监控只使用调用序号、耗时、错误码与用量。 |
| 外部导入后 Windows 来源列表仍旧 | 刷新窗口后进入来源页。原生导入流程会刷新当前窗口；独立窗口和 API 外部变更的实时联动仍待验证。 |
