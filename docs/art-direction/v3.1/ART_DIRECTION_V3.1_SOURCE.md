# ATELIER ATLAS
# ART DIRECTION v3.1
## Reference-led Visual Identity, Composition & Asset Production Specification

**项目：** Atelier Atlas — AI Knowledge Workspace  
**版本：** 3.1 Reference-led Edition  
**文档性质：** 全局艺术指导、视觉设计和素材生产规范  
**执行对象：** Codex、Frontend Agent、Visual Design Agent、Image Generation Agent  
**核心目标：** 将 Atelier Atlas 打造成具有独立审美身份、专业知识表达能力和高品质交互体验的数字知识工作室。

---

# 0. 执行说明

本文件是 Atelier Atlas 的全局艺术指导文件。

它不是普通的 UI 设计说明书，也不是组件开发清单。

Codex 必须将本文件理解为一个具有约束力的视觉创作规范。

本文件包含：

1. 品牌视觉定位；
2. 真实设计案例及其参考网址；
3. 案例拆解与设计原则；
4. 全局美术语言；
5. 非对称构图与空间设计；
6. 字体、色彩、材质和排版；
7. 图像生成策略；
8. 可直接执行的图像生成提示词；
9. 所有 Artifact Renderer 的独立艺术指导；
10. 动效、视差和交互视觉规范；
11. 桌面、平板和移动端设计要求；
12. Codex 实施流程；
13. 视觉验收标准。

## 0.1 最重要的执行要求

不得将本文件简单翻译为一组 CSS 参数。

不得仅仅更换颜色、字体、圆角和阴影。

不得在现有普通 SaaS 页面上增加几张 AI 插画，然后宣称完成艺术指导。

必须改变：

- 页面构图；
- 内容的视觉组织；
- 视觉层级；
- 素材使用方式；
- 信息表达方式；
- 模块之间的视觉差异；
- 交互行为与视觉语言的结合。

## 0.2 参考案例使用规则

本文提供的真实设计案例仅用于研究设计方法。

Codex 必须：

- 访问参考链接；
- 查看完整案例，而非只看缩略图；
- 分析其构图、字体、图像、材质和信息组织；
- 提取适合 Atelier Atlas 的设计原则；
- 重新创作符合本项目需求的设计。

严禁直接复制现有品牌、作品、页面或素材。

参考图不是最终 UI 设计稿，也不是要求 Codex 按照原图逐像素复刻。

参考案例中的图片如果没有明确授权，不得直接作为生产素材嵌入项目。生产环境应使用自行生成、具有明确使用许可或经过授权的素材。

---

# PART I — BRAND ART DIRECTION

# 1. Atelier Atlas 的视觉身份

## 1.1 核心概念

**A Living Atlas of Knowledge**

一座持续生长的数字知识图集。

Atelier Atlas 不应该被理解为：

- 一个 AI 聊天机器人；
- 一个普通笔记软件；
- 一个传统知识管理后台；
- 一个套用了深色主题的 Dashboard；
- 一个由各种图表和卡片组成的工具集合。

它应该像一座融合了科学研究、知识制图、编辑出版和档案收藏的数字工作室。

用户进入产品后，应该感受到自己正在探索一个不断扩展的知识世界。

## 1.2 四种核心视觉来源

### A. Atlas Cartography — 地图制图学

关键词：

- Topography；
- Contour Lines；
- Cartographic Symbols；
- Geographic Layers；
- Spatial Relationships；
- Routes；
- Survey Marks。

贡献：

- 空间感；
- 知识区域；
- 节点关系；
- 路径；
- 地图式探索；
- 层次化空间组织。

主要应用：

Knowledge Graph、Timeline、Dependency、Knowledge Navigation。

### B. Editorial Publishing — 编辑出版

关键词：

- Editorial Grid；
- Typography；
- Asymmetry；
- Margin Notes；
- White Space；
- Visual Rhythm；
- Book Layout。

贡献：

- 高级排版；
- 不对称构图；
- 阅读节奏；
- 留白；
- 字体对比；
- 图片与文字的组织方式。

主要应用：

Home、Document Editor、Research、Artifact Overview。

### C. Scientific Illustration — 科学插画

关键词：

- Botanical Engraving；
- Scientific Specimens；
- Anatomical Illustration；
- Geological Sections；
- Scientific Instruments；
- Technical Sketches。

贡献：

- 精细插画；
- 专业感；
- 视觉解释能力；
- 标本质感；
- 科学研究氛围。

主要应用：

Learning、Evidence、Scientific Chart、Source Browser。

### D. Museum Exhibition Design — 博物馆展览设计

关键词：

- Exhibition Graphics；
- Object Labels；
- Archive；
- Wayfinding；
- Exhibition Typography；
- Curatorial Layout；
- Visual Narrative。

贡献：

- 展示层级；
- 视觉导览；
- 资料编排；
- 内容叙事；
- 统一品牌系统。

主要应用：

Artifact、Source、Knowledge Archive、Home。

## 1.3 四种语言的关系

不能让每个模块各自选择一种完全不同的主题。

应该形成统一的品牌语法：

- 地图学决定空间关系；
- 编辑出版决定内容组织；
- 科学插画决定素材表达；
- 博物馆设计决定展示秩序。

它们是同一个视觉体系的不同组成部分。

---

# PART II — REFERENCE RESEARCH

# 2. 真实案例研究

以下案例是设计参考库，Codex 应在实现前逐一查看。

## 2.1 历史地图与地形制图

### Reference A — David Rumsey Historical Map Collection

网址：

https://www.davidrumsey.com/

地图分类：

https://www.davidrumsey.com/collections/cartography.html

地图集：

https://www.davidrumsey.com/view/atlases

参考内容：

- 历史地图；
- 地形图；
- 古典地图集；
- 地理信息；
- 地图边缘装饰；
- 地图图例；
- 等高线和地形阴影。

需要研究：

1. 不同区域如何通过线条密度区分；
2. 地形如何通过线条表现高度；
3. 图例如何组织；
4. 地图边缘如何安排说明；
5. 地理实体和路径如何构成视觉层次；
6. 如何在复杂信息中保留阅读秩序。

应用于：

- Knowledge Graph；
- Timeline；
- Dependency；
- 首页知识领域封面。

禁止直接复制古典地图的全部颜色和装饰。

目标是将地图制图的空间组织方法转化为现代数字知识界面。

### Reference B — Lehmann Hachure Relief

原始图片：

https://schierenberg.nl/product/66792

参考图片：

https://schierenberg.nl/media/cache/product_main/66792/66792_6.jpg

值得研究：

- Hachure Relief：通过刻线方向和密度表现地形坡度；
- 线条密度与视觉重量之间的关系；
- 不同区域的明暗层次；
- 单色线条如何表现复杂空间。

应用：

