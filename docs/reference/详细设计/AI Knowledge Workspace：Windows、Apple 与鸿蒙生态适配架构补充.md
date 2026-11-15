# AI Knowledge Workspace：Windows、Apple 与鸿蒙生态适配架构补充

CROSS-PLATFORM ARCHITECTURE ADDENDUM · V1.0 · 2026-11-08

我建议将原来的 Android 适配方案升级为一个完整的多端统一知识工作空间架构。

这次不是简单地增加 Windows、macOS、iOS 和鸿蒙客户端，而是要重新考虑一个问题：

不同设备应该共享什么，又应该保留什么平台原生能力？

我们的产品有一个特殊性：它不是普通的聊天软件，而是一个以知识产物为中心的工作空间。

用户可能在 Windows 上进行深度研究，在 iPad 上阅读论文、修改知识图谱，在 iPhone 上查看研究进度，在 Android 或鸿蒙设备上收集资料。

因此，我不建议把所有设备都设计成完全相同的网页界面。

我的核心建议：

- 统一后端和知识数据模型。
- 统一前端业务逻辑和 Artifact Schema。
- 根据平台采用不同的客户端容器。
- 对桌面端、平板端、手机端采用不同的交互布局。
- 对文件系统、通知、分享、后台任务、离线存储等能力使用平台适配层。

## 一、最终支持的设备生态

