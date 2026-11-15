# 多端、离线与同步

| 平台/能力 | 状态 | 实现与证据 |
| --- | --- | --- |
| Web | implemented | [Next 客户端](../../apps/web/app)、[Service Worker](../../apps/web/public/sw.js) 和 [本地资料库](../../packages/client/src/lib/local-repository.ts)。本轮 Edge E2E 8/8，验证离线编辑后重连同步、响应布局、证据、版本恢复、LaTeX、图谱、时间线、图表/PDF。 |
| Windows | implemented | [Tauri platform.ts](../../apps/windows/src/platform.ts)、[Rust storage.rs](../../apps/windows/src-tauri/src/storage.rs)。本轮原生 WebView2 隔离冒烟通过。测试使用既有隔离 EXE 和本次 API Build，涵盖 SQLite 持久化、重开、重连同步、独立窗口、通知、OCR、公式、时间线、图表和 PDF 证据。未从这轮测试推断签名安装包或生产分发就绪。 |
| Android | partial | [Capacitor](../../apps/mobile/capacitor.config.ts) 与 [WorkspaceBridge.java](../../apps/mobile/android/app/src/main/java/com/akw/workspace/WorkspaceBridge.java) 有 HTTP、SQLite、剪贴板等代码，当前 adapter 的原生文件选择和通知能力关闭。确认已有 Debug APK，6,637,671 字节。本轮未重建或安装；PATH 和常用 SDK 路径未定位 adb，未取得真机状态。 |
| macOS / HarmonyOS | planned | 共享 [PlatformKind](../../packages/client/src/lib/platform.ts) 有枚举，未定位相应应用、原生桥接、分发配置或实测。 |
| Offline sync | partial | Web IndexedDB 或原生 SQLite 保存服务器副本、草稿和待提交 mutation。服务端以 base revision、幂等键和 outbox cursor 同步；可合并无冲突段落/文本区间，冲突显式报错。Web 与 Windows 本地已验；多设备相互并发、Android 前后台/进程被杀后的恢复待验。 |
| Run 与 Artifact 边界 | implemented | 运行状态与 Session 事件走独立服务端接口；文档草稿通过本地 Repository 和 revision 同步。离线可继续编辑文档，真实模型分析要有可访问后端与本次外发授权。 |

下一平台阶段需要真机验证安装/升级、文件选择、前后台、进程恢复、离线冲突、原生请求取消和凭证储存。现有 APK 仅证明上轮构建链通过。
