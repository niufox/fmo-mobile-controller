// Simple WebSocket events client for ws://<host>/events
// 简单的 WebSocket 事件客户端，用于 ws://<host>/events
// Purpose: keep /events subscription logic isolated from audioPlayer.js
// 目的：将 /events 订阅逻辑与 audioPlayer.js 隔离

class EventsService {
  constructor({ url = `ws://${window.location.host}/events`, autoReconnect = true } = {}) {
    this.url = url;
    this.autoReconnect = autoReconnect;
    this.ws = null;
    this.want = false;
    this.listeners = new Set(); // (msg)=>void
    this._retryMs = 1000;
  }

  /**
   * Connect to WebSocket
   * 连接 WebSocket
   */
  connect() {
    this.want = true;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;

    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.ws = null;
      return;
    }

    this.ws.onopen = () => {
      this._retryMs = 1000;
    };

    this.ws.onmessage = (evt) => {
      let msg;
      try {
        msg = JSON.parse(evt.data);
      } catch {
        return;
      }
      if (!msg || typeof msg !== 'object') return;
      this.listeners.forEach((cb) => {
        try { cb(msg); } catch (e) { console.warn('events callback error', e); }
      });
    };

    this.ws.onerror = () => {
      // let onclose handle reconnect
      // 让 onclose 处理重连
    };

    this.ws.onclose = () => {
      this.ws = null;
      if (this.autoReconnect && this.want) {
        const ms = this._retryMs;
        this._retryMs = Math.min(8000, Math.floor(this._retryMs * 1.5));
        setTimeout(() => this.connect(), ms);
      }
    };
  }

  /**
   * Disconnect WebSocket
   * 断开 WebSocket 连接
   */
  disconnect() {
    this.want = false;
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
  }

  /**
   * Subscribe to messages
   * 订阅消息
   * @param {Function} cb
   */
  subscribe(cb) {
    if (typeof cb !== 'function') return;
    this.listeners.add(cb);
  }

  /**
   * Unsubscribe from messages
   * 取消订阅消息
   * @param {Function} cb
   */
  unsubscribe(cb) {
    this.listeners.delete(cb);
  }
}

export const eventsService = new EventsService();
export { EventsService };
