# 前端实施审计（2026-11-15）

依据两个前端执行包及仓库真实实现。文档中的首轮等待确认模板不覆盖本次完成实现的用户请求。

## 页面、组件与共享边界

Next.js / Tauri / Capacitor 共用 `packages/client`。`WorkspaceApp` 管理工作空间、页面、离线副本、同步和面板；`TaskStart` 调用 browse/tasks；`DocumentCanvas` 统一正文与投影视图；`ArtifactEditor`、`SelectionProposals` 和版本页沿用 Patch/Revision。来源、搜索、学习、监测、知识维护、导出、回收站均已有真实 API。缺项目概览和活动聚合入口。

## 视觉差距与实施

原有暖纸色 token 已存在，但首页为堆叠表单，导航平铺十二项，缺上下文栏、项目档案和专业知识视图。建立语义 token、四组导航、首页编辑式构图、项目与活动入口；复用原工作流。引入生成的概念插画而非静态数据图。手机提供抽屉/底部检查器，支持键盘、浅深主题与 reduced-motion。

## 必须保留

`api.ts` → platform request；IndexedDB/SQLite 持久化后才提示保存；Outbox ACK/409 冲突；UTF-16 选区和 base revision；Patch 审核；真实任务阶段；外部服务逐次授权；viewer 权限；搜索链接与证据区分；归档预检恢复；所有原有页面入口。用户已有 README 和 web/package.json 修改不可覆盖。

## 验证范围

类型检查、lint、现有 API 单元测试与 E2E；新增视图语义、项目过滤、活动恢复、空主张、表格缺失值、390/360/768/1280/1440 浅深布局回归。性能数据仅在有实际测量时报告；不声明原生设备已验收。