Knowledge Graph 背景纹理、领域区域边缘、局部空间装饰。

不要把刻线直接叠加到所有图谱节点后面。

### Reference C — Historical Atlas of Pallas

案例：

https://www.librairieclavreuil.com/en/pallas-voyages-en-differentes-provinces-de-lempire-de-russie-et-dans-lasie-septentrionale-traduits-de-lallemand-par-m-gauthier-de-la-peyronie-commis-des-affaires-etrangeres/

参考图片：

https://www.librairieclavreuil.com/wp-content/uploads/2024/04/65e5f91536d1f_PALLAS_EmpireRussie_1788-1793202408bd.jpg

值得研究：

- 单一植物主体；
- 细节拆解；
- 标本与局部结构；
- 小型编号；
- 细线标注；
- 精细刻版质感。

应用：

Learning、Scientific Chart、Evidence、Document Editor。

---

## 2.2 植物学与科学标本

### Reference D — Wellcome Collection Botanical Illustration

网址：

https://wellcomecollection.org/collections

植物插画分类：

https://content.www.wellcomecollection.org/concepts/mcmtzz9f

值得研究：

- 历史科学插画；
- 标本展示；
- 植物结构；
- 手稿；
- 科学观察；
- 图像与文字注释。

重点：

不要只研究植物插画的画风，还要研究如何通过一个主体展示多个层次的信息。

### Reference E — Kew Science Herbarium

网址：

https://powo.science.kew.org/

参考标本图片：

https://d2seqvvyy3b8p2.cloudfront.net/7f21b2ef38ecf833febac5c70fb01bcf.jpg

值得研究：

- 标本本身的空间分布；
- 纸张与植物之间的关系；
- 标签和记录；
- 标本与元信息的结合；
- 真实研究资料的档案感。

应用：

Source Browser、Evidence Network、Learning。

特别注意：生成素材不能冒充真实植物标本或真实研究资料。

---

## 2.3 编辑出版与非对称排版

### Reference F — The Typographic Grid Book Compositions

网址：

https://www.behance.net/gallery/10608343/The-Typographic-Grid-Book-Layout

值得研究：

- 同一文字内容的不同排版方案；
- 网格的变化；
- 留白；
- 文字密度；
- 不同页面之间的节奏；
- 目录与正文的关系。

核心启示：

同样的数据和文字，通过不同的排版方式，可以产生完全不同的阅读体验。

### Reference G — Impact: Weill Cornell Medicine Magazine

网址：

https://skeltonsprouls.com/new/wcm-fall22

值得研究：

- 科学内容的编辑式呈现；
- 概念插画；
- 数据图形；
- 图片裁切；
- 长篇内容的节奏；
- 不同章节之间的视觉转换；
- 数字与印刷版本之间的统一。

尤其值得研究的是其将复杂医学内容转化为具有编辑叙事能力的视觉内容的方法。

应用：

Document Editor、Scientific Chart、Home、Research。

### Reference H — Nivaagaard Museum Visual Identity

网址：

https://www.behance.net/gallery/99285513/Visual-Identity-NIVAAGAARD

值得研究：

- 古典与现代的结合；
- Serif 与 Sans Serif 的对比；
- 品牌视觉系统；
- 多种场景下的统一性。

应用：

Atelier Atlas 的全局品牌系统。

---

## 2.4 博物馆展览与视觉识别

### Reference I — Pentagram: New York at Its Core

网址：

https://www.pentagram.com/work/new-york-at-its-core/story

值得研究：

- 同一个展览体系下的多个视觉分区；
- 统一字体；
- 不同历史阶段的差异化表达；
- 文字作为视觉主体；
- 多类型内容的组织。

核心启示：

统一品牌不意味着所有页面必须长得一样。

同一套设计系统可以允许不同内容拥有不同的视觉表达。

应用：

Timeline、Home、Artifact。

### Reference J — Bratislava City Museum: Biographies of People and Things

网址：

https://www.tabstudio.eu/work/biographies-of-people-and-things

值得研究：

- 展览视觉识别；
- 字体作为图形；
- 印章与实体材料；
- 黑白与摄影的组合；
- 展示空间和印刷物料之间的统一。

尤其值得借鉴的是小型实体印章如何形成可识别的视觉标记。

应用：

Source、Evidence、Artifact Metadata。

### Reference K — Barcelona Design Museum

网址：

https://www.dandad.org/work/d-ad-awards-archive/barcelona-design-museum

值得研究：

- 以简单连接线构成品牌系统；
- 字体与图形的组合；
- 同一视觉语言在不同载体中的变化；
- 品牌不依赖复杂 Logo，而依赖一套持续可识别的视觉规则。

应用：

全局连接线、知识关系视觉语言、品牌识别。

### Reference L — GRASSI Museum Exhibition Design

网址：

https://www.ungestalt.de/en/work/grassi-museum-fuer-angewandte-kunst-exhibition-design-for-cultural-affairs

值得研究：

- 空间分区；
- 颜色和字体形成导览；
- 展览区域之间的关系；
- 动态展示；
- 视觉叙事与空间体验。

应用：

知识领域分区、Artifact 导航和模块间的空间组织。

---

## 2.5 时间线与历史叙事

### Reference M — Henry Moore Institute Timeline

网址：

https://henry-moore.org/henry-moore-institute/whats-on-henry-moore-institute/

时间线图片：

https://images.henry-moore.org/uploads/2024/07/Timeline-install-view.jpg?gravity=&resize=1592%2C995

值得研究：

- 年代分区；
- 文字和图片的节奏；
- 横向历史叙事；
- 不同年代的视觉重量；
- 事件之间的关系。

应用：

Timeline Renderer。

### Reference N — Institute of Quantum Computing Exhibition

网址：

https://www.lord.ca/projects/project-experience/institute-of-quantum-computing-iqc-travelling-exhibition

值得研究：

- 科学知识如何形成视觉导览；
- 重要事件和阶段如何突出；
- 时间、科学概念和展览空间如何结合；
- 不同内容如何通过图形语言形成连续叙事。

应用：

Scientific Timeline、Learning Journey。

---

## 2.6 科学可视化

### Reference O — Nature Scientific Illustration Guide

网址：

https://www.nature.com/documents/Nature_scientific_illustration_author_guide.pdf

必须研究的原则：

1. Hierarchy：视觉层级；
2. Visual Editing：视觉删减；
3. Clarity：清晰；
4. Accessibility：可访问性。

特别关注：

- 重要内容使用更高视觉权重；
- 非重点区域减少细节；
- 复杂信息需要重新组织，而不是简单增加装饰；
- 视觉层级必须反映信息层级。

### Reference P — Nature Figure Guide

网址：

https://research-figure-guide.nature.com/figures/preparing-figures-our-specifications/

必须研究：

