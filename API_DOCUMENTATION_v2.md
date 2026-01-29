# FMO Audio Player API 2.0 文档

## 1. 概述

FMO Audio Player API 2.0 是基于 WebSocket 的音频流播放器后端接口系统。它提供实时音频流、设备配置、台站管理、QSO 日志、WiFi 管理及事件订阅等功能。

### 1.1 通信协议基础

*   **WebSocket URL**: `ws://<host>/ws` (默认)
*   **消息格式**: JSON
    ```json
    {
      "type": "string",     // 服务类型 (如 'config', 'station', 'wifi')
      "subType": "string",  // 操作类型 (如 'setUrl', 'getList')
      "data": {}            // 数据载荷
    }
    ```
*   **心跳/重连**: 客户端实现自动重连机制（默认 3 秒延迟）。

---

## 2. 服务模块详解

### 2.1 WebSocket 基础服务 (`webSocketService.js`)

负责底层的 WebSocket 连接维护和消息分发。

*   **状态**: `INIT`, `CONNECTED`, `ERROR`, `CLOSE`
*   **重连策略**: 异常断开后 3 秒自动重连。

### 2.2 配置服务 (`configService.js`)

**Namespace (type)**: `config`

| 方法 (subType) | 请求参数 (data) | 响应/说明 |
| :--- | :--- | :--- |
| `setUrl` | `{ url: string }` | 设置服务器地址 (max 31 chars) |
| `getUrl` | - | 获取服务器地址 |
| `setPort` | `{ port: number }` | 设置端口 (1-65535) |
| `getPort` | - | 获取端口 |
| `setPasscode` | `{ passcode: string }` | 设置 APRS 验证码 (5位数字或 '-1') |
| `getPasscode` | - | 获取 APRS 验证码 |
| `setAprsRemark` | `{ remark: string }` | 设置 APRS 备注 (max 63 bytes UTF-8) |
| `getAprsRemark` | - | 获取 APRS 备注 |
| `setServerName` | `{ serverName: string }` | 设置服务器名称 (max 31 chars) |
| `getServerName` | - | 获取服务器名称 |
| `setBlacklist` | `{ blacklist: string }` | 设置黑名单 (大写字母, 数字, 逗号, 空格; max 511 chars) |
| `getBlacklist` | - | 获取黑名单 |
| `setBroadcastServer` | `{}` | 设置广播服务器模式 |
| `setBroadcastUser` | `{}` | 设置广播用户模式 |
| `setAprsType` | `{ aprsType: number }` | 设置 APRS 图标类型 (1-15) |
| `getAprsType` | - | 获取 APRS 图标类型 |
| `restartAprsService` | `{}` | 重启 APRS 服务 |
| `setUserPhyDeviceName` | `{ deviceName: string }` | 设置物理设备名称 (max 15 chars) |
| `getUserPhyDeviceName` | - | 获取物理设备名称 |
| `setUserPhyFreq` | `{ freq: number }` | 设置物理频率 (0-1000 MHz) |
| `getUserPhyFreq` | - | 获取物理频率 |
| `setUserPhyAnt` | `{ ant: string }` | 设置天线描述 (max 15 chars) |
| `getUserPhyAnt` | - | 获取天线描述 |
| `setUserPhyAntHeight` | `{ height: number }` | 设置天线高度 (0-100000 m) |
| `getUserPhyAntHeight` | - | 获取天线高度 |
| `setServerFilter` | `{ serverFilter: number }` | 设置服务器过滤器 (0-8) |
| `getServerFilter` | - | 获取服务器过滤器 |
| `setServerLoginAnnouncement` | `{ serverLoginAnnouncement: string }` | 设置登录公告 (max 127 bytes UTF-8) |
| `getServerLoginAnnouncement` | - | 获取登录公告 |
| `setQsoBestWish` | `{ qsoBestWish: string }` | 设置 QSO 祝福语 (max 64 bytes UTF-8) |
| `getQsoBestWish` | - | 获取 QSO 祝福语 |
| `setCordinate` | `{ latitude: number, longitude: number }` | 设置坐标 (-90~90, -180~180) |
| `getCordinate` | - | 获取坐标 |

