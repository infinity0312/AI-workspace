# AI Knowledge Workspace 升级实施与验收

2026-11-14 · Windows 本机和隔离测试环境

本文对应《AI Knowledge Workspace 全面问题审查与升级规划书 v1.0》。阶段结论以本轮源码、实际测试和留存数据为准。模型运行结束只表示产生了结果或明确失败。事实准确性、任务覆盖、来源定位和最终版次另行验收。

## 阶段记录

| 阶段 | 实施、影响与验收 | 放行范围和剩余缺项 |
| --- | --- | --- |
| 00 现状审计 | 对照既有架构和 v2 工作台样本，沿入口检查 Sync、Jobs、Runtime、Quality Engine、证据和投影。现有同工作空间写入持有行锁。源码未证明已经发生设备序号竞态或漏事件。覆盖账本把前置状态未完成的引用块计为完整的问题可直接复现。Git 当时没有 HEAD，项目树为未跟踪状态，无法给出可追溯提交或提交级 diff。 | 本机实施通过。生产事件错序频率、线上检索覆盖率和真实使用分布为 unknown。 |
| 01 一致性与质量 | 设备单调序号、版本保存、幂等回执和 outbox 同事务。推送只确认变更，拉取分页和快照用工作空间共享锁；本地游标只向前。质量门控检查来源、证据、回答和最终产物四项，采纳时检查实际引用和图像元数据。已有正式版次继续读取。加了重复提交、旧序号拒绝、阶段缺口和无对应产物检查。选段改写额外补上空回复修复，明确的普通文字替换直接按指定单词执行。 | 本机通过。两个 PostgreSQL 连接池验证同 mutation 只产生一条提交事件。需要实际设备在弱网下并发跑长时间同步。 |
| 02 Runtime | 增加可选的加密回合日志。模型用量、余额、回合响应和事件同事务写入并校验租约。工具结果落盘后，重领 Worker 还原消息顺序并重新校验授权。完成、失败、取消或达到重试上限时清理记录。 | 模拟中断和续跑通过。提供方已接收请求而本地尚未取得完整有效响应时仍可能重发。实测工具为只读。重领时用户可看到再次进入步骤的进度。租约故障仅做本机验证，尚无生产流量对照。 |
| 03 研究检索与质量 | 必需原始来源优先保留多个证据片段。增加诺贝尔奖官网协作资料与讲稿、NIST 标准对照、Commons 署名肖像候选和合法缩略图主机。针对已知标准的规则可绑定原文页码并核对双边构造。模型复核输出的无效引用逐项丢弃，KMAC 标准出处另有防误归门控。七个固定场景通过真实 DeepSeek 与浏览器重跑，内容结果见下表。 | 这些限定任务可复测。通用搜索广度依赖可用的搜索供应方。本轮未建立论文版本冲突、多文档反向证据、复杂公式等扩展样本的规模化人工评分。专用连接器和运算规则覆盖有限。 |
| 04 知识产物与视图 | 分析提案追加证据网络视图，连接当前版次中的 Claim、Evidence 和正文块。对已改写或删除的块，视图通过新投影移除旧正文定位。正文、图谱、时间脉络、思维导图、依赖图、LaTeX 和导出延续共享渲染与结构化数据。 | 引用定位、编辑刷新、组装及导出已做本机验证。按场景自动生成时间线、概念关系、对照矩阵及跨视图冲突检查仍缺完整闭环。 |
| 05 用户流程 | 首页自然语言入口，快速了解、系统学习、深度研究和读者级别。快速回答由用户保存为普通可编辑笔记，重复操作返回同一笔记。文档生成用计划生成器拆分检索问题，通过账本查看证据与缺项；启动前显示按模式变化的流程预览。 | 本机流程可用。启动前的预览是模板，目标驱动的计划目前在运行内生成。开跑前的逐条编辑、自动选择任务模式和完整新手引导未验收。 |
| 06 工程和多端 | 本地 PostgreSQL 17.11 双池执行 48 条隔离作业、同设备重复提交、落后序号拒绝和租约重领。本地 S3rver 对象写读、缺键和复制通过。浏览器、原生 WebView2 与 Android API 36 模拟器验证本地工作台和离线同步。 | 生产门槛未放行。真实 pgvector 迁移、云对象存储与数据库联合备份恢复、容量和监控阈值、Android 真机、三端同时并发和弱网仍未实测。 |
| 07 Orchestrator 与 Multi-Agent | 保留单 Agent 的类型化检查点、并行资料发现和受限只读工具。复测给出单 Agent 基线。 | 规划要求先量化质量、时延或成本收益。多 Agent 实验、Factory、冲突仲裁和上线路径尚未交付，当前材料无法证明收益。 |
| 08 学习和生态 | 文档可直接打开预选关联文档的复习卡表单，沿用私人卡片、评分和下次复习排程。既有批注、审核、归档恢复和跨项目授权由相关回归覆盖。 | 用户确认的可迁移长期记忆、题库自动生成、团队协同扩展、新增导入导出格式、macOS 与 Harmony 适配仍未交付。 |

