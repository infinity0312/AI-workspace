# v3.1 最终验证

2026-11-16。最终目录跳转与低对比纸纹修正后执行：

|检查|结果|
|---|---|
|npm run typecheck（API、Web、Windows、Mobile）|退出0|
|npm run lint|退出0|
|npm run build -w @akw/web|退出0；reports/web-build.log|
|npm run build -w @akw/windows|退出0；reports/windows-frontend-build.log|
|npm run build -w @akw/mobile|退出0；reports/mobile-frontend-build.log|
|node --import tsx --test tests/frontend-rendering.test.ts tests/explorer-v21.test.ts tests/editorial-assets.test.ts（apps/api）|10通过、0失败；包括层级完整性、SCC环路、确定性布局、显式深链、手机窗口截取与旧素材保留|
|新20项素材完整性|20独立ID、20原图/Prompt、60 WebP、字节与格式签名核对；19 Alpha+1不透明纸纹|
|真实运行检查|reports/page-checks.json与renderer-checks.json；无文档横向溢出、无素材失败；截图人工目视详见VISUAL_QA.md|

Windows/Mobile构建保留原有大块JS提示，构建未失败；本轮未扩展为性能架构改造。Web构建为Next静态页构建，不等于已部署。未构建Tauri或APK安装包。

本轮所有浏览器操作通过CUA完成。未运行CLI Playwright：其v2.1像素基线以及旧大图/手机独立整景选择器记录的是旧设计，应重新登记v3.1再执行；不能将其称为当前通过。上一轮69单元、26 E2E仍是历史记录。

真实原数据库未用于预览；隔离预览启动核对见reports/local-preview-proof.json。以上是当前本机合成数据的前端验证，不推论历史远端影响或原用户数据恢复。
