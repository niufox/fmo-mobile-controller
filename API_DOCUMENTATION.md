# FMO Audio Player API 说明文档

## 概述

FMO Audio Player API 是一个基于 WebSocket 的音频流播放器后端接口系统，提供实时音频流、设备配置、台站管理和日志记录等功能。
注意：给输入的PCM数据，加一个300HZ的HPF，避免哑音。
## 1. WebSocket服务 (`webSocketService.js`)

### 核心功能
提供WebSocket连接管理和消息通信基础服务

### 主要方法
- `connect()` - 建立WebSocket连接
- `send(type, subType, data)` - 发送消息
- `subscribe(event, callback)` - 订阅事件
- `unsubscribe(event, callback)` - 取消订阅事件

### 状态管理
- `INIT` - 初始化状态
- `CONNECTED` - 已连接状态  
- `ERROR` - 错误状态
- `CLOSE` - 关闭状态

### 自动重连
错误和关闭状态下3秒后自动重连

## 2. 配置服务 (`configService.js`)

### 核心功能
设备配置管理，包括服务器设置、APRS配置、用户物理可达性等

### 服务器配置
- `setServiceUrl(url)` - 设置服务器地址（最大31字符）
- `getServiceUrl()` - 获取服务器地址
- `setServicePort(port)` - 设置服务端口（1-65535）
- `getServicePort()` - 获取服务端口

### APRS配置
- `setPasscode(passcode)` - 设置APRS密码（5位数字或-1）
- `getPasscode()` - 获取APRS密码
- `setAprsRemark(remark)` - 设置APRS备注（最大63字节UTF-8）
- `getAprsRemark()` - 获取APRS备注
- `setAprsType(type)` - 设置APRS类型（1-15整数）
- `getAprsType()` - 获取APRS类型
- `restartAprsService()` - 重启APRS服务

### 广播设置
- `setBroadcastServer()` - 广播服务器设置
- `setBroadcastUser()` - 广播用户设置

### 用户物理可达性
- `setUserPhyDeviceName(name)` - 设置设备名称（最大15字符）
- `getUserPhyDeviceName()` - 获取设备名称
- `setUserPhyFreq(freq)` - 设置频率（0-1000MHz）
- `getUserPhyFreq()` - 获取频率
- `setUserPhyAnt(ant)` - 设置天线信息（最大15字符）
- `getUserPhyAnt()` - 获取天线信息
- `setUserPhyAntHeight(height)` - 设置天线高度（0-100000）
- `getUserPhyAntHeight()` - 获取天线高度

### 其他配置
- `setServerName(name)` - 设置服务器名称（最大31字符）
- `getServerName()` - 获取服务器名称
- `setBlacklist(blacklist)` - 设置黑名单（大写字母、数字、逗号或空格，最大511字符）
- `getBlacklist()` - 获取黑名单
- `setServerLoginAnnouncement(text)` - 设置登录公告（最大127字节UTF-8）
- `getServerLoginAnnouncement()` - 获取登录公告
- `setQsoBestWish(text)` - 设置QSO祝福（最大64字节UTF-8）
- `getQsoBestWish()` - 获取QSO祝福
- `setServerFilter(filter)` - 设置服务器过滤器（0-8）
- `getServerFilter()` - 获取服务器过滤器
- `setCordinate(latitude, longitude)` - 设置坐标（纬度-90到90，经度-180到180）
- `getCordinate()` - 获取坐标

### 验证规则
- URL：无空格、无斜杠、必须包含点、不以点开头和结尾、最大31字符
- 端口：1-65535整数
- 密码：5位数字或-1
- APRS备注：最大63字节UTF-8
- 设备名称：最大15字符
- 频率：0-1000MHz
- 天线高度：0-100000整数
- 黑名单：大写字母、数字、逗号或空格，最大511字符
- 登录公告：中英文字符、英文标点、数字、空格，最大127字节UTF-8
- QSO祝福：中英文、英文标点、数字、空格，最大64字节UTF-8
- 坐标：纬度-90到90，经度-180到180

## 3. 音频播放器 (`audioPlayer.js`)

### 核心功能
8kHz PCM音频流播放，支持缓冲、调度和可视化

### 主要特性
- 原始16位PCM（小端序）单声道8000Hz音频流
- WebAudio API重采样
- 自适应缓冲控制（最小0.6秒启动缓冲）
- 音频处理链：高通滤波器→低通滤波器→三段EQ→压缩器
- FFT频谱可视化支持

### 主要方法
- `connect()` - 连接音频流
- `disconnect()` - 断开音频流
- `setVolume(volume)` - 设置音量（0-2）
- `attachFFTCanvas(canvas)` - 附加FFT画布进行可视化
- `detachFFTCanvas()` - 分离FFT画布

### 音频处理参数
- 高通滤波器：220Hz，Q=0.5
- 低通滤波器：3000Hz，Q=0.5  
- EQ低频架：180Hz，+0.5dB
- EQ中频峰值：1400Hz，Q=0.8，+1.0dB
- EQ高频架：2600Hz，0dB
- 压缩器：阈值-22dB，拐点24dB，比率2:1

## 4. 远程控制服务 (`remoteService.js`)

### 核心功能
台站列表管理和远程控制

### 台站管理
- `getList()` - 获取台站列表（默认8个）
- `getListRange(start, count)` - 获取指定范围的台站列表
- `getCurrent()` - 获取当前台站
- `setCurrent(uid)` - 设置当前台站
- `next()` - 切换到下一个台站
- `prev()` - 切换到上一个台站

## 5. QSO日志服务 (`qsoService.js`)

### 核心功能
QSO（通联）日志管理