- 坐标轴；
- 单位；
- 图例；
- 色彩可访问性；
- 数据标注；
- 避免不必要装饰；
- 文字与图形的分离。

### Reference Q — Beautiful Reasons / Giorgia Lupi

网址：

https://medium.com/accurat-in-sight/beautiful-reasons-c1c6926ab7d7

值得研究：

- 数据的编辑式表达；
- 多变量信息组织；
- 数据图形与叙事结合；
- 非传统数据可视化。

仅用于研究信息表达方式，不要求采用其具体图表形式。

---

# PART III — GLOBAL VISUAL LANGUAGE

# 3. 品牌视觉系统

## 3.1 视觉气质

Atelier Atlas 应具有：

- 知识探索感；
- 科学研究感；
- 出版物的精致感；
- 档案的秩序感；
- 现代设计的克制；
- 自然素材的细节；
- 数字空间的流动性。

避免：

- 普通 SaaS；
- 科技公司模板；
- 过度装饰；
- 纯复古；
- 游戏化；
- 过度极简；
- 所有页面同一种布局。

## 3.2 品牌视觉原则

**Principle 01 — Content First**

内容必须是主体。

**Principle 02 — Structured Asymmetry**

允许不对称，但必须有明确构图逻辑。

**Principle 03 — Semantic Visuals**

不同知识对象具有不同视觉表达。

**Principle 04 — Material Intelligence**

材质和素材应该帮助用户理解内容，而不是纯装饰。

**Principle 05 — Visual Rhythm**

页面需要有节奏，不能所有区域平均分布。

**Principle 06 — Restrained Ornament**

装饰必须克制。

**Principle 07 — Editorial Hierarchy**

文字不是简单排列，而是具有明确阅读顺序。

**Principle 08 — Spatial Interaction**

交互应该帮助用户理解空间关系。

---

# PART IV — COLOR, TYPOGRAPHY & MATERIALS

# 4. 色彩体系

以下色板是第一轮候选值，必须经过实际页面测试后再确定。

## 4.1 Light Theme — Archive Paper

| Token | Color | Usage |
|---|---|---|
| Canvas | #F1EEE6 | 主背景 |
| Surface | #F7F4EC | 正文背景 |
| Paper | #E8E0D2 | 局部纸张区域 |
| Ink | #242522 | 主要文字 |
| Secondary Ink | #77756D | 次级文字 |
| Rule | #D2CABB | 分隔 |
| Mineral Blue | #667F8C | 主强调 |
| Oxide | #A75F48 | 重点 |
| Lichen | #7C806A | 辅助 |
| Brass | #A68A58 | 装饰 |

## 4.2 Dark Theme — Midnight Atelier

| Token | Color | Usage |
|---|---|---|
| Canvas | #171A1C | 主背景 |
| Surface | #202427 | 内容区域 |
| Raised | #292E31 | 浮层 |
| Ink | #E8E1D5 | 主要文字 |
| Secondary Ink | #A6A095 | 次级文字 |
| Rule | #3B4143 | 分隔 |
| Mineral Blue | #8DA4B0 | 主强调 |
| Oxide | #C07A60 | 重点 |
| Lichen | #9AA188 | 辅助 |
| Brass | #B69A69 | 装饰 |

## 4.3 色彩规则

- 避免纯白和纯黑。
- 不要所有按钮都使用强调色。
- 不要将每种节点类型都分配一种高饱和颜色。
- 强调色应根据当前任务和视觉焦点使用。
- 状态不能只依赖颜色。
- 深浅主题应分别设计素材对比度。
- 不能通过反转背景颜色直接完成 Dark Theme。

---

# 5. Typography

## 5.1 三类字体

### Editorial Serif

候选：

- Source Serif 4；
- Literata；
- Cormorant Garamond；
- Source Han Serif SC。

用途：

- 主标题；
- 章节标题；
- 重要知识概念；
- 研究成果封面。

### Interface Sans

候选：

- Inter；
- Source Han Sans SC；
- Noto Sans SC。

用途：

- 正文 UI；
- 导航；
- 控件；
- 表格；
- 说明文字。

### Technical Mono

候选：

- IBM Plex Mono。

用途：

- DOI；
- URL；
- 时间戳；
- 节点 ID；
- 版本；
- 公式编号。

不要一次加载过多字体。

## 5.2 字体层级

| Role | Desktop |
|---|---:|
| Main Hero | 48–64px |
| Page Title | 32–42px |
| Section Title | 24–32px |
| Subheading | 18–22px |
| Body | 15–17px |
| UI | 12–14px |
| Caption | 11–12px |
| Metadata | 11–13px |

中文字体必须实际测试。

不要只根据英文衬线字体效果决定字体组合。

## 5.3 排版规则

- 标题不必全部加粗。
- 允许大字号标题。
- 允许标题跨越多个网格列。
- 重要元信息使用独立层级。
- 来源和脚注可以使用边注。
- 重要章节之间使用较大的留白。
- 长篇正文控制行宽。
- 不要把所有内容压缩成同样的文字大小。

---

# PART V — COMPOSITION

# 6. 非对称布局系统

## 6.1 Structured Asymmetry

Atelier Atlas 应采用有秩序的非对称设计。

不是随意偏移，而是先建立隐藏网格，再有目的地突破网格。

## 6.2 Desktop Grid

建议：

- 12 列；
- 最大内容宽度约 1440px；
- 左右边距 48–72px；
- 列间距 20–28px；
- 8px 作为主要间距单位。

允许：

- 7/5；
- 8/4；
- 5/7；
- 3/6/3；
- 2/7/3。

这些比例仅作为构图工具。

## 6.3 六种构图方法

### A. Offset Composition

标题和主体内容错位。

例如左侧标题、右侧图片，而不是所有内容居中。

### B. Margin Notes

在正文边缘放置：

- 引用；
- 来源；
- 时间；
- 批注；
- AI 说明；
- 元信息。

### C. Partial Bleed

局部插画越过内容边界。

不能让插画覆盖可操作内容。

### D. Variable Columns

不同区域采用不同宽度。

不要所有内容都使用 50/50。

### E. Layered Composition

使用少量叠放：

- 纸张标签；
- 小型标本；
- 章节编号；
- 图片与说明。

不要让所有元素都悬浮。

### F. Editorial Pause

在连续信息之间制造视觉停顿。

例如：

大标题 → 大留白 → 主体图像 → 密集内容 → 小型说明。

## 6.4 视觉重心

每个页面必须明确：

- Primary Focus；
- Secondary Focus；
- Supporting Information。

不能让标题、按钮、筛选器、内容卡片具有相同权重。

## 6.5 禁止

- 所有页面都三列卡片；
- 所有内容居中；
- 所有内容都包在卡片里；
- 所有图片都是相同尺寸；
- 随机旋转图片；
- 随机重叠元素；
- 用留白掩盖内容组织问题。

