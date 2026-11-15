应该支持精细到每一个文字符号的编辑，而且我认为这应该是 AI Knowledge Workspace 的基础能力，而不是后期才添加的高级功能。

如果 Workspace 只能调整 AI 生成内容的组合方式，例如移动卡片、调整章节顺序、切换思维导图和知识图谱，那么它本质上还是一个 AI 内容展示器，而不是真正的知识工作空间。

我建议把产品的可编辑性定义为：

AI 负责生产知识，用户拥有对知识产物从字符、段落、结构到关系的完整编辑权。

# 一、可编辑性应该有五个层次

L1 · 布局级编辑

基础能力

[Serenity](https://images.openai.com/static-rsc-4/chkZj8E5Yprh1aprplYDkOc_cgDzFvb-xvJAMAfN7V-zE2XkiFcD8MVkO-Vcxg82CvY-juywSLpB30TI6h7wRU7Z6V3jI-T0hFbjaYxE-tbB53tisvtIYhZBHbWdIWlk5y0oZOE0qiMs-qgoIGGMuL4VXWV4kmpEKfAJI99_efM?purpose=inline)

[serenity.page](https://www.serenity.page/features?utm_source=chatgpt.com)

- 调整章节顺序。

- 拖动内容 Block。

- 调整图片和图表位置。

- 调整栏宽、布局和展示方式。

- 在不同知识展示模板之间切换。

  L2 · 内容块级编辑

  基础能力

- 新增、删除、复制段落。

- 修改标题。

- 编辑列表和引用块。

- 新增表格、图片、公式。

- 合并或拆分段落。

  L3 · 字符与行内级编辑

  核心能力

  [Tiptap Rich Text Editor - the Headless WYSIWYG Editor](https://images.openai.com/static-rsc-4/QCYQniFmG27fC8HS53bZ8IkkaUTuDyQuLyJJHitDWcf7_pR0aUY2dAWG-eHN3-8sjgYQtOvfPpZn4vQRC8AKaI5mFR94L9dgIXN0fE9-yPk02RB7Hta2Bd6D2H_VBfc3V4TeZYWl7Tez6exe4UmPz4ZSA6pe2FbVziZmv8J_JdU?purpose=inline)

  [tiptap.dev](https://tiptap.dev/product/editor?utm_source=chatgpt.com)

- 光标定位到任意位置。

- 修改单个汉字、字母、数字和标点。

- 插入、删除、替换任意文字。

- 修改局部字体、颜色、粗体、斜体。

- 添加超链接、脚注、引用。

- 选中一段文字交给 AI 修改。

  L4 · 结构化对象编辑

  核心能力

  [Online mathematics editor "Mathcha" which can draw full-fledged formulas and graphs on the browser right now - GIGAZINE](https://images.openai.com/static-rsc-4/GpCuyhSTBzlzMeTdUE_TvFUEKD1ac-fhee1pvN1A_XQ8IGybppx2TTQBp2WmzkdVaUcRLF82iAnZOvC0pmaL7LlAd6IWjlsHW9NUuu2OhQ8DBqN-_4TibyoKSa2AAberl9jd6PaiN6zYhwSb78kxaxpN3kKKwBk_ilp4yB7-7g8?purpose=inline)

  [gigazine.net](https://gigazine.net/gsc_news/en/20170821-mathcha/?utm_source=chatgpt.com)

- 公式逐符号编辑。

- 表格逐单元格编辑。

- 图表数据编辑。

- 图片裁剪、标注和图注编辑。

- 思维导图节点、连线独立编辑。

- 知识图谱节点和关系编辑。

  L5 · 语义级编辑

  差异化能力

- 将某个结论标记为有争议。

- 修改某个知识节点的定义。

- 改变两个知识节点的关联类型。

- 修改某个 Claim 的证据来源。

- 将 AI 生成的内容转化为用户自己的观点。

- 要求 AI 只重写指定部分，并保留其余内容。

这五层应该共同构成 Workspace 的编辑系统。

# 二、文字编辑必须接近专业文档编辑器

我不建议采用简单的 Markdown 文本框，也不建议把每个段落设计成一个不可深入编辑的卡片。

应该采用真正的富文本编辑器。

例如用户打开一份 AI 生成的学习笔记：

Graph Neural Networks

编辑模式

## 1. Graph Convolutional Network

Graph Convolutional Network（GCN）是一种用于图结构数据的神经网络模型。

其核心思想是通过邻居节点的信息聚合，更新当前节点的特征表示。

数学表达式

\[ H^{(l+1)}=\sigma\left(\hat D^{-\frac12} \hat A\hat D^{-\frac12}H^{(l)}W^{(l)}\right) \]

来源：原始 GCN 论文 · 引用 01

富文本

公式编辑

引用关联

局部 AI 修改

示意内容：文字、公式和引用均为独立可编辑对象。

用户可以：

1. 将光标放在 Graph Convolutional Network 中间，修改任意字母。
2. 只选中「邻居节点的信息聚合」，将其改成自己理解的表述。
3. 只修改公式中的某一个指数或矩阵符号。
4. 修改标题而不影响其他内容。
5. 对某个段落添加自己的注释。
6. 将某个段落交给 AI 重新解释。

而且这些修改不应该破坏原有的来源关联。

# 三、必须增加局部 AI 编辑能力

这是我认为最有产品价值的部分之一。

传统编辑器负责用户自己修改。

AI Knowledge Workspace 应该进一步做到：用户可以选中任意范围，让 AI 对选中的内容执行指定操作。

例如：

选中一段文字后的 AI 工具栏

当前选中内容

GCN 通过聚合邻居节点的特征来更新中心节点的表示。

重新表达

优化语言和表达

详细解释

展开原理和细节

翻译

转换语言

事实核查

检查依据和准确性

补充案例

增加例子和解释

自定义指令

自己描述修改要求

AI 执行之后，不应该直接覆盖原文，而应该显示 Diff：

修改前

GCN 通过聚合邻居节点的特征来更新中心节点的表示。

AI 修改后

GCN 通过对邻居节点特征进行加权聚合，生成中心节点的新表示。

新增与替换可追踪

保留原文

接受修改拒绝修改

进一步支持：

- 接受某个修改。
- 拒绝某个修改。
- 重新生成。
- 与原文对比。
- 查看修改依据。
- 撤销修改。

这意味着 AI 不再只是生成一份文档，而是成为一个能够参与持续编辑的协作者。

# 四、底层技术架构必须改变

这里需要修正前面提出的 Artifact Schema。

之前采用的：

```
{
  "block_id": "block_001",
  "type": "paragraph",
  "text": "..."
}
```

只能很好地支持 Block 级别的编辑。

如果直接用它作为最终数据结构，后期会遇到精细编辑、行内格式、局部 AI 修改、公式编辑等问题。

建议升级为：

Structured Rich Document Model。

## 4.1 推荐的编辑器技术

我建议优先评估：

[Tiptap Rich Text Editor - the Headless WYSIWYG Editor](https://images.openai.com/static-rsc-4/jTuqHOZlQLUQly7BJcrF9yLxp19VkKquPa60fRaCQ2dz_waIgXyyPbrA30MH_TqMpLWRFx2lefBRtWz5bV5aKTWDgFJKaGAzqT4nIlVWXBkO40J9Zk8brUihOyI2cvN143D0jLrrgcizvcoIi654wSftPDXSicUbTxr8ds79W_s?purpose=inline)

Tiptap + ProseMirror

首选

React / TypeScript 富文本编辑框架

支持自定义 Node、Mark、编辑事务和结构化文档，非常适合我们的 Artifact 编辑器。

[官方文档](https://tiptap.dev/?utm_source=chatgpt.com)

备选：

- Lexical：轻量、可扩展，适合自定义编辑器。[官方文档](https://lexical.dev/?utm_source=chatgpt.com)
- Slate：高度灵活，但需要自行承担更多编辑器能力的实现。[官方文档](https://docs.slatejs.org/?utm_source=chatgpt.com)

我的倾向是 Tiptap / ProseMirror。

它比较适合我们需要的：

- 富文本。
- 自定义知识节点。
- 行内引用。
- 公式。
- 表格。
- 自定义 Block。
- 局部编辑。
- 结构化文档序列化。

而且可以继续在 Web、Capacitor、Tauri 和 ArkWeb 中复用核心编辑器。

## 4.2 新的 Artifact 内部结构

建议采用类似这样的结构：

```
{
  "artifact_id": "artifact_001",
  "schema_version": "2.0",

  "content": {
    "type": "doc",
    "content": [
      {
        "type": "heading",
        "attrs": {
          "id": "block_001",
          "level": 1
        },
        "content": [
          {
            "type": "text",
            "text": "Graph Neural Networks"
          }
        ]
      },
      {
        "type": "paragraph",
        "attrs": {
          "id": "block_002"
        },
        "content": [
          {
            "type": "text",
            "text": "GCN 通过"
          },
          {
            "type": "text",
            "text": "邻居节点的信息聚合",
            "marks": [
              {
                "type": "bold"
              }
            ]
          },
          {
            "type": "text",
            "text": "更新节点表示。"
          }
        ]
      },
      {
        "type": "math_block",
        "attrs": {
          "id": "block_003",
          "latex": "H^{(l+1)}=..."
        }
      }
    ]
  }
}
```

这里需要特别强调：

- `Block ID` 用于定位内容块。
- 文本节点用于定位和编辑文字。
- `Marks` 用于表示局部格式。
- 自定义 Node 用于公式、引用、图表等结构化对象。
- 引用关系单独关联 Evidence ID，而不是只在文字里保存一个普通字符串。

不要将编辑器内部 JSON 直接当成整个系统唯一的数据协议。应当定义自己的 Artifact Schema，再通过 Editor Adapter 转换为编辑器文档结构。

# 五、AI 修改必须支持字符级 Patch

之前的 Patch 主要是：

```
{
  "op": "replace",
  "block_id": "block_003",
  "value": {}
}
```

现在需要增加更精细的操作：

| 操作                 | 用途           |
| -------------------- | -------------- |
| `insert_text`        | 插入文字       |
| `delete_text`        | 删除文字       |
| `replace_text_range` | 替换指定范围   |
| `set_mark`           | 加粗、斜体等   |
| `remove_mark`        | 删除局部格式   |
| `split_block`        | 拆分段落       |
| `merge_blocks`       | 合并段落       |
| `update_node`        | 修改结构化对象 |
| `move_block`         | 移动内容块     |
| `update_cell`        | 修改表格单元格 |
| `update_formula`     | 修改公式       |

例如：

```
{
  "patch_id": "patch_001",
  "artifact_id": "artifact_001",
  "base_version": 5,

  "operations": [
    {
      "op": "replace_text_range",
      "target": {
        "block_id": "block_002",
        "anchor_text": "邻居节点的信息聚合"
      },
      "replacement": "邻居节点特征的加权聚合"
    }
  ],

  "reason": "提高术语准确性",

  "evidence_refs": [],

  "requires_user_approval": true
}
```

正式实现不能只依赖 `anchor_text`，还应该包含原文上下文、位置、文档版本和必要的文本哈希，防止定位到错误的重复文本。

另外，字符定位应该考虑 Unicode 字素簇，不能简单地把 UTF-16 字符偏移量当成用户看到的字符位置。

核心原则：AI 只能修改指定范围，不能因为修改一个句子就重新生成整份 Artifact。

# 六、跨平台编辑体验

这个能力必须在所有设备上保持一致，但交互方式可以不同。

| 设备    | 编辑体验                                     |
| ------- | -------------------------------------------- |
| Windows | 完整光标编辑、键盘快捷键、鼠标选区、复杂公式 |
| macOS   | 完整编辑、快捷键、触控板、拖放               |
| iPad    | 触控选区、Apple Pencil、外接键盘             |
| iPhone  | 精细文字编辑、选区工具栏、AI 底部面板        |
| Android | 触控编辑、选区菜单、AI 工具栏                |
| 鸿蒙    | ArkWeb 编辑器、原生键盘和选择交互适配        |

特别注意中文输入法：

- 拼音组合输入。
- 候选词确认。
- 光标移动。
- 选区替换。
- 中英文混合输入。
- 公式和特殊符号输入。

这些必须在 Capacitor、Tauri 和 ArkWeb 中分别进行真实设备测试，不能只依赖浏览器模拟器。

# 七、我建议最终将编辑器设计成三个工作模式

Reading Mode

阅读

专注阅读 AI 整理的知识，查看引用、图片、公式和关联关系。

Editing Mode

精细编辑

完整富文本编辑，支持字符级、段落级、结构化对象级修改。

AI Collaboration Mode

AI 协作

选中内容交给 AI 修改，查看 Diff、证据和修改理由，决定是否接受。

三个模式可以快速切换，不应该让用户进入一个完全独立的页面才能编辑。

# 八、最终产品决策

我建议正式确定以下规则：

| 设计事项    | 最终决定                    |
| ----------- | --------------------------- |
| 编辑粒度    | 字符级到整个 Artifact       |
| 文本编辑    | 完整富文本编辑              |
| 结构编辑    | Block 级                    |
| 公式编辑    | 独立公式编辑器              |
| 表格编辑    | 单元格级                    |
| 图表编辑    | 数据与展示分离              |
| 知识图谱    | 节点、关系独立编辑          |
| AI 编辑     | 支持任意选区                |
| AI 修改方式 | Patch + Diff                |
| 修改确认    | 可配置，默认重要修改需确认  |
| 撤销恢复    | 支持                        |
| 历史版本    | 支持                        |
| 引用关系    | 独立保存，不随普通文本删除  |
| 导出        | Markdown、PDF、DOCX 等      |
| 跨平台      | 统一 Schema，复用编辑器核心 |

我还想强调一个更深层的产品理念：

用户不应该只是拥有 AI 输出内容的修改权，而应该拥有这些知识资产的完整控制权。

AI 生成的内容可以被用户逐字修改、拆解、重组、补充、质疑，甚至完全推翻。用户也可以在任何时候把自己的修改重新交给 AI，让它在尊重原有内容和来源的前提下继续工作。

这样，Workspace 才不是 AI 生成文档的容器，而是真正属于用户的、可以持续演化的知识空间。

下一步最值得做的是把这套设计落实为 Artifact Schema 2.0 + Rich Text Editor Specification + Character-level Patch API，这三份规范将直接决定后续编辑器的技术实现。