## 关键文件

| 模块 | 主要变更 |
| --- | --- |
| [Sync](../../apps/api/src/domain/sync.ts)、[授权与 outbox](../../apps/api/src/domain/access.ts)、[客户端缓存](../../packages/client/src/lib/local-repository.ts) | 推送回执、单调序号、分页边界与单调游标 |
| [需求账本](../../apps/api/src/quality-engine/requirement-ledger.ts)、[采纳与正式版次](../../apps/api/src/domain/artifacts.ts) | 阶段依赖、证据与正文对应、图像和事实块 |
| [013 迁移](../../apps/api/migrations/013_runtime_journal.sql)、[加密日志](../../apps/api/src/runtime/harness/journal.ts)、[运行循环](../../apps/api/src/runtime/harness/loop.ts)、[模型结算](../../apps/api/src/domain/jobs/model-invocation.ts) | 消息恢复、事务结算、授权和租约 |
| [研究来源](../../apps/api/src/runtime/harness/primary-sources.ts)、[通用资料聚合](../../apps/api/src/runtime/public-research.ts)、[研究算子](../../apps/api/src/quality-engine/research-operators.ts) | 标准与机构证据、指定肖像、语义与确定性检查 |
| [投影引用](../../apps/api/src/domain/workspace-references.ts)、[证据网络](../../packages/client/src/workspace/reference-views.tsx)、[生成文档提案](../../apps/api/src/domain/document-analysis.ts) | 正文锚点、稳定 ID 和证据反向定位 |
| [独立研究](../../packages/client/src/workspace/research-page.tsx)、[文档分析](../../packages/client/src/workspace/document-analysis.tsx)、[学习](../../packages/client/src/workspace/study-page.tsx)、[任务与保存接口](../../apps/api/src/domain/jobs.ts) | 自然语言入口、读者层次、保存及复习 |

## 用户场景与内容验收

