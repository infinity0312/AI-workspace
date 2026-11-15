# Phase 00 运行基线

审计日期 2026-11-12。基线来自 `F:\ai-knowledge-workspace` 当前源文件。分支为 `main`，无 Git 提交，源文件哈希见 [指纹清单](SOURCE_MANIFEST.sha256)。

## 可复现成功与失败

从项目根目录执行：

```powershell
npm.cmd exec -- tsx --tsconfig apps/api/tsconfig.json audit/scripts/phase-00-diagnostic.ts
npm.cmd exec -- tsx --tsconfig apps/api/tsconfig.json audit/scripts/phase-00-diagnostic.ts --live
```

默认命令执行两个固定 HTTP 供应商响应的场景。第二条命令额外调用一次已配置的 DeepSeek，只提交合成的选段替换任务。每个场景创建临时内存 PGlite，使用实际 Nest HTTP 路由、任务入队、Worker 的 `Jobs.next`、DeepSeek 请求适配、响应门控及 Artifact 服务。临时服务监听回环随机端口，对象存储为拒绝读写的桩。运行结束后关闭 API 和数据库。输出允许列表仅含运行状态、完成原因、版本、耗时、用量和审计标识。

| 场景 | 结果 | 审计证据 |
| --- | --- | --- |
| `fixture_stop` | HTTP 202，`COMPLETED`，`stop`。一份提案，采纳前为版本 1，采纳后为版本 2。 | 39 ms，总计 40 输入和 6 输出 fixture tokens。 |
| `fixture_length` | HTTP 202，供应商信封中的文字可解析为 JSON，但 `length` 被拒绝。运行 `FAILED`，`PROVIDER_OUTPUT_TRUNCATED`，质量码 `Q008`。零提案，保留版本 1。 | 23 ms，总计 40 输入和 6 输出 fixture tokens。 |
| `live_deepseek` | 真实 `deepseek-flash` 选段通过，`stop`。一份提案，用户采纳后文档到版本 2。 | 单次调用 1,107 ms，入队到 Worker 返回 1,134 ms，99 输入和 5 输出 tokens。 |

运行 ID、上下文摘要和事件顺序见 [脱敏记录](PHASE_00_RUN_EVIDENCE.json)。时间为本次样本，fixture 耗时与真实网络延迟不可比较。

## 本次执行的回归

| 命令 | 本机结果 |
| --- | --- |
| `npm.cmd test` | 32 项通过。覆盖作用域、版本、证据、模型完成原因、无证据失败和租约恢复。 |
| `npm.cmd run typecheck` 与 `npm.cmd run lint` | API、Web、Windows、移动端类型检查及 Lint 通过。 |
| `npm.cmd run test:e2e` | 8 项通过。脚本启动隔离 API 与 Web 并构建应用，覆盖编辑同步、来源证据、授权和 Workspace 视图。 |
| `npm.cmd run test:deepseek` | 真实问答、研究证据或摘录降级、改写采纳、分析采纳均通过。本次为 `deepseek-flash` 9 次，3,029 输入和 799 输出 tokens。 |
| `npm.cmd run test:windows:ui` | 以已有隔离桌面构建测试，WebView2 通过。包括 SQLite 离线重启和同步、OCR、PDF 引用、LaTeX、图表和时间线。 |

## 上轮工作台的真实内容样本

以下为已存在的 `.data/quality-acceptance` 记录。本阶段将它们用于定位缺口，新的诊断未重跑这些主题。自动覆盖率来自当次检索计划。

- 居里夫人样本 `curie.json` 完成并写到版本 2，自动覆盖 2/5。缺指定官网，准确获奖理由的自动判定与人工核对不符。
- SHA 对照 `hash.json` 完成并写到版本 2，自动覆盖 4/5。缺 NIST 原始标准和完整对照解释。该轮通用网页搜索未启用。`hash_with_standards.json` 中两份 URL 导入未通过本机公网地址校验。
- 两组热泵试验 `conditions.json` 完成并写到版本 2，自动覆盖 1/5。只留下第一组，未解决第二组和低温外推。`absent.json` 的空资料库正确返回 `ANALYSIS_NO_EVIDENCE`。
- `edit.json` 无据增加节电比例被拒绝。合法缩写写入版本 2 时引用保留，但人工发现遗漏「室内」限定。

Phase 00 的成功和失败复现已达标。跨主题人工金标、同一输入的供应商/工作流对照、成本与尾延迟统计留给后续实验。当前数据足以识别问题，尚无法把问题归因为模型或 Harness 中的单一环节。
