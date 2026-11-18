# 首批20项素材：生产记录

A方向已由用户选择。20项均独立生成，保留20个PNG原图、60个192/384/768px响应式WebP与20份实际提示词。19项包含Alpha，纸纹按用途不透明。没有整页生成图，没有把图谱或图表烘焙进素材。

|素材ID|实际使用|状态|
|---|---|---|
|aa_learning_botanical_01|workspace-home.tsx / 首页默认标本；document-canvas.tsx / 学习文稿边注；atlas-art.tsx / learning-folio 别名|实现代理视觉检查通过；未记为用户逐图批准|
|aa_graph_mineral_01|workspace-home.tsx / 主要近期成果；atlas-art.tsx / comparison-empty 别名|实现代理视觉检查通过；未记为用户逐图批准|
|aa_home_compass_01|workspace-home.tsx / 首页可切换标本；atlas-art.tsx / search-empty 别名|实现代理视觉检查通过；未记为用户逐图批准|
|aa_dependency_instrument_01|dependency-view.tsx / 依赖图页首；research-page.tsx / 研究页首；atlas-art.tsx / error、research 别名|实现代理视觉检查通过；未记为用户逐图批准|
|aa_document_notebook_01|document-canvas.tsx / 普通文稿边注；workspace-home.tsx / 无近期成果；atlas-art.tsx / collection、offline、guide 空态别名|实现代理视觉检查通过；未记为用户逐图批准|
|aa_evidence_archive_stamp_01|provenance-board.tsx / 有主张或引用时页首；实体装饰，不表示通过审核|实现代理视觉检查通过；未记为用户逐图批准|
|aa_evidence_manuscript_01|provenance-board.tsx / 无主张且无引用时页首；atlas-art.tsx / evidence-empty 别名|实现代理视觉检查通过；未记为用户逐图批准|
|aa_global_cartographic_ornament_01|search-page.tsx / 搜索页首；采用重生成v02单一风向玫瑰|实现代理视觉检查通过；未记为用户逐图批准|
|aa_global_ink_texture_01|art-direction-v31.css / 文稿起始8px细分隔|实现代理视觉检查通过；未记为用户逐图批准|
|aa_global_paper_grain_01|art-direction-v31.css / 文稿边缘，97%底色覆盖的低对比纸纹|实现代理视觉检查通过；未记为用户逐图批准|
|aa_graph_contour_01|knowledge-flow.tsx / map、index 页首|实现代理视觉检查通过；未记为用户逐图批准|
|aa_graph_mountain_01|knowledge-flow.tsx / clusters 页首|实现代理视觉检查通过；未记为用户逐图批准|
|aa_home_atlas_fragment_01|workspace-home.tsx / ProjectsPage 页首|实现代理视觉检查通过；未记为用户逐图批准|
|aa_learning_fossil_01|study-page.tsx / 复习卡页首|实现代理视觉检查通过；未记为用户逐图批准|
|aa_learning_seed_capsule_01|study-page.tsx / 学习目标页首；atlas-art.tsx / learning-empty 别名|实现代理视觉检查通过；未记为用户逐图批准|
|aa_mindmap_branching_01|specialized-projection.tsx / 思维导图页首；atlas-art.tsx / mindmap-empty 别名|实现代理视觉检查通过；未记为用户逐图批准|
|aa_scientific_mica_01|chart-block.tsx / 科学图表标题旁，位于数据绘图区外|实现代理视觉检查通过；未记为用户逐图批准|
|aa_sources_book_spine_01|sources-page.tsx / 来源库页首|实现代理视觉检查通过；未记为用户逐图批准|
|aa_timeline_astronomical_01|chronicle.tsx / 编年、横向、轨道页首；atlas-art.tsx / timeline-empty 别名|实现代理视觉检查通过；未记为用户逐图批准|
|aa_timeline_strata_01|chronicle.tsx / 时期概览页首|实现代理视觉检查通过；未记为用户逐图批准|

配对实显见 final-screenshots/assets-light-dark.jpg：每项在浅纸色与深墨色底以约160px检查。原图用于检查完整主体，网页用优化尺寸。地图装饰v01含多余枝条，已退回并重生成单主体v02；生产目录只收最终版。每项详细参数、生成工具、日期、用途、提示词路径、文件大小、审核与许可说明见 PRODUCTION_ASSET_MANIFEST.json。

共享客户端资产放在 packages/client/src/assets/art-direction/v3.1，供Next、Windows与移动端打包器共同引用；按module与category记录分类，避免复制到三个平台的public目录。docs/art-direction/v3.1保存研究、清单、截图与审核。原先30项素材仍保留供用户显式封面选择和回退，不把旧整景当作新素材成果。
