 # FMO Player API 文档

## 概述

FMO Player 提供了三个版本的 API（1.0、2.0 和 3.0），用于与 FMO 音频设备进行通信。这些 API 主要基于 WebSocket 协议，提供配置管理、音频播放、远程控制等功能。

## API 架构

### 连接方式
- **WebSocket 地址**: `ws://fmo.local/ws`
- **音频流地址**: `ws://fmo.local/audio`
- **基础 URL**: `http://fmo.local/`

### 消息格式
所有 WebSocket 通信均使用 JSON 格式：

```json
{
  "type": "服务类型",
  "subType": "操作类型",
  "data": {
    // 具体参数
  }
}
```

## API 版本比较

| 特性 | API 1.0 | API 2.0 | API 3.0 |
|------|---------|---------|---------|
| 基本功能 | ✅ | ✅ | ✅ |
| WebSocket 服务 | ✅ | ✅ | ✅ |
| 配置管理 | ✅ | ✅ | ✅ |
| 音频播放 | ✅ | ✅ | ✅ |
| 远程控制 | ✅ | ✅ | ✅ |
| QSO 日志 | ✅ | ✅ | ✅ |
| WiFi 控制 | ✅ | ✅ | ✅ |
| 代码结构 | 基础实现 | 优化实现 | 最新实现 |
| 文件组织 | 分散文件 | 模块化改进 | 完全模块化 |

## 核心服务模块

### 1. WebSocket 服务 (webSocketService.js)

所有版本的 WebSocket 服务实现基本相同，提供以下功能：

- **连接管理**: 自动重连机制，状态管理
- **消息订阅/取消订阅**: 事件监听器模式
- **消息发送**: 统一的消息发送接口

#### 方法

```javascript
// 连接 WebSocket
connect()

// 订阅事件
subscribe(event, callback)

// 取消订阅
unsubscribe(event, callback)

// 发送消息
send(type, subType, data)
```

#### 事件类型

- `open`: 连接成功
- `close`: 连接关闭
- `error`: 连接错误
- `message`: 收到消息

### 2. 配置服务 (configService.js)

配置服务提供设备配置的管理功能，包括服务器设置、APRS 配置、用户物理可达性设置等。

#### 配置项

| 配置项 | 类型 | 限制 | 说明 |
|--------|------|------|------|
| 服务地址 | 字符串 | 最多31字符，不含空格和斜杠 | FMO 服务器地址 |
| 端口 | 数字 | 1-65535 | 服务器端口 |
| 密码 | 字符串 | 5位数字或-1 | 连接密码 |
| APRS 备注 | 字符串 | 最多63字节 | APRS 个性化消息 |
| 服务器名称 | 字符串 | 最多31字符 | 服务器显示名称 |
| 黑名单 | 字符串 | 最多511字符 | 大写字母、数字、逗号和空格 |
| APRS 类型 | 数字 | 1-15 | APRS 设备类型 |
| 服务器过滤 | 数字 | 0-8 | 距离过滤级别 |
| 登录公告 | 字符串 | 最多127字节 | 服务器登录公告 |
| QSO 祝福语 | 字符串 | 最多64字节 | QSO 结束祝福语 |
| 坐标 | 数字 | 纬度:-90到90，经度:-180到180 | 设备地理位置 |
| 用户物理设备名 | 字符串 | 最多15字符 | 物理设备名称 |
| 用户物理频率 | 数字 | 0-1000MHz | 设备频率 |
| 用户物理天线 | 字符串 | 最多15字符 | 天线类型 |
| 用户物理天线高度 | 数字 | 0-100000米 | 天线高度 |

#### 主要方法

```javascript
// 获取配置
async getServiceUrl()
async getServicePort()
async getPasscode()
async getAprsRemark()
async getServerName()
async getBlacklist()
async getAprsType()
async getServerFilter()
async getServerLoginAnnouncement()
async getQsoBestWish()
async getCordinate()
async getUserPhyDeviceName()
async getUserPhyFreq()
async getUserPhyAnt()
async getUserPhyAntHeight()

// 设置配置
async setServiceUrl(url)
async setServicePort(port)
async setPasscode(passcode)
async setAprsRemark(remark)
async setServerName(name)
async setBlacklist(blacklist)
async setAprsType(type)
async setServerFilter(filter)
async setServerLoginAnnouncement(text)
async setQsoBestWish(text)
async setCordinate(latitude, longitude)
async setUserPhyDeviceName(name)
async setUserPhyFreq(freq)
async setUserPhyAnt(ant)
async setUserPhyAntHeight(height)

// 操作方法
async setBroadcastServer()
async setBroadcastUser()
async restartAprsService()
```

