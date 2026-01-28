# FMO Mobile Controller

> **当前版本**: <!-- VERSION_START -->v1.3<!-- VERSION_END --> | **最后更新**: <!-- DATE_START -->2025-01-28<!-- DATE_END -->

FMO Mobile Controller 是一个专为移动端深度优化的单文件 HTML5 控制器，用于远程控制 FMO 系统并实现低延迟音频流的实时收听与可视化。本项目采用“一次编写，多端运行”的架构，既可作为单文件网页直接运行，也可通过 Cordova 构建为原生 Android 应用。

---

## 📚 目录

- [✨ 核心功能](#-核心功能)
- [🛠 技术栈](#-技术栈)
- [🚀 快速开始](#-快速开始)
- [📦 安装与部署](#-安装与部署)
- [⚙️ 配置说明](#-配置说明)
- [📱 使用指南](#-使用指南)
- [🔧 开发与构建](#-开发与构建)
- [🤝 贡献指南](#-贡献指南)
- [📝 版本历史](#-版本历史)

---

## ✨ 核心功能

### 1. 极致轻量与响应式
*   **零依赖单文件**：所有逻辑（HTML/CSS/JS）集成在一个 `.html` 文件中，部署极其便捷。
*   **智能设备适配**：
    *   **移动端**：垂直堆叠布局，大触控区域，优化单手操作。
    *   **平板/桌面**：自动检测屏幕宽度（>768px），启用网格分栏布局，字体自动放大 20% 以适应大屏阅读。
    *   **iOS 适配**：完美支持刘海屏安全区域 (`safe-area-inset`)。

### 2. 专业级音频处理
*   **低延迟流媒体**：基于 Web Audio API 和 WebSocket 接收 PCM 音频流。
*   **增强型音量控制**：支持 **0% - 200%** 的超宽音量调节范围，采用线性增益映射，确保弱信号也能清晰可辨。
*   **高保真录音**：支持一键录制当前音频并导出为 WAV 格式。

### 3. 炫酷可视化引擎
内置高性能 Canvas 渲染引擎，支持 6 种可视化模式（点击画面循环切换）：
*   **Spectrum**: 增强型频谱图（动态粒子大小/密度，光效渲染）。
*   **Mirror**: 镜像频谱，对称美学。
*   **Waveform**: 实时波形示波。
*   **Oscilloscope**: XY 模式示波器。
*   **Radial**: 径向环绕频谱。
*   **Particles**: 动态粒子流效果。

### 4. 丰富的主题系统
内置 **9 套** 精美主题，覆盖从硬核科技到柔和护眼的多种风格：
*   经典系列：Matrix (黑客帝国), Ocean (深海), Sunset (日落), Light (明亮)
*   **新增系列**：Pink (猛男粉), Purple (基佬紫), Red (蕾丝红), Black (流氓黑)
*   支持平滑色彩过渡动画。

### 5. 强大的远程控制
*   **连接管理**：WebSocket 信令控制，支持断线自动重连、心跳保活。
*   **多设备管理**：记录历史连接设备，支持一键回连。
*   **QSO 日志**：实时推送通联日志，支持点击状态栏星星图标快速查看。
*   **服务发现**：集成 mDNS (Cordova 插件) 自动发现局域网内的 FMO 设备（apk不支持）。

## 🛠 技术栈

| 领域 | 技术/库 | 说明 |
| :--- | :--- | :--- |
| **Frontend** | HTML5, CSS3 | 使用 CSS Variables 实现主题，Grid/Flex 实现布局 |
| **Scripting** | Vanilla JS (ES6+) | 无框架设计，使用 Class 模块化 (`ControlClient`, `Visualizer` 等) |
| **Audio** | Web Audio API | `AudioContext`, `ScriptProcessorNode` 处理 PCM 流 |
| **Graphics** | HTML5 Canvas | `requestAnimationFrame` 实现 60fps 高性能绘图 |
| **Mobile** | Apache Cordova | 将 Web 应用封装为 Android APK |
| **Build** | Node.js | 自研 `build.js` 实现资源提取、版本自增、APK 构建 |

---

## 🚀 快速开始

### 方式一：Web 浏览器直接运行
1.  下载 `fmo-mobile-controller.html` 文件。
2.  在任意现代浏览器（Chrome, Safari, Edge）中打开该文件。
3.  点击右上角 ⚙️ 设置，输入 FMO 服务器 IP 即可连接。

### 方式二：安装 Android 应用
1.  在 `release/` 目录下找到最新构建的 APK 文件（如 `fmo-controller-debug.apk`）。
2.  安装到 Android 手机/平板。
3.  打开应用，即可体验原生级性能。

---

## � 安装与部署

本项目包含自动构建脚本，可将单文件源码转换为 Cordova 项目并打包 APK。

### 环境要求
*   **Node.js**: v14+
*   **Cordova**: 全局安装 (`npm install -g cordova`)
*   **Java JDK**: v11 (Android 构建推荐)
*   **Android SDK**: API Level 35 (构建脚本自动配置)

### 构建步骤
在项目根目录下运行：

```bash
node build.js
```

**脚本将自动执行以下流程：**
1.  **版本管理**：读取 HTML 中的 `data-version`，自动递增版本号（如 1.2 -> 1.3）。
2.  **资源分离**：解析 HTML，将 CSS 和 JS 提取到 `www/css` 和 `www/js`。
3.  **环境检查**：自动创建 Cordova 项目（如果不存在），安装必要插件 (`cordova-plugin-zeroconf`)。
4.  **配置注入**：自动修改 `config.xml` 适配 Android SDK 35，生成自适应图标。
5.  **编译打包**：执行 `cordova build android` 生成 APK。
6.  **产物输出**：APK 将复制到 `release/` 目录。

---

## ⚙️ 配置说明

### 1. 客户端配置 (Runtime)
用户可通过界面右上角的设置面板进行动态配置，配置项将持久化存储于 `localStorage`。

| 配置项 | 说明 | 默认值 |
| :--- | :--- | :--- |
| **Host IP** | FMO 服务器地址 | 空 |
| **Theme** | 界面主题 | theme-matrix |
| **Device History** | 历史连接设备列表 | [] |

### 2. 构建配置 (Build Time)
构建相关的常量定义在 `build.js` 头部，如需修改输出目录或包名请编辑此处。

```javascript
// build.js
const SOURCE_FILE = 'fmo-mobile-controller.html';
const CORDOVA_PROJECT_DIR = path.join(__dirname, 'cordova_app');
// ...
```

<!-- MAINTENANCE_CHECK_START -->
> ⚠️ **维护注意**：
> 若 Cordova 插件或 Android SDK 版本发生重大变更，请检查 `build.js` 中的 `preferences` 数组和插件列表。
<!-- MAINTENANCE_CHECK_END -->

---

## 📱 使用指南

### 界面交互
*   **连接/断开**：点击设置图标 -> 输入 IP -> Connect。连接成功后指示灯变绿。
*   **切换主题**：点击顶栏调色板图标 🎨，在 9 种主题间循环切换。
*   **查看 QSO**：点击顶栏星星图标 ⭐ 或 QSO 按钮，弹出通联日志列表。
*   **音量调节**：拖动滑块，支持 0-200% 增益。
*   **录音**：点击红点按钮开始录音，再次点击停止并下载 WAV。

### 故障排查
*   **连接失败**：请检查手机是否与服务器在同一局域网；检查 IP 输入是否正确（无需输入 `ws://` 前缀）。
*   **无声音**：检查系统音量；确认浏览器是否允许自动播放音频（部分浏览器需交互后才允许播放）。
*   **卡顿**：在低端设备上，尝试切换到较简单的可视化模式（如 Waveform）。

---

## � 开发与构建

### 目录结构

```
fmoaudio/
├── fmo-mobile-controller.html  # [核心] 单文件源码 (开发主入口)
├── build.js                    # [核心] 自动化构建脚本
├── release/                    # 构建产物 (APK)
├── www/                        # 构建过程生成的 Web 资源 (勿直接编辑)
├── cordova_app/                # 自动生成的 Cordova 项目 (勿直接编辑)
└── README.md                   # 项目文档
```

### 开发流程
1.  **修改代码**：直接编辑 `fmo-mobile-controller.html`。
2.  **Web 测试**：在浏览器打开 HTML 文件进行调试。
3.  **构建 APK**：运行 `node build.js`。
4.  **真机测试**：安装生成的 APK 进行验证。

---

## 📚 API 文档

本控制器通过 WebSocket 与 FMO 服务端通信。虽然控制器本身是单文件应用，但其通信协议与 FMO 核心 API 保持一致。

*   **后端通信协议**：请参考 [API_DOCUMENTATION.md](API_DOCUMENTATION.md) 了解详细的 WebSocket 消息格式与信令流程。
*   **内部类接口**：
    *   `ControlClient`: 封装了 WebSocket 连接与心跳逻辑。
    *   `AudioPlayer`: 封装了 Web Audio API 的流处理逻辑。

---

## 🤝 贡献指南

欢迎提交 Issue 和 PR！在贡献代码时请遵循以下规范：

1.  **单文件原则**：请保持所有 Web 逻辑在 `fmo-mobile-controller.html` 中，不要手动拆分文件。
2.  **代码风格**：
    *   JS 使用 ES6+ 语法。
    *   CSS 使用 BEM 命名规范（推荐）。
    *   重要逻辑块请添加中文注释。
3.  **文档更新**：若新增功能，请同步更新本 README 的“核心功能”章节。

---

## 📝 版本历史

<!-- CHANGELOG_START -->
### v1.3 (Current)
*   **New**: 新增 4 款主题 (Pink, Purple, Red, Black)。
*   **Enhancement**: 音量控制范围扩展至 200%。
*   **Enhancement**: 优化可视化粒子效果与性能。
*   **Enhancement**: 平板/桌面端字体自动适配放大。
*   **UX**: 点击星星图标可直接打开 QSO 日志。

### v1.2
*   集成自动构建脚本 `build.js`。
*   实现版本号自动递增。
*   优化 Android APK 图标生成逻辑。

### v1.0
*   项目初始化。
*   实现基础 WebSocket 控制与 Web Audio 播放。
<!-- CHANGELOG_END -->
