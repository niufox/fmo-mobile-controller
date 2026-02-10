import { wsService } from './webSocketService.js';

export class UserInfoService {
  constructor(ws) {
    if (UserInfoService.instance) return UserInfoService.instance;
    this.webSocketService = ws;
    this.listeners = new Map();
    this._busy = false;
    this._setup();
    UserInfoService.instance = this;
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

  getInfo() {
    if (this.isBusy()) return;
    if (!this.isConnected()) return;
    this._busy = true;
    this.webSocketService.send('user', 'getInfo', {});
    setTimeout(() => {
      if (this._busy) {
        this._busy = false;
        this._emit('getInfo', { status: 'timeout' });
      }
    }, 5000);
  }

  _setup() {
    this.webSocketService.subscribe('message', (message) => {
      if (message.type !== 'user') return;
      this._busy = false;
      switch (message.subType) {
        case 'getInfoResponse':
          this._emit('getInfo', {
            status: 'success',
            callsign: message.data?.callsign || '',
            uid: message.data?.uid ?? 0,
            wlanIP: message.data?.wlanIP || '',
          });
          break;
        default:
          console.warn('Unknown user message', message);
      }
    });

    this.webSocketService.subscribe('open', () => this._emit('onDeviceStatusChange', { status: 'connected' }));
    this.webSocketService.subscribe('close', () => this._emit('onDeviceStatusChange', { status: 'disconnected' }));
    this.webSocketService.subscribe('error', () => this._emit('onDeviceStatusChange', { status: 'error' }));
  }
}

let instance = null;
export function getUserInfoService() {
  if (!instance) instance = new UserInfoService(wsService);
  return instance;
}
