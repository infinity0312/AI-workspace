# 学习目标工作空间 · Windows 验收

2026-11-14 · Windows 原生 WebView2、隔离 PGlite、真实 DeepSeek

## 用户操作

进入工作台，在「你想学会什么？」填一句话并同意本次外部模型和公开检索。已有基础可选填。系统在同一任务内决定如何查资料、如何安排课程以及哪些视图适合。手动建项目和建文档收进折叠区。

打开学习产物后，从「学习目标」继续下一节。课程含可点击的先修关系、证据链接、LaTeX 推导和适合该课程的选择题。与主题匹配的关系图、论文时间线和路径表可从同一产物切换。选择题提交后立即评分并给出解析。再次追问会追加到同一条版本链，保留原内容和题目未变的作答记录。

## Windows 实测

| 验收项 | 最终实测 |
| --- | --- |
| 原生入口 | 用一句 GNN 与晶体物性目标开始，未创建空白文档或选择工具。提交的工作空间已开启外部模型权限。 |
| 初版生成 | 启动到产物可打开 31.22 秒。4 节课程、4 组公式、4 道练习、9 条来源（含作者教材）。 |
| 视图与证据 | 4 个课程节点与 3 条先修关系。时间线含 7 个预印本节点。切换时间线、打开日期证据和公式显示通过。 |
| 追问 | 6.63 秒后更新相同 Artifact。Revision 2 的父版本为 Revision 1。三原子示例包含 90°、180° 两组构型及两条可验算公式。 |
| 练习和版本 | 正确作答获得 1/1。第二版中原题记录仍可查询，API 验证同工作空间另一用户无法读取。 |
| 回归 | 53 项 API 测试、8 项 Web 端到端测试、3 项 Windows Rust 测试、Windows 原生已有场景烟测、4 项 DeepSeek 通路与类型检查/Lint 通过。 |

[Windows 截图](../../.data/learning-qa/native-rLwSYu/learning-workspace.png) · [初版原始记录](../../.data/learning-qa/native-rLwSYu/initial.json) · [追问和练习记录](../../.data/learning-qa/native-rLwSYu/followup.json)

人工核查对照了 GCN 的节点级任务、MPNN 的图级读出、CGCNN 晶体连接与 ALIGNN 的键角表示。教材由出版页面之外的作者公开页面进入。论文时间线将 arXiv 首次公开年标为预印本年份，期刊版日期需回到刊物核对。Windows 可直接打开正文所附出处。 [Hamilton 教材](https://www.cs.mcgill.ca/~wlh/grl_book/) · [GCN](https://arxiv.org/abs/1609.02907) · [MPNN](https://proceedings.mlr.press/v70/gilmer17a.html) · [CGCNN](https://arxiv.org/abs/1710.10324) · [ALIGNN](https://arxiv.org/abs/2106.01829)

早期测试出现过格式破损、复核后只剩两节、以及把键角错放到线图节点的回答。增加了紧凑重试、低覆盖补全和出处门控。该主题的三原子追问使用基于两个已抓取原始论文、可直接验算的例子。两条中心键等长时，三角形夹角仍可不同。加入第三条距离后，余弦定理能恢复角度。

## 实现和复测位置

| 入口 | 内容 |
| --- | --- |
| [学习工作台](../../packages/client/src/workspace/learning-experience.tsx) | 自然语言入口、阶段状态、基础校准、追问与练习 |
| [任务执行](../../apps/api/src/domain/jobs/learning-execution.ts) | 计划、抓取、超时、复核、版本检查、事务与私人成绩上下文 |
| [课程复核](../../apps/api/src/quality-engine/learning-quality.ts) | 证据索引、公式与练习核验、确定性事实约束 |
| [产物编译](../../apps/api/src/domain/learning-artifact.ts) | 正文、证据、知识节点和版本化派生视图 |
| [学习记录](../../apps/api/src/domain/learning-progress.ts) | 当前用户、具体课程版次与对应题集的练习记录 |
| [Windows 实测脚本](../../scripts/windows-learning-smoke.mjs) | 原生 WebView2、实际模型与七个用户操作断言 |

新增迁移 `014_learning_attempts.sql` 创建个人作答表。历史普通 Artifact 原样可读取。题集内容进入产物版本以支持离线阅读与归档。个人练习进度通过服务端个人查询读取，当前需要联网保存，并未纳入工作空间 ZIP。已有旧数据库启动时执行迁移。回退功能时可保留表和工作区数据。

Windows x64 的 NSIS 和 MSI 构建已生成，验收使用的是本机调试程序与独立 API。安装、签名和自动更新仍待实际发布环境验证。

本轮通用领域的课程质量仍需要更多实测。学习起点只根据用户提供的事实和本产物的已有练习调整，信息不足时从可跳过的先修学习开始。课程内练习只说明对应题目的掌握情况。主线实测以 GNN 和晶体物性为例，未对全部主题或生产负载作通过结论。
