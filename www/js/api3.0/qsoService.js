/**
 * @fileoverview QSO Service
 * QSO 服务
 */
import { wsService } from './webSocketService.js';

/**
 * QSO Service Class
 * QSO 服务类
 * Handles QSO log retrieval via WebSocket
 * 通过 WebSocket 获取 QSO 日志
 */
export class QsoService {
  /**
   * Constructor
   * 构造函数
   * @param {WebSocketService} ws
   */
  constructor(ws) {
    if (QsoService.instance) return QsoService.instance;
    this.webSocketService = ws;
    this.listeners = new Map();
    this._busy = false;
    this._setup();
    QsoService.instance = this;
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
   * @returns {boolean}
   */
  isBusy() { return this._busy; }

  /**
   * Get QSO List
   * 获取 QSO 列表
   * @param {number} page
   * @param {number} pageSize
   */
  getList(page = 0, pageSize = 20) {
    if (this.isBusy()) return;
    this._busy = true;
    this.webSocketService.send('qso', 'getList', { page, pageSize });
    setTimeout(() => {
      if (this._busy) {
        this._busy = false;
        this._emit('getList', { status: 'timeout' });
      }
    }, 5000);
  }

  /**
   * Get QSO Detail
   * 获取 QSO 详情
   * @param {number} logId
   */
  getDetail(logId) {
    if (this.isBusy()) return;
    this._busy = true;
    this.webSocketService.send('qso', 'getDetail', { logId });
    setTimeout(() => {
      if (this._busy) {
        this._busy = false;
        this._emit('getDetail', { status: 'timeout' });
      }
    }, 5000);
  }

  /**
   * Setup Service
   * 设置服务
   */
  _setup() {
    this.webSocketService.subscribe('message', (message) => {
      if (message.type !== 'qso') return;
      this._busy = false;
      switch (message.subType) {
        case 'getListResponse':
          this._emit('getList', {
            status: 'success',
            list: (message.data?.list) || [],
            page: message.data?.page ?? 0,
            pageSize: message.data?.pageSize ?? 20,
          });
          break;
        case 'getDetailResponse':
          this._emit('getDetail', {
            status: 'success',
            log: message.data?.log || null,
          });
          break;
        default:
          console.warn('Unknown qso message', message);
      }
    });

    this.webSocketService.subscribe('open', () => this._emit('onDeviceStatusChange', { status: 'connected' }));
    this.webSocketService.subscribe('close', () => this._emit('onDeviceStatusChange', { status: 'disconnected' }));
    this.webSocketService.subscribe('error', () => this._emit('onDeviceStatusChange', { status: 'error' }));
  }
}

let instance = null;
export function getQsoService() {
  if (!instance) instance = new QsoService(wsService);
  return instance;
}
