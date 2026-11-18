# Atelier Atlas v2.1 前端实施报告

2026-11-16；代码基线 `main@1dda035`，保留原有未提交工作与全部素材。没有提交或推送 GitHub。规划书是验收依据；没有执行其中与本次前端任务无关的发布、联系他人等动作。

## 结果与入口

保持最新后端的“生成模块内联到 Artifact”架构。正文内容索引只定位已有块，不恢复旧的八视图 Tab，不创建第二份 Artifact。开发原型在 `/renderer-lab`，明确标为 synthetic fixtures，无生产写入；生产构建默认 404，只有开发或 `AKW_RENDERER_LAB=1` 的验收构建可访问。

## 按规划书落地

|章节|实施与证据|
|---|---|
|01 / 审计|`ARTIFACT_RENDERING_GAP_ANALYSIS.md` 记录真实组件、契约、责任与基线；`CONTROL_LANGUAGE_AUDIT.md` 扫描浏览表单及事务例外|
|02 / Shell|原 Artifact Header、保存/Revision/离线、Edit/Export 继续复用；新增 `document-canvas.tsx` 内联内容索引，节点/证据回调进入已有知识页与 Source Reader|
|03 / Tokens|沿用 Atelier Light/Dark，新增图表与动效 Token；没有再造主题；自动计算 ink/muted/brand/warning 对 surface 的对比度|
|04 / Graph|`knowledge-flow.tsx` 为内联与全库共用 Focus Atlas；确定性布局、自定义边界连线、节点形态、关系方向与真实审核状态；局部展开/历史、拖动仅设备偏好；按真实 type 分类；索引分页；70 节点画布上限明确显示完整节点/关系计数|
|05 / Timeline|`chronicle.tsx` 实现纵向、横向编年索引、真实 type 轨道、时期概览；同日聚合、年/月/日精度、独立 Unknown 区；日期窗口与即时筛选|
|06 / Mind Map|只将 is_a 反转用于父→子视觉遍历；多父、环及其他关系保留交叉索引；大纲/图形、一级展开/全部展开/回根/折叠、搜索、来源回调；编辑态新增分支、建议确认与撤回、显式节点范围更新经 Artifact Revision 保存|
|06 / Dependency|独立 `dependency-view.tsx` + 纯 `dependency-layout.ts`；只使用 depends_on；SCC 环检测、环组圆形构图和 DAG 分层；前置→当前→后续详情；手机线性列表|
|07 / Evidence|`provenance-board.tsx` Source→Evidence→Claim；状态来自后端 Claim；来源/支持状态 Facet、Claim 聚焦、Inspector、正文与原文定位；缺证据/不可读取明确展示|
|08 / Table|真实行列、sticky 首列、隐藏维度、单对象模式、原值/空值、可键盘单元格详情；不对口径未知的字符串做排序或推荐|
|08 / Chart|共享 buildChartScene 输出主题 SVG；三种真实图表契约、原始数据表、系列开关、键盘数据点详情；坐标轴保留变量/单位；邻接来源引用|
|09 / Editor|既有 RichText / Patch Diff / Revision / Unicode 选区 / 撤销链与 Outbox 不改写；本轮 E2E 复核正文编辑、离线重连、引用刷新、版本导出|
|10 / Assets|复用已有 30 张核验素材与 65 个响应式 WebP 变体及 manifest；只用于封面/空状态/低对比背景；没有用位图替代知识数据|
|11 / Foundation|保留 BlockRendererRegistry；ProjectionViewRegistry 负责现有投影专用视图；统一 EntityInspector、原文/节点桥接；Projection 存储键含 Artifact+Revision，内存键加同步 epoch，共享同版本请求；未知类型保留数据回退|
|12 / Responsive|1440/1280/768/390/360、Light/Dark；手机 Facet 横向条、筛选/详情 Bottom Sheet、Graph 局部+列表、MindMap 大纲、Dependency 线性、Table 横向/单对象；Reduced Motion；原生 dialog 焦点管理；从弹层打开原文/证据时先关闭顶层，再交接到真实检查器|
|13 / Casebook|只提取局部图、字段驱动视图、统一实体身份、时间分组、定制节点等原则；未复制品牌、代码或素材。参见 [Obsidian graph](https://obsidian.md/help/plugins/graph)、[Kumu focus](https://docs.kumu.io/guides/focus)、[React Flow custom nodes](https://reactflow.dev/learn/customization/custom-nodes)、[Aeon timeline](https://help.aeontimeline.com/article/8-timeline-view)|
|14–17 / QA|Renderer Lab、截图矩阵、域测试、生产工作流回归、性能与对比度 JSON、变更清单/备份；独立审查报告另附|
|18 / Control Language|`explorer-controls.tsx` 统一 Search / Context / Facet / Token / Focus / ViewOptions / Advanced Draft / Summary / EmptyResult；Graph 为样板；Timeline、Evidence、Source、Research、Maintenance、Learning、Activity、Capture 已迁移|

## 控件状态与迁移边界

浏览型 field-grid 已从 GraphExplorer、KnowledgeFlow、Chronicle、Evidence 与 Source 列表移除。Research 创建、导入、关系建议、节点编辑、权限和导出是有校验/事务边界的表单，按任务展开保留。导入、研究与知识创建收起后，浏览内容先出现。

清除筛选保留项目上下文和焦点；取消高级筛选丢弃草稿。图谱链接仅在用户点击“保存视图到链接”后写入实体ID/枚举/模式，验证实体存在，保留原 workspace/artifact；不自动把私有搜索写入 URL。

过滤为空、数据为空、正在加载、请求失败、离线缓存分别呈现。正式 Artifact selectProjection 只接受 confirmed；全库浏览默认全部状态且明确标注待审核与拒绝，不能把建议误当已确认知识。

## 数据契约边界（不伪完成）

- Projection 只有 `event_date`，没有 approximate/range/topic，故不推断近似日期、跨度或虚构主题轨道；横向模式明确是编年索引，间距不暗示真实时间差。
- 没有任务完成字段或已验证关键路径数据，不画任务进度或“关键路径”。没有逐条 evidence→claim 支持/反驳类型，争议主张并列保留全部关联材料，不擅自划分充分性。
- Table 为字符串 rows；Chart 为 x/y/series/labels。逐单元格/逐点 evidence、误差/方法、预测/测量标识等尚无专用字段；页面显示缺口，块级引用仍能打开。相关图型（误差带、箱线等）不会凭空启用。
- 当前 Projection API 是随知识域变化的实时投影。缓存绑定 Artifact Revision 可以防止错用文档版本，但不等于后端已经支持历史图谱快照重放。
- 结构编辑通过现有节点/关系建议/确认与撤回工作流。关联现有节点会保留旧父关系为交叉引用，不冒充原子重挂。操作回执跨本次组件/Revision 刷新保留，尚未实现浏览器重载后的持久历史；分支级原子重挂与 Patch Undo 仍待领域支持。

## 验证和发布判定

最终完整运行 **26 项 E2E、69 项单元测试** 通过，四端类型检查、Lint、Web/API 构建通过；Windows / Android 前端 Vite 构建通过（未生成或验收原生安装包）。E2E 包含真实组件与本机 API 路由工作流、原文/正文焦点交接、结构建议确认撤回、双主题五断点及大图样例。最后一次视觉比较没有更新基线，28 张已登记基线通过。具体命令与记录见 `QA_VERIFICATION.md`。截图来自运行组件，合成样例均有标识。

性能记录是 Windows Headless Edge 的合成 200 nodes / 400 edges：画布上限 70，完整统计/索引保留全部数据。`performance.json` 的 render_ms 是密集数据切入时间，fps 是拖拽窗口的 rAF 采样，heap 是浏览器 JS heap；不能外推为 Android 真机指标。Android 真机、用户试用与服务端灰度属于发布前实机验收，不标记为已完成。

本轮开发期间原工作区 API 出现 PGlite 启动故障，真实数据库预览尚未恢复；未删除、重置 WAL 或替换原数据库，已留存逐文件哈希一致的副本。本轮创建的重复 watcher 与预览服务已停止。另已使用独立目录、显式环境白名单和 GET 请求验证本地空工作区并正常关闭。此前停止的预览进程无法完整重建历史有效环境，不能据现有记录承诺历史远端零写入。详情由主代理单独记录于 `环境状态说明.md`，不属于子代理规划完成度核对。

本轮前端改造已接入项目，可供查看与继续验收；**整本规划书仍为部分完成**。除数据契约、真实工作区、真机/读屏与灰度验收外，部分高级探索和编辑条目也未完成。逐项状态以 `INDEPENDENT_BLUEPRINT_REVIEW.md` 为准，不标记全部规划或 Production-ready Gate 通过。

## 回退

`outputs/v2.1/change-manifest.json` 记录逐文件实施前/后 SHA256；`backup/` 为覆盖前原文件。恢复时先验证目标路径在项目根内、验证文件仍为本轮 after 哈希；只恢复本轮改动，保留用户原有未提交内容。新文件可在哈希一致后移入备份目录，不用 git reset --hard。不要整体恢复旧前端而丢失 1dda035 的内联模块改动。

本机投影视图可将 `localStorage['akw-renderer-flags']` 对应 kind 设为 false 后刷新，保留正文和数据索引回退。这是设备回退开关，不冒称已经实现服务端分用户灰度。资源与 UI 偏好不进入知识 Revision。
