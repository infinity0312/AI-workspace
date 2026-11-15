# 一、最终视觉方向：Atelier Atlas

建议作为正式设计基线

Atelier Atlas — A Creative Knowledge Observatory

中文可以理解为：一个具有艺术气质的数字知识研究工作室。

我不希望最终产品看起来像：

- 一个套了漂亮主题的 SaaS 后台。
- 一个 Notion 的仿制品。
- 一个 ChatGPT 加知识图谱的组合。
- 一个充满渐变、发光线条和玻璃卡片的普通 AI 科技产品。

我希望它更接近以下几种设计语言的融合：

[Inventario 18 - Tutto è Progetto - Corraini | Books & Magazines - Soul Studio](https://images.openai.com/static-rsc-4/r9yy884mEtc49qyiUMRy1V0xt8Mf3V8Ap0ZexDDOcgWlDIcoa6VgFV9pobIHxdjXPIXcxvu0fTRdDAgpYfRsaz9_-97KzRmwa_3Y-R4yVxkexF7kwuqDCxX9FOgUM1pswo0yf3V92Z0Xj7OjiEz7N_-nbTlbUlhvOGL9qf50QdQ?purpose=inline)

Editorial Design

艺术杂志式排版、网格、留白、字体对比。

[Ocean, Exploring the Marine World – Paxton Gate](https://images.openai.com/static-rsc-4/bvqf1INYb1eGB5oc5u-ipSFF8NHlYjJhvv_RSBvj8lEY5bleqltpp6Xeo10M6d7Rr3O3oWgFphdtPELS3VQ81vgHIHTWlgyYS5DegANBqNUqPwsPPRbm4Vnqab1PS9Cagx9No0qgKW1TF0x0xmnHztOt3PIvgt-uZA2uwL7ms5c?purpose=inline)

Scientific Atlas

科学图鉴、精密标注、结构化信息、知识索引。

[Womb of Dismantling and Reassembly de Dan Obana – SINGULART](https://images.openai.com/static-rsc-4/pLLmaVwquQRwueuOHQ_hh7zV1yDNwRST64ik-tJZIvUwEbJHUEXvMAEFFxNOmCzL-cgat4hDUPbg8Y1Ym0TvLV1MsjEW3Lfd-sQB1gr0GBHTbOGaLokpBYqraCjK6E2AaAZlGkiRGEcKwVlKSVfYXvxjzWEfw9DX2Bt70KJryic?purpose=inline)

Contemporary Art

抽象艺术、几何构成、材质和色彩表达。

[Drafting Feature - Write in focus mode](https://images.openai.com/static-rsc-4/_2QA9SMx1sCD-twFz4lV9ZipOXqd8ZzEFe1vRSHDu-5Rn8LyCP1XN9_cgrYReyzAo1UBaaGLwmTCJkCiqZY84vnaTZrTJIcW2hAPAh6zrT5r7-BatOkK5NIiwgAVbVuNzDk-JytY8bBq9kMonBqR0tODIylIm9R8LvbnNflPjSs?purpose=inline)

Digital Atelier

精致、实用、具有空间感的数字工作台。

这四者之间有明确的分工：

| 设计语言         | 负责什么           |
| ---------------- | ------------------ |
| Editorial Design | 建立页面排版美学   |
| Scientific Atlas | 建立知识表达方式   |
| Contemporary Art | 建立品牌独特性     |
| Digital Atelier  | 保证功能和操作体验 |

核心设计原则：外部大胆，内部克制；视觉有艺术性，信息有秩序感。

下面是完整规划书。

# AI Knowledge Workspace

# Frontend Design Master Specification

**文档版本：V1.0**

**设计代号：Atelier Atlas**

**适用平台：Web / Android**

**前端架构：Next.js + React + Capacitor**

**设计目标：建立一套具有独立审美、艺术表现力、专业知识表达能力和优秀编辑体验的跨设备前端系统。**

# 0. 项目执行说明

本文档是前端设计与开发的主要执行依据。

AI 编程 Agent 必须同时承担：

- Product UI Designer
- Art Director
- UX Designer
- Design System Engineer
- Senior Frontend Engineer
- Visual QA Engineer

不能只将任务理解为编写 React 页面。

最终交付物必须是一款完整的产品前端，而不是一组静态页面。

## 0.1 不可违反的设计原则

1. 产品必须具有独立视觉识别度。
2. 禁止直接套用普通 SaaS Dashboard 模板。
3. 禁止将产品设计成以聊天气泡为中心的界面。
4. 所有知识产物必须可以通过统一 Artifact Schema 渲染。
5. 用户必须可以编辑 AI 生成的内容。
6. 用户的布局修改必须可以保存。
7. Web 和 Android 必须共享核心业务组件。
8. Android 不允许直接缩小桌面端页面。
9. 图片、图谱、公式和科学图表必须使用正确的渲染方式。
10. 视觉设计不能破坏信息准确性、可读性和操作效率。

## 0.2 开发前置检查

在开始任何编码之前：

- 检查已有 Git 仓库。
- 检查已有前端项目。
- 检查 Artifact Schema。
- 检查 API 接口。
- 检查已经存在的组件。
- 检查当前技术版本。
- 确认是否有可用的设计参考素材。

如果已有实现，不允许无理由覆盖。

如果设计规范和已有后端协议存在冲突，先记录冲突并提出方案，不得自行修改后端数据协议。

# 1. 品牌与艺术指导

## 1.1 品牌定位

Atelier Atlas 是产品的临时设计代号。

它代表一个具有艺术气息的数字知识研究空间。

用户每次进入产品，都应该感受到：

- 探索知识的自由感。
- 科学研究的严谨性。
- 艺术编辑的精致感。
- 数字工具的高效性。

## 1.2 核心视觉语言

采用四种设计语言融合。

### A. Contemporary Editorial Design

参考现代艺术杂志、建筑出版物和高品质编辑设计。

特征：

- 不对称网格。
- 大型标题。
- 衬线字体和无衬线字体对比。
- 大面积留白。
- 章节编号。
- 精细注释。
- 灵活的内容宽度。
- 视觉节奏。

### B. Scientific Atlas

参考科学图鉴、博物馆展览图册和高品质学术出版物。

特征：

- 精密结构图。
- 图形标注。
- 来源编号。
- 图表索引。
- 关系线。
- 图例。
- 说明文字。
- 结构化知识展示。

### C. Contemporary Generative Art

为产品建立独特的艺术视觉资产。

特征：

- 抽象几何形态。
- 晶体和矿物结构。
- 有机与机械形态结合。
- 非对称构图。
- 细腻的空间层次。
- 有控制的材质表现。

### D. Refined Digital Workspace

确保最终产品仍然是一个高效率的生产力工具。

特征：

- 稳定的导航。
- 清晰的层级。
- 高效的编辑。
- 适当的信息密度。
- 快速的交互反馈。
- 可预测的操作方式。

## 1.3 视觉表现的层次

整个产品采用三种视觉强度：

| 区域                | 视觉强度 | 设计策略                   |
| ------------------- | -------- | -------------------------- |
| 首页、项目封面      | 高       | 大胆构图、艺术插画、标题   |
| Workspace、知识浏览 | 中       | 编辑式排版、图解、适量色彩 |
| 编辑器、表格、设置  | 低       | 克制、精确、强调可读性     |

不能让所有页面都具有相同的装饰程度。

# 2. Design System：设计系统

## 2.1 色彩系统

采用 Warm Editorial + Ultramarine 作为品牌主方向。

### 基础色

| Token         | HEX     | 用途     |
| ------------- | ------- | -------- |
| paper         | #F1EEE5 | 全局背景 |
| paper-soft    | #F8F7F2 | 次级背景 |
| surface       | #FFFFFF | 编辑区域 |
| surface-muted | #E9E7DF | 次级表面 |
| ink           | #202431 | 主要文字 |
| ink-secondary | #525765 | 次级文字 |
| ink-muted     | #777D87 | 辅助文字 |
| border        | #DDDAD1 | 边框     |

### 品牌色

| Token            | HEX     | 用途     |
| ---------------- | ------- | -------- |
| ultramarine      | #394AC7 | 品牌主色 |
| ultramarine-soft | #E7E9FC | 选中背景 |
| mineral          | #668477 | 知识关联 |
| vermilion        | #D66B50 | 重点强调 |
| sand             | #D9CBB3 | 辅助装饰 |

### 状态色

需要独立定义：

- Success。
- Warning。
- Error。
- Information。
- Pending。
- Disabled。

状态不能只依靠颜色表达，还必须有图标或文字说明。

### 使用比例

建议：

- 70% 中性色。
- 20% 深色文字和结构。
- 8% 品牌色。
- 2% 辅助强调色。

禁止大面积使用高饱和渐变。

## 2.2 Dark Mode

第一版以 Light Mode 为主。

Dark Mode 可以后续实现，但必须从一开始使用语义化颜色 Token。

不能直接通过全局反转颜色实现暗色模式。

暗色模式应重新定义：

- 页面背景。
- 编辑表面。
- 边框。
- 正文。
- 图谱节点。
- 关系线。
- 图片展示。
- 代码区域。

## 2.3 字体系统

采用三种字体角色。

### Display Font

用于大型标题、项目封面和艺术化标题。

推荐：

- Newsreader。
- Noto Serif SC。
- Source Han Serif SC。

### Interface Font

用于正文、导航、表格和操作控件。

推荐：

- Inter。
- Geist Sans。
- Noto Sans SC。

### Monospace Font

用于代码、公式编号、数据和技术注释。

推荐：

- JetBrains Mono。

字体规则：

- 不要同时使用过多字体。
- 中文标题可以使用衬线字体。
- 英文标题可以使用更鲜明的 Display Serif。
- 正文必须保证长时间阅读舒适。
- 字体加载失败时必须有系统字体回退。
- 中文字体应考虑文件体积和按需加载。

## 2.4 字体尺寸

建议使用流式字号。

| Token      | Desktop | Mobile |
| ---------- | ------- | ------ |
| Display    | 64px    | 40px   |
| H1         | 42px    | 32px   |
| H2         | 30px    | 26px   |
| H3         | 23px    | 21px   |
| H4         | 18px    | 18px   |
| Body Large | 18px    | 17px   |
| Body       | 16px    | 16px   |
| Small      | 14px    | 13px   |
| Caption    | 12px    | 12px   |

正文行高：

- 中文正文：1.75。
- 英文正文：1.6。
- 标题：1.15–1.3。
- 表格：1.5。

## 2.5 间距系统

使用 4px 基础单位。

```
4
8
12
16
20
24
32
40
48
64
80
96
```

页面不能过度拥挤。

尤其是知识文档，正文区域应保持舒适阅读宽度。

## 2.6 圆角与边框

| 组件         | 圆角 |
| ------------ | ---- |
| 小按钮       | 8px  |
| 输入框       | 10px |
| 小面板       | 12px |
| 大面板       | 16px |
| Dialog       | 18px |
| 大型封面区域 | 20px |

不要所有组件都使用大圆角。

边框优先使用细线，不要过度依赖阴影。

# 3. Layout System：布局系统

## 3.1 Desktop Grid

建议：

- 最大内容宽度：1600px。
- 主网格：12 列。
- 页面左右留白：32–48px。
- 列间距：24px。
- 顶部导航：64px。
- 左侧导航：240px。
- Inspector：320px。

Workspace 中间内容区域自适应。

正文阅读宽度建议控制在 720–820px。

大型知识图谱和数据可视化可以突破正文宽度限制。

## 3.2 Tablet Grid

根据窗口宽度决定：

- 导航可以折叠。
- Inspector 可以变成侧滑面板。
- 内容区优先保证阅读宽度。
- 双栏模式优先于三栏模式。

## 3.3 Mobile Grid

手机端：

- 单列布局。
- 16–20px 页面边距。
- 底部导航。
- Bottom Sheet。
- 全屏编辑器。
- 全屏知识图谱。

禁止强制显示桌面三栏。

## 3.4 断点

统一采用以下设计断点：

| Breakpoint | Width     | Layout         |
| ---------- | --------- | -------------- |
| Compact    | <600px    | 手机单栏       |
| Medium     | 600–839px | 双栏或折叠导航 |
| Expanded   | ≥840px    | 多面板         |
| Wide       | ≥1200px   | 完整工作台     |
| Ultra Wide | ≥1600px   | 最大宽度约束   |

必须根据实际可用窗口宽度判断，而不是仅根据设备名称判断。

# 4. 信息架构与导航

## 4.1 页面结构

```
Application
│
├── Home
│
├── Projects
│   ├── Project Overview
│   └── Project Settings
│
├── Workspace
│   ├── Overview
│   ├── Artifacts
│   ├── Knowledge Graph
│   ├── Sources
│   ├── Research Monitor
│   └── AI Assistant
│
├── Knowledge Library
│
├── Export Center
│
└── Settings
```

不要为每个小功能创建独立的一级导航。

## 4.2 Desktop Navigation

采用左侧固定导航。

主要内容：

- 品牌 Logo。
- Home。
- Projects。
- Knowledge Library。
- Recent Workspaces。
- Active Research。
- Settings。

支持折叠。

折叠后显示图标，并提供 Tooltip。

## 4.3 Android Navigation

采用底部四项导航：

- Home。
- Projects。
- Knowledge。
- Profile。

Workspace 内部使用独立导航。

AI 输入入口在首页突出展示，不必强行占据一个底部导航位置。

# 5. 核心页面设计规范

# 5.1 Home

首页是整个产品的品牌入口。

必须具有最强的视觉识别度。

### 页面构成

```
┌──────────────────────────────────────────────┐
│ LOGO                       Search     Profile │
├──────────────┬───────────────────────────────┤
│              │                               │
│ Navigation   │  MAIN HERO                    │
│              │                               │
│ Home         │  What do you want             │
│ Projects     │  to understand today?         │
│ Library      │                               │
│              │  AI Research Input            │
│              │                               │
│ Recent       │  Active Research              │
│ Workspaces   │                               │
│              │  Recent Workspaces            │
│              │                               │
└──────────────┴───────────────────────────────┘
```

### Hero 区域

必须具有：

- 大型编辑式标题。
- 品牌艺术主视觉。
- AI 输入框。
- 文件上传。
- URL 输入。
- 研究模式选择。

输入框支持：

- 普通提问。
- 深度研究。
- 文件解析。
- 资料整理。
- 已有 Workspace 延续。

Hero 插画不能占据过多空间。

用户进入首页后，应能够立即开始学习。

### Recent Workspaces

采用编辑式网格，而不是普通 SaaS 数据卡片。

每个项目展示：

- 主题封面。
- 标题。
- 描述。
- 知识节点数量。
- 最近更新时间。
- 研究状态。

允许不同项目拥有不同封面，但保持统一 Art Direction。

### Active Research

采用紧凑的任务状态区域。

展示：

- 任务名称。
- 执行阶段。
- 来源收集数量。
- 当前进度。
- 最近事件。
- 进入研究详情的入口。

# 5.2 Projects

项目管理页面采用 Digital Archive 的视觉概念。

每个 Project 是一个知识主题档案。

显示：

- 项目标题。
- 主题插画。
- 描述。
- Artifact 数量。
- Knowledge Node 数量。
- Source 数量。
- 最近活动。

支持：

- 创建。
- 修改。
- 归档。
- 删除。
- 搜索。
- 筛选。
- 自定义封面。
- 用户自主关联其他项目。

项目关联建议采用独立关系编辑器。

AI 可以建议关系，但用户拥有最终决定权。

# 5.3 Workspace

这是产品最重要的页面。

需要优先保证设计质量。

## Desktop Workspace

采用三层结构：

```
┌────────────┬─────────────────────┬──────────────┐
│            │                     │              │
│ Navigation │ Workspace Canvas    │ Inspector    │
│            │                     │              │
│ Artifacts  │ Document            │ AI Assistant │
│ Outline    │ Graph               │ Sources       │
│ Knowledge  │ Timeline            │ Evidence      │
│            │ Table               │ Properties    │
│            │                     │              │
└────────────┴─────────────────────┴──────────────┘
```

左侧：

- Workspace 导航。
- Artifact 列表。
- 文档目录。
- Knowledge 节点。

中间：

- 当前 Artifact。
- Block 编辑和展示。
- 图谱。
- 表格。
- 时间轴。
- 科学可视化。

右侧：

- AI Assistant。
- Sources。
- Evidence。
- 当前选中 Block 的属性。
- 关联知识。

三栏必须支持折叠和调整。

## Workspace Header

显示：

- Project Breadcrumb。
- Workspace Title。
- Sync Status。
- Last Saved。
- Share。
- Export。
- More Actions。

## 自适应布局

根据 Artifact 类型、设备宽度和用户偏好选择布局。

AI 负责推荐内容组合。

Layout Engine 负责实际展示。

用户手动修改后，必须持久化。

# 5.4 Document Editor

编辑器是核心生产力组件。

建议使用 Tiptap。

必须支持：

- Heading。
- Paragraph。
- List。
- Table。
- Code。
- Formula。
- Image。
- Quote。
- Divider。
- Wiki Link。
- Citation。
- Embedded Artifact。

### 编辑模式

提供两种主要模式：

1. Reading Mode。
2. Editing Mode。

阅读模式减少工具栏干扰。

编辑模式提供完整操作能力。

### AI Floating Toolbar

选中文本时展示：

- Explain。
- Simplify。
- Expand。
- Give Examples。
- Add Formula。
- Find Sources。
- Continue Research。

AI 修改通过 Patch 提交。

用户可以预览 Diff。

不能静默覆盖已有内容。

### Wiki Link

支持：

```
[[Graph Neural Networks]]
[[Graph Attention Network]]
```

点击后打开对应知识节点。

编辑时显示自动补全。

如果节点不存在，允许创建候选节点。

反向链接自动更新。

# 5.5 Knowledge Graph

使用 React Flow。

图谱需要兼具科学可视化和艺术表现力。

### 节点类型

- Concept。
- Theory。
- Method。
- Algorithm。
- Material。
- Person。
- Event。
- Source。

不同节点使用不同形状、标签和辅助色。

### 关系类型

- is_a。
- depends_on。
- causes。
- applies_to。
- contrasts_with。
- related_to。
- derived_from。

关系类型由用户和系统共同维护，允许自定义。

### 节点状态

- Confirmed。
- AI Suggested。
- Pending。
- Rejected。

不能只用颜色区分。

### 交互

- 拖动。
- 缩放。
- 搜索。
- 筛选。
- 添加节点。
- 修改关系。
- 删除关系。
- 展开邻居。
- 查看详情。
- 查看证据。

### 视觉风格

图谱不能像普通工程流程图。

节点应具有统一的视觉系统，连线要有层次，重点节点应有明显但克制的强调。

禁止过度使用发光和动态粒子。

# 5.6 Timeline

适合：

- 历史。
- 科学技术演进。
- 人物生平。
- 事件发展。
- 项目进程。

支持：

- 时间缩放。
- 事件详情。
- 事件编辑。
- 来源引用。
- 不确定日期标注。

时间轴布局根据内容密度自动调整。

# 5.7 Sources

设计成专业的数字文献档案馆。

每条来源显示：

- 标题。
- 作者。
- 发布机构。
- 类型。
- 发布时间。
- URL。
- 关联知识。
- 引用次数。

支持：

- PDF 阅读。
- 网页阅读。
- 来源筛选。
- 原文定位。
- 证据查看。
- 引用插入。
- 资料收藏。

PDF Reader 使用 PDF.js。

不能将 GPT Image 生成的图表冒充论文原图。

# 5.8 Research Monitor

展示 Agent 的可解释执行过程。

使用纵向研究时间线。

包含：

1. Research Plan。
2. Task Progress。
3. Tool Calls。
4. Sources Collected。
5. Decision Records。
6. Claims。
7. Evidence。
8. Verification。
9. Final Artifact。

事件展示区分：

- Running。
- Completed。
- Failed。
- Waiting for User。

可以展示决策摘要、工具调用、来源和证据。

不公开隐藏的原始模型思维链。

# 5.9 Export Center

提供：

- 单个 Artifact 导出。
- 完整 Workspace 导出。
- PDF。
- DOCX。
- Markdown。
- JSON。
- SVG。
- PNG。
- ZIP。

导出界面需要展示：

- 导出范围。
- 文件格式。
- 内容选项。
- 版本。
- 任务进度。
- 下载入口。
- 历史记录。

实际生成由后端 Export API 完成。

# 6. Artifact Renderer System

必须建立统一 Renderer Registry。

```
ArtifactRendererRegistry
│
├── MarkdownRenderer
├── FormulaRenderer
├── ImageRenderer
├── TableRenderer
├── CodeRenderer
├── GraphRenderer
├── MindMapRenderer
├── TimelineRenderer
├── SourceRenderer
├── EvidenceRenderer
└── InteractiveRenderer
```

每个 Renderer 必须支持：

- Read Mode。
- Edit Mode。
- Loading State。
- Error State。
- Empty State。
- Mobile Layout。
- Export Compatibility。

未知 Block 类型不能导致整个 Workspace 崩溃。

Renderer 读取统一 Artifact Schema。

禁止让 Agent 直接生成 HTML 并注入页面。

# 7. UI Components

## 7.1 基础组件

```
Button
Input
Textarea
Select
Checkbox
Radio
Tabs
Dialog
Dropdown
Tooltip
Popover
Command
Toast
Badge
Avatar
Skeleton
Progress
```

## 7.2 Workspace 组件

```
WorkspaceShell
WorkspaceHeader
WorkspaceSidebar
WorkspaceCanvas
WorkspaceInspector
WorkspaceNavigation
WorkspaceLayoutSelector
```

## 7.3 Artifact 组件

```
ArtifactContainer
ArtifactHeader
ArtifactToolbar
BlockContainer
BlockEditor
BlockActions
BlockDiffPreview
BlockVersionHistory
```

## 7.4 Knowledge 组件

```
KnowledgeNode
KnowledgeRelation
KnowledgeGraphCanvas
KnowledgeNodeInspector
RelationEditor
BacklinkList
KnowledgeSearch
```

## 7.5 Agent 组件

```
ResearchTimeline
ResearchTask
ToolCallCard
DecisionRecord
SourceEvidence
VerificationStatus
AgentProgress
```

## 7.6 Mobile 组件

```
MobileAppShell
BottomNavigation
BottomSheet
MobileInspector
MobileArtifactHeader
MobileActionBar
OfflineIndicator
SyncStatus
```

所有组件必须使用 Design Tokens。

不能各自硬编码颜色和尺寸。

# 8. 动效与交互

## 8.1 动效原则

动效应该传达：

- 层级变化。
- 操作反馈。
- 状态变化。
- 空间关系。
- 内容生成。

建议主要动效为 120–240ms。

复杂面板切换可适当延长。

## 8.2 重点动效

| 场景         | 表现             |
| ------------ | ---------------- |
| 页面切换     | 轻量淡入         |
| 面板展开     | 平滑位移         |
| Block 插入   | 轻微高亮后淡入   |
| 节点创建     | 节点与关系线出现 |
| AI 修改      | Diff 高亮        |
| 保存         | 状态指示变化     |
| 研究任务     | 阶段性进度变化   |
| Bottom Sheet | 上滑展开         |

禁止持续闪烁和无意义的循环动画。

支持 prefers-reduced-motion。

# 9. GPT Image Asset System

图片素材必须具有统一的艺术指导。

## 9.1 图片使用原则

适合 GPT Image：

- 首页 Hero。
- 项目封面。
- 分类插画。
- Onboarding。
- 空状态。
- 品牌艺术素材。

不适合 GPT Image：

- 实际知识图谱。
- 数据图表。
- 数学公式。
- 真实论文图表。
- 需要精确几何关系的晶体结构。

后者必须使用真实数据和代码渲染。

## 9.2 素材分类

```
assets/
│
├── brand/
│   ├── hero/
│   ├── backgrounds/
│   └── abstract/
│
├── covers/
│   ├── science/
│   ├── mathematics/
│   ├── history/
│   ├── programming/
│   └── biology/
│
├── illustrations/
│
├── onboarding/
│
└── empty-states/
```

## 9.3 首批生成清单

| ID     | 素材            | 比例 |
| ------ | --------------- | ---- |
| IMG-01 | 品牌主视觉      | 16:9 |
| IMG-02 | 科学研究封面    | 3:2  |
| IMG-03 | 数学封面        | 3:2  |
| IMG-04 | 历史封面        | 3:2  |
| IMG-05 | 编程封面        | 3:2  |
| IMG-06 | 生物学封面      | 3:2  |
| IMG-07 | 空状态插画      | 1:1  |
| IMG-08 | Onboarding 插画 | 4:3  |
| IMG-09 | 知识探索背景    | 16:9 |

## 9.4 GPT Image Prompt

统一风格：

"Contemporary editorial scientific illustration, sophisticated art direction, refined geometric composition, subtle physical materiality, warm ivory paper background, ultramarine and mineral green accents, elegant spatial depth, carefully balanced negative space, premium art-book aesthetic, no text, no letters, no logo, no UI elements."

不同知识主题可以变化主体，但保持品牌色彩、材质和构图质量。

图片必须经过人工视觉审核。

# 10. Android Responsive Design

Android 使用 Capacitor。

共享核心 Renderer，但采用独立 Mobile Shell。

## 10.1 页面结构

底部导航：

- Home。
- Projects。
- Knowledge。
- Profile。

Workspace 使用单栏模式。

## 10.2 Mobile Workspace

顶部：

- 返回。
- Workspace 标题。
- 更多操作。

中部：

- Artifact 内容。

底部：

- AI 操作。
- 编辑快捷入口。

Inspector 使用 Bottom Sheet。

## 10.3 Mobile Knowledge Graph

提供：

- Graph Overview。
- Relation List。
- Node Detail。

不能强制显示完整桌面图谱。

## 10.4 Android 原生能力

通过 Capacitor 和 Kotlin 插件支持：

- 文件导入。
- 文件保存。
- 外部分享接收。
- 文件分享。
- Push Notification。
- App Lifecycle。
- Android Back Button。
- WorkManager。
- SQLite。

## 10.5 Offline UI

必须显示：

- Online。
- Offline。
- Syncing。
- Pending Changes。
- Conflict。

离线编辑正常进行。

恢复网络后自动同步。

## 10.6 Android 特别注意事项

- Status Bar。
- Navigation Bar。
- Safe Area。
- Soft Keyboard。
- Gesture Navigation。
- Landscape。
- Split Screen。
- Foldable Screens。
- External Keyboard。

# 11. Frontend Engineering Architecture

## 11.1 技术栈

| 模块          | 技术                 |
| ------------- | -------------------- |
| Web           | Next.js              |
| Android       | Vite + React         |
| Runtime       | Capacitor            |
| Language      | TypeScript           |
| Styling       | Tailwind CSS         |
| UI Primitives | Radix UI             |
| Components    | 自定义 Design System |
| Motion        | Motion               |
| Editor        | Tiptap               |
| Graph         | React Flow           |
| Math          | KaTeX                |
| PDF           | PDF.js               |
| Charts        | ECharts              |
| Table         | TanStack Table       |
| State         | Zustand              |
| Server State  | TanStack Query       |
| Validation    | Zod                  |
| Icons         | Lucide               |
| Tests         | Vitest + Playwright  |

## 11.2 Monorepo

```
ai-knowledge-workspace/
│
├── apps/
│   ├── web/
│   └── android/
│
├── packages/
│   ├── design-tokens/
│   ├── ui-core/
│   ├── domain/
│   ├── workspace-engine/
│   ├── artifact-renderers/
│   ├── editors/
│   ├── graph/
│   ├── api-client/
│   ├── sync-engine/
│   └── local-storage/
│
├── backend/
│
├── assets/
│
├── docs/
│
└── tests/
```

Web 和 Android 共享：

- Domain Models。
- Artifact Schema。
- UI Core。
- Renderer。
- Editor Core。
- API Client。
- Design Tokens。

应用 Shell 独立。

## 11.3 代码质量

必须：

- TypeScript Strict Mode。
- 组件职责单一。
- 避免巨大组件。
- 统一错误处理。
- 统一 API Client。
- 使用 Schema 校验数据。
- 避免 any。
- 避免重复实现。
- 不得在组件中硬编码业务数据。
- 不得使用假数据作为最终实现。

# 12. AI Coding Agent 执行计划

AI 不允许一次性完成整个前端。

必须分阶段开发。

## Phase 0：Repository Audit

任务：

- 读取仓库。
- 检查项目结构。
- 检查依赖。
- 检查 Artifact Schema。
- 检查 API。
- 输出技术差距报告。

交付：

ARCHITECTURE_AUDIT.md

## Phase 1：Art Direction

任务：

- 建立 Moodboard。
- 设计色彩系统。
- 设计字体系统。
- 设计排版网格。
- 设计图形语言。
- 制作首页、Workspace、Graph、Android 的视觉探索。

交付：

DESIGN_DIRECTION.md

至少提供三个视觉方向：

A. Editorial Scientific Atlas。

B. Contemporary Art Workspace。

C. Minimal Research Atelier。

每个方向必须有桌面和移动端示例。

最终选定一个主方向，不允许随意混合。

## Phase 2：Design System

任务：

- Design Tokens。
- 基础 UI。
- Typography。
- Layout。
- Navigation。
- Buttons。
- Inputs。
- Dialogs。
- Panels。
- Responsive Components。

交付：

完整可运行的 Design System。

建议建立 Storybook 或等效组件展示页面。

## Phase 3：High Fidelity Prototype

优先完成：

1. Home。
2. Workspace。
3. Knowledge Graph。
4. Android Home。
5. Android Workspace。

这些页面必须先达到视觉验收标准。

## Phase 4：Core Pages

开发：

- Projects。
- Sources。
- Document Editor。
- Research Monitor。
- Export Center。
- Settings。

## Phase 5：Artifact Engine

开发：

- Renderer Registry。
- Markdown Renderer。
- Formula Renderer。
- Table Renderer。
- Image Renderer。
- Graph Renderer。
- Timeline Renderer。
- Block Editing。
- AI Patch Preview。

## Phase 6：API Integration

连接：

- Project API。
- Knowledge API。
- Artifact API。
- Research API。
- Export API。
- Event Stream API。

移除正式环境中的 Mock Data。

## Phase 7：Android Adaptation

开发：

- Capacitor Shell。
- Bottom Navigation。
- Mobile Workspace。
- Native File Bridge。
- Incoming Share。
- Offline Status。
- Local Repository。

## Phase 8：Visual Polish

优化：

- 字体。
- 对齐。
- 间距。
- 视觉节奏。
- 动效。
- 图片。
- 空状态。
- 加载状态。
- 错误状态。
- 深色主题基础。

## Phase 9：QA

进行：

- 桌面测试。
- 移动端测试。
- 响应式测试。
- 交互测试。
- 无障碍测试。
- API 测试。
- Android 安装测试。
- 离线测试。

# 13. AI Agent 开发工作规则

每个阶段必须按照以下顺序执行：

1. 阅读相关文档。
2. 检查已有代码。
3. 明确开发范围。
4. 设计组件结构。
5. 实现代码。
6. 运行类型检查。
7. 运行单元测试。
8. 启动应用。
9. 使用浏览器检查实际页面。
10. 截图进行视觉审查。
11. 修复问题。
12. 提交阶段报告。

每个阶段结束时输出：

- 完成内容。
- 修改文件。
- 新增组件。
- 测试结果。
- 页面截图。
- 未完成问题。
- 下一阶段计划。

不能只通过代码审查判断视觉质量。

必须在真实运行环境中检查页面。

# 14. 视觉质量评分标准

每个核心页面按 100 分评估。

| 维度                  | 权重 |
| --------------------- | ---- |
| Art Direction         | 20   |
| Typography            | 15   |
| Composition           | 15   |
| Color                 | 10   |
| Information Hierarchy | 15   |
| Interaction           | 10   |
| Responsiveness        | 10   |
| Consistency           | 5    |

要求：

- 总分至少 85。
- Art Direction 不低于 16。
- Typography 不低于 12。
- Interaction 不低于 8。
- Responsiveness 不低于 8。

这是内部设计验收目标，不是自动化测试能完全证明的指标。

## 14.1 页面验收尺寸

至少检查：

- 1440px Desktop。
- 1280px Laptop。
- 1024px Tablet。
- 768px Tablet。
- 430px Mobile。
- 390px Mobile。
- 360px Mobile。

Android 额外检查：

- 横屏。
- 软键盘。
- 系统返回键。
- 安全区域。
- 分屏。
- 折叠屏。
- 断网。

## 14.2 可访问性

目标 WCAG 2.2 AA。

要求：

- 键盘可操作。
- Focus 可见。
- 文字对比度合格。
- 颜色不是唯一的信息编码方式。
- 图像提供 Alt Text。
- 支持减少动画。
- 触控区域优先达到 44–48px。
- 弹窗具有合理的焦点管理。

# 15. 最终交付清单

AI 前端团队必须交付：

## 设计文档

- DESIGN_DIRECTION.md
- DESIGN_TOKENS.md
- COMPONENT_SPEC.md
- PAGE_SPEC.md
- RESPONSIVE_SPEC.md
- ASSET_GUIDE.md

## 工程实现

- Web Application。
- Android Application。
- Shared UI Components。
- Design System。
- Workspace Engine。
- Artifact Renderers。
- Document Editor。
- Knowledge Graph。
- Mobile Shell。

## 图片素材

- 品牌主视觉。
- 项目封面。
- 分类插画。
- Onboarding。
- Empty States。

## 测试

- Component Tests。
- Integration Tests。
- E2E Tests。
- Responsive Tests。
- Android Tests。
- Visual QA Report。

# 16. 最终设计目标

最终产品必须具备以下特征：

**视觉上：**

像一本精心设计的现代艺术与科学图鉴。

**知识表达上：**

像一个能够动态组织知识的科学研究空间。

**操作体验上：**

像一个成熟、精致、可靠的生产力工具。

**艺术表现上：**

具有统一的审美体系，而不是依靠随机生成的漂亮图片。

**工程上：**

Web、Android、Artifact 和 Renderer 遵循统一架构。

最终原则：

**Art Direction establishes identity.
Information Design establishes clarity.
Interaction Design establishes usability.
Engineering establishes consistency.**

艺术建立产品的灵魂，信息设计建立秩序，交互设计建立效率，工程架构保证长期可持续发展。

# 二、我建议再增加一层：不要让 AI 只交付代码，要让它先交付视觉作品

这是我认为最重要的执行建议。

如果你直接把规划书交给 Codex，让它开始开发，它很可能会迅速完成一套功能齐全、但审美普通的页面。

所以我建议设置一个独立的视觉评审关卡。

## 第一阶段：先做四张视觉设计稿

[VÉRAI: Free Art & Design Website Template by baptiste.fort — Framer Marketplace](https://images.openai.com/static-rsc-4/ja5vGr9VAhHUhlhdLuytTYVwf_mYA2JXIeJsnHcEG8p0HIxEALiojuHWj1Bs_8lP4CbhHLLpMqiZLFz_Jz3merCs58WZHr8M7E_CCFn1x5_ZLPt1JQVmhkqkclSsp9e1oJ9Lc1RN6e23r0qrr-YNjLShGw8Ot8QzAoBx1sDl4I8?purpose=inline)

01 · Home

验收品牌气质、字体、色彩、Hero 构图和项目封面。

最高优先级

[Claude Science, an AI workbench for scientists \ Anthropic](https://images.openai.com/static-rsc-4/gVMhEh8k6z2VALDHo-ynxI68pZWFE30yRvnWvZBoWCooVXGDogS5-Zt5XQamFMDZpvifkohYByztgCJwRvkwPdZ0gvH9P0kfUHvkLkMZqaEeBT1bYRYSmck_sVxcmB21AAaVZOc0QXMqBii_TCUDTenqwW7hdtZi5qnZ-jyW2n8?purpose=inline)

02 · Workspace

验收三栏布局、阅读体验、编辑器、AI Inspector。

最高优先级

[PKM Reimagined: Exploring Theme-Based Knowledge Systems — Brian Mathews](https://images.openai.com/static-rsc-4/PaZoYIflBs6po6JA9SdI26t36kpilgyj5w-_WZ2gwZ7k7kzjnKtQW-gfVRZycSFuB2hLmDC9BD2ibiCkw3E_bJOXTo2Z-wTruwAUaOX6SZYQaks89C-eHCtLrsx0t-fup0RvDb8Bn8qmXvoD-uD0SWaX6dInXDE3XvvrrrFmba0?purpose=inline)

03 · Knowledge Graph

验收知识可视化的艺术表现和实际交互。

[Anti-Slop — Hi-fi mobile screens, generated with taste](https://images.openai.com/static-rsc-4/ZEaHavBmhi1aZYEb1UtjfzphTnTqJNjjlSmSPBPCZ6r9U91tRh7zbMkNZqPRcEgahiDPOfItNT9hwxCKBXWFegdic7yz2ascDfqQnsHRlNRQ6Dklt6HXH-PPI7ReV6ZrcMm6VzGCWqbcImPQrD3Iir2FEzdRVX1xVisOXX50AE0?purpose=inline)

04 · Android

验收品牌视觉在手机端的延续，以及单手操作体验。

这四张设计稿通过后，再进入组件开发。

## 第二阶段：建立真正的设计资产库

建议让 AI 交付：

- 颜色 Token。
- 字体 Token。
- 间距 Token。
- 图标规范。
- 组件规范。
- 图片素材。
- 插画风格。
- 动效规范。

以后新增页面就不需要每次重新设计。

## 第三阶段：视觉验收与代码验收分开

我建议采用这样的标准：

| 验收类型       | 核心问题                     |
| -------------- | ---------------------------- |
| Visual QA      | 是否漂亮、有品位、有辨识度？ |
| UX QA          | 是否容易使用？               |
| Engineering QA | 是否可维护、可扩展？         |
| Product QA     | 是否真正满足学习工作流？     |

四项都通过，才能算页面完成。

# 三、我对最终美学的一个进一步建议

我认为还可以加入一个非常有辨识度的设计元素：

每个 Workspace 都像一本动态生成的数字知识图鉴。

例如，用户研究尖晶石材料：

- 封面采用具有艺术构图的尖晶石晶体主题插画。
- 文档采用学术编辑式排版。
- 晶体结构采用精确的三维模型。
- GNN 关系图采用数字科学可视化。
- 文献区域采用档案式索引。
- 重要结论采用精细的边注和证据编号。

[シンメトリー・対称性がつむぐ不思議で美しい物語 (アルケミスト双書)   デーヴィッド・ウェード | タイムカプセル](https://images.openai.com/static-rsc-4/fjiDh3siWdOZpb0IwoCk96J_3QUNBKpbTL0igxViJLK-1qrZHWAC9pKhpDXxax_LQPkDQ96jxjpkaNt2M87kCbLWJbGUhDYx5VKPhnSEsg5syXBBAX4gisMxi7ooNlcWbzsqXC22ICY55fiHhVzzDP94zzcyUJCZWk_sgB1_59A?purpose=inline)

[Naturhistorisches Museum Wien - Press-Detail New](https://images.openai.com/static-rsc-4/Z7f57GhA5CFUCiZqB63VXGy3C_GIuMYl9Gr4IIdqj2J_lumjLLksp1DVPAU1UPDmNMmyRfOadinaNCoTZuGc7QpgUfQL4gYF5y_V-5qkSNCEGVlIK31woJD3aw31wS23G_uehLw4eiMgSK7fHn1G-nrmUKFOIjBV7uo00Zaft1U?purpose=inline)

[Designa - DeLong Lisa, Olsen Scott, Sutton Daud, Tetlow Adam, Wade David | Artforum - dobrodružstvo myslenia](https://images.openai.com/static-rsc-4/6dIXYwn7wQeHP5eP820qalWKoIlucGGpqgqrO0pqVloYEeUKA2mWxyJ8i5eR5Wrr_CKAFLx-OsDxDUHLbAzh9Si_qGor4K_FehChkrbFSpFXh0stiUfzHEkTXsxXseAX9JYgDvC2MG7w6JMrtqqjl7CyxCS6oNrltdl9h_v9h6c?purpose=inline)

12

而用户研究历史、数学、编程时，整个 Workspace 会呈现完全不同的主题视觉，但仍然属于同一个产品。

这比所有知识都套用一种固定的卡片模板更有创造力。

我的最终建议：将 Atelier Atlas 的设计理念确定为「一个可以不断生成新知识图鉴的数字研究工作室」。

它的艺术气息来自内容、排版、图形、材质和构图的整体设计，而不只是装饰。这也是我认为能够让产品与普通 AI 学习工具真正拉开距离的地方。