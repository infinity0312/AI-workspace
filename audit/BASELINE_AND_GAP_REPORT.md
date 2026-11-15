# Phase 02 基线与根因

现有 Runtime 的 API 回归 32/32，真实 DeepSeek 选段改写 1 次、99 输入和 5 输出 tokens、约 1.0 秒，诊断路径含旧适配器、Jobs 和 Artifact。另有上一轮工作台四个主题及改写人工核对。居里夫人缺指定官网和准确归因，SHA 缺原始标准与比较理由，双工况热泵缺第二组，空资料拒绝合理，改写缩短时遗漏「室内」。

现有证据将问题分为检索范围/来源选择、计划分母、证据核查和语义不变量。模型是否为主因仍需控制变量。24 条基线目录同时列明可用的已有回归和差距。同一个固定提示的选段请求使用 A 直接模型请求、C 旧适配器、E 新 SSE 适配器。每组运行三次，全部精确输出，单次 99 输入与 5 输出 tokens。中位时长 A 972 ms、C 548 ms、E 853 ms。这里只对照模型传输和短任务行为，完整工作台用例另行验收。官方 B 未运行；D/F 多 Agent 未采用。

复现与证据：

- 用例目录 `evaluation/CASES.json`。
- 传输对照 `scripts/compare-harness-transport.ts` 与 `evaluation/TRANSPORT_RESULTS.json`。
- 工作台复跑 `evaluation/workbench/playwright.config.ts` 与 `evaluation/WORKBENCH_RESULTS.json`。
- 发布判断按场景逐项核对最终正文、指定来源和版本安全。合成输入的时长和自动覆盖率不替代人工内容验收。
