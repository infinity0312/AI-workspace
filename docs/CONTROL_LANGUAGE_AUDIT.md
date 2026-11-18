# Control Language 全项目审计 / 迁移计划

|页面/入口|实施前反模式与用户意图|处理|优先级|
|---|---|---|---|
|knowledge / GraphExplorer|关键词、项目、type、relation、status、focus 六格同权|Search + ContextSelector + 多选Facet + FocusPicker + ViewOptions；活动Token与摘要|P0|
|Artifact / KnowledgeFlow|四字段网格，聚焦等同筛选|与全库共用探索语言，保留对象ID和视图偏好|P0|
|Artifact / Chronicle|粒度/年/搜索/布局四格|Search + 时间窗口 + type Facet；刻度与布局进 ViewOptions|P0|
|Artifact / ProvenanceBoard|来源+关键词两大格|搜索、来源/真实支持状态Facet、Claim Focus、真实数量|P0|
|sources|导入表单先于来源列表；浏览筛选两格|导入折叠按需打开；列表Search + 生命周期Facet + Token + 空结果|P1|
|research|任务创建表单合法，结果无搜索|创建保留；运行记录增加Search/运行状态Facet，绝不映射为知识可信状态|P1|
|maintenance|待复核Select；真实复核为事务表单|浏览状态改Facet；复核表单保留；重复/冲突检测不虚构|P1|
|study|目标/卡片切换，无轻量搜索|Search/状态Facet；每题继续独立交互|P1|
|activity|活动流无搜索|Search + 真实执行状态/日期窗口 + Token，保持错误重试|P1|
|capture inbox|列表状态与整理项目混在field-grid|状态Facet；整理到项目是明确写操作，单独Context控件|P1|
|search|单一全文搜索及已有结果分组|复用；无多Select网格，不引入新查询语义|P2|
|projects|项目索引和封面偏好|项目Context；封面为设备View Options，保留|P2|
|export|格式、文档、revision、diagram|合法配置例外；按格式→范围/版本→视图→执行分组|P2|
|settings、collaboration、source management、structured editor|需校验的创建/编辑/权限设置|合法表单例外，不强行改成Chip|保留|
|knowledge 新建/关系建议/维护|真实POST/PATCH/审核事务|保留分组表单，默认折叠；不挤占浏览首屏|保留|

共享组件路径：`packages/client/src/workspace/explorer-controls.tsx`；样式 `explorer.css`。不得再往浏览区域添加 field-grid。Context/Query/Facet/Focus/View/Selection 各自持有状态，清除筛选不清除项目或焦点。原 URL 已包含 workspace/artifact；仅允许显式分享时加入非敏感实体ID与枚举，不把私有搜索自动写入URL。

已有验收证据见 `QA_VERIFICATION.md`：桌面/平板/手机模拟、Popover 键盘关闭与焦点返回、单选/多选语义、Token 删除、过滤空结果/空数据区分、Revision 不变和 inline 模块回归。来源列表的作者/DOI/日期/URL 搜索、导入折叠、请求失败重试已验证。完整辅助技术与专业视图高级探索仍按规划完成度清单保留未完成状态。
