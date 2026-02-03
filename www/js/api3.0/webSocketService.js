class WebSocketService {
  constructor(url) {
    this.url = url;
    this.ws = null; // WS 实例
    this.heartbeatTimer = null; // 心跳定时器
    this.reconnectTimer = null; // 重连定时器
    this.heartbeatInterval = 30000; // 30秒心跳
    this.reconnectDelay = 5000; // 初始重连间隔
    this.maxReconnectAttempts = 10; // 最大重连次数
    this.currentReconnectAttempts = 0; // 当前重连次数
    this.listeners = new Set(); // 消息监听者
    this.isConnecting = false; // 标记是否正在连接中，避免重复连接
  }

  // 初始化连接（核心修复：增加连接中状态锁）
  connect() {
    // 防止重复发起连接
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      console.log("WebSocket 已在连接中/已连接，无需重复连接");
      return;
    }

    this.isConnecting = true;
    this.currentReconnectAttempts = 0; // 重置重连次数
    console.log("WebSocket connecting...");

    // 清理旧的 WS 实例
    if (this.ws) {
      try {
        this.ws.close(1000, "Reconnecting");
      } catch (e) {
        console.warn("关闭旧WS实例失败：", e);
      }
      this.ws = null;
    }

    this.ws = new WebSocket(this.url);

    // 连接成功
    this.ws.onopen = () => {
      console.log("WebSocket 连接成功");
      this.isConnecting = false;
      this.currentReconnectAttempts = 0;
      this.startHeartbeat(); // 启动心跳
      this._notifyListeners({ type: "open" });
    };

    // 接收消息
    this.ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        this._notifyListeners({ type: "message", data });
        // 心跳响应
        if (data.type === "pong") {
          console.log("心跳确认");
        }
      } catch (err) {
        console.error("解析WS消息失败：", err);
      }
    };

    // 连接关闭
    this.ws.onclose = (event) => {
      console.log(`WebSocket 关闭，状态码：${event.code}，原因：${event.reason}`);
      this.isConnecting = false;
      this.stopHeartbeat();
      this._notifyListeners({ type: "close", event });
      // 仅在非主动关闭时重连（状态码 1000 是正常关闭）
      if (event.code !== 1000) {
        this.reconnect();
      }
    };

    // 连接错误
    this.ws.onerror = (error) => {
      console.error("WebSocket error, reconnecting...", error);
      this.isConnecting = false;
      this._notifyListeners({ type: "error", error });
      this.reconnect();
    };
  }

  // 发送消息（核心修复：检查连接状态）
  send(data) {
    // 仅在连接已打开时发送消息
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error("WebSocket 未连接，无法发送消息（当前状态：", this.ws?.readyState, "）");
      // 可选：将消息缓存，连接成功后重发
      // this.cacheMessage(data);
      return false;
    }

    try {
      // 统一序列化消息
      const sendData = typeof data === "object" ? JSON.stringify(data) : data;
      this.ws.send(sendData);
      return true;
    } catch (err) {
      console.error("发送WS消息失败：", err);
      return false;
    }
  }

  // 重连逻辑（核心修复：增加次数限制和退避策略）
  reconnect() {
    // 清理旧的重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // 超过最大重连次数则停止
    if (this.currentReconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`已达到最大重连次数（${this.maxReconnectAttempts}），停止重试`);
      this._notifyListeners({ type: "maxReconnect" });
      return;
    }

    this.currentReconnectAttempts++;
    // 指数退避：重连间隔逐渐增加（5s → 10s → 20s...）
    const delay = this.reconnectDelay * Math.min(2 ** this.currentReconnectAttempts, 8);
    console.log(`第 ${this.currentReconnectAttempts} 次重连，${delay/1000} 秒后重试`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  // 启动心跳
  startHeartbeat() {
    this.stopHeartbeat(); // 先停止旧的心跳
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: "ping", timestamp: Date.now() });
    }, this.heartbeatInterval);
  }

  // 停止心跳
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // 主动关闭连接
  close() {
    this.isConnecting = false;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.ws) {
      this.ws.close(1000, "Manual close");
    }
  }

  // 监听消息
  onMessage(listener) {
    this.listeners.add(listener);
  }

  // 移除监听
  offMessage(listener) {
    this.listeners.delete(listener);
  }

  // 通知所有监听者
  _notifyListeners(event) {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (e) {
        console.error("监听者执行失败：", e);
      }
    });
  }
}

// 使用示例
const wsService = new WebSocketService("ws://fmo.local/ws");
wsService.connect();

// 监听消息
wsService.onMessage((event) => {
  if (event.type === "message") {
    console.log("收到消息：", event.data);
  } else if (event.type === "maxReconnect") {
    alert("WS连接失败，已停止重连，请检查服务端");
  }
});

// 发送消息示例（安全发送）
function sendSafeMessage(data) {
  const success = wsService.send(data);
  if (!success) {
    // 处理发送失败的逻辑，比如提示用户
    console.log("消息发送失败，请稍后重试");
  }
}