### 2.3 远程控制服务 (`remoteService.js`)

**Namespace (type)**: `station`

| 方法 (subType) | 请求参数 (data) | 响应 SubType | 响应数据 (data) |
| :--- | :--- | :--- | :--- |
| `getListRange` | `{ start: number, count: number }` | `getListResponse` | `{ list: [], count: number }` |
| `getCurrent` | `{}` | `getCurrentResponse` | `{ uid: number, name: string }` |
| `setCurrent` | `{ uid: number }` | `setCurrentResponse` | `{ result: number }` |
| `next` | `{}` | `nextResponse` | `{ result: number }` |
| `prev` | `{}` | `prevResponse` | `{ result: number }` |

*注: `getList()` 是 `getListRange(0, 8)` 的便捷封装。*

### 2.4 QSO 日志服务 (`qsoService.js`)

**Namespace (type)**: `qso`

| 方法 (subType) | 请求参数 (data) | 响应 SubType | 响应数据 (data) |
| :--- | :--- | :--- | :--- |
| `getList` | `{ page: number, pageSize: number }` | `getListResponse` | `{ list: [], page: number, pageSize: number }` |
| `getDetail` | `{ logId: number }` | `getDetailResponse` | `{ log: object }` |

### 2.5 WiFi 管理服务 (`wifiService.js`)

**Namespace (type)**: `wifi`

| 方法 (subType) | 请求参数 (data) | 说明 |
| :--- | :--- | :--- |
| `scanWifi` | - | 触发扫描 (异步)。前端需等待 ~9s 后调用 `scanWifiResult`。 |
| `scanWifiResult` | - | 获取扫描结果。响应包含 `{ list: [] }`。 |
| `getWifi` | - | 获取当前连接信息。 |
| `saveWifi` | `{ ssid: string, password: string }` | 保存配置但不连接。 |
| `setWifi` | `{ ssid: string, password: string }` | 连接 WiFi。响应 `setWifi` (开始连接) 和 `setWifiResult` (最终结果)。 |
| `setWifiResult` | - | 主动查询连接结果 (通常由 `setWifi` 流程自动触发)。 |
| `forgetWifi` | `{ ssid: string }` | 忘记密码。 |
| `disconnectWifi` | `{}` | 断开连接。 |

### 2.6 事件订阅服务 (`eventsService.js`)

**Endpoint**: `ws://<host>/events`

独立于主 WebSocket 的事件推送通道。

*   **API**:
    *   `connect()`: 建立连接。
    *   `subscribe(callback)`: 订阅消息。
    *   `unsubscribe(callback)`: 取消订阅。
*   **机制**: 支持断线指数退避重连 (1s -> 8s)。

### 2.7 音频播放器 (`audioPlayer.js`)

**Endpoint**: `ws://<host>/audio`

*   **格式**: 原始 16-bit PCM (Little Endian), 单声道, 8000 Hz。
*   **处理链**:
    1.  **HPF**: 220Hz, Q=0.5 (去低频噪声)
    2.  **LPF**: 3000Hz, Q=0.5 (抗混叠/柔化)
    3.  **EQ Low**: 180Hz, +0.5dB (Shelf)
    4.  **EQ Mid**: 1400Hz, +1.0dB, Q=0.8 (Peaking)
    5.  **EQ High**: 2600Hz, 0dB (Shelf)
    6.  **Compressor**: Thresh -22dB, Ratio 2:1, Knee 24dB
*   **功能**:
    *   `connect()` / `disconnect()`
    *   `setVolume(0.0-1.0)`
    *   `attachFFTCanvas(canvasElement)`: 绑定 Canvas 进行频谱可视化。
