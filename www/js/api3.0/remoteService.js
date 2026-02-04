import { wsService } from './webSocketService.js';

/**
 * Remote Service Class
 * 远程服务类
 */
export class RemoteService {
  constructor(ws) {
    if (RemoteService.instance) return RemoteService.instance;
    this.webSocketService = ws;
    this.listeners = new Map();
    this._busy = false;
    this._setup();
    RemoteService.instance = this;
  }

  /**
   * Subscribe to Event
   * 订阅事件
   * @param {string} event
   * @param {Function} cb
   */
  subscribe(event, cb) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(cb);
  }

  /**
   * Emit Event
   * 触发事件
   * @param {string} event
   * @param {any} data
   */
  _emit(event, data) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).forEach(cb => cb(data));
  }

  /**
   * Check if Service is Busy
   * 检查服务是否繁忙
   */
  isBusy() { return this._busy; }
  _busyGuard() { if (this._busy) return true; this._busy = true; setTimeout(()=>{ this._busy = false; }, 3000); return false; }

  /**
   * Get Station List
   * 获取站点列表
   */
  getList() {
    return this.getListRange(0, 8);
  }

  /**
   * Get Station List Range
   * 获取站点列表范围
   * @param {number} start
   * @param {number} count
   */
  getListRange(start=0, count=8){
    if (this.isBusy()) return;
    this._busy = true;
    this.webSocketService.send('station', 'getListRange', { start, count });
    setTimeout(()=>{ if(this._busy){ this._busy=false; this._emit('getList', { status:'timeout' }); } }, 5000);
  }

  /**
   * Get Current Station
   * 获取当前站点
   */
  getCurrent() {
    if (this.isBusy()) return;
    this._busy = true;
    this.webSocketService.send('station', 'getCurrent', {});
    setTimeout(()=>{ if(this._busy){ this._busy=false; this._emit('getCurrent', { status:'timeout' }); } }, 5000);
  }

  /**
   * Set Current Station
   * 设置当前站点
   * @param {number} uid
   */
  setCurrent(uid) {
    if (this.isBusy()) return;
    this._busy = true;
    this.webSocketService.send('station', 'setCurrent', { uid });
    setTimeout(()=>{ if(this._busy){ this._busy=false; this._emit('setCurrent', { status:'timeout' }); } }, 5000);
  }

  /**
   * Switch to Next Station
   * 切换到下一个站点
   */
  next() {
    if (this.isBusy()) return;
    this._busy = true;
    this.webSocketService.send('station', 'next', {});
    setTimeout(()=>{ if(this._busy){ this._busy=false; this._emit('next', { status:'timeout' }); } }, 5000);
  }

  /**
   * Switch to Previous Station
   * 切换到上一个站点
   */
  prev() {
    if (this.isBusy()) return;
    this._busy = true;
    this.webSocketService.send('station', 'prev', {});
    setTimeout(()=>{ if(this._busy){ this._busy=false; this._emit('prev', { status:'timeout' }); } }, 5000);
  }

  /**
   * Setup Service
   * 设置服务
   */
  _setup() {
    this.webSocketService.subscribe('message', (message) => {
      if (message.type !== 'station') return;
      this._busy = false;
      switch(message.subType) {
        case 'getListResponse':
          this._emit('getList', { status:'success', list: (message.data?.list)||[], count: message.data?.count||0 });
          break;
        case 'getCurrentResponse':
          this._emit('getCurrent', { status:'success', uid: message.data?.uid||0, name: message.data?.name||'' });
          break;
        case 'setCurrentResponse':
          this._emit('setCurrent', { status: (message.data?.result===0?'success':'error') });
          break;
        case 'nextResponse':
          this._emit('next', { status: (message.data?.result===0?'success':'error') });
          break;
        case 'prevResponse':
          this._emit('prev', { status: (message.data?.result===0?'success':'error') });
          break;
        default:
          console.warn('Unknown station message', message);
      }
    });
    this.webSocketService.subscribe('open', () => this._emit('onDeviceStatusChange', { status:'connected' }));
    this.webSocketService.subscribe('close', () => this._emit('onDeviceStatusChange', { status:'disconnected' }));
    this.webSocketService.subscribe('error', () => this._emit('onDeviceStatusChange', { status:'error' }));
  }
}

let instance = null;
export function getRemoteService(){ if(!instance) instance = new RemoteService(wsService); return instance; }