---

# PART VI — IMAGE ASSET STRATEGY

# 7. 生成素材而非生成页面

这是本项目非常重要的技术和美术原则。

## 7.1 两种视觉对象

### Generated Assets

使用图像生成：

- 植物标本；
- 矿物；
- 科学仪器；
- 地形装饰；
- 小型地图碎片；
- 档案印章；
- 纸张纹理；
- 章节插画；
- 局部装饰。

### Programmatic Objects

必须由真实代码和数据生成：

- 知识图谱；
- 关系线；
- 节点；
- 时间轴；
- 科学图表；
- 数据表；
- 文字；
- 公式；
- 动态状态；
- 用户编辑内容。

严禁使用生成图像替代可编辑的数据对象。

## 7.2 素材类别

### Specimen Assets

单个植物、矿物、仪器、化石。

### Cartographic Assets

小型地形、等高线、指北针、测绘标记。

### Archival Assets

纸张标签、档案印章、书籍碎片、手稿。

### Editorial Assets

章节插画、主题小图、局部装饰。

### Material Assets

纸张纤维、印刷纹理、墨迹。

## 7.3 图片尺寸

| 类型 | 源尺寸 | 比例 |
|---|---:|---|
| 小型图标素材 | 256–512px | 1:1 |
| 标本插画 | 512–1024px | 1:1 / 4:5 |
| 章节插画 | 768–1024px | 4:3 |
| 局部装饰 | 256–512px | 1:1 |
| 纹理 | 512–1024px | 1:1 |
| 小型领域封面 | 1024px | 4:3 |

素材必须针对最终显示尺寸优化。

不要为了显示 80px 的植物素材加载数 MB 的原图。

## 7.4 透明背景

优先要求：

- isolated subject；
- transparent background；
- clean silhouette；
- generous negative space。

如果图像工具不支持透明背景：

- 不得虚构透明输出；
- 使用合适的背景移除流程；
- 检查边缘；
- 检查半透明区域；
- 检查深浅背景下的表现。

## 7.5 单主体原则

每次生成一张素材：

- 一个主体；
- 一个用途；
- 一个文件；
- 一个提示词。

禁止：

- 九宫格素材拼图；
- 多个无关对象；
- 生成完整 UI；
- 生成整张知识图谱；
- 生成带文字的假文献。

---

# 8. 全局图像生成风格锁

## 8.1 Master Prompt

每个素材生成任务都应该在具体提示词前加入以下风格要求。

```text
Create a refined editorial illustration asset
for Atelier Atlas, a premium digital knowledge workspace.

Visual identity:
historical scientific atlases,
natural history specimen plates,
fine engraved illustrations,
contemporary museum editorial design,
archival research materials.

Art direction:
precise, elegant, restrained,
intellectually curious,
subtle hand-crafted character,
sophisticated composition.

Rendering:
fine etching details,
delicate linework,
restrained mineral-inspired colors,
subtle tonal variation,
natural material texture,
carefully controlled contrast.

The result should feel like a small collectible
illustration from a beautifully designed scientific atlas.

Asset requirements:
one isolated subject only,
clean silhouette,
generous negative space,
transparent background when supported,
high-resolution details,
designed to be embedded as a small UI asset.

Do not generate:
webpages,
UI screenshots,
dashboards,
full-screen compositions,
large landscape backgrounds,
charts,
data diagrams,
maps containing labels,
fake documents,
interface components.
```

## 8.2 Negative Prompt

```text
Avoid:
generic SaaS illustration,
startup vector art,
cartoon characters,
emoji,
plastic 3D rendering,
neon glow,
purple-blue gradients,
excessive glossy effects,
AI abstract blobs,
random geometric decoration,
multiple unrelated subjects,
collage,
fake text,
pseudo letters,
watermarks,
logos,
borders,
UI elements,
complete scenes,
oversaturated colors,
excessive decorative details.
```

如果生成工具不支持 Negative Prompt 独立字段，将其并入普通提示词。

---

# PART VII — MODULE ART DIRECTION

# 9. Home / Workspace

## 9.1 核心定位

**The Entrance to a Living Atlas**

首页不是 Dashboard，而是用户进入个人知识世界的入口。

## 9.2 视觉结构

采用编辑式非对称布局。

建议：

- 左侧 60%：标题、介绍、Intent Composer；
- 右侧 40%：主题插画和知识领域视觉素材。

允许变化，不要固定为每个页面相同的两列。

## 9.3 视觉主体

首页必须有一个明确的视觉焦点：

- 当前知识领域；
- 正在进行的研究；
- 重要 Artifact；
- 最近知识成果。

不能只靠一张装饰性山水图吸引注意力。

## 9.4 Intent Composer

输入框不应像普通聊天框。

应该强调：

- 研究任务；
- 学习目标；
- 用户意图；
- 资料输入；
- 产物生成。

输入区域可以有独立构图和明显视觉权重。

但不要将所有操作包进一个巨型圆角矩形。

## 9.5 最近工作

使用编辑式布局：

- 主要项目占据较大区域；
- 其他项目采用不同尺寸；
- 允许小型封面素材；
- 标题和时间信息分层；
- 不要全部使用相同尺寸卡片。

## 9.6 图片生成 Prompt

```text
A small editorial still-life illustration
for a sophisticated intellectual knowledge studio.

Subject:
a folded historical atlas fragment,
a small mineral specimen,
a botanical clipping,
and a delicate scientific measuring instrument.

Composition:
carefully balanced small arrangement,
isolated objects,
generous negative space,
natural asymmetry.

Style:
natural history engraving mixed with
contemporary museum editorial photography.

Palette:
warm bone,
muted mineral blue,
oxidized terracotta,
soft graphite,
restrained olive.

Transparent background.
No text.
No labels.
No interface.
No large landscape.
```

---

# 10. Knowledge Graph — Knowledge Atlas

## 10.1 核心定位

**The Cartography of Ideas**

图谱必须成为产品的视觉招牌。

它不是一张普通的圆点连线图。

## 10.2 空间构成

分为：

1. Domain；
2. Cluster；
3. Entity；
4. Relation；
5. Focus。

不同主题可以形成不同空间区域。

## 10.3 节点视觉语义

| 类型 | 视觉建议 |
|---|---|
| Concept | 简洁的概念实体 |
| Claim | 具有文字权重的主张节点 |
| Source | 档案式来源实体 |
| Evidence | 小型证据标记 |
| Event | 时间性实体 |
| Person | 人物实体 |
| Material | 具体材料或物质实体 |

不同实体不能只靠颜色区分。

应结合形状、文字层级、边框和小型标记。

## 10.4 关系

至少区分：

- Supports；
- Contradicts；
- Cites；
- Depends On；
- Related To；
- Derived From。

