# 09 --- Security, Privacy & Data Governance

## 1. 安全目标

-   多租户隔离。
-   资源级授权。
-   数据最小化。
-   安全凭据管理。
-   外部内容不可信。
-   文件处理隔离。
-   审计可追踪。
-   用户可导出和删除数据。

## 2. 权限模型

MVP 使用 RBAC + Resource-level checks： - Tenant membership。 -
Workspace membership。 - Project access。 - Artifact access。 - Asset
access。 - Agent Tool permission。

所有授权在服务端执行。客户端隐藏 UI 不能代替权限检查。

跨 Project 关系不自动授予数据访问权限。每次 Agent 检索和 Tool
调用都重新校验权限。

## 3. 数据分级

-   L0 Public：公开资料。
-   L1 Personal：普通个人笔记和学习记录。
-   L2 Sensitive：私人研究、未公开文档。
-   L3 Restricted：密码、密钥、认证信息等，不进入模型上下文。

数据策略至少控制： - storage_mode - sensitivity -
ai_processing_allowed - external_provider_allowed - retention -
offline_allowed - export_allowed

## 4. DeepSeek / 外部模型数据边界

云端模型调用前执行 Data Governance 检查： - 是否允许外部供应商处理。 -
是否需要用户同意。 - 是否需要脱敏。 - 是否属于禁止发送数据。 -
是否超出项目策略。

不得假定 API
调用天然意味着供应商不保留数据；供应商政策、合同和地区要求需独立审查。

## 5. 加密

-   TLS 传输加密。
-   服务端静态加密。
-   KMS 管理主密钥。
-   Envelope Encryption。
-   租户密钥逻辑隔离。
-   客户端凭据放 OS Secure Storage。
-   日志脱敏。

标准云端 AI
处理模式不等于端到端加密。若服务器需调用模型处理明文，服务端处理期间必须能访问内容。

真正 E2EE 作为未来独立架构项目，不得提前作出不准确承诺。

## 6. Prompt Injection

网页、PDF、OCR、邮件、上传文件都是不可信数据。其内容不得改变系统策略、权限或工具定义。

防护： - Tool allowlist。 - 参数 Schema。 - 资源级授权。 - 网络 egress
控制。 - 文件解析沙箱。 - SSRF 防护。 - 敏感信息过滤。 -
重要副作用用户确认。

## 7. 文件安全

-   MIME sniffing。
-   扩展名与内容一致性校验。
-   文件大小和页数限制。
-   恶意软件扫描。
-   压缩炸弹防护。
-   临时目录隔离。
-   解析器资源限制。
-   不执行上传文件中的代码或宏。
-   对外下载使用短时授权。

## 8. SSRF

禁止访问： - localhost。 - 私有网段。 - link-local。 - 云 metadata
endpoint。 - 内部管理端口。

校验 DNS 解析结果和重定向目标，防止 DNS rebinding。只允许必要协议。

## 9. 版权与来源权利

记录： - access_type - license - redistribution_status -
commercial_use_status - full_text_storage_policy -
image_redistribution_policy - source attribution

这些字段不能由 Agent
自行推断为法律结论。来源访问权限与再分发权限必须分离。

不得绕过付费墙；对版权不明确的内容限制全文保存和再分发；支持投诉和下架流程。

## 10. 删除和保留

Data Lifecycle Manager 负责： - 软删除。 - 回收站。 - 永久删除。 -
对象存储删除。 - 派生数据删除。 - 向量索引清理。 - 备份保留策略。 -
删除审计。

删除 Source 时执行依赖分析，不能无差别删除仍由其他 Evidence 支持的
Claim。

## 11. 审计

记录： - 登录和设备变化。 - 权限授予/撤销。 - 数据导出。 - 文件访问。 -
Agent Tool 调用。 - Artifact Patch 接受/拒绝。 - 删除和恢复。 -
安全策略变化。

日志不得包含不必要的原始文件正文、完整 Prompt 或密钥。
