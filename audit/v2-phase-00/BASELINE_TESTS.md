# 本轮测试基线

2026-11-12，在 Windows 10.0.26100 / Node 24.16.0 / npm 11.13.0 复跑。未用正式数据。API 夹具运行 PGlite，Web 采用独立数据库及对象目录并关闭真实模型、通用搜索及向量外发。真实 DeepSeek 测试只向模型发送合成内容，内存数据库与拒绝对象写入的测试存储。原生测试使用既有隔离 EXE 及本次构建的 API。命令运行位置为仓库根目录。

| 命令 | 结果 | 覆盖和边界 |
| --- | --- | --- |
| `npm.cmd test` | implemented，43/43，9.84 s | 证据、角色/项目、幂等/冲突、SSE、预算、取消、检查点、灰度回退等。 |
| `npm.cmd run typecheck` | implemented，通过 | API、Web、Windows、Android 的 TypeScript 检查。 |
| `npm.cmd run lint` | implemented，通过 | ESLint 的 API、Web、Windows、共享契约和客户端范围。 |
| `npm.cmd run test:e2e -- --output .data/v2-phase-00/e2e` | implemented，8/8，31.6 s | 流程含本次 Next/API 构建、离线重连、证据、资料与可组合内容。 |
| `npm.cmd run test:deepseek` | implemented，4/4 | 旧默认真实非思考适配器的即时问答、研究证据/回退、选段提案和分析采纳。返回模型 `deepseek-flash`，7 次计量，2,369 输入与 778 输出 tokens。 |
| `npm.cmd run test:windows:ui` | implemented，通过 | 指向既有 `.data/akw-harness-smoke.exe`。WebView2、SQLite 重开与重连、独立窗口、通知、OCR、LaTeX、时间线、图表、PDF 证据。 |
| Android 真机、实际 PostgreSQL/S3、多 Worker 及压力 | unknown | 本轮未运行，已有 Debug APK 和代码只作为构建/实现证据。 |

## 历史质量基线

[工作台场景结果](../evaluation/WORKBENCH_RESULTS.json) 中，自动化流程 7/7，人工内容检查 4 通过、3 部分通过。本轮保留历史人工基线，没有重新生成七场景、改动历史标注或宣称内容质量提高。四项真实 DeepSeek 合成验证属于本轮执行链证据。

[传输对照](../evaluation/TRANSPORT_RESULTS.json) 历史三次一组的短任务结果为 A 直接请求 972 ms、C 旧适配器 548 ms、E 自研 SSE 853 ms 的中位值；每次 99/5 tokens。样本不能估算长文档、缓存成本或生产吞吐。官方 Runtime B 和多 Agent D/F 尚无有效数据。完整固定输入及人工 rubric 留至 v2.0 Phase 02。
