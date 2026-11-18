# v2.1 实施前只读审计 · 2026-11-16

基线：main 1dda035 + 用户现有未提交前端与素材；保留后端新增的 inline module 渲染，不恢复旧的八个全局 Tab。检查真实调用链，而非按按钮判断完成。

|视图|实施前状态 / 代码证据|契约与缺口|最小改造|
|---|---|---|---|
|正文|可用；DocumentCanvas → ArtifactEditor → ArtifactBlockView，已有阅读/编辑、Patch/Revision、引用|ArtifactDocument / LocalDocument；不应复制为另一套文档|保留内联；添加当前内容索引与版本上下文|
|Graph|部分；KnowledgeFlow 使用真实 Projection；全库 GraphExplorer 仍六字段 field-grid + 不可交互 canvas|ProjectionNode/Edge 有 type/status/evidence，无节点作者/时间范围|共享探索控件和真实 ReactFlow 画布，分离 Context/Focus/Filter|
|Timeline|部分；Chronicle 纵/横编年；四大字段网格|event_date 仅 YYYY/MM/DD 精度，无 approximate/range；不能推断|日期窗口、同日分组、时期索引、真实 type 轨道|
|Mind Map|部分；hierarchyProjection 仅反转 is_a，保留环/多父关系|只支持明确 is_a，不能强制树化 related_to|大纲/局部、展开层级、来源检查器|
|Dependency|通用替代；借用 KnowledgeFlow 且错误包含 derived_from|depends_on 才是依赖；无 task status / critical path|专属层级、环检测、前置/当前/后续列表；不宣称关键路径|
|Evidence|部分；ProvenanceBoard 已三列真实引用链|WorkspaceReferences，有 Claim.status 无逐边充分性；无 Passage 实体|来源/状态 Facet、活动条件、Claim focus、线性详情、无数据区分|
|Table|部分；ComparisonSheet 真实 rows、sticky、缺值|tableAttrs 只有字符串行，单位/时间/证据未独立结构化|保留原值；显示数据口径限制；不提供无依据排序或推荐|
|Chart|部分；canvas + shared buildChartScene、图例、数据表|chartAttrs 只有 x/y/series/labels，无 uncertainty/method/source 字段|主题 SVG、可键盘点选、Inspector；明确字段缺口，不编造误差|
|Learning / Guide|已有专属块、独立题目与评分、编号步骤|复用 learning/guide 契约及引用，不新建平行模型|保持内联与独立交互，纳入 Lab 和回归|

API：`GET /artifacts/:id/projection`；`GET /knowledge/graph?workspace_id`；现有 Evidence / Source Reader；写操作仍由 Artifact Patch/Revision 和 Knowledge Proposal 服务承担。selectProjection 只取 confirmed，正式文档不混入建议。全库浏览可见全部状态，必须标注建议。

缓存：useArtifactProjection 原以 artifact 为存储键；revision 触发刷新但无快照版本标记。需要兼容版本化缓存封套、请求复用、离线显示缓存 Revision。错误/403 不得伪装无数据。

Renderer Lab：原先没有。需独立开发路由，明确 synthetic 标记，复用生产 Renderer，无生产写入。

基线截图：`outputs/v2.1/screenshots/graph-before-1440.png`、`graph-before-390.png`。其余视图的前版截图见既有 asset-repair/page-previews 与测试夹具；不把这些旧截图视为 v2.1 验收。当前用户数据不足以证明全部 Renderer，后续通过明确标记的隔离 fixture 验证并另附真实路由。

本文件是实施前状态记录，不代表最终 Gate 全部通过。代码/API 映射与图谱运行已有证据；全部视图的改造前截图未齐。缺失字段列为数据边界，前端不推断。最终完成度见独立清单。