| 场景 | 产物和实测结果 | 内容判定 |
| --- | --- | --- |
| 居里夫人 · 18.23 秒 | Revision 2。四个文本分项覆盖；另有已解码的 Henri Manuel 肖像和 CC BY 4.0 许可。 | 两次奖项及理由可追溯，区分贝克勒尔的发现、居里夫妇共同研究、与贝蒙合作发现镭，以及与德比耶纳合作分离金属镭。中文解释附有英文原文。 [诺贝尔奖官方资料](https://www.nobelprize.org/prizes/themes/marie-and-pierre-curie-and-the-discovery-of-polonium-and-radium/) · [皮埃尔·居里讲稿](https://www.nobelprize.org/uploads/2018/06/pierre-curie-lecture.pdf) · [肖像及许可](https://commons.wikimedia.org/wiki/File:Portrait_of_Marie_Curie_(1867_-_1934),_Polish_chemist_Wellcome_M0000113.jpg) |
| SHA-256 与 SHA3-256 · 12.18 秒 | Revision 2，3/3。两份标准及消息认证机构资料已引用。 | 两种算法的输出长度、消息分块和 KECCAK 原文、协议指定算法时的校验边界、消息认证的共享密钥均已交付。构造的中文入门解释仍偏短，证据页中的公式沿用 PDF 解析文本。 [FIPS 180-4](https://csrc.nist.gov/pubs/fips/180-4/upd1/final) · [FIPS 202](https://csrc.nist.gov/pubs/fips/202/final) · [NIST 消息认证资料](https://csrc.nist.gov/projects/message-authentication-codes) |
| 住宅热泵 · 6.11 秒 | Revision 2，显式必答项 4/4。 | 两组温度、准确降幅、同等供热下的电阻加热基线都保留，并交代了缺乏横向比较及冰点外推依据。正文主要由英文逐字摘录构成，未达到完整中文讲解。 |
| GW150914 · 15.17 秒 | Revision 2，账本 4/4。原始 DOI、百科背景和可显示图像均在。 | 可以追溯同时观测、波形解释和模型比对。摘要与百科的区分有体现；大学新生所需的术语解释仍有限。 [原始论文](https://doi.org/10.1103/PhysRevLett.116.061102) |
| 空资料库 · 4.60 秒 | 返回 `ANALYSIS_NO_EVIDENCE`，保留原文档。 | 通过拒答要求。没有虚构设备、数值或提案。 |
| 取消并刷新 | 状态 `CANCELLED`，Revision 1。刷新重放了取消状态。 | 通过。取消后没有迟到提案。 |
| 带引文改写 | 扩大适用范围并引入比例的改写被拒。保留原限定的改写确认后由 Revision 1 进入 2，证据 ID 保留。 | 通过。中文精简与恶意改变事实均使用界面走完。 |

原始样本、请求、覆盖账本、提交前后状态和证据定位保存在本机 `.data/upgrade-v1/acceptance/*.json`。这些样本记录为验收数据。WorkBench 脚本会验证运行、界面和提案路径。本轮复核了 SHA 构造、获奖归因、热泵条件与论文摘要的实际文本和来源。单次样本不足以建立精度、完成率或成本的生产阈值。

## 测试和成本

- `npm.cmd test` 验收 API、租户授权、编辑冲突、投影引用、证据隔离、账本、Runtime 中断与提案。最终 51 项通过。
- `npm.cmd run typecheck` 和 `npm.cmd run lint` 通过。
- `npm.cmd run test:deepseek` 四条路径通过。初次运行暴露了选段结果被空串替换，修复后即时回答、研究证据、选段提案及正式分析均通过。实际调用 8 次，合计 4,757 tokens。
- `npm.cmd run test:e2e -- --output .data/upgrade-v1/e2e-final` 在隔离本机库通过 8 项，含证据网络跟随版次、LaTeX、图谱、文档到复习卡和离线编辑。
- `npm.cmd exec -- playwright test --config audit/evaluation/workbench/playwright.config.ts` 在独立目录和端口运行真实 DeepSeek 七场景。建议将 `AKW_QA_OUTPUT_DIR` 指向新目录来保留基线。使用 `AKW_QA_WEB_PORT` 与 `AKW_QA_API_PORT` 隔离已有服务。
- `npm.cmd exec -- tsx audit/v2-delivery/postgres-workers.ts` 通过。48 个作业本轮内执行约 162 ms，未包含检索、模型、连接启动或云网络。
- `npm.cmd exec -- tsx audit/v2-delivery/s3-put-get.ts` 通过本地对象存储写读、哈希校验与复制。
- Windows 编译使用 `scripts/windows-env.cmd` 加载本机 MSVC 和 Rust，随后 `npm.cmd run test:windows:ui` 通过 WebView2 烟测，包括 SQLite 离线重启、补同步、新窗口、IPC、OCR、公式、时间线和 PDF 页定位。
- `npm.cmd run build:android` 成功。Android API 36 模拟器运行 `audit/v2-delivery/android-offline-smoke.mjs` 通过原生 SQLite、离线保存、强制结束后重开和补同步。该结果对应本轮构建的 APK。
- 回合日志增加模型结算事务内一次写入和一次工具日志事务。图片下载受固定主机、1 MB 上限及内容检查约束。安卓构建报告共享界面主包约 1.55 MB，gzip 后约 0.48 MB。未测线上 P95、用户编辑距离、使用成本或真实长尾召回。

## 数据迁移、安全与回滚

- 先运行 `npm.cmd run migrate`。013 只创建以会话为外键的表，无历史回填。前端为旧投影响应保留兼容逻辑。旧幂等条目可能继续回传旧版附带游标，当前客户端仅通过拉取路径更新游标。相同键、相同输入保留原提交结果。
- `AKW_RUNTIME_RECOVERY_KEY` 是可选的 32 字节密钥，以 64 位十六进制字符配置。启用消息恢复时，所有同一数据库的 Worker 需使用同一密钥。备份使用独立密钥托管。更换密钥前需排空仍待恢复的会话。同一 session、invocation、round 和 entry 被绑定到 AES-GCM 认证数据。公开进度输出保留事件类型和计数。运行中的恢复载荷仅供 Worker 解密。
- 热回滚时先停止新增灰度任务并排空或取消活动会话，再撤掉恢复密钥或关闭 Harness 灰度。保留添加的迁移表和既有文档。只有回滚到不访问日志表的代码后才能考虑删表。已接纳版次沿用版本恢复、回收站及归档机制。
- 样本库、模型请求和对象目录均用隔离测试数据。线上合同、流量、真实用户私有内容、密钥和生产存储没有参与验收。数据库临时集群测试只应用所需表，应用归档恢复测试独立于生产备份恢复。
- 外部检索保留 URL、DNS/网络及文件类型边界。来源文本始终按资料处理。联网材料保留来源与署名，正式文档由用户采纳。未进行外部服务安全测试。此前用户发出的访问密钥未写入此报告或样本。
