# 12 --- Testing, Acceptance & Failure Scenarios

## 1. 测试层次

-   Unit Tests：领域规则、Schema、权限、Patch。
-   Integration Tests：数据库、对象存储、队列、Model Gateway。
-   Contract Tests：API、事件、客户端同步协议。
-   E2E Tests：用户研究闭环。
-   Load Tests：并发任务、上传、同步和检索。
-   Security Tests：租户隔离、SSRF、Prompt Injection、文件安全。
-   Recovery Tests：备份恢复、任务恢复、断网恢复。
-   Cross-platform Tests：输入法、编辑器、离线和同步。

## 2. 核心用户闭环验收

用户提出一个学习主题后，系统能够： 1. 创建研究任务。 2. 生成计划。 3.
搜索资料。 4. 注册来源。 5. 解析文档。 6. 生成质量报告。 7. 提取
Evidence / Claim。 8. 建立知识关系建议。 9. 生成可编辑 Artifact。 10.
字符级编辑。 11. AI Patch / Diff。 12. 接受或拒绝修改。 13.
保留来源和版本。 14. 导出 Markdown / PDF / DOCX。 15.
在另一设备同步后继续编辑。 16. 任务中断后恢复。 17. 用户完整导出
Workspace。

## 3. 数据完整性测试

-   编辑后断网。
-   编辑后强制关闭应用。
-   服务端提交成功但 ACK 丢失。
-   同一 Mutation 重复提交。
-   两设备并发编辑。
-   Artifact 删除与未同步编辑竞争。
-   Agent Patch 与用户编辑竞争。
-   Schema 升级时旧数据迁移。
-   上传中断与恢复。
-   Embedding 失败但 Artifact 成功保存。

## 4. Agent 质量测试

建立人工标注评测集： - 输出 Schema 合规率。 - Citation Accuracy。 -
Evidence Support Rate。 - Unsupported Claim Rate。 - Tool Permission
Violation（必须为 0）。 - Prompt Injection Resistance。 - Repair Success
Rate。 - Task Completion Rate。 - Cost per Accepted Artifact。

Validator 必须记录 False Positive / False
Negative，并定期校准。多个相同模型的 Judge 一致不能作为事实正确证明。

## 5. 同步测试

-   多设备并发 Mutation。
-   网络抖动。
-   长期离线。
-   Cursor 过期。
-   Snapshot Reconciliation。
-   重复事件。
-   乱序事件。
-   事件投递失败。
-   权限撤销后旧客户端继续提交。
-   客户端旧 Schema。

## 6. 安全测试

-   跨租户 IDOR。
-   跨 Project 越权检索。
-   资源下载 URL 泄漏。
-   SSRF / DNS rebinding。
-   Prompt Injection。
-   恶意 PDF / Office。
-   压缩炸弹。
-   日志敏感数据泄漏。
-   API Key 暴露。
-   越权导出。
-   删除后派生数据残留。

## 7. 跨平台编辑测试

-   中文拼音组合输入。
-   中英文混合。
-   Emoji / Unicode 字素簇。
-   选区和替换。
-   撤销/重做。
-   公式编辑。
-   表格单元格编辑。
-   粘贴复杂格式。
-   图片拖放/导入。
-   保存后重启。
-   跨设备同步后内容一致。

## 8. 关键验收底线

-   用户已确认保存的本地修改不得因网络中断丢失。
-   不允许跨租户数据泄漏。
-   Agent 不得绕过权限和 Patch Gate。
-   Embedding/缓存失败不得导致正式知识丢失。
-   同一 Mutation 重试不得重复产生副作用。
-   任何自动合并都必须可追踪、可撤销。
-   完整备份必须通过真实恢复测试。
-   任何来源支持结论都必须可追溯到 Evidence。