通过线型、方向、权重和标注表达。

## 10.5 视觉焦点

选中节点后：

- 当前节点清晰突出；
- 直接关联节点保留；
- 无关节点降低视觉权重；
- 关系路径更清晰；
- 允许逐层展开。

不要让所有节点永远保持相同视觉权重。

## 10.6 背景素材

使用：

- 地形刻线；
- 局部地图碎片；
- 轻微纸张纹理；
- 小型测绘标记。

这些素材只出现在画布边缘、主题区域和辅助区域。

不能遮盖真实节点。

## 10.7 Prompt

```text
A small isolated cartographic ornament
for a sophisticated scientific knowledge atlas.

Subject:
a delicate engraved topographic contour fragment
with one subtle mountain ridge and fine survey marks.

Style:
historical scientific cartography,
contemporary editorial graphic design,
fine etching,
precise linework,
restrained monochrome mineral palette.

Transparent background.
One independent asset.
No labels.
No text.
No real map data.
No UI.
No complete map.
```

---

# 11. Mind Map — Branching Knowledge

## 11.1 核心定位

**The Structure of Thought**

思维导图强调层级组织，不强调任意多对多关系。

## 11.2 视觉结构

- 中心主题具有明确权重；
- 一级分支形成主要结构；
- 二级分支逐渐收敛；
- 分支有不同视觉色彩；
- 交叉引用使用另一种线型；
- 支持折叠和展开。

## 11.3 与 Knowledge Graph 的区别

Knowledge Graph：

- 多对多；
- 关系丰富；
- 空间探索；
- 节点聚类。

Mind Map：

- 层级；
- 分支；
- 主次关系；
- 逐层理解。

二者不能只使用相同节点样式并更换布局算法。

## 11.4 Prompt

```text
A delicate isolated botanical branching specimen
for an intellectual editorial knowledge map.

Subject:
one natural branching botanical structure
with several distributed leaves.

Style:
scientific botanical engraving,
fine copperplate linework,
restrained olive and graphite tones,
elegant natural asymmetry.

Transparent background.
No diagram.
No arrows.
No labels.
No text.
```

---

# 12. Timeline — Chronicle Atlas

## 12.1 核心定位

**The Geography of Time**

时间线应该像一部可以探索的历史图录。

## 12.2 三种视图

### Chronicle

适用于：

- 历史事件；
- 技术演进；
- 人物生平；
- 科学发现。

### Stratigraphy

适用于：

- 地质时期；
- 材料演化；
- 科学阶段；
- 复杂历史分层。

### Parallel Tracks

适用于：

- 多条技术路线；
- 多个人物；
- 多个科学领域；
- 并行事件。

## 12.3 视觉结构

- 重要事件具有更高视觉权重；
- 普通事件使用轻量标记；
- 重要阶段有明显分区；
- 时间不确定性独立表达；
- 图片和事件文字形成组合；
- 多轨之间具有明确对应关系。

## 12.4 Prompt

```text
A small isolated archival scientific object illustration.

Subject:
an antique astronomical measuring instrument,
carefully rendered brass and dark wood details.

Style:
historical scientific catalogue engraving,
contemporary museum editorial art direction,
delicate printmaking.

Muted mineral colors,
restrained highlights,
transparent background.

No readable text.
No dates.
No timeline.
No labels.
No background scenery.
```

---

# 13. Dependency — Dependency Landscape

## 13.1 核心定位

**The Architecture of Work**

依赖图应该体现研究计划、任务结构和系统依赖。

## 13.2 视觉结构

- 阶段形成区域；
- 并行任务形成轨道；
- 关键路径突出；
- 阻塞节点明显；
- 已完成节点降低权重；
- 循环依赖必须明确警告。

## 13.3 禁止

不要使用：

- 大量齿轮；
- 机器人；
- 普通流程图模板；
- 所有节点完全相同；
- 过度装饰的连接线。

## 13.4 Prompt

```text
A small isolated archival engineering specimen.

Subject:
a precision scientific measuring instrument
or mechanical research apparatus.

Style:
historical engineering notebook,
fine technical engraving,
contemporary editorial restraint.

Muted graphite, brass and mineral tones.

Transparent background.
One subject only.
No flowchart.
No workflow diagram.
No arrows.
No text.
```

---

# 14. Evidence Network — Research Provenance Atlas

## 14.1 核心定位

**The Anatomy of Evidence**

这个模块的核心是知识来源的可追溯性。

## 14.2 结构

Source → Evidence → Claim。

但不能仅仅做成三层流程图。

实际应支持：

- 多个来源支持同一主张；
- 多段证据支持同一主张；
- 不同证据之间存在冲突；
- 同一来源支持多个主张；
- 主张存在不同可信状态。

## 14.3 视觉表达

Source：

- 真实文献封面；
- 书籍、网页、论文；
- 来源元信息。

Evidence：

- 原文摘录；
- 页码；
- 段落；
- 图表；
- 具体数据位置。

Claim：

- 主张内容；
- 证据状态；
- 支持关系；
- 反驳关系。

## 14.4 重要要求

真实文献封面优先使用真实资料。

不要生成虚假的论文封面。

不要生成虚假的文字作为证据。

不要让 AI 生成的装饰素材冒充真实研究资料。

## 14.5 Prompt

```text
A small isolated archival research object illustration.

Subject:
one historical research notebook,
a manuscript fragment,
and a small archival paper tag.

Style:
museum archive documentation,
scientific field notes,
fine editorial illustration.

Restrained warm bone,
graphite and muted terracotta.

Transparent background.
No readable writing.
No fake document content.
No complete page.
No UI.
No collage.
```

---

# 15. Data Table — Research Ledger

## 15.1 核心定位

**The Research Ledger**

数据表首先是高效、准确的研究工具。

不应该为了艺术性牺牲信息密度。

## 15.2 视觉表达

- 文字、数值、时间、状态有不同表达；
- 重要数据突出；
- 关键行可以强调；
- 来源可追溯；
- 单位和精度清晰；
- 分组使用留白和细线；
- 避免每个单元格都加边框。

## 15.3 与普通表格的区别

允许：

- 行内来源标记；
- 重要字段的编辑式排版；
- 数据类型标识；
- 轻量注释；
- 关联 Artifact 的快捷入口。

不允许：

- 所有单元格都添加装饰；
- 大量无意义颜色；
- 过多图标；
- 不必要的背景纹理。

---

# 16. Scientific Chart — Scientific Publication

## 16.1 核心定位

**The Language of Scientific Observation**

科学图表应该像专业期刊中的图表。

## 16.2 视觉要求

- 坐标轴准确；
- 单位清晰；
- 图例完整；
- 数据真实；
- 误差范围真实；
- 置信区间有数据依据；
- 异常点可以标注；
- 数据来源可追溯。

