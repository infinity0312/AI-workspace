# Artifact 渲染审计

`artifact-renderer.tsx` 的 `Readonly<Record<string, ComponentType<BlockRendererProps>>>` 注册表经 Provider 共用正文、proposal、history，未知块保留原数据。现有类型含 paragraph/heading/list/table/chart/image/math、guide_step/task_gap/weather/information、learning_goal/learning_lesson、mindmap/timeline/graph_embed/dependency_graph/evidence_network。

契约：`contracts/src/index.ts`、`workspace-blocks.ts`、`projection.ts`、`learning.ts`。投影 version=1，nodes 有 title/type/description/project/date/evidence/version，edges 有 from/to/relation_type/evidence/status；references 含来源、原文证据、主张和文档。只有 confirmed 关系进入正文投影。日期仅 YYYY/YYYY-MM/YYYY-MM-DD；无区间/约略时间。Claim.status 是原始领域状态，没有逐边支持类型，不可推断 confidence 或 direct_support。

发现：图谱为默认网格且缺节点单击与列表模式；思维导图把所有关系当层级并丢弃非树边；时间视图遗漏无日期节点；证据视图遗漏零证据主张；表格无首列固定与单对象模式。此次在共享渲染层实现，保持领域 schema 不变。思维导图仅以 is_a 归属关系构建层级，其他边和环/多父边显式保留。学习、指南沿用真实领域状态，增加教材/手册排版。

视图偏好与节点位置只写设备存储，不创建 Revision。编辑、AI、冲突恢复保持原流程。导出仍使用现有 Markdown/JSON/PDF/DOCX/ZIP 文本表达；不声称支持图谱矢量或截图导出。Web/Windows/Android 共用实现，真实原生设备/性能验收另列限制。
