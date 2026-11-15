# Windows 桌面适配交接

Windows 使用 Tauri 2、WebView2 与 Rust 系统桥接。Web 的 Next.js 壳和 Windows 的 Vite 壳使用同一个 `packages/client`，共享界面、编辑器、API Client、Sync Engine 和数据契约。

## 本机运行

前置依赖是 Node.js、Rust MSVC、Microsoft C++ Build Tools 和 WebView2 Runtime。现有 Windows 主机的 MSVC 安装在 F 盘。PowerShell 中可执行：

```powershell
Set-Location F:\ai-knowledge-workspace
npm.cmd ci
npm.cmd run build -w @akw/api
$env:AKW_VS_DEV_CMD = 'F:\dev\VisualStudio\2022\Community\Common7\Tools\VsDevCmd.bat'
.\scripts\windows-env.cmd npm.cmd run build:windows -- --debug --no-bundle
npm.cmd run start:windows
```

常规 Visual Studio 安装可由 `vswhere` 识别，已打开 Visual Studio Developer PowerShell 时可直接运行 npm 脚本。想改 UI 时，先启动 API，再执行 `npm.cmd run dev:windows`。默认 API 为 `http://127.0.0.1:4100`。本机启动器复用可用的 API，否则启动已构建的 API。关闭主窗口会隐藏到托盘，使用托盘「退出」结束程序。

## 已接入的桌面行为

| 能力 | 实现 |
| --- | --- |
| 文件选择与拖入 | 原生多选文件、拖放、选择文件夹后扫描第一层文件，预览后提交。单次最多 24 个文件，每个文件至多 8 MiB。 |
| 导入与证据 | PDF、正文、Markdown、HTML、DOCX、PPTX、XLSX、PNG、JPEG。Office 定位区分段落、幻灯片顺序和工作表与单元格。图片使用随依赖安装的本机中英文 OCR，界面呈现置信度和质量提示。 |
| 系统剪贴板 | 来源粘贴、文档正文复制。系统托盘或设置页显示的快捷键可进入快速捕获。通过启动环境变量 `AKW_QUICK_CAPTURE_KEY` 可指定首选组合键。剪贴板内容先预览。 |
| 通知和托盘 | 活跃工作空间的研究任务在完成、部分完成或失败时发出 Windows 通知。托盘提供打开、快速捕获、退出和运行计数。 |
| 多窗口 | 文档可在独立窗口打开。同一文档复用已有窗口，多个窗口共享 SQLite 与同步协议。 |
| 导出 | 使用 Windows 保存对话框保存已生成的产物。 |
| SQLite | 文档工作副本、Mutation Outbox、设备序列和游标保存在本机 SQLite。WAL、事务式比较交换与服务端幂等共同保护写入。 |

本机对象存储由 API 管理。系统选中的文件只授予当前窗口短期访问，页面收到文件名和不透明 ID。桥接层只访问绑定于回环地址的 `/v1` API，DeepSeek 凭据由后端读取。

## 模型配置与验收

将 `DEEPSEEK_API_KEY` 保存在仓库根目录的本机 `.env`。可使用 `DEEPSEEK_MODEL=deepseek-flash`。修改配置后重启 API。在「设置」开启工作空间级外部服务策略，并对每次请求单独授权。从首页的「你想学会什么？」提交学习目标。后台准备学习路径与证据，通过核对的内容写入学习产物。已有普通文档也可以从「AI 生成分析」预览后采纳提案。

```powershell
npm.cmd run test:deepseek
.\scripts\windows-env.cmd npm.cmd run test:windows
npm.cmd run test:windows:ui
npm.cmd run test:windows:learning
```

独立 DeepSeek 回归使用合成资料，Windows 学习验收使用公开教材与论文。桌面测试使用独立 API、SQLite 和 WebView2 配置目录，覆盖离线保存、应用重启、恢复同步、独立窗口、快捷键注册、通知桥接和 OCR 结果。Windows 通知最终显示受系统通知设置影响。原生文件打开、拖放与另存的实选步骤仍需在交互桌面验收。

## 多端扩展

`packages/client/src/lib/platform.ts` 定义文件、剪贴板、通知、多窗口、下载、存储、请求传输的能力边界。Web 使用同源 API 和 IndexedDB，Windows 使用受限 IPC 和 SQLite。后续 Capacitor、macOS 或 HarmonyOS 可接入对应实现，继续复用 Artifact、Patch、Mutation 和 Cursor 契约。

## 发布边界

包含文档分析入口的 x64 NSIS 与 MSI 构建位于 `apps/windows/src-tauri/target/release/bundle`。如果旧程序仍在系统托盘，先保存文档并从托盘退出，再执行 `npm.cmd run start:windows`。两种安装包未签名，已验证打包生成，安装流程仍待验收。安装程序的桌面壳使用已有本机 API。代码签名、签名自动更新、Explorer 文件关联、右键集成与 Microsoft Store 发布仍需后续配置与验收。当前 Office 提取为正文、幻灯片文本和单元格内容，OCR 面向独立 PNG/JPEG。扫描 PDF、Office 嵌图、复杂版面与旧版 Office 文件仍待扩展。