## 16.3 视觉层次

1. 研究问题；
2. 图表主体；
3. 重要数据；
4. 注释；
5. 来源和口径。

## 16.4 素材原则

图表本身必须程序化绘制。

生成素材只能用于章节插画和局部装饰。

---

# 17. Document Editor — Editorial Research Studio

## 17.1 核心定位

**The Living Research Manuscript**

文档编辑器应该像一本可以持续编辑和扩展的研究图录。

## 17.2 排版

- 正文采用适合长时间阅读的字体；
- 标题具有明确层级；
- 图片、公式、表格拥有独立排版；
- 来源和引用具有视觉层次；
- 注释可以出现在正文边缘；
- 允许图片跨越正文列；
- 允许重要章节具有独立构图。

## 17.3 编辑交互

- 文本可以精细编辑；
- AI 修改显示局部差异；
- 引用可以定位原始来源；
- 图片可以调整；
- 公式可独立编辑；
- 知识块可以移动和重新组织。

不要把所有编辑能力隐藏在一个通用 Inspector 中。

## 17.4 Prompt

```text
A small editorial illustration asset
for a premium scientific research publication.

Subject:
one carefully detailed botanical specimen
with a small archival annotation tag.

Style:
museum catalogue,
historical scientific illustration,
contemporary editorial design,
fine engraved linework.

Muted mineral colors,
subtle paper character,
transparent background.

No text.
No full document.
No page layout.
No interface.
```

---

# 18. Learning — Learning Journey

## 18.1 核心定位

**A Journey Through Knowledge**

学习模块应该让用户感受到知识逐渐建立的过程。

## 18.2 视觉结构

- 知识路径；
- 章节；
- 学习目标；
- 掌握状态；
- 待复习内容；
- 依赖知识；
- 错题；
- 笔记。

## 18.3 视觉表达

不要让所有学习内容变成任务卡片。

允许：

- 路径地图；
- 章节图录；
- 进度层次；
- 知识分支；
- 学习记录；
- 复习日历。

## 18.4 Prompt

```text
A small editorial illustration for a premium
knowledge learning workspace.

Subject:
a compact field notebook,
a folded map fragment,
a pencil,
and one delicate botanical specimen.

Mood:
curious, intellectual, calm and inspiring.

Style:
contemporary museum catalogue,
historical scientific field notes,
fine engraved details.

Transparent background.
No characters.
No cartoon.
No text.
No complete landscape.
```

---

# 19. Source Browser — Knowledge Archive

## 19.1 核心定位

**The Knowledge Archive**

来源库像一个经过整理的数字档案馆。

## 19.2 视觉结构

来源类型：

- Paper；
- Book；
- Website；
- Image；
- Video；
- Dataset；
- User Upload；
- Research Note。

来源应根据内容类型使用不同展示方式。

例如：

论文优先显示真实封面、标题、作者、年份、DOI。

网页优先显示网站身份、标题、来源和抓取时间。

图片优先显示缩略图、版权和来源。

## 19.3 禁止

不要所有来源都使用统一卡片。

不要生成假的文献封面。

不要将来源信息压缩成一行普通文字。

---

# 20. Inspector / Contextual Controls

## 20.1 核心定位

Inspector 是知识对象的上下文操作空间。

不是普通设置面板。

## 20.2 视觉结构

根据当前选中对象变化。

例如：

选中 Concept：

- 定义；
- 关联；
- 来源；
- 备注。

选中 Evidence：

- 原文；
- 来源位置；
- 支持关系；
- 审核状态。

选中 Timeline Event：

- 时间；
- 事件描述；
- 相关实体；
- 证据。

不要显示大量与当前对象无关的配置项。

## 20.3 控件语言

搜索使用 Search Bar。

筛选使用 Facet。

当前条件使用轻量 Token。

聚焦对象使用 Entity Picker。

高级选项使用 Context Menu 或 Drawer。

严禁将所有条件变成统一的大型 Select 网格。

---

# PART VIII — INTERACTION & MOTION

# 21. 动效设计

核心原则：

**Motion should explain spatial relationships.**

动效不是装饰，而是帮助用户理解空间和内容变化。

## 21.1 Spatial Transition

适用于：

- 图谱聚焦；
- 节点展开；
- 时间线缩放；
- 关系路径展开；
- 来源定位。

建议时间：

350–650ms。

## 21.2 Editorial Transition

适用于：

- 正文切换；
- 章节展开；
- 注释出现；
- Inspector 打开。

建议时间：

180–300ms。

## 21.3 Material Response

适用于：

- 插画视差；
- 局部高亮；
- 编辑反馈；
- 轻量选中状态。

建议时间：

100–200ms。

## 21.4 视差

首页：

- 前景 2–4px；
- 中景 4–6px；
- 背景 6–10px。

必须克制。

不能影响滚动、触控和阅读。

## 21.5 禁止

- 频繁弹跳；
- 夸张缩放；
- 全页面漂浮；
- 不必要的粒子动画；
- 每个按钮都有复杂动画；
- 大量持续循环动画。

支持 Reduced Motion。

---

# PART IX — RESPONSIVE ART DIRECTION

# 22. Desktop

桌面是完整研究工作空间。

允许：

- 非对称排版；
- 多列；
- 大画布；
- Inspector；
- 边注；
- 局部素材；
- 复杂关系视图。

但不要因为屏幕宽就无限增加卡片。

# 23. Tablet

- Inspector 可折叠；
- 工具栏收缩；
- Facet 横向滚动；
- 图谱画布保持主体；
- 文档保留阅读宽度；
- 素材缩小。

# 24. Mobile

移动端必须重新设计。

不能简单将桌面内容压缩成纵向长页面。

各模块建议：

| Module | Mobile Design |
|---|---|
| Home | 编辑式纵向叙事 |
| Graph | 局部聚焦、逐层展开 |
| Mind Map | 分支导航、局部画布 |
| Timeline | 纵向时间叙事 |
| Dependency | 阶段分组、路径导航 |
| Evidence | 可展开的来源—证据—主张 |
| Table | 列优先级、横向滚动 |
| Scientific Chart | 保持坐标和图例可读 |
| Document | 阅读优先、精细编辑 |
| Learning | 知识旅程和章节导航 |

移动端 Inspector 使用底部详情面板。

---

# PART X — ASSET PRODUCTION PIPELINE

# 25. Codex 图像生成流程

## 25.1 检查能力

Codex 首先检查实际可用的图像生成工具或技能。

不得假设存在某个不存在的命令。

如果图像生成能力不可用：

- 输出素材清单；
- 输出提示词；
- 标记待生成素材；
- 不得用程序绘图冒充已完成的生成素材。

## 25.2 目录结构

