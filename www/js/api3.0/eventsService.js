// Simple WebSocket events client for ws://<host>/events
// Purpose: keep /events subscription logic isolated from audioPlayer.js

class EventsService {
  constructor({ url = `ws://${window.location.host}/events`, autoReconnect = true } = {}) {
    this.url = url;
    this.autoReconnect = autoReconnect;
    this.ws = null;
    this.want = false;
    this.listeners = new Set(); // (msg)=>void
    this._retryMs = 1000;
  }

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

  disconnect() {
    this.want = false;
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
  }

  subscribe(cb) {
    if (typeof cb !== 'function') return;
    this.listeners.add(cb);
  }

  unsubscribe(cb) {
    this.listeners.delete(cb);
  }
}

export const eventsService = new EventsService();
export { EventsService };