### 3. 音频播放器 (audioPlayer.js)

音频播放器提供实时音频流播放功能，支持 8kHz PCM 音频流。

#### 主要特性

- **音频格式**: 16-bit PCM, 单声道, 8000Hz
- **缓冲机制**: 自适应缓冲，减少延迟
- **音频处理**: 内置滤波器、均衡器和压缩器
- **可视化**: FFT 频谱分析显示

#### 方法

```javascript
// 连接/断开音频流
connect()
disconnect()

// 设置音量
setVolume(volume)

// 附加/分离 FFT 画布
attachFFTCanvas(canvas)
detachFFTCanvas()
```

#### 配置参数

```javascript
{
  url: `ws://${window.location.host}/audio`, // 音频流地址
  inputSampleRate: 8000,                     // 输入采样率
  minStartBufferSec: 0.6,                     // 最小启动缓冲时间
  lowBufferSec: 0.3,                         // 低缓冲阈值
  targetLeadSec: 0.5,                        // 目标提前时间
  maxBufferSec: 2.0                           // 最大缓冲时间
}
```

## API 使用示例

### WebSocket 连接

```javascript
import { wsService } from './webSocketService.js';

// 订阅事件
wsService.subscribe('open', () => {
  console.log('WebSocket 已连接');
});

wsService.subscribe('message', (data) => {
  console.log('收到消息:', data);
});

// 连接服务器
wsService.connect();
```

### 配置管理

```javascript
import { getConfigService } from './configService.js';

const configService = getConfigService();

// 获取服务器地址
configService.getServiceUrl();

// 设置服务器地址
configService.setServiceUrl('server.example.com');

// 订阅配置变更事件
configService.subscribe('setUrl', (response) => {
  if (response.status === 'success') {
    console.log('服务器地址设置成功');
  } else {
    console.error('设置失败:', response.status);
  }
});
```

### 音频播放

```javascript
import { initAudioUI } from './audioPlayer.js';

// 初始化音频 UI（包含连接、断开、音量控制等）
initAudioUI();

// 或者直接使用播放器类
import { AudioStreamPlayer } from './audioPlayer.js';

const player = new AudioStreamPlayer();
player.onStatus = (status) => {
  console.log('音频状态:', status);
};

// 连接音频流
player.connect();
```

## 消息协议详解

### 配置服务消息

#### 获取配置

请求:
```json
{
  "type": "config",
  "subType": "getUrl"
}
```

响应:
```json
{
  "type": "config",
  "subType": "getUrlResponse",
  "data": {
    "url": "server.example.com"
  }
}
```

#### 设置配置

请求:
```json
{
  "type": "config",
  "subType": "setUrl",
  "data": {
    "url": "server.example.com"
  }
}
```

响应:
```json
{
  "type": "config",
  "subType": "setUrlResponse",
  "data": {
    "result": "success"
  }
}
```

### 状态事件

连接状态变更:
```json
{
  "type": "config",
  "subType": "onDeviceStatusChange",
  "data": {
    "status": "connected" // 或 "disconnected", "error"
  }
}
```

## 错误处理

所有 API 操作都包含错误处理机制：

1. **超时处理**: 请求发出后 5 秒内未收到响应将触发超时
2. **参数验证**: 所有参数在发送前都会进行有效性检查
3. **忙碌状态**: 设备忙碌时不会处理新的请求
4. **连接状态**: WebSocket 未连接时发送请求会收到警告

## 版本迁移指南

### 从 API 1.0 到 2.0

- 代码结构优化，功能保持不变
- 改进了错误处理机制
- 优化了性能和内存使用

### 从 API 2.0 到 3.0

- 完全模块化设计
- 增强的类型检查
- 更好的错误恢复机制
- 改进的音频处理算法

## 注意事项

1. **单例模式**: 所有服务类都使用单例模式，确保全局只有一个实例
2. **异步操作**: 所有配置操作都是异步的，需要通过事件监听获取结果
3. **重连机制**: WebSocket 连接断开时会自动尝试重连，间隔为 3 秒
4. **数据限制**: 所有字符串配置都有长度限制，超出限制会导致设置失败
5. **字符编码**: 中文字符需要按照 UTF-8 字节数计算实际长度

## 测试建议

1. **连接测试**: 验证 WebSocket 连接的稳定性和重连机制
2. **配置测试**: 测试所有配置项的设置和获取功能
3. **边界测试**: 测试参数边界值和无效值的处理
4. **并发测试**: 测试多个请求同时发送时的处理
5. **音频测试**: 验证音频流的连接和播放功能