```text
public/
  assets/
    art-direction/
      global/
      home/
      graph/
      timeline/
      mindmap/
      dependency/
      evidence/
      document/
      learning/
      sources/
      textures/

docs/
  art-direction/
    references/
    prompts/
    asset-manifest/
    screenshots/
```

## 25.3 素材命名

格式：

`aa_{module}_{subject}_{variant}`

例如：

- aa_home_atlas_fragment_01
- aa_graph_contour_01
- aa_learning_botanical_01
- aa_evidence_archive_stamp_01

## 25.4 Asset Manifest

每个素材记录：

```yaml
id: aa_graph_contour_01
module: graph
category: cartographic
filename: aa_graph_contour_01.webp
source_format: png
display_role: canvas-edge-decoration
transparent: true
recommended_display_width: 180
prompt_file: prompts/graph_contour_01.md
alt: subtle engraved topographic contour fragment
```

另外记录：

- 生成工具；
- 生成日期；
- 原始文件；
- 实际使用页面；
- 使用许可；
- 优化尺寸；
- 审核状态。

## 25.5 图片验收

每张图检查：

- 主体是否完整；
- 是否存在 AI 畸形；
- 是否存在伪文字；
- 是否符合品牌风格；
- 边缘是否干净；
- 缩小后是否仍清晰；
- 深浅主题是否适用；
- 是否有重复素材。

## 25.6 图片优化

- 优先 WebP / AVIF；
- 透明图保留 Alpha；
- 不加载不必要的原始大图；
- 采用响应式尺寸；
- 懒加载非首屏素材；
- 对高频素材缓存；
- 保留生成源文件。

---

# PART XI — FIRST ASSET BATCH

# 26. 第一批素材清单

先生成 20 个基础素材。

| ID | Asset | Module |
|---|---|---|
| 01 | Atlas fragment | Home |
| 02 | Topographic contour | Graph |
| 03 | Mountain engraving | Graph |
| 04 | Mineral specimen | Graph |
| 05 | Botanical specimen | Learning |
| 06 | Branching botanical | Mind Map |
| 07 | Astronomical instrument | Timeline |
| 08 | Historical compass | Home |
| 09 | Geological strata | Timeline |
| 10 | Archive stamp | Evidence |
| 11 | Manuscript fragment | Evidence |
| 12 | Research notebook | Document |
| 13 | Precision instrument | Dependency |
| 14 | Fossil specimen | Learning |
| 15 | Paper grain | Global |
| 16 | Ink texture | Global |
| 17 | Cartographic ornament | Global |
| 18 | Book spine fragment | Source |
| 19 | Mineral cluster | Scientific |
| 20 | Small scientific specimen | Learning |

每个素材独立生成。

不得一次生成整张拼贴图。

---

# PART XII — ART DIRECTION LAB

# 27. 三套视觉方向实验

Codex 不得直接开始全面改造。

必须先建立 Art Direction Lab。

三个方向必须是真正不同的设计方案。

## Direction A — Archive Editorial

核心：

- 编辑出版；
- 档案；
- 纸张；
- Serif；
- 大留白；
- 图片裁切；
- 边注。

特点：

更偏向高级学术图录和研究出版物。

适合：

Document、Home、Research。

## Direction B — Cartographic Atelier

核心：

- 地形；
- 空间；
- 路径；
- 线条；
- 区域；
- 知识探索。

特点：

更偏向地图、空间和探索。

适合：

Graph、Timeline、Learning。

## Direction C — Contemporary Scientific Museum

核心：

- 博物馆；
- 展签；
- 科学图解；
- 现代排版；
- 主题分区；
- 展览式叙事。

特点：

更偏向现代科学展览和专业知识展示。

适合：

Evidence、Source、Scientific Chart。

## 27.1 实验要求

每个方向都制作：

- 首页；
- Knowledge Graph；
- Document Editor；
- Timeline。

每个方向必须使用相同的测试数据。

每个方向必须展示：

- Light Theme；
- Dark Theme；
- Desktop；
- Mobile。

禁止只制作三张配色不同的页面。

必须真正改变：

- 构图；
- 字体；
- 图片；
- 信息层级；
- 留白；
- 材质；
- 交互表达。

## 27.2 最终选择

允许最终选择：

一个主方向 + 其他两个方向中的少量设计优点。

不能将三种方向完全混合。

必须建立统一的品牌视觉体系。

---

# PART XIII — CODEX IMPLEMENTATION ROADMAP

# 28. 实施阶段

## Phase 0 — Current State Audit

审查现有代码库。

检查：

- 页面路由；
- 组件结构；
- Renderer；
- 图片资源；
- Design Tokens；
- 主题；
- 响应式；
- 当前交互。

交付：

`ART_DIRECTION_CURRENT_STATE_AUDIT.md`

## Phase 1 — Reference Research

访问本文件中的所有案例。

建立：

`REFERENCE_ANALYSIS.md`

每个案例记录：

- URL；
- 截图；
- 构图特点；
- 字体；
- 色彩；
- 图片；
- 材质；
- 可借鉴原则；
- 不适合直接借鉴的部分。

## Phase 2 — Art Direction Lab

制作三套视觉方向。

交付：

- 4 个核心模块 × 3 套方向；
- 主题对比；
- 桌面和移动端；
- 实际截图。

## Phase 3 — Brand System

确定：

- 字体；
- 色彩；
- 网格；
- 视觉层级；
- 材质；
- 控件；
- 动效；
- 素材规则。

交付：

`BRAND_VISUAL_SYSTEM.md`

## Phase 4 — Asset Production

生成首批 20 个素材。

交付：

- 原始图像；
- 优化图像；
- Prompt；
- Manifest；
- 审核记录。

## Phase 5 — Flagship Modules

优先完成：

1. Home；
2. Knowledge Graph；
3. Document Editor。

必须有明显不同的视觉构图。

## Phase 6 — Other Renderers

完成：

1. Timeline；
2. Mind Map；
3. Dependency；
4. Evidence Network；
5. Data Table；
6. Scientific Chart；
7. Source Browser；
8. Learning。

## Phase 7 — Global Integration

统一：

- 深色主题；
- 浅色主题；
- 移动端；
- 素材；
- 动效；
- 控件；
- Inspector；
- 搜索。

## Phase 8 — Visual QA

实际运行页面并截图。

检查：

- 首屏；
- 长页面；
- 空状态；
- 数据较多的情况；
- 数据较少的情况；
- 深色；
- 浅色；
- 桌面；
- 手机。

不得只凭代码编译成功宣布完成。

---

# PART XIV — VISUAL QUALITY GATES

# 29. 视觉验收

每个模块按 1–5 分评价。

| 指标 | 评价 |
|---|---|
| Identity | 是否有品牌辨识度 |
| Composition | 是否有良好构图 |
| Typography | 字体和层级 |
| Material | 素材和质感 |
| Semantics | 是否体现知识类型 |
| Functionality | 是否易用 |
| Density | 信息密度 |
| Motion | 动效是否有意义 |
| Responsive | 移动端是否合理 |
| Consistency | 是否属于同一品牌 |

