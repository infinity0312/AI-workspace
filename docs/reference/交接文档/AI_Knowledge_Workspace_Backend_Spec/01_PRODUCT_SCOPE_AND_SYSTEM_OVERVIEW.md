# 01 --- Product Scope & System Overview

## 1. 产品定义

AI Knowledge Workspace 是面向普通学习者和知识工作者的 AI
赋能知识工作空间。用户输入学习或研究目标，系统自主收集互联网资料、解析文献和多模态内容、提取证据与知识关系，并生成可持续编辑、引用、组织、复用和导出的知识产物。

产品不是以聊天记录为中心，而是以用户长期拥有的知识资产为中心。

## 2. 核心产品决策

-   目标用户：所有有学习需求的普通用户；MVP
    优先验证资料驱动型学习与研究。
-   核心产物：统一 Knowledge Workspace。
-   AI
    自主程度：高度自主，但重要写入、权限提升、外部副作用和高风险修改必须经过策略门控。
-   Agent：混合架构；Orchestrator 统一调度专业 Agent /
    Skills；简单任务单 Agent，复杂任务多 Agent Typed DAG。
-   模型：DeepSeek API 首发，必须经 Model Gateway。
-   关系：用户完全控制项目关联和知识关系；AI
    可以建议，不可擅自改变用户定义的关联边界。
-   编辑：字符级、段落级、结构化对象级、关系级均可编辑。
-   AI 修改：Patch + Diff + Validation；默认不覆盖用户正式内容。
-   导出：同时支持可读格式和完整结构化备份。
-   客户端：Web、Windows、Apple、Android、HarmonyOS；共享数据契约，不强求
    UI 实现完全一致。
-   Android：Capacitor；离线能力 Basic。
-   Workspace 交互：Adaptive，桌面多面板、移动端聚焦式导航。
-   数据架构：Cloud-authoritative + Local-first interaction。

## 3. 核心用户闭环

1.  用户输入主题、问题或学习目标。
2.  系统判断是临时回答、知识片段还是正式 Artifact。
3.  对需要研究的任务制定计划。
4.  搜索并收集来源。
5.  解析 PDF、网页、图片、Office 等资料。
6.  生成 Document、Passage、Evidence、Claim。
7.  进行事实、引用、结构和权限验证。
8.  生成 Artifact 与知识关系建议。
9.  用户阅读、编辑、批注、接受或拒绝 AI Patch。
10. 产物和关系在设备间同步。
11. 用户可导出、备份、复用、持续更新。

## 4. 三类产物生命周期

### 4.1 Transient Response

即时回答，不默认创建正式知识资产；可保存、转化或丢弃。

### 4.2 Knowledge Note

可沉淀的知识片段，例如定义、公式、观点、摘录或个人注释。

### 4.3 Workspace Artifact

正式知识产物，支持版本、引用、关系、导出、长期维护。

AI 可以推荐初始形态，但用户可随时转换、合并或拆分。

## 5. 系统边界

### 客户端

-   UI、富文本编辑器、图谱视图。
-   本地数据库与缓存。
-   本地 Mutation Outbox。
-   本地文件绑定。
-   同步状态与冲突界面。
-   安全凭据存储。

### 主后端

-   身份、租户、权限。
-   Workspace、Project、Artifact、Knowledge、Source 等领域服务。
-   API、Sync、版本、审计、配额。
-   任务编排和事件持久化。

### Agent Runtime

-   Orchestrator、Agent、Skill、Tool Executor。
-   研究计划、执行、验证、修复。
-   模型调用与成本计量。
-   只能通过授权接口读写领域数据。

### Worker

-   文件解析、OCR、Embedding、索引更新、导出、备份、事件投递等异步任务。

## 6. 逻辑架构

``` text
Multi-platform Clients
  ├── Adaptive Workspace UI
  ├── Rich Artifact Editor
  ├── Local DB / Asset Cache
  └── Sync Engine / Mutation Outbox
             │
             ▼
API Gateway / Auth / Tenant Context
             │
  ┌──────────┼───────────┐
  ▼          ▼           ▼
Domain     Sync       Agent Gateway
Services   Service        │
  │          │             ▼
  │          │       Agent Runtime
  │          │       ├── Orchestrator
  │          │       ├── Specialist Agents
  │          │       ├── Skills / Tools
  │          │       └── Validators
  │          │
  └──────┬───┴─────────────┐
         ▼                 ▼
   PostgreSQL          Object Storage
   + pgvector           S3 / MinIO
         │
         ▼
   Redis / Workers / Event Dispatcher
```

## 7. 非目标（MVP 不做）

-   不做完整浏览器替代品。
-   不做通用自动化 RPA 平台。
-   不做多人实时协同编辑。
-   不做公开插件市场。
-   不做所有设备本地运行完整 Agent。
-   不做所有资料默认端到端加密。
-   不做复杂微服务网格。
-   不做全量本地向量索引和全量文件镜像。

## 8. 核心质量属性

-   数据完整性优先于缓存和索引新鲜度。
-   用户编辑优先于 AI 自动修改。
-   权限校验必须服务端执行。
-   异步任务可暂停、取消、恢复和部分完成。
-   数据协议稳定、Schema 可迁移。
-   云端故障时，本地已保存修改不丢失。
-   数据可以完整导出和恢复。
