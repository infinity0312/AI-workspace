# 素材补交与逐项对照

交付日期：2026-11-16。上一轮只制作 HOME-02，不满足交接包的模块粒度；本次按两份提示词库补齐并接入。

- 已采用 **30 张独立原图**：上一轮 1 张 + 本轮新增 29 张；其中 10 张独立竖幅构图（首页 1 张、9 类空状态各 1 张）。
- 另外保留 **4 张被拒用的初稿**，不计入已采用数量；搜索与中断恢复的初稿因偏题而重做。
- 当前共 65 个已引用 WebP 尺寸文件，合计约 1.93 MB。这些派生尺寸不计作独立素材。
- 工具：内置 image_gen.imagegen；完整实际提示词、来源、日期、版本、原生尺寸、变体、focal point、alt、用途、回退与审核信息保存在 manifest.json。
- reviewed_by 为 Codex；approved_by 保持 null，没有伪造用户审批。

## 对照表

| 素材 | 提示词编号 | 原生像素 | 版本 | 页面与使用条件 |
| --- | --- | --- | --- | --- |
| collection-empty-mobile | COLLECTION-EMPTY-01-mobile | 1122×1402 | v01 | 来源中心无资料选集的独立手机构图 |
| collection-empty | COLLECTION-EMPTY-01 | 1448×1086 | v01 | 来源中心无资料选集 |
| comparison-empty-mobile | COMPARISON-EMPTY-01-mobile | 1122×1402 | v01 | 无数据表／图表的视图回退的独立手机构图 |
| comparison-empty | COMPARISON-EMPTY-01 | 1448×1086 | v01 | 无数据表／图表的视图回退 |
| error-recovery-mobile | ERROR-01-mobile | 1122×1402 | v02 | 活动加载错误／连接中断提示的独立手机构图 |
| error-recovery | ERROR-01 | 1448×1086 | v02 | 活动加载错误／连接中断提示 |
| evidence-archive-bg | EVIDENCE-ARCHIVE-BG | 1672×941 | v01 | 来源—证据—主张展板底层纹理 |
| evidence-empty-mobile | EVIDENCE-EMPTY-01-mobile | 1122×1402 | v01 | 当前筛选无证据与主张状态的独立手机构图 |
| evidence-empty | EVIDENCE-EMPTY-01 | 1448×1086 | v01 | 当前筛选无证据与主张状态 |
| graph-atlas-bg | GRAPH-ATLAS-BG / GRAPH-BG-01 | 1672×941 | v01 | 交互图谱底层纹理，真实节点和边覆盖其上 |
| guide-manual | GUIDE-MANUAL-01 | 1536×1024 | v01 | 含 guide_step 的产物手册封面 |
| home-atlas-desktop | HOME-01 | 1672×941 | v01 | 首页主图；可切换工作室静物 |
| home-atlas-mobile | HOME-01-mobile | 1122×1402 | v01 | 首页输入器之后的独立手机插画 |
| learning-empty-mobile | LEARNING-01-mobile | 1122×1402 | v01 | 学习页无目标状态的独立手机构图 |
| learning-empty | LEARNING-01 | 1448×1086 | v01 | 学习页无目标状态 |
| learning-folio | LEARNING-FOLIO-01 | 1536×1024 | v01 | learning_goal 产物教材封面 |
| mindmap-empty-mobile | MINDMAP-EMPTY-01-mobile | 1122×1402 | v01 | 思维导图无节点状态的独立手机构图 |
| mindmap-empty | MINDMAP-EMPTY-01 | 1448×1086 | v01 | 思维导图无节点状态 |
| offline-preserved-mobile | OFFLINE-01-mobile | 1122×1402 | v01 | 离线保留提示／离线活动页的独立手机构图 |
| offline-preserved | OFFLINE-01 | 1448×1086 | v01 | 离线保留提示／离线活动页 |
| project-discrete | COVER-02 | 1536×1024 | v01 | 项目封面系列第二主题；用户主动选择 |
| project-mineral | COVER-01 | 1536×1024 | v01 | 项目封面库；用户主动选择后按项目 ID 保存本机偏好 |
| research-process | RESEARCH-01 | 1672×941 | v01 | 研究页主题背景 |
| search-empty-mobile | SEARCH-EMPTY-01-mobile | 1122×1402 | v02 | 搜索无结果／网页检索无结果的独立手机构图 |
| search-empty | SEARCH-EMPTY-01 | 1448×1086 | v02 | 搜索无结果／网页检索无结果 |
| timeline-chronicle-bg | TIMELINE-CHRONICLE-BG | 1672×941 | v01 | 知识时间线底层纹理 |
| timeline-empty-mobile | TIMELINE-EMPTY-01-mobile | 1122×1402 | v01 | 时间线无节点／无日期状态的独立手机构图 |
| timeline-empty | TIMELINE-EMPTY-01 | 1448×1086 | v01 | 时间线无节点／无日期状态 |
| timeline-illustration | TIMELINE-01 | 1672×941 | v01 | 时间脉络的主题条带 |
| home-folio | HOME-02 | 1672×941 | v01 | 首页静物选项，保留上一轮素材 |

## 集成与审核

共享源目录为 packages/client/src/assets，而非为 Web/Windows/Android 各复制一份 public 资源；由各宿主打包器生成带哈希的 URL。generated/originals 保留已采用原图，generated/optimized 按模块保存优化图，generated/rejected 保存拒用稿。asset-registry.ts 为实际导入表。

EditorialImage 使用 picture/source/srcset、固定宽高、延迟加载和失败回退；手机选择独立竖图。首页手机图排在输入器之后，避免把任务入口推到首屏以下。深色主题降低素材亮度，数据背景再降低透明度，reduced-motion 不依赖任何图像运动。

当前真实工作空间无 Project；因此两款项目主题封面是明确命名的可选素材，未创建虚假项目，也未按项目名称随机分配。项目选中后可更换本机封面，偏好按项目 ID 保存并明确标注，不影响领域事实。新主题仍需制作与之对应的专属封面，不能用这两款冒充所有项目主题。

所有知识节点、关系线、时间刻度、表格、公式、证据与步骤继续由真实数据组件渲染。插画只用于概念封面、空状态、低对比背景，均不作为数据或证据。

提示词要求了建议输出尺寸，但内置工具实际原生输出约 1122–1672px 宽，manifest 如实记录，没有把上采样冒充高分辨率原图；当前页面展示采用不放大的响应式 WebP。若要求严格的 2400px 原生印刷母版，还需支持该尺寸的原生输出能力。

## 验证记录

来源/尺寸/文件完整性及手机独立图检查包含在单元测试中；浏览器测试验证页面加载、手机 currentSrc、项目封面切换、空状态、学习/指南封面及图片失败回退。最终结果：64 项单元测试、13 项端到端测试、类型检查、Lint 和 Web/Windows/Mobile 前端构建全部通过。截图与总览位于本交付目录。原生安装包与真机未验证，未记录人类美术审批。
