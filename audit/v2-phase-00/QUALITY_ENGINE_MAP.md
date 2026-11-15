# Quality Engine、Coverage 与 Retrieval

## 当前覆盖率的真实算法

1. [document-research.ts](../../apps/api/src/runtime/document-research.ts) 取用户填写的 `required_questions` 为 facets；若未填，则取发现计划的 `facets[].label`；二者均无时分母为 0。Schema 最多五项。这是扁平问题数，没有 parent/atomic leaf 层级。指定来源另行验证是否取得可用候选及最终引用。
2. [document-quality.ts](../../apps/api/src/quality-engine/document-quality.ts) 提取可引用正文，过滤图片和只有书目的论文作为文字证据，最多 24 份文本片段与 36 个可选原文摘录。JSON 草稿解析剔除未知 evidence ID、未知 excerpt ID、错误 facet 与不允许的数字改写。原文摘录由程序回填。
3. `approvedAnalysis` 按 `document.verify` 返回的 `approved_claims` 及去重保留主张。 `markCovered` 只认已批准 claim、section 的 facet 与 verdict 的 `answers` 一致的映射。有限的数量类关键词要求答案显式含带数值的原文摘录，未逐一验证问题内全部字段、单位、双方条件和图像。
4. 首轮缺项、无主张或指定来源未引用时，最多做一次面向缺口的补写及复核；已有通过内容保留。 `analysisRequirements` 给每项一个运行内顺序 ID，`supported = targets 非空的项数`，`requested = facets.length`。显式必答项有缺口时拒绝提案；自动规划项有缺口仍可输出带说明的提案。
5. [analysisPatch](../../apps/api/src/domain/document-analysis.ts) 正向把 section/claim 位置映射为 block/evidence ID。Jobs 写入 `RequirementLedgerRecorded` 事件；这是结果投影。覆盖数字早于图片下载、最终 patch 应用和用户采纳。接受提案时没有反向以最终 Revision 重新做 coverage。

**状态 partial。** 现在的算法能阻止显式必答缺项静默写入，但模型漏标、把一项复合问题当作单项、以及图片未落地可导致 Ledger 和正文不一致。上一轮 GW150914 原论文已引用却显示缺项，热泵早期 4/4 漏 B 降幅，均能由现有判定机制解释。v2.0 的 Retrieval/Evidence/Answer/Artifact 四层、强制原子叶分母、最终产物反向核对为 **planned**。 [历史七场景结果](../evaluation/WORKBENCH_RESULTS.json)。

## 证据、修复和检索边界

| 能力 | 状态 | 当前实现及缺口 |
| --- | --- | --- |
| 证据门控 | implemented | Schema/引用作用域/快照与精确摘录由程序验证；提案封存、采纳复核可阻止来源失效或提交冲突。文档/研究/改写有语义核查，执行的是另一个提示而非独立校准模型，开放域蕴含、比较、归因和矛盾完整性仍为 partial。 |
| 修复 | partial | [document-research.ts](../../apps/api/src/runtime/document-research.ts) 可修格式、少量覆盖和证据问题；[selection-review.ts](../../apps/api/src/quality-engine/selection-review.ts) 与 [selection.ts](../../apps/api/src/runtime/selection.ts) 对数字/直接引文、限定词/长度做检查和有限重试；研究走抽取回退。没有统一按缺口类型选择 Operator/重新检索/修解析器并只更新失败字段的路由。 |
| Workspace RAG | implemented | [retrieval.ts](../../apps/api/src/domain/retrieval.ts) 融合关键词/全文排名、可选同配置 pgvector、已审 Claim 和确认边证据回召；按权限、来源状态、外发条件筛选。没有长期会话语义记忆。 |
| 通用 Web | partial | [providers.ts](../../apps/api/src/runtime/providers.ts) 提供 Brave 接入，需 `BRAVE_SEARCH_API_KEY`；[institutional-research.ts](../../apps/api/src/runtime/institutional-research.ts) 在配置后消费。历史七场景 `web_enabled=false`，本次隔离测试也未启用。生产配置与开放域召回表现 unknown。 |
| DOI / URL / 官方来源 | partial | [public-research.ts](../../apps/api/src/runtime/public-research.ts) 从原始目标提取、去重最多三个 DOI，以 Crossref 精确查并核对 DOI，较长摘要优先进入候选。无摘要只可作书目，精确命中不保证引用。用户 HTTPS 走 [public-web.ts](../../apps/api/src/platform/public-web.ts)；Nobel/NIST 路径走 [primary-sources.ts](../../apps/api/src/runtime/harness/primary-sources.ts)。缺统一 provider 合同、原子要求级检索与版本化去重。 |
| 学术、图片和许可 | partial | Wikipedia、Crossref、Europe PMC、OSTI、Commons 等组合。许可和署名在图片候选、Source/Asset 与文档块有持久化；正文写入前还需图片实际下载成功。没有单独的 mandatory visual requirement 或产物层核验；历史记录有一次解码成功，最终图像存在随运行波动。 |

语义检查和 deterministic gate 当前叠加使用。接续阶段应让确定性来源/数值/图片事实驱动 Ledger，再让语义判断检查解释、比较与适用边界。
