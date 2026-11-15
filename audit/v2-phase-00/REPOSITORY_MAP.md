# 仓库地图

审计对象为 `F:/ai-knowledge-workspace`。2026-11-12，Windows 11 工作环境，Node v24.16.0、npm 11.13.0。`git branch --show-current` 为 `main`，`git rev-parse --verify HEAD` 失败，根目录代码和既有审计资料均属当前未提交工作区。以文件清单和 SHA-256 标识本次快照，不能以旧官方仓库提交代替本项目提交。

状态口径适用于本目录。**implemented** 有实现证据；**partial** 已覆盖部分目标或仅本地验证；**planned** 在 v2.0 中明确要求且未见实现；**unknown** 缺少运行、部署或外部证据。

| 区域 | 状态 | 当前实现和入口 |
| --- | --- | --- |
| API | implemented | TypeScript、NestJS 11.2.9 / Express、Zod 4.6.7。 [main.ts](../../apps/api/src/main.ts) 初始化 [services.ts](../../apps/api/src/services.ts)，[controllers.ts](../../apps/api/src/http/controllers.ts) 暴露 `/v1`，OpenAPI 由 [openapi.ts](../../apps/api/src/http/openapi.ts) 生成。 |
| 数据与迁移 | implemented | 使用 `pg` 8.23.1 与手写参数化 SQL；无 ORM。无数据库 URL 时用 PGlite 0.5.3 与 pgvector；生产模式要求 PostgreSQL。 [database.ts](../../apps/api/src/platform/database.ts) 与 [migrations](../../apps/api/migrations)。 |
| 队列和 Worker | partial | PostgreSQL/PGlite 表承担队列；API 本地内置 Worker，另有 PostgreSQL 独立 Worker。Compose 中 Redis 为可选 cache profile；作业领用不依赖 Redis。 [jobs.ts](../../apps/api/src/domain/jobs.ts) 与 [worker](../../apps/api/src/worker)。 |
| 对象存储 | partial | 本地文件系统与 AWS SDK S3 Put/Get 两个分支。Compose 定义 PG17/pgvector 和 MinIO，生产连接与备份未验证。 [objects.ts](../../apps/api/src/platform/objects.ts) 与 [compose.yaml](../../compose.yaml)。 |
| Runtime 与 Quality Engine | partial | [runtime](../../apps/api/src/runtime) 与 [quality-engine](../../apps/api/src/quality-engine) 同级。前者执行领域工作流、调用模型和受控工具，后者定义任务提示、验证和覆盖。 |
| 领域与共享契约 | implemented | [domain](../../apps/api/src/domain) 管理 Workspace、来源、知识、版本、导出和同步；[contracts](../../packages/contracts/src) 存放共享 Zod/API/视图/合并契约。 |
| Web | implemented | Next 16.4.6、React 19.3.1、Next `/api` rewrite、共享 React 工作台、Service Worker 和 IndexedDB。 [web](../../apps/web) 与 [client](../../packages/client/src)。 |
| Windows | implemented | Tauri 2 / Rust / WebView2，rusqlite、文件、剪贴板、独立窗口和通知桥接。本机冒烟本轮通过。 [windows](../../apps/windows) 与 [Windows 测试](../../scripts/windows-smoke.mjs)。 |
| Android | partial | Capacitor 8.6.0 / Java、自定义 WorkspaceBridge 与 SQLite。已有 Debug APK；真机待验。 [mobile](../../apps/mobile)。 |
| CI | partial | [ci.yml](../../.github/workflows/ci.yml) 定义 Ubuntu 静态检查、API、Build、Playwright，以及 Windows Rust 测试与 Debug 构建。本轮仅有本机复跑，远端 CI、Android 和生产基础设施流水线无运行证据。 |

[上一轮 Harness 验收](../PHASES_01_12_COMPLETION_REPORT.md) 与 [七场景记录](../evaluation/WORKBENCH_RESULTS.json) 是历史证据。本轮结果见 [BASELINE_TESTS.md](BASELINE_TESTS.md)。
