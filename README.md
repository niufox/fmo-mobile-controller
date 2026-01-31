
# FMO Mobile Controller 🎙️

一款专为业余无线电爱好者设计的移动端控制界面，支持实时音频流处理、可视化效果、语音识别和QSO日志管理。

## ✨ 主要特性

### � 音频处理
- **实时音频流**: 支持8kHz PCM音频流的实时接收和播放
- **音频可视化**: 7种可视化模式（频谱、波形、示波器、粒子效果等）
- **本地静音**: 500ms延迟缓冲，避免本地发射时的回音干扰
- **录音功能**: 支持录制音频并导出为WAV格式

### 🎤 语音识别
- **实时转录**: 基于SiliconFlow API的实时语音识别
- **呼号检测**: 自动识别和显示接收到的呼号
- **字幕显示**: 实时字幕叠加，支持流式输出效果
- **多语言支持**: 支持中文语音识别

### 📻 台站管理
- **WebSocket连接**: 实时连接FMO服务器
- **台站列表**: 网格布局显示可用台站
- **快速切换**: 支持上下台切换和直接选择
- **设备发现**: 自动发现网络中的FMO设备（android不支持）

### 📊 QSO日志
- **日志管理**: 完整的QSO记录和查询功能
- **地图集成**: 内置Maidenhead网格定位系统
- **呼号标记**: 实时显示呼号是否在日志中
- **数据持久化**: 本地存储QSO记录

### 🎨 界面特性
- **响应式设计**: 完美适配移动端和桌面端
- **主题系统**: 8种预设主题，支持深色模式
- **触摸优化**: 专为触摸操作优化的界面
- **性能优化**: 60fps流畅动画，iOS滚动优化

## � 快速开始

### 环境要求
- 现代浏览器（Chrome, Firefox, Safari, Edge）
- WebSocket支持
- Web Audio API支持
- 移动设备推荐iOS 12+ 或 Android 8+

### 本地运行

直接访问 http://180.76.54.163 使用最新版本

android 下载 release/fmo-controller-debug.apk 安装（手机端暂时不支持录音）



```bash
# 克隆项目
git clone https://github.com/niufox/fmo-mobile-controller.git

# 进入项目目录
cd fmo-mobile-controller

# 启动开发服务器
pnpm run dev
# 或
python3 -m http.server 8080

# 访问应用
打开浏览器访问 http://localhost:8080
```

### 连接FMO设备
1. 确保FMO设备已启动并连接到同一网络
2. 在设置中输入FMO设备的IP地址
3. 点击"CONNECT"按钮建立连接
4. 开始享受实时音频和控制功能

## 📱 移动端使用

### iOS Safari
- 添加到主屏幕以获得最佳体验
- 支持离线运行和全屏模式
- 优化的触摸滚动和手势操作

### Android Chrome
- 支持添加到主屏幕
- 完整的PWA功能支持
- 优化的性能和电池使用

## 🔧 技术架构

### 前端技术
- **纯原生JavaScript**: 无框架依赖，极致性能
- **ES6 Modules**: 现代模块化架构
- **Canvas API**: 高性能音频可视化
- **Web Audio API**: 专业音频处理
- **WebSocket**: 实时双向通信

### 音频处理
- **采样率**: 8kHz，16位，单声道
- **缓冲策略**: 500ms前向缓冲，防止音频中断
- **音频链**: HPF → EQ → Compressor → Gain → Output
- **可视化**: 实时频谱分析和波形显示

### 语音识别
- **API服务**: SiliconFlow Cloud API
- **模型**: TeleAI/TeleSpeechASR
- **分段策略**: 基于呼号事件的智能分段
- **延迟优化**: 本地缓存和批量处理

## 🎨 可视化模式

1. **SOLAR SYSTEM**: 太阳系动画，呼号显示在行星上
2. **SPECTRUM**: 经典频谱分析仪
3. **MIRROR**: 镜像频谱效果
4. **WAVEFORM**: 实时波形显示
5. **OSCILLOSCOPE**: 示波器风格
6. **RADIAL**: 圆形频谱显示
7. **PARTICLES**: 粒子效果可视化

## � 配置选项

### 音频设置
- 音量控制（0-100%）
- 本地静音开关
- 录音功能
- 音频质量设置

### 显示设置
- 主题切换（8种主题）
- 可视化模式选择
- 字幕开关和位置
- 全屏模式

### 网络设置
- 设备IP配置
- 历史设备管理
- 自动发现功能
- 连接状态监控

## 🔌 API集成

### WebSocket协议
- 控制连接: `ws://[ip]/ws`
- 音频流: `ws://[ip]/audio`
- 事件流: `ws://[ip]/events`

### 语音识别API
- 提供商: SiliconFlow
- 模型: TeleAI/TeleSpeechASR
- 支持语言: 中文、英文

## 🐛 常见问题

### 连接问题
- **无法连接**: 检查设备IP和网络设置
- **音频中断**: 检查网络质量和缓冲设置
- **识别失败**: 验证API密钥和网络连接

### 性能问题
- **卡顿**: 关闭不必要的可视化效果
- **电池消耗**: 降低屏幕亮度，关闭复杂可视化
- **内存使用**: 定期清理浏览器缓存

### 兼容性问题
- **iOS滚动**: 已优化触摸滚动性能
- **Android音频**: 支持最新Chrome版本
- **桌面端**: 支持所有现代浏览器

## 🤝 贡献指南

欢迎提交Issue和Pull Request来改进这个项目！

### 开发设置
```bash
# 安装开发依赖
pnpm install

# 运行lint检查
pnpm run lint

# 格式化代码
pnpm run format
```

### 提交规范
- 使用清晰的提交信息
- 添加适当的测试
- 更新文档和README
- 遵循项目代码风格

## � 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- FMO老板娘、老板和FMO深度搜索1群全体FMOER
- 开源社区的支持和贡献

## 📞 联系方式

bg5eit 73

- GitHub Issues: [项目Issues](https://github.com/niufox/fmo-mobile-controller/issues)
- 项目主页: [GitHub Repository](https://github.com/niufox/fmo-mobile-controller)
- APK下载: [Release页面](https://github.com/niufox/fmo-mobile-controller/releases)

---

**⚠️ 重要提醒**: 本项目仅供业余无线电爱好者学习和交流使用，请勿用于商业用途。请遵守当地无线电管理法规。