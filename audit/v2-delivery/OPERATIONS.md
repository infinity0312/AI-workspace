# v2.0 本机复跑与回退

在仓库根目录运行。已有 DeepSeek 本地配置供真实模型复测使用，合成对照只向模型发送测试资料。

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:e2e -- --output .data/v2-e2e
npm.cmd exec -- playwright test --config audit/evaluation/workbench/playwright.config.ts
npm.cmd exec -- tsx audit/v2-delivery/read-only-shadow.ts
```

本机灰度使用 `AKW_HARNESS_V2_ENABLED=true` 配 `AKW_HARNESS_V2_WORKSPACES`。仅本机隔离可用 `AKW_HARNESS_V2_LOCAL_ALL=true`。新队列选择与初始旗标写入检查点，关闭准入只影响新任务，旧会话仍可查看。在切换代码版本前排空或取消在途任务。现有结构化要求结果是额外 JSON 字段，旧客户端可继续读 `coverage`。本轮 001–012 迁移未改，旧提案证据与版次校验规则沿用。

| 复跑 | 命令及限定 |
| --- | --- |
| 官方发布包 PoC | 在 `.data/v2-harness-poc` 通过 `npm install --prefix` 安装 `@deepseek-ai/dsh-session@0.2.2-rc.2` 和 `@deepseek-ai/dsh-agent-loop@0.2.2-rc.2`，禁用安装脚本。执行 `node audit/v2-delivery/official-session-poc.mjs`。 |
| PostgreSQL | 在 `.data/v2-postgres` 安装 `embedded-postgres@17.11.0-beta.19`，禁用安装脚本。执行 `npm.cmd exec -- tsx audit/v2-delivery/postgres-workers.ts`。脚本仅测试回环 PostgreSQL 上作业所需的 SQL，完整 pgvector 迁移另验。 |
| 对象存储 | 在 `.data/v2-s3` 安装 `s3rver@3.7.1`，禁用安装脚本。执行 `npm.cmd exec -- tsx audit/v2-delivery/s3-put-get.ts`。仅回环模拟器，按请求写入不同前缀和读回，无云端凭证。 |
| Windows | 用 `scripts/windows-env.cmd` 构建，给 smoke 用单独 app identifier 与 EXE 副本，`AKW_WINDOWS_SMOKE_EXE` 指向副本后运行 `npm.cmd run test:windows:ui`。 |
| Android | `npm.cmd run build:android`。安装到独立模拟器后运行 `node audit/v2-delivery/android-offline-smoke.mjs`，默认测试 `emulator-5570`，使用 4202 / 9230 专用端口。仅该模拟器应用会被停止并重启。 |

现场定位覆盖缺口可先看要求面板的「来源／证据／回答／产物」，再点对应证据、正文位置或运行过程。指定来源获取失败时查看按来源列出的结果，可重新提交或导入资料。计划、来源许可或格式有缺口时按任务目标验读正式版本。生产部署参数及回退背景见 [原运维手册](../../docs/engineering/deepseek-harness-migration/OPERATIONS.md)。