### 日志管理
- `getList(page, pageSize)` - 获取QSO日志列表（默认每页20条）
- `getDetail(logId)` - 获取指定日志的详细信息

## 6. 配置界面 (`config.js`)

### 核心功能
配置页面的UI管理和事件绑定

### 主要功能
- 多语言支持（基于i18n）
- 表单验证和错误处理
- 紧急模式（禁用参数链请求）
- 请求队列管理（避免并发冲突）
- 状态反馈和超时处理

### 紧急模式
- 启用时禁用参数链请求
- 存储在localStorage中
- 启用后自动刷新页面

## 7. WiFi管理服务 (`wifiService.js`)

### 核心功能
WiFi网络扫描、连接管理和状态监控。

### 主要方法
- `scan()` - 触发WiFi扫描（9秒超时）
- `getScanResult()` - 获取扫描结果列表
- `getConnected()` - 获取当前连接的WiFi信息
- `connect(ssid, password)` - 连接指定WiFi（发送 `setWifi` 指令）
- `save(ssid, password)` - 保存WiFi配置但不连接
- `disconnect()` - 断开当前WiFi连接
- `forget(ssid)` - 忘记指定WiFi密码

### 事件监听
- `scanWifi` - 扫描状态变化
- `scanWifiResult` - 扫描结果返回
- `getWifi` - 获取连接信息返回
- `setWifi` - 连接操作状态返回
- `setWifiResult` - 连接结果返回
- `disconnectWifi` - 断开连接状态返回
- `forgetWifi` - 忘记密码状态返回

### 状态对象结构
```javascript
{
    scanning: false,      // 是否正在扫描
    connecting: false,    // 是否正在连接
    disconnecting: false, // 是否正在断开
    forgeting: false,     // 是否正在忘记
    connected: false,     // 是否已连接
    currentSSID: null,    // 当前SSID
    currentIP: null,      // 当前IP
    currentRSSI: null     // 当前信号强度
}
```

## 8. 事件订阅服务 (`eventsService.js`)

### 核心功能
提供独立的 WebSocket 客户端，专门用于订阅后端 `/events` 路径的实时事件推送。该服务独立于音频播放逻辑，确保事件通知的可靠性。

### 类定义 `EventsService`

#### 构造函数
```javascript
new EventsService({
  url: string,          // WebSocket URL，默认 ws://${host}/events
  autoReconnect: boolean // 是否开启断线自动重连，默认 true
})
```                                                                   

### 主要方法

#### 1. 连接管理
- `connect()`
  - 建立 WebSocket 连接。
  - 自动处理重复调用（如果已连接或正在连接则忽略）。
  - 设置自动重连机制（指数退避策略：1s -> ... -> 8s）。
- `disconnect()`
  - 主动断开连接。
  - 设置 `want = false`，阻止自动重连触发。

#### 2. 订阅管理
- `subscribe(callback)`
  - 注册事件监听回调。
  - `callback(msg)`: 接收解析后的 JSON 消息对象。
- `unsubscribe(callback)`
  - 移除指定的事件监听回调。

### 自动重连机制
- 当 WebSocket 连接意外关闭（`onclose`）且 `autoReconnect` 为 `true` 时触发。
- 重连延迟从 1000ms 开始。
- 每次重连失败，延迟时间增加 1.5 倍，最大不超过 8000ms。
- 连接成功（`onopen`）后，重连延迟重置为 1000ms。

### 使用示例
```javascript
import { eventsService } from './api/eventsService.js';

// 1. 订阅事件
const onEvent = (msg) => {
  console.log('Received event:', msg);
};
eventsService.subscribe(onEvent);

// 2. 启动连接
eventsService.connect();

// 3. 不需要时取消订阅
eventsService.unsubscribe(onEvent);
```


## 使用示例

```javascript
// 初始化WebSocket连接
import { wsService } from './webSocketService.js';
import { getConfigService } from './configService.js';
import { getRemoteService } from './remoteService.js';

// 连接WebSocket
wsService.connect();

// 获取配置服务
const configService = getConfigService();

// 设置服务器地址
configService.setServiceUrl('example.com');

// 获取远程服务
const remoteService = getRemoteService();

// 获取台站列表
remoteService.getList();

// 监听事件
configService.subscribe('setUrl', (data) => {
  if (data.status === 'success') {
    console.log('服务器地址设置成功');
  }
});

remoteService.subscribe('getList', (data) => {
  if (data.status === 'success') {
    console.log('台站列表:', data.list);
  }
});
```

## 错误处理

所有服务都实现了统一的错误处理机制：
- 超时处理（5秒超时）
- 状态反馈（success/error/timeout）
- 忙碌状态管理（防止重复请求）
- 参数验证（前端和后端双重验证）

## 技术特点

- 使用单例模式确保服务实例唯一性
- 完整的错误处理和超时机制（5秒超时）
- 参数验证（前后端双重验证）
- 请求队列管理防止并发冲突
- 紧急模式支持
- 多语言支持（i18n）
- 音频处理链包含滤波器、EQ、压缩器等专业音频处理

## 文件结构

```
fmo-player/api/
├── index.js              # 主页面管理
├── webSocketService.js   # WebSocket基础服务
├── configService.js      # 配置管理服务
├── audioPlayer.js        # 音频播放器
├── remoteService.js      # 远程控制服务
├── qsoService.js        # QSO日志服务
├── eventsService.js     # 事件订阅服务
├── config.js            # 配置界面管理
├── wifiService.js       # WiFi管理服务
├── wifiCtl.js           # WiFi控制逻辑
└── API_DOCUMENTATION.md # API文档（本文件）
```