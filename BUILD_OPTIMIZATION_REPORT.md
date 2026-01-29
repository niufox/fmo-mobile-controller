# FMO 构建系统优化与修复报告

本报告针对 `build.js` 的修改以及对 `fmo-mobile-controller.html` 的构建处理进行了总结，并提出进一步的优化建议。

## 1. 已实施的修复与优化 (Implemented in `build.js`)

我们修改了构建脚本 `build.js`，在**不修改源文件** `fmo-mobile-controller.html` 的前提下，实现了以下功能：

### 1.1 禁用自动连接 (Auto-connect Disabled)
- **问题**：原应用启动后会自动尝试连接 `fmo.local`，这在某些网络环境下可能导致体验不佳或不必要的错误。
- **修复**：在构建过程中，通过正则匹配识别并注释掉了自动连接的逻辑块（`setTimeout` 代码段）。
- **结果**：生成的 APK 启动后将处于空闲状态，等待用户手动输入地址连接。

### 1.2 移除 Alert 弹窗 (Remove Alerts)
- **问题**：应用中使用 `alert()` 进行错误提示（如“请先连接音频”），这种原生弹窗会阻断用户操作，体验较差。
- **修复**：构建脚本将所有的 `alert(...)` 调用替换为 `console.log('Alert suppressed:', ...)`。
- **结果**：错误信息将记录在控制台，不再弹出干扰用户的对话框。

### 1.3 移植 API 2.0 库 (Transplant API 2.0)
- **操作**：将 `/fmo-player/api2.0` 目录下的所有 JS 文件自动复制到构建产物的 `js/api/` 目录，并在生成的 `index.html` 中注入 `<script>` 引用。
- **目的**：为应用升级到模块化架构做准备。
- **现状**：虽然库文件已注入，但原有的 `app.js`（提取自 HTML）仍使用旧的逻辑。这是一个过渡状态，新 API 已就绪可供调用。

### 1.4 配置注入 (Configuration Injection)
- **操作**：根据 `API_DOCUMENTATION_v2.md`，确认并注入了 `WS_CONFIG`（包含 `WS_PATH: '/ws'`），确保 WebSocket 连接符合 API 2.0 标准。

---

## 2. 进一步优化建议 (Proposed Optimizations)

虽然构建脚本已解决了燃眉之急，但为了长期的可维护性，建议进行以下重构（需要在源文件层面进行）：

### 2.1 彻底重构前端架构
- **现状**：核心逻辑通过构建脚本从 HTML 中提取，这是一种脆弱的“胶水”代码。
- **建议**：
  1.  **废弃嵌入式 JS**：将 `fmo-mobile-controller.html` 中的 JS 逻辑彻底剥离，重写为独立的 ES Module 项目。
  2.  **对接 API 2.0**：修改 `app.js` 逻辑，使其直接实例化 `api2.0` 中的 `WebSocketService`, `ConfigService` 等类，而不是使用当前单文件的 `ControlClient`。
  3.  **UI/Logic 分离**：使用现代前端框架（如 Vue 或 React）或即使是原生 JS，也应将视图更新逻辑与网络通信逻辑分开。

### 2.2 改进错误反馈机制
- **现状**：我们通过构建脚本“屏蔽”了 `alert`，但这导致用户在出错时（如录音失败）得不到任何反馈。
- **建议**：
  - 引入一个轻量级的 Toast 库（如 `Toastify` 或简单的自定义 CSS 提示）。
  - 在 `app.js` 中封装一个统一的 `notify(msg, type)` 函数。
  - 将原来的 `alert()` 替换为 `notify()` 调用，而不是仅仅 `console.log`。

### 2.3 Cordova 构建环境
- **建议**：当前的构建脚本依赖于本地已安装好 Android SDK 和 Cordova 环境。建议添加 `Dockerfile` 或 CI/CD 配置，将构建环境容器化，确保在任何机器上都能一键生成 APK。

## 3. 总结
当前的 `build.js` 已经作为一个强大的“预处理器”，成功在不触碰遗留代码的情况下实施了关键的业务规则变更（禁用自动连接、移除弹窗）。生成的 APK (`fmo-controller-debug.apk`) 现已符合您的即时需求。