[FreeDOS Nedir? FreeDOS'a İşletim Sistemi Nasıl Kurulur?](https://images.openai.com/static-rsc-4/to8-lsMbP3Lx-ur0gqUepdHa_8rQNFhS986-TbLqtf1bNKEmJxwgZLgpN7vnyShvsAGVEtr0EEPvZ3v9rrhN7gkoD2ma7Nb4gWzfowOSFasxCWFYKegiVx5_ycfLtEFtJStzKdzPxDCfAc0Kjt0kBaDtXy1vlOZJBYXoqzqVSaw?purpose=inline)

Windows

重点桌面平台

Windows 10/11，优先支持 Windows 11

深度研究、文献管理、知识图谱、多窗口工作流。

[9 trucos de Dropbox para tu iPhone y Mac para exprimirlo al máximo](https://images.openai.com/static-rsc-4/qXyqEeA_oXdTeM9F07VpL3_ECzl2pk4hGR82P5H02K0hNCCdNAjz7TnA_INDYed0U_TUbllPA8eu99x7YQfUbAfODNYnTW21q4Mz9w5nVd4E6xweGTnNSNyLJPwztucKPW9kpqmxsgw9fp9a3Z0qKWBQJeCUUiMXn4H3Zs4b2ms?purpose=inline)

Apple 生态

重点平台

macOS、iPadOS、iOS

Mac 深度工作、iPad 阅读和编辑、iPhone 快速捕获。

[华为开发者联盟-HarmonyOS开发者官网，共建鸿蒙生态](https://images.openai.com/static-rsc-4/Pb8uqgXUaNTXCDdJ5ZvUY4P94us8lbqu5M4c0ohhRxzE-jBHwCH1CY7GkRDAEXQ573sIyNxxJPKKVZA9iH1JFV7F-pIsK5fhZHtN1yKgM1SVzlMDUDwjvajpqI4-tNdqlZQ-1Nkp4U5jdqhkBgbS6TNqulT-dbjlCE3RINvNsUE?purpose=inline)

HarmonyOS 鸿蒙生态

重点移动平台

HarmonyOS 手机、平板及适用的鸿蒙设备

资料采集、知识浏览、阅读、Artifact 编辑和跨设备协同。

[Modern mobile devices](https://images.openai.com/static-rsc-4/5dZb8wvPwIXHozO2Zk2Gv0zvYAvLc0emrhZg3mQZuns4rsXq5p2HVpaXztfhCGHh8wiUvlwoq1FrisPk9K9s6iXZWES00j0RVtJn2xCxlGaIObbSc_m3BICYNg5jqhXrLBUMpTox1JAp1-M6Bz3tocFJ1pzck2eMW-7KW1k2shU_NR-R-yNDV6tONGeifoqK?purpose=inline)

Android

已有路线

Android 手机和平板

延续 Capacitor 路线，与鸿蒙适配层分开管理。

这里需要区分三个概念：

- 跨平台业务：所有设备共享。
- 跨平台 UI：尽量共享，但允许适配。
- 平台原生能力：通过各自的 Adapter 实现。

我不建议为了追求一套代码运行所有平台，而牺牲各个平台的使用体验。

# 二、各平台的技术选型

我建议采用以下技术组合，而不是强行用一个跨平台框架覆盖全部设备。

| 平台         | 推荐方案                 | 定位                    |
| ------------ | ------------------------ | ----------------------- |
| Web          | React / TypeScript + PWA | 统一基础客户端          |
| Android      | Capacitor                | 原生应用容器            |
| iOS / iPadOS | Capacitor iOS            | Apple 移动端            |
| Windows      | Tauri 2                  | 桌面客户端              |
| macOS        | Tauri 2                  | Apple 桌面端            |
| HarmonyOS    | ArkTS + ArkUI + ArkWeb   | 鸿蒙原生宿主 + Web 核心 |
| 浏览器       | Web Extension            | 浏览器资料采集入口      |

## 2.1 为什么不能全部采用 Capacitor？

这是一个需要明确的技术边界。

Capacitor 官方支持的平台主要是 Android、iOS 和 Web，并不把 Windows、macOS 列为官方原生应用目标。虽然有社区桌面方案，但不建议把它作为项目的长期桌面基础。

Capacitor Documentation+1



所以：

- Android 和 iOS 继续使用 Capacitor。
- Windows 和 macOS 使用 Tauri。
- 鸿蒙采用 ArkUI 原生宿主。
- 所有平台复用同一套 Web 业务前端。

## 2.2 Tauri 还是 Electron？

这是 Windows 和 macOS 需要作出的主要技术决策。

[Tauri Logo PNG Vector (SVG) Free Download](https://images.openai.com/static-rsc-4/-QapfYv-2b5Di9rq0f7zMAcOgxdF2Vsvzj_69Cr1eFxYTLic0o8zmn3fA9OgeELSPKydsuL7cEMkAA3JozaMMh_454dSM6uLbvgo3HTUq3BgfmH2Gjj6japPrWH8EJ6QT4O2oMIYWqnb3RLMgJ5mO0a3YEbD30ajTZS278xgwx0?purpose=inline)

Tauri 2

首选

Rust + 系统 WebView

优势：

- 应用体积通常较小。
- 使用系统 WebView，不需要随应用打包完整 Chromium。
- 能通过 Rust 接入文件系统、系统托盘和窗口管理。
- 适合复用现有 React / TypeScript 前端。

不足：

- Windows 使用 WebView2。
- macOS 使用 WKWebView。
- 不同平台的浏览器内核可能带来渲染差异。

Tauri+1

[File:Electron Software Framework Logo.svg - Wikimedia Commons](https://images.openai.com/static-rsc-4/VQLFVr1YlZt98tsYAuFrxWfqklLfHMOuPpzBloVMtaoAGDogClmYswcmDewsmW_pbD2PU9bl0ckhOZU3iSti55pANJNYmnbl4XDeBv9uxfk1K9vjGuiM9krjbEv9gN1oH8qcYM1Zz3vRQ0ja9TtgUNm4GIu2W9c8sfmY0Acsij8?purpose=inline)

Electron

备选

Node.js + Chromium

优势：

- Windows 和 macOS 使用统一 Chromium 环境。
- 桌面生态成熟。
- 对复杂 Web UI、图形渲染和浏览器兼容性比较友好。

不足：

- 通常有更高的内存和安装包开销。
- 需要更谨慎地管理主进程与渲染进程的安全边界。

Electron+1

最终建议：先选 Tauri 2。

我们的知识图谱、Markdown 编辑器、Artifact Renderer、复杂布局都可以继续使用 Web 技术。

但必须建立 Windows WebView2、macOS WKWebView 的自动化兼容性测试。

如果后期发现某些核心图形组件在系统 WebView 上无法稳定实现，再考虑 Electron，而不是一开始就承担 Electron 的全部运行开销。

# 三、Windows 适配方案

重点建设

Windows 是这个产品最适合承载完整工作流的桌面平台。

我建议将 Windows 客户端定位为：

AI Research Studio——深度研究和知识生产工作台。

## 3.1 客户端架构

```
Windows Desktop App
        │
        ▼
     Tauri 2
        │
   ┌────┴─────┐
   ▼          ▼
Web UI     Rust Core
   │          │
   │          ├── File System
   │          ├── System Tray
   │          ├── Notifications
   │          ├── Global Shortcuts
   │          ├── Window Manager
   │          ├── Clipboard
   │          └── Auto Updater
   │
   ▼
API Client
   │
   ▼
Backend API
```

Tauri 负责原生系统集成，React 前端负责工作空间 UI。

不要在 Rust 层重新实现业务逻辑。

## 3.2 必须实现的 Windows 原生功能

| 功能       | 具体用途                       | 优先级 |
| ---------- | ------------------------------ | ------ |
| 文件拖放   | 拖入 PDF、图片、Office 文档    | P0     |
| 文件选择器 | 导入本地资料                   | P0     |
| 系统剪贴板 | 复制知识、粘贴资料             | P0     |
| 系统通知   | Agent 任务完成通知             | P0     |
| 多窗口     | 同时打开不同 Artifact          | P1     |
| 系统托盘   | 查看运行任务和快速入口         | P1     |
| 全局快捷键 | 快速捕获、呼出搜索             | P1     |
| 文件关联   | 双击打开 Workspace 导出的文件  | P1     |
| 右键菜单   | 对网页、文件和知识节点执行操作 | P1     |
| 自动更新   | 客户端版本更新                 | P1     |

## 3.3 Windows 的专属工作流

我建议开发三个比较有价值的功能。

A. 全局快速捕获

例如用户在浏览网页、阅读 PDF 或使用其他软件时：

按下自定义快捷键，弹出快速捕获窗口。

Quick Capture

Windows

当前资料

Graph Neural Networks for Materials Science

保存到 Workspace

Materials Research

自动提取摘要与关键知识

概念交互示意

B. 文件系统集成

支持：

- PDF 直接拖入。
- 多文件批量导入。
- 目录批量扫描。
- 导入后自动识别文档类型。
- 自动建立 Source 和 Document 记录。

但不建议默认监控用户所有本地目录。必须让用户主动选择授权目录。

C. 多窗口知识工作流

例如：

- 窗口 1：原始论文。
- 窗口 2：AI 分析结果。
- 窗口 3：知识图谱。
- 窗口 4：Artifact 编辑器。

这对复杂学习和研究场景非常有价值。

## 3.4 Windows 发布形式

建议支持：

- `.exe` 安装程序。
- `.msi` 安装包。
- Microsoft Store 分发（后期）。

初期优先支持 Windows 11 x64，随后验证 Windows ARM64。

# 四、Apple 生态适配方案

Apple 生态不能只理解为 iPhone。

我们的目标应当是：

- iPhone：资料捕获与快速学习。
- iPad：阅读、标注、编辑和多任务。
- Mac：完整知识工作空间。

## 4.1 iPhone：Capture & Learn

[Capacities  Notes  PKM for iPhone -  Download](https://images.openai.com/static-rsc-4/gCznio7mkjinN7cwSjyL-RpZuRVGNOFzvhQgorxxbzh8mXSkFrns1VyYQd-QxmpzB8otJMpWN4133Qy4Pv3VdJnprWCnsuHt71tPdgow1oZv-CjKL8CIbagBT8TeDz7hCj0RnUdSwEKSQTxrK5Jt1RUKy0O0Nq_URX6LSiX2FpA?purpose=inline)

[Highlights: PDF Reader & Notes - Productivity App | MWM](https://images.openai.com/static-rsc-4/NhFI-bRVqhs7-wFMKPzw15ArmRG5YVqu27HIOU-LZ6XRj3FkUOrxFo8QcT-nzmYcrnHKRbRMDNY3vewUtUXO5G5sOZYwGHR3WelehH_ViEdMrleNxi9mIEN74VJs67WW5SbKexkmUSaSfKKjtD8oI2QesPWR44IpyQApqih0uFk?purpose=inline)

[Obsidian for iOS and Android](https://images.openai.com/static-rsc-4/cfDMJRJmTg4gxgS0aKy_vBhWE7XBHcM4k6B0a_dr9Ch8MONa2f_W9IwQxAOR-gPnfAMyykUvrS9V1NwkjyKNH9Cr6tvf1HffPInBsfynPKBU-op15gJLOgEDzcNOYwgPl5OGQ-KBWxT2tuPlZV80G2HnXRVqoMkUHrdRr_43LWQ?purpose=inline)

10

继续使用 Capacitor iOS。

Capacitor 的 iOS 容器使用 WKWebView，并且可以通过原生 Swift / Objective-C 插件与系统能力交互。

Capacitor Documentation



建议实现：

| 功能                       | 具体用途                  |
| -------------------------- | ------------------------- |
| Share Extension / 系统分享 | 从 Safari、邮件等分享资料 |
| 文件导入                   | 从 Files 导入 PDF         |
| 相机和图片                 | 拍摄书籍、笔记、图表      |
| 系统剪贴板                 | 快速收集文字              |
| 本地通知                   | 研究任务完成提醒          |
| 安全存储                   | 保存认证凭据              |
| 本地缓存                   | 离线阅读和编辑草稿        |

iPhone 不需要完整展示桌面工作空间。

重点是让用户能够：

1. 捕获资料。
2. 快速提出学习问题。
3. 查看 AI 整理的结果。
4. 编辑简短内容。
5. 查看研究进度。
6. 将资料发送到某个 Workspace。

## 4.2 iPad：Research & Reading

[Research Made Easy: Highlights App + Apple Notes on iPad | by A.Yehia | Medium](https://images.openai.com/static-rsc-4/KgliLc1i5mgk31T-WCD0-H5tzz9HesZJVCRdqSZUuVaemV4Kdj9uSX-DV7ZNGY9bkHZN5lqEbe-nDqT_ABTd_8ryfBBUMLiudt5CqGgeIbXoyXddqoeT95NUYLc7ov_1N3Wuq7G0y4KF8kPg5QFlMk9dCVCayZYCD5nNGzZlhKM?purpose=inline)

[大學生必備的6大實用「iPad筆記App」推薦！GoodNotes網激推、CollaNote免費功能超夠用，讓你學習不受限！ | iPad、筆記、App | 生活發現 | 妞新聞 niusnews](https://images.openai.com/static-rsc-4/5i3uNID3t3RT7ZL-Ravc1DoU0Gee00p2Ym8wJ_mlUGHeilckkf8c5E6mJF7UjDLqUXdP_t9p0eePYlN7TLYoKt6EoDoFC174XFjB9SFEL-dU1Yvv4yGgu75pB0-EiE4HONDue3cps9b6aAmS7Qd0pRVPVXK3b4BUX6ehq0dhbSM?purpose=inline)

[Hypernotes Software Reviews, Demo & Pricing - 2026](https://images.openai.com/static-rsc-4/LvC-9YyD4XC9ipWgSyHRkaPpSJUtulpritUfaIdnjWj6HNAUCp5ntDysdGjF_Jq5LndXJ5q6Kocl8mw62s7LphVJ-_QCvwq2PJFqroY8r-MlW-kZhi8c_CB3FwQ132AEPi7ls8zck5FDlOTDyUJJgkQGoFxQYl1GeFQ99ZivOJY?purpose=inline)

9

iPad 不应该只是放大版 iPhone。

它应该成为介于桌面端和手机端之间的完整工作平台。

建议支持：

- 左侧 Workspace 导航。
- 中间 Artifact 编辑器。
- 右侧 AI 助手和资料引用。
- PDF 与知识笔记并排。
- Apple Pencil 手写批注。
- 键盘快捷键。
- 鼠标和触控板。
- 拖放资料。
- 分屏和多窗口。

Apple 官方的人机交互指南明确强调 iPad 应当兼顾触控、Apple Pencil、键盘、指针和多任务交互。

Apple Developer Documentation+1



我建议将 iPad 的主要工作模式设计成：

iPad Research Workspace

三栏模式

Workspace

项目

资料

知识

Artifact

研究摘要

知识内容...

图表与引用

AI Panel

资料来源

关键结论

执行记录

仅为布局示意，实际布局根据设备尺寸动态调整。

建议第一版实现双栏和三栏自适应，之后再实现原生多窗口能力。

## 4.3 macOS：完整桌面端

macOS 建议使用 Tauri 2，而不是再额外使用 SwiftUI 重写整个前端。

原因：

- 已经有 React / TypeScript 前端。
- Tauri 能够复用前端业务代码。
- 可以直接利用 Mac 的文件系统、菜单、窗口和通知。
- 可以与 Windows 桌面端共用大部分桌面架构。

Mac 端重点实现：

- Finder 拖放。
- 多窗口。
- 原生菜单栏。
- 键盘快捷键。
- 系统分享。
- 文件导入与导出。
- 快速搜索。
- 桌面通知。
- Spotlight / 快速启动入口（后期）。
- Apple Silicon 原生构建。

不推荐现在使用 Mac Catalyst。

Mac Catalyst 的主要价值是把 iPad UIKit 应用适配到 Mac，而我们现有的主体是 Web 前端，直接引入另一套 UIKit UI 架构会增加维护成本。

Apple Developer Documentation+1



## 4.4 Apple 跨设备同步

不建议把 iCloud 当成主要知识数据库。

我们的核心数据应该始终以自有后端为权威：

```
iPhone ──────┐
             │
iPad ────────┼──── Backend
             │
Mac ─────────┘
```

iCloud 可以作为后期可选的文件导入、导出和系统级集成能力，但不应该产生第二套知识资产真相来源。

# 五、HarmonyOS 鸿蒙生态适配方案

建议独立建设适配层

鸿蒙是这次平台扩展中最特殊的一部分。

我不建议简单地把 Android APK 改一下就认为完成鸿蒙适配，也不建议直接假定 Capacitor 能够完整覆盖 HarmonyOS NEXT。

建议采用：

ArkTS + ArkUI + ArkWeb + JavaScript Bridge

这套架构可以复用现有 Web 前端，同时保留鸿蒙的原生系统能力。

华为官方提供 ArkTS 声明式开发范式、ArkUI 原生 UI 框架，以及 ArkWeb Web 页面嵌入能力。ArkWeb 还支持通过 JavaScriptProxy 实现 Web 页面与原生应用交互。

华为开发者+1



## 5.1 鸿蒙客户端总体架构

![mermaid-diagram (12)](C:\Users\Y9000P-2025\Downloads\mermaid-diagram (12).png)

这里有两个主要部分。

ArkUI：负责鸿蒙原生应用外壳。

包括：

- 应用生命周期。
- 系统导航。
- 系统级弹窗。
- 原生文件选择器。
- 分享面板。
- 通知。
- 原生设备能力。
- 多设备协同入口。

ArkWeb：负责承载已有 Web 工作空间。

包括：

- Workspace。
- Artifact 编辑器。
- Knowledge Graph。
- AI Agent Panel。
- 文献阅读界面。
- 搜索和资料展示。

这样可以避免重新使用 ArkTS 编写整套知识工作空间。

## 5.2 为什么不建议直接使用 ArkTS 重写全部 UI？

因为这样会产生两套前端：

```
React / TypeScript
       │
       ├── Web
       ├── Android
       ├── iOS
       ├── Windows
       └── macOS

ArkTS / ArkUI
       │
       └── HarmonyOS
```

这意味着：

- Artifact Renderer 需要维护两套。
- 编辑器需要维护两套。
- 知识图谱需要维护两套。
- UI 组件需要维护两套。
- 交互状态需要维护两套。

这是很大的长期维护成本。

更合理的是：

```
               Shared Frontend
                     │
          ┌──────────┼───────────┐
          ▼          ▼           ▼
       Capacitor   Tauri       ArkWeb
          │          │           │
       Android    Desktop     HarmonyOS
       iOS        Windows
                  macOS
```

ArkUI 主要负责原生系统能力，复杂业务界面继续由 Web UI 渲染。

不过需要注意，ArkTS 虽然基于 TypeScript 生态，但并不等于能够直接无修改地运行所有普通 TypeScript 代码。应该共享 JSON Schema、API 契约和业务协议，而不是试图共享全部前端组件。

华为开发者+1



## 5.3 HarmonyOS JSBridge 设计

建议定义统一接口：

```
interface HarmonyBridge {

  pickFiles(options: FilePickerOptions): Promise<FileRef[]>;

  shareContent(
    content: SharePayload
  ): Promise<void>;

  readClipboard(): Promise<string>;

  writeClipboard(
    content: string
  ): Promise<void>;

  showNotification(
    notification: NotificationPayload
  ): Promise<void>;

  openExternal(
    url: string
  ): Promise<void>;

  getDeviceInfo(): Promise<DeviceInfo>;

  saveLocalDraft(
    draft: LocalDraft
  ): Promise<void>;

}
```

原生层通过 ArkTS 实现。

Web 层只调用标准接口，不直接接触鸿蒙系统 API。

### 安全要求

JSBridge 绝对不能提供一个无限制的接口：

```
callNative(method, arbitraryArguments)
```

建议改成：

- 方法白名单。
- 参数 Schema 验证。
- 来源域名校验。
- 文件路径授权。
- 敏感操作确认。
- 调用频率限制。

尤其不能允许网页内容通过 JSBridge 随意调用系统文件访问接口。

## 5.4 鸿蒙手机和平板适配

[HUAWEI MatePad Pro 13.2 英寸 - 华为官网](https://images.openai.com/static-rsc-4/WWSaTh2Wmwwtw5mNqiNxGn3vu8EUm4PrD9B9lpypugNwX0YRjyHhSbYdQV3y18dddtyY7Kqa31NZy7pdKRSWNu6N4WVlnHYCui23ZCfCtGIQ6bXmn3dQPZFCgqHYIKBSbM9MLR3Mq9EH8s9Nkb_cmICQpcJ4S1XJ29DbTaj7K88?purpose=inline)

[HUAWEI Mate XTs 非凡大师 - 华为官网](https://images.openai.com/static-rsc-4/EndMpwph1cvQXRLQefXe2bxa7VuMdRU7sie8CYNC9DXtjGUXFo1CbpqsOl3kygJbeLpuS9m6k7QQ0ELVk7jLMnxfklX3Y5mISzQ8ZUwrLktgYVSruRzzhf5xCH0wFOJ9RsE1AGtEMjAatTTZf38V6o0MxuDOskGk5tZEFxIJ4lo?purpose=inline)

[HUAWEI MatePad 2022 - HUAWEI Colombia](https://images.openai.com/static-rsc-4/d-xI7vjRoFWkhKdR5rTUDWiTy-IuRsncmUOfIfnK9XmyGjEFvId3zXOgE83woKlnKFFQUU0yKeq8ODIokncE7fgk6Dw67kVUun2FsalE69vWy3llRAwyj4PB9LX-EFU1GtWHCDtSAlAmCRA77fFalsgVzE9gOE9HwFsDu14cH4E?purpose=inline)

9

第一阶段建议重点适配：

1. 鸿蒙手机。
2. 鸿蒙平板。
3. 折叠屏设备。

不同设备需要不同布局：

| 设备       | 交互方式       | Workspace    |
| ---------- | -------------- | ------------ |
| 手机       | 触控           | 单栏         |
| 折叠屏展开 | 触控           | 双栏         |
| 平板       | 触控、键盘、笔 | 双栏/三栏    |
| 大屏平板   | 多任务         | 完整工作空间 |

华为官方的多设备布局方案也支持通过断点、栅格和分栏布局适配手机、折叠屏、平板和电脑。

华为开发者+1



## 5.5 鸿蒙 PC / 2-in-1 适配

这部分建议放到第二阶段。

不能简单把手机 UI 拉伸到电脑屏幕。

需要额外适配：

- 鼠标悬停。
- 右键菜单。
- 键盘快捷键。
- 窗口缩放。
- 多窗口。
- 文件拖放。
- 键盘焦点导航。
- 横屏与分屏。
- 触控和鼠标交互切换。

华为已经提供针对鸿蒙电脑与 2-in-1 设备的应用适配指导，特别强调自由多窗、键鼠操作和大屏布局。

华为开发者+1



因此建议：

鸿蒙手机和平板优先，鸿蒙 PC / 2-in-1 后续单独验收。

## 5.6 鸿蒙分布式能力

这是鸿蒙生态值得利用的部分，但我不建议把它作为基础数据架构。

可以考虑的场景：

- 手机开始阅读，平板继续阅读。
- 平板浏览资料，电脑继续编辑。
- 手机捕获内容，平板打开对应 Artifact。
- 多设备之间传递当前 Workspace 状态。

华为提供跨设备协同和应用接续相关能力，但其可用范围受到设备版本、应用类型和 API 限制。

华为开发者+1



所以我的建议是：

- 核心同步始终由我们的 Backend 完成。
- 鸿蒙分布式能力只作为体验增强。
- 不将知识数据传输完全依赖于鸿蒙分布式服务。

尤其是后台任务：鸿蒙会对应用退到后台后的进程进行挂起或终止管理。长时间 AI 研究必须由云端 Orchestrator 执行，不能依赖手机一直保持进程运行。

华为开发者+1



# 六、统一的前端架构：一套业务，多种平台容器

这是整套跨平台设计中最重要的工程部分。

我建议增加一个独立的：

Cross-Platform Client Architecture（CPCA）

## 6.1 前端分层

```
Frontend
│
├── Presentation Layer
│   ├── Workspace UI
│   ├── Artifact Renderer
│   ├── Knowledge Graph
│   ├── Agent Panel
│   └── Responsive Layout
│
├── Application Layer
│   ├── Workspace Use Cases
│   ├── Artifact Operations
│   ├── Research Operations
│   └── Knowledge Operations
│
├── Platform Abstraction Layer
│   ├── File Adapter
│   ├── Clipboard Adapter
│   ├── Share Adapter
│   ├── Notification Adapter
│   ├── Window Adapter
│   ├── Secure Storage Adapter
│   └── Background Adapter
│
├── Data Layer
│   ├── API Client
│   ├── Local Database
│   ├── Sync Engine
│   ├── Cache Manager
│   └── Offline Queue
│
└── Platform Implementations
    ├── Web
    ├── Capacitor
    ├── Tauri
    └── Harmony Bridge
```

## 6.2 Platform Adapter

建议统一接口：

```
interface PlatformAdapter {

  readonly platform: PlatformType;

  readonly capabilities: PlatformCapabilities;

  file: FileCapability;

  clipboard: ClipboardCapability;

  share: ShareCapability;

  notification: NotificationCapability;

  storage: StorageCapability;

  window: WindowCapability;

  lifecycle: LifecycleCapability;

}
```

平台类型：

```
type PlatformType =
  | "web"
  | "android"
  | "ios"
  | "windows"
  | "macos"
  | "harmonyos";
```

例如：

Windows：

```
platform.file.pick()
```

内部调用 Tauri。

Android：

```
platform.file.pick()
```

内部调用 Capacitor 插件。

鸿蒙：

```
platform.file.pick()
```

内部调用 ArkTS JSBridge。

前端业务层不需要知道这些差异。

## 6.3 能力检测，不要依赖平台名称判断

不推荐：

```
if (platform === "ios") {
  // ...
}
```

更推荐：

```
if (platform.capabilities.multiWindow) {
  // 启用多窗口
}

if (platform.capabilities.fileSystemAccess) {
  // 启用原生文件操作
}

if (platform.capabilities.systemShare) {
  // 启用系统分享
}
```

因为同一个平台的不同系统版本，能力也可能不同。

还应明确区分：

- 原生文件访问。
- 浏览器文件选择。
- 本地文件缓存。

这三者不能都用一个 `fileSystemAccess` 布尔值表示。

## 6.4 共享程度建议

| 内容                 | 共享比例目标 | 说明       |
| -------------------- | ------------ | ---------- |
| API Client           | 100%         | 完全共享   |
| Artifact Schema      | 100%         | 完全共享   |
| Knowledge Data Model | 100%         | 完全共享   |
| Agent Event Protocol | 100%         | 完全共享   |
| 业务逻辑             | 90%+         | 主要共享   |
| UI 组件              | 80% 左右     | 按平台调整 |
| 页面布局             | 按设备适配   | 不强求相同 |
| 原生能力             | 分平台实现   | 必须解耦   |

这里的百分比是架构目标，不是强制代码覆盖率。

# 七、Adaptive Workspace：统一的多设备交互设计

你之前选择的 Workspace 交互模式是 Adaptive，我建议现在正式把它升级为三个布局模式。

## 7.1 三种核心模式

Focus Mode

手机

[iF Design - DeepRead](https://images.openai.com/static-rsc-4/2M2vaWdNNEC8XbPWbdVKN4amyLwKY4J77msxoMR38fhgxdCb7rnGgYKoAPojIXeUl6mUVBLYtEKAVRSLAsu74gVZnH_bM-Eem2NIhSLny6w-xLXSJLNDde9H1op5uricgDUPH5NcqB7muvYLs-kzDqoqUlW8oVsURdWyzGFo0Mo?purpose=inline)

[ifdesign.com](https://ifdesign.com/en/winner-ranking/project/deepread/686319?utm_source=chatgpt.com)

单栏内容、底部导航、抽屉式 AI 面板、快速捕获。

Split Mode

平板

[生产力最强的鸿蒙设备 华为MatePad Pro系列PC应用引擎黑科技功能将公测 - Huawei 华为 - cnBeta.COM](https://images.openai.com/static-rsc-4/Qzna3vm6kDviVpWlH81-lMXjSLzOWdMyQlCboguOqwFxWtUJe1C9furdS9J4kQ6ML8Eyxft8Wuep8pU4EQh6pGYjkQssB_d576XAmPy1fpaB3eeKUCAPvAXf50RogiFj4X_ArJXQ1NwHmhbmGimf1poCkfgdj-PZEph5b3DSsZY?purpose=inline)

[cnbeta.com.tw](https://www.cnbeta.com.tw/articles/tech/1316961.htm?utm_source=chatgpt.com)

左侧知识导航，中间编辑器，右侧按需显示 AI 或引用。

Studio Mode

桌面

[The Mistake Every Obsidian Beginner Makes | by Prakash Joshi Pax | Medium](https://images.openai.com/static-rsc-4/L56CcL1e2QJttF9pfbcxH5vgaTWD4YtUr6oL-xhS4S5vj071BnjM7myo-AdmA0XD9sWoxko1fCRrBg0x8eh38zxTxVFQPscwcbw7uFZldzchGH3mV41z8JYitMQNBeY8Gt7hIZ7Sg0_652Iu-CkX8rWYK2mEE2ljq7T0rQeJ6Vc?purpose=inline)

[beingpax.medium.com](https://beingpax.medium.com/the-mistake-every-obsidian-beginner-makes-2d7a0a81abd1?utm_source=chatgpt.com)

三栏布局、多窗口、全局搜索、知识图谱、复杂 Artifact 编辑。

## 7.2 响应式断点

建议初始设计：

| 屏幕宽度    | 模式            | 布局             |
| ----------- | --------------- | ---------------- |
| 小于 768px  | Focus           | 单栏             |
| 768–1023px  | Split Compact   | 双栏             |
| 1024–1279px | Split Expanded  | 双栏/三栏        |
| 1280–1599px | Studio          | 三栏             |
| 1600px 以上 | Studio Expanded | 三栏 + Inspector |

不要只依赖屏幕尺寸。

应当优先使用容器查询、可用窗口宽度和实际交互能力决定布局。

例如，Windows 上一个只有 700px 宽的窗口，也应该进入紧凑模式，而不是因为它属于桌面平台就强行显示三栏。

## 7.3 知识图谱的跨平台交互

这是一个需要专门适配的组件。

| 设备 | 图谱展示方式                    |
| ---- | ------------------------------- |
| 手机 | 当前节点 + 邻居列表 + 局部关系  |
| 平板 | 可缩放图谱 + 节点详情           |
| 桌面 | 完整图谱 + Inspector + 多选编辑 |

手机上不要直接缩小整张知识图谱。

节点数量多时，应该采用：

- 以当前节点为中心。
- 逐级展开。
- 关系过滤。
- 搜索节点。
- 切换为树形结构。

桌面端才充分开放自由拖拽、批量编辑和复杂图布局。

## 7.4 输入设备适配

前端设计系统需要统一考虑：

- Touch。
- Mouse。
- Keyboard。
- Trackpad。
- Stylus / Apple Pencil。

例如，节点拖动不能只支持鼠标事件，也不能把长按作为唯一交互。

应该使用统一 Pointer Events，并针对不同输入设备优化。

# 八、跨设备同步与离线架构

原来已经确定的离线策略是 Basic，我建议继续保留，不要因为增加平台就引入复杂的 CRDT 系统。

但现在必须增加一个统一的 Sync Engine。

## 8.1 数据同步架构

![mermaid-diagram (13)](C:\Users\Y9000P-2025\Downloads\mermaid-diagram (13).png)

## 8.2 不同设备的本地存储

| 平台         | 本地存储                          |
| ------------ | --------------------------------- |
| Web          | IndexedDB                         |
| Android      | SQLite                            |
| iOS / iPadOS | SQLite                            |
| Windows      | SQLite                            |
| macOS        | SQLite                            |
| HarmonyOS    | ArkData / SQLite，按 SDK 能力选择 |

不要每个平台都单独发明一套数据格式。

本地数据库可以不同，但必须共享：

- Entity Schema。
- Mutation Protocol。
- Version Protocol。
- Sync Cursor。
- Conflict Resolution Rules。

## 8.3 离线支持范围

| 功能                   | 离线状态       |
| ---------------------- | -------------- |
| 查看最近 Artifact      | 支持           |
| 查看缓存的知识节点     | 支持           |
| 阅读已缓存 PDF         | 支持           |
| 编辑已有 Artifact 草稿 | 支持           |
| 创建本地笔记           | 支持           |
| 建立待同步修改         | 支持           |
| 新增文件待上传         | 支持           |
| 在线 AI 研究           | 不支持直接执行 |
| DeepSeek API 调用      | 需要网络       |
| 多 Agent 研究          | 云端执行       |

注意：离线时可以创建一个待执行的研究任务，恢复联网后再提交 Orchestrator。

不应该在手机后台运行一个复杂的 Agent Runtime。

## 8.4 冲突解决

这是跨设备同步必须重点处理的问题。

例如：

用户在 Mac 上修改 Artifact Version 5，同时在 iPad 上修改 Version 5。

不能采用简单的 Last Write Wins。

建议：

```
{
  "mutation_id": "mut_001",
  "artifact_id": "artifact_001",

  "base_version": 5,

  "operation": "update_block",

  "block_id": "block_003",

  "payload": {
    "text": "Updated content"
  }
}
```

服务端发现当前版本已经变成 Version 6：

1. 检查双方是否修改了不同 Block。
2. 不同 Block 可以尝试自动合并。
3. 同一个 Block 冲突时生成 Conflict。
4. 用户可以选择保留版本、合并内容或重新编辑。

建议采用 Block 级别的版本管理，而不是整份 Artifact 作为一个冲突单位。

## 8.5 后端需要新增的同步接口

| API                                    | 用途             |
| -------------------------------------- | ---------------- |
| `POST /v1/devices/register`            | 注册设备         |
| `GET /v1/devices`                      | 查看已登录设备   |
| `DELETE /v1/devices/{id}`              | 撤销设备授权     |
| `GET /v1/sync/changes`                 | 获取增量变更     |
| `POST /v1/sync/mutations`              | 上传本地修改     |
| `GET /v1/sync/conflicts`               | 获取冲突         |
| `POST /v1/sync/conflicts/{id}/resolve` | 解决冲突         |
| `POST /v1/uploads/sessions`            | 创建文件上传会话 |

建议新增数据库表：

- `devices`
- `device_sessions`
- `sync_cursors`
- `client_mutations`
- `sync_conflicts`

这样，原来的 Agent 和 Knowledge 后端基本不需要因为多端适配而改变。

# 九、一个非常值得增加的功能：浏览器扩展

我认为这个项目不应该急着自己开发一个完整浏览器。

你最初提出的宏大目标是取代传统浏览器的部分学习功能。

对此，我有一个更实际的建议：

先做浏览器扩展，再考虑浏览器本身。

原因是用户已经有 Chrome、Edge、Safari 等浏览器，不需要为了使用你的产品而改变自己的浏览习惯。

## 9.1 浏览器扩展架构

[xTiles Web Clipper](https://images.openai.com/static-rsc-4/8vQtsyExTfq1b0KzaJxnPx6fFb7JmZjWsavG96E6eGb-BnKz0XTNh9nPzHPY9aJiFioHG4kUafww-O_AGUSb1IDDuzSJHjXrcdssevdgto1WXpzr9Z7CXMv6HZdCa64lwy71E0Y4O4HmVWeLa6M9B8Ua-Mf4XeELVLeCP3BErEA?purpose=inline)

[xtiles.app](https://xtiles.app/en/web-clipper?utm_source=chatgpt.com)

建议采用 WebExtension 技术路线。

优先支持：

- Chrome。
- Microsoft Edge。
- 后续 Safari。

核心功能：

| 功能               | 用途               |
| ------------------ | ------------------ |
| Save Page          | 保存当前网页       |
| Capture Selection  | 捕获选中文字       |
| Capture Screenshot | 保存页面截图       |
| Send to Workspace  | 指定项目           |
| AI Explain         | 让 AI 解析当前网页 |
| Create Knowledge   | 生成知识候选       |
| Research Later     | 加入研究队列       |

工作流程：

```
浏览器网页
    │
    ▼
浏览器扩展
    │
    ├── URL
    ├── 页面标题
    ├── 选中文字
    ├── 截图
    └── 用户备注
    │
    ▼
Backend Source Registry
    │
    ▼
Ingestion Pipeline
    │
    ▼
Knowledge Workspace
```

这样用户在任何浏览器里遇到有价值的内容，都可以一键送入我们的知识工作空间。

鸿蒙浏览器的扩展能力需要单独验证，不要依赖与 Chrome 完全相同的扩展机制。可以先通过系统分享和 URL 导入实现同等核心功能。

这个功能的产品价值可能比单纯开发桌面客户端更高。

# 十、更新后的项目代码目录

建议在之前的目录结构上增加以下内容。

```
ai-knowledge-workspace/
│
├── apps/
│   │
│   ├── web/
│   │   ├── src/
│   │   └── public/
│   │
│   ├── mobile/
│   │   ├── android/
│   │   ├── ios/
│   │   └── capacitor.config.ts
│   │
│   ├── desktop/
│   │   ├── src/
│   │   ├── src-tauri/
│   │   │   ├── src/
│   │   │   ├── capabilities/
│   │   │   └── tauri.conf.json
│   │   ├── windows/
│   │   └── macos/
│   │
│   ├── harmony/
│   │   ├── entry/
│   │   │   ├── src/main/
│   │   │   ├── ets/
│   │   │   └── resources/
│   │   ├── arkweb/
│   │   ├── bridge/
│   │   └── native/
│   │
│   └── browser-extension/
│       ├── manifest.json
│       ├── background/
│       ├── content/
│       ├── popup/
│       └── sidepanel/
│
├── packages/
│   │
│   ├── design-system/
│   │
│   ├── platform-contracts/
│   │   ├── file.ts
│   │   ├── clipboard.ts
│   │   ├── share.ts
│   │   ├── notification.ts
│   │   └── capabilities.ts
│   │
│   ├── platform-web/
│   ├── platform-capacitor/
│   ├── platform-tauri/
│   ├── platform-harmony-bridge/
│   │
│   ├── sync-engine/
│   ├── local-storage/
│   ├── artifact-renderer/
│   ├── knowledge-graph/
│   ├── api-client/
│   └── shared-contracts/
│
├── backend/
│   ├── api/
│   ├── application/
│   ├── domain/
│   ├── infrastructure/
│   ├── knowledge/
│   ├── ingestion/
│   ├── retrieval/
│   ├── export/
│   └── sync/
│
├── agent-platform/
│   ├── runtime/
│   ├── orchestrator/
│   ├── agents/
│   ├── skills/
│   ├── validation/
│   ├── model_gateway/
│   └── evaluation/
│
└── docs/
    ├── CROSS_PLATFORM_ARCHITECTURE.md
    ├── DESKTOP_ADAPTATION_SPEC.md
    ├── APPLE_ECOSYSTEM_SPEC.md
    ├── HARMONYOS_ADAPTATION_SPEC.md
    ├── PLATFORM_BRIDGE_SPEC.md
    ├── SYNC_ENGINE_SPEC.md
    ├── OFFLINE_MODE_SPEC.md
    ├── BROWSER_EXTENSION_SPEC.md
    └── DEVICE_COMPATIBILITY_MATRIX.md
```

注意：HarmonyOS 的 ArkTS 项目不能简单地当作普通 React 项目来构建。应该独立使用 DevEco Studio 工具链，和其他前端通过 API Contract、JSON Schema 和桥接协议协作。

# 十一、开发优先级与实施路线

我不建议同时开发六种客户端。

这样会导致前端团队、AI 编程 Agent 和测试资源分散。

建议按以下顺序实施。

## 跨平台开发路线

1. Phase 1：统一 Web 核心

   P0

   - React / TypeScript。
   - Adaptive Workspace。
   - PWA。
   - Platform Adapter。
   - Artifact Renderer。
   - Sync Engine 基础。

   这是所有客户端共享的基础。

2. Phase 2：Android + iOS

   P0

   - Capacitor Android。
   - Capacitor iOS。
   - 原生文件导入。
   - 分享能力。
   - 本地 SQLite。
   - 通知。

   同一移动端前端，分别适配 Android 和 Apple 原生能力。

3. Phase 3：Windows + macOS

   P0

   - Tauri 2。
   - 文件系统。
   - 多窗口。
   - 快捷键。
   - 系统托盘。
   - 桌面版 Artifact 编辑器。

   建设完整研究工作台。

4. Phase 4：HarmonyOS 手机和平板

   P1

   - ArkTS / ArkUI。
   - ArkWeb。
   - JSBridge。
   - 系统分享。
   - 文件选择器。
   - 设备同步。

5. Phase 5：浏览器扩展

   P1

   - Chrome / Edge。
   - 页面捕获。
   - 选中文字。
   - AI 解析。
   - 资料导入。

6. Phase 6：鸿蒙 PC / 2-in-1

   P2

   - 大屏布局。
   - 键鼠操作。
   - 右键菜单。
   - 多窗口。
   - 文件拖放。

这里有一个实际的资源安排建议：Windows 和 macOS 使用同一个 Tauri 项目，Android 和 iOS 使用同一个 Capacitor 项目，不要把六个平台当成六个完全独立的产品开发。

# 十二、跨平台架构需要增加的验收标准

我建议将下面的内容纳入项目测试计划。

| 测试类别 | 验收要求                             |
| -------- | ------------------------------------ |
| UI       | 六种平台都能正确渲染 Artifact        |
| 响应式   | 手机、折叠屏、平板、桌面布局正确     |
| 文件     | 所有平台都能导入 PDF                 |
| 分享     | 支持各平台的资料分享入口             |
| 图谱     | 节点、关系、缩放、筛选正常           |
| 编辑     | Block 编辑、撤销、版本记录一致       |
| 同步     | 跨设备修改能够同步                   |
| 离线     | 离线编辑后能够恢复同步               |
| 冲突     | 不覆盖其他设备尚未合并的修改         |
| 通知     | Agent 完成后正确通知                 |
| 后台     | 应用关闭或挂起不影响云端研究任务     |
| 安全     | 原生桥接接口不能绕过权限验证         |
| 性能     | 大型 Artifact 和图谱不会造成明显卡顿 |

特别增加三个测试场景：

1. 用户在 Windows 上创建 Artifact，在 iPad 上继续编辑。
2. 用户在 iPhone 上离线修改，恢复网络后与 Mac 同步。
3. 用户在鸿蒙平板上导入 PDF，在 Windows 上查看 AI 研究结果。

这三个场景能够验证整套跨平台架构是否真正成立。

# 十三、最终技术决策更新

建议作为正式 ADR

| 模块           | 最终决策                     |
| -------------- | ---------------------------- |
| 统一前端       | React + TypeScript           |
| UI 设计系统    | 自研 Design System           |
| Web            | PWA                          |
| Android        | Capacitor                    |
| iOS / iPadOS   | Capacitor                    |
| Windows        | Tauri 2                      |
| macOS          | Tauri 2                      |
| HarmonyOS      | ArkTS + ArkUI + ArkWeb       |
| 鸿蒙桥接       | Secure JSBridge              |
| 桌面原生能力   | Tauri Rust Adapter           |
| 移动端原生能力 | Capacitor Native Plugins     |
| 本地存储       | SQLite / IndexedDB / ArkData |
| 离线策略       | Basic Offline                |
| 数据同步       | 自研 Sync Engine             |
| 冲突解决       | Block-level Versioning       |
| 浏览器入口     | WebExtension                 |
| AI 执行        | 后端 Orchestrator            |
| 跨设备 AI 任务 | 云端持久化执行               |
| 数据权威来源   | PostgreSQL                   |
| 文件权威来源   | S3 / MinIO                   |

## 十四、还需要修改原来的 Agent 与后端架构吗？

我的判断是：核心 Agent 架构不需要改变，只需要增加客户端接入和同步基础设施。

特别是以下部分应该保持完全不变：

- Agent Runtime。
- Orchestrator。
- DeepSeek Model Gateway。
- Skill Registry。
- Validation Engine。
- Evidence Engine。
- Knowledge Engine。
- Artifact Engine。

无论用户使用 Windows、Mac、iPhone、Android 还是鸿蒙设备，发起的研究任务最终都进入同一个后端系统。

![mermaid-diagram (14)](C:\Users\Y9000P-2025\Downloads\mermaid-diagram (14).png)

这样，我们不会因为增加一个平台，就增加一套 Agent 或一套知识数据库。

# 十五、我认为最值得坚持的三个原则

第一，桌面端和移动端不能只是尺寸不同。

桌面端是知识生产工具，移动端是资料捕获、学习和轻量编辑工具，平板则承担两者之间的桥梁作用。

第二，鸿蒙应该适配，但不要为了适配而重写整个前端。

ArkUI 负责系统级能力，ArkWeb 负责共享业务界面。只有在确实需要原生体验的地方，才逐步增加 ArkTS 原生组件。

第三，跨设备协同的核心不是设备之间直接传输数据，而是所有设备围绕同一份知识资产协作。

用户不应该关心 Artifact 是在哪台设备创建的，也不应该关心 Agent 是在哪台设备发起的。

他只需要在任何设备上打开同一个 Workspace，就能看到一致的知识资产、研究进度和编辑状态。

最终产品形态应该是：一个统一的 AI 知识工作平台，拥有 Web、桌面、移动、鸿蒙和浏览器入口，而不是五六个彼此独立的客户端。

下一步我最建议先把这次补充固化成 `CROSS_PLATFORM_ARCHITECTURE.md`、`PLATFORM_BRIDGE_SPEC.md` 和 `SYNC_ENGINE_SPEC.md`，再让 Codex 按照统一前端、平台适配器和原生能力边界实施，避免开发过程中出现重复实现。