要求：

- 平均分至少 4.0；
- Identity 不低于 4；
- Composition 不低于 4；
- Functionality 不低于 4；
- Responsive 不低于 4。

## 29.1 直接不合格

出现以下情况之一，不能通过验收：

1. 页面只是更换颜色。
2. 所有模块仍然采用同一布局。
3. 所有内容仍然被统一卡片包围。
4. 素材只存在于首页。
5. 生成图像代替真实数据图谱。
6. 生成图片有明显 AI 瑕疵。
7. 移动端只是缩小桌面页面。
8. 非对称布局导致阅读混乱。
9. 复杂内容没有视觉层级。
10. 装饰性素材比知识内容更突出。

---

# PART XV — FINAL CODEX MASTER INSTRUCTION

# 30. 交给 Codex 的执行指令

```text
You are the Art Director and Senior Frontend Designer
for Atelier Atlas.

Your responsibility is to establish a distinctive
visual identity for a premium AI knowledge workspace.

Do not create a generic SaaS dashboard.

Do not simply polish the existing interface.

Read the complete Art Direction v3.1 specification.

Study every reference URL and extract design principles.

The core visual identity combines:

1. Historical scientific cartography.
2. Contemporary editorial publishing.
3. Natural history specimen illustration.
4. Museum exhibition design.

Critical requirements:

- Use structured asymmetrical composition.
- Create a clear visual focal point on every page.
- Give each Artifact Renderer its own visual grammar.
- Use typography as an important design element.
- Use real generated image assets for small,
  isolated illustrations, ornaments and textures.
- Do not generate complete webpages or UI screenshots.
- Do not replace real data visualizations with images.
- Preserve precise editing and data integrity.
- Build complete light and dark themes.
- Design mobile layouts independently.
- Avoid excessive cards, rounded rectangles and generic controls.
- Use visual references for inspiration, never for direct copying.

Before large-scale implementation:

1. Audit the existing project.
2. Inspect the available image generation capabilities.
3. Study the supplied reference cases.
4. Create three distinct Art Direction Lab concepts.
5. Implement four representative modules in each concept.
6. Capture real screenshots.
7. Compare the results.
8. Wait for visual direction approval before migration.

After approval:

- Establish the complete design system.
- Generate and validate the first 20 image assets.
- Implement Home, Knowledge Graph and Document Editor.
- Migrate the remaining Renderers.
- Complete mobile and theme adaptation.
- Perform visual QA.

Every generated image must have:
- a specific purpose;
- an independent asset file;
- a documented prompt;
- a recorded usage location;
- an optimized production format.

Do not claim that Art Direction is implemented
until actual rendered screenshots have passed review.

The goal is not to create a prettier SaaS.

The goal is to create a distinctive digital
knowledge studio that users can recognize
without seeing its logo.
```

---

# PART XVI — 最终设计原则

## 31. 十五条不可妥协的原则

1. 内容永远是主角。
2. 装饰必须具有意义。
3. 不对称必须有构图依据。
4. 每个模块必须有独立的视觉语言。
5. 所有模块必须共享品牌基因。
6. 字体必须参与视觉设计。
7. 图片必须经过筛选和优化。
8. 小素材优先于整张生成式背景。
9. 真实数据必须由真实数据渲染。
10. 不允许为了艺术性牺牲阅读效率。
11. 不允许为了统一而牺牲模块差异。
12. 深色与浅色都必须完整设计。
13. 移动端必须重新组织。
14. 动效必须解释空间或状态变化。
15. 最终必须通过真实截图验收。

## 32. 最终设计目标

Atelier Atlas 应该同时具有：

- 一本高级学术图录的阅读品质；
- 一张精密地图的探索能力；
- 一间科学档案室的秩序感；
- 一座现代博物馆的展示能力；
- 一款专业编辑软件的操作效率。

**The interface is not a container for knowledge. It is part of the way knowledge is experienced.**

界面不只是知识的容器，它本身就是知识体验的一部分。

---

# APPENDIX — REFERENCE INDEX

以下网址必须保留在项目文档中，方便后续设计人员和 Codex 继续研究。

| 编号 | 主题 | 网址 |
|---|---|---|
| A | David Rumsey Maps | https://www.davidrumsey.com/ |
| B | Cartography Collection | https://www.davidrumsey.com/collections/cartography.html |
| C | Historical Atlases | https://www.davidrumsey.com/view/atlases |
| D | Lehmann Relief | https://schierenberg.nl/product/66792 |
| E | Pallas Botanical Atlas | https://www.librairieclavreuil.com/en/pallas-voyages-en-differentes-provinces-de-lempire-de-russie-et-dans-lasie-septentrionale-traduits-de-lallemand-par-m-gauthier-de-la-peyronie-commis-des-affaires-etrangeres/ |
| F | Wellcome Botanical Illustration | https://content.www.wellcomecollection.org/concepts/mcmtzz9f |
| G | Kew Science | https://powo.science.kew.org/ |
| H | Typographic Grid | https://www.behance.net/gallery/10608343/The-Typographic-Grid-Book-Layout |
| I | Weill Cornell Magazine | https://skeltonsprouls.com/new/wcm-fall22 |
| J | Nivaagaard Identity | https://www.behance.net/gallery/99285513/Visual-Identity-NIVAAGAARD |
| K | Pentagram Exhibition | https://www.pentagram.com/work/new-york-at-its-core/story |
| L | Bratislava City Museum | https://www.tabstudio.eu/work/biographies-of-people-and-things |
| M | Barcelona Design Museum | https://www.dandad.org/work/d-ad-awards-archive/barcelona-design-museum |
| N | GRASSI Museum | https://www.ungestalt.de/en/work/grassi-museum-fuer-angewandte-kunst-exhibition-design-for-cultural-affairs |
| O | Henry Moore Timeline | https://henry-moore.org/henry-moore-institute/whats-on-henry-moore-institute/ |
| P | Quantum Computing Exhibition | https://www.lord.ca/projects/project-experience/institute-of-quantum-computing-iqc-travelling-exhibition |
| Q | Nature Scientific Illustration | https://www.nature.com/documents/Nature_scientific_illustration_author_guide.pdf |
| R | Nature Figure Guide | https://research-figure-guide.nature.com/figures/preparing-figures-our-specifications/ |
| S | Giorgia Lupi / Data Visualization | https://medium.com/accurat-in-sight/beautiful-reasons-c1c6926ab7d7 |
| T | Esri Knowledge Graph | https://www.esri.com/arcgis-blog/products/arcgis-enterprise/data-management/what-is-a-knowledge-graph |

**End of Art Direction v3.1.**