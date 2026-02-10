import { wsService } from './webSocketService.js';

export class UIService {
  constructor(ws) {
    if (UIService.instance) return UIService.instance;
    this.webSocketService = ws;
    this.listeners = new Map();
    this._busy = false;
    this._setup();
    UIService.instance = this;
  }

  subscribe(event, cb) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(cb);
  }

  _emit(event, data) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).forEach(cb => cb(data));
  }

  isBusy() { return this._busy; }
  isConnected() { return !!this.webSocketService?.isConnected; }

  getScreenMode() {
    if (this.isBusy()) return;
    if (!this.isConnected()) return;
    this._busy = true;
    this.webSocketService.send('ui', 'getScreenMode', {});
    setTimeout(() => {
      if (this._busy) {
        this._busy = false;
        this._emit('getScreenMode', { status: 'timeout' });
      }
    }, 5000);
  }

  setScreenMode(mode) {
    if (this.isBusy()) return;
    if (!this.isConnected()) return;
    this._busy = true;
    this.webSocketService.send('ui', 'setScreenMode', { mode });
    setTimeout(() => {
      if (this._busy) {
        this._busy = false;
        this._emit('setScreenMode', { status: 'timeout' });
      }
    }, 5000);
  }

  _setup() {
    this.webSocketService.subscribe('message', (message) => {
      if (message.type !== 'ui') return;
      this._busy = false;
      switch (message.subType) {
        case 'getScreenModeResponse':
          this._emit('getScreenMode', { status: 'success', mode: message.data?.mode });
          break;
        case 'setScreenModeResponse':
          this._emit('setScreenMode', { status: (message.data?.result === 0 ? 'success' : 'error') });
          break;
        default:
          console.warn('Unknown ui message', message);
      }
    });

    this.webSocketService.subscribe('open', () => this._emit('onDeviceStatusChange', { status: 'connected' }));
    this.webSocketService.subscribe('close', () => this._emit('onDeviceStatusChange', { status: 'disconnected' }));
    this.webSocketService.subscribe('error', () => this._emit('onDeviceStatusChange', { status: 'error' }));
  }
}

let instance = null;
export function getUIService() {
  if (!instance) instance = new UIService(wsService);
  return instance;
}
