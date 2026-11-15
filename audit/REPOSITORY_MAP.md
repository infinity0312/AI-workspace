# 现有仓库地图

审计日期为 2026-11-12，根目录为 `F:\ai-knowledge-workspace`。本报告记录现有产品，供 Harness 迁移 Phase 00 复核。

## 仓库与版本

| 检查 | 结果 |
| --- | --- |
| `git branch --show-current` | `main` |
| `git rev-parse HEAD` 与 `git log -1 --oneline` | 无提交，无法解析有效的 HEAD |
| `git status --short` 与 `git ls-files` | 既有项目文件为未跟踪，索引中有 0 个文件。无法从 Git 区分历史用户改动。 |
| 现状指纹 | `SOURCE_MANIFEST.sha256` 含 247 个非忽略文件，清单 SHA-256 为 `8c1c62d12e56cd98576718fcd3db34b1f0dce4faddc92e5885da45a54ffb1ec1`。清单排除本轮 `audit/` 和 Git 忽略项。 |
| 本机执行环境 | Windows PowerShell，Node.js 24.16.0，npm 11.13.0。仓库要求 Node.js 22 或更新版本。 |
| 包管理 | npm Workspaces，根 `package.json` 与 `package-lock.json`。已安装 TypeScript 5.9.3、NestJS 11.2.9、Express 5.3.0、Next 16.4.6、React 19.3.1。 |

## 应用与边界

| 位置 | 当前职责 |
| --- | --- |
| `apps/api/src/http` | NestJS + Express HTTP API。控制器做身份和 Zod 校验，`openapi.ts` 描述合同。 |
| `apps/api/src/domain/jobs.ts`、`apps/api/src/worker` | 业务任务入队、分派、租约、检查点、预算和提交。Worker 轮询数据库任务。 |
| `apps/api/src/runtime` | 即时问答、研究、文档分析、选段改写、公开检索、DeepSeek HTTP、预算估算。 |
| `apps/api/src/quality-engine` | 与 Runtime 同级。提示词、任务契约、证据与响应校验、覆盖判定、审计元数据。 |
| `apps/api/src/domain` | Workspace、项目、来源、证据、知识关系、Artifact、修订、导入导出和同步。 |
| `apps/api/migrations`、`apps/api/src/platform/database.ts` | SQL 迁移 001–011，事务内登记迁移。本地 PGlite 0.5.3 + pgvector，服务部署可走 PostgreSQL + `pg` 8.23.1。服务迁移有 advisory lock。 |
| `apps/api/src/platform/objects.ts` | 本机内容寻址文件存储，或 AWS SDK S3 兼容存储。文件用临时文件和重命名提交。 |
| `apps/web`、`packages/client`、`packages/contracts` | Next.js Web 壳、React 共享工作台、Zod 和 TypeScript 共享协议。Web 把 `/api/*` 转给 API。 |
| `apps/windows`、`apps/mobile` | Windows 使用 Tauri 2、Rust、WebView2、SQLite。移动端采用 Capacitor 和 Android 工程。当前审计的原生界面验证覆盖 Windows。 |

## 队列、部署和配置

- 本地 API 同进程启动 Worker。配置数据库 URL 时可独立运行 `apps/api/src/worker/main.ts`，也可显式启用内联 Worker。任务由 `jobs` 表和 `FOR UPDATE SKIP LOCKED` 领取。调度器约每 15 秒检查计划任务，空队列约 600 毫秒后复查。
- `compose.yaml` 提供 PostgreSQL 17 + pgvector、MinIO，以及可选 cache profile 的 Redis。当前任务执行链使用 SQL 队列，未发现 Redis 队列接线。
- `.github/workflows/ci.yml` 在 Ubuntu 执行安装、类型检查、Lint、API 回归、构建与 Playwright，在 Windows 执行 Cargo 检查和 Tauri 调试构建。仓库部署手册覆盖本地及 PostgreSQL/S3 服务配置，本阶段没有执行生产部署。
- DeepSeek 通过 Node 原生 `fetch` 调用。Brave Search 和独立 Embedding 由环境配置启用。服务配置由 `config.ts` 加载，`.env`、`.data`、构建目录均被 Git 忽略。审计只记录配置名称和协议，凭证不进入报告或清单。
- 一手代码导航与复测入口分别见 [调用链](CURRENT_MODEL_CALL_CHAIN.md)、[生命周期](CURRENT_AGENT_LIFECYCLE.md)、[测试基线](CURRENT_BASELINE.md)。
