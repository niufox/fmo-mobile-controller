import { EventEmitter } from './utils.js';
import { connectionManager } from './connectionManager.js';

/** WebSocket 控制客户端
 * WebSocket Control Client
 */
export class ControlClient extends EventEmitter {
    constructor() {
        super();
        // 配置常量 - 提取以提高可维护性
        // Configuration constants - Extracted for maintainability
        this.CONFIG = {
            FETCH_PAGE_SIZE: 8, // Reduced from 20 to match remote.html implementation
            AUTO_REFRESH_INTERVAL: 30000,
            RECONNECT_DELAY: 3000,
            POST_SWITCH_DELAY: 3000
        };

        this.ws = null;
        this.connected = false;
        this.reconnectTimer = null;
        this.autoUpdateTimer = null; // 自动更新定时器 // Auto-update timer
        this.host = '';
        this.stationList = []; // 存储所有已加载的台站 // Store all loaded stations
        this.currentStationId = null; // 当前台站ID // Current station ID
        
        // 全量加载状态管理
        // Full load state management
        this.fetchingAll = false;
        this.tempStationList = [];
        this.fetchStart = 0;
        this.fetchPageSize = this.CONFIG.FETCH_PAGE_SIZE; // 每次获取限制 // Fetch limit per request
        
        // Heartbeat config
        this.heartbeatInterval = 30000; // 30s
        this.heartbeatTimer = null;
        
        // Busy state for operation throttling
        this._busy = false;
    }

    isBusy() { return this._busy; }

    _busyGuard() {
        if (this._busy) return true;
        this._busy = true;
        setTimeout(() => { this._busy = false; }, 1000); // 1s throttle
        return false;
    }

    decodeBinaryMessage(buffer) {
        // Try UTF-8 first
        try {
            const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
            return JSON.parse(text);
        } catch (e) {
            // Fallback to GBK
            try {
                // console.warn('[EventsClient] UTF-8 decode failed, trying GBK...');
                const text = new TextDecoder('gb18030').decode(buffer);
                return JSON.parse(text);
            } catch (e2) {
                throw e2;
            }
        }
    }

    async connect(host) {
        if (this.isConnecting) {
             console.warn('[ControlClient] Connection attempt ignored: Already connecting.');
             return;
        }
        this.isConnecting = true;

        // 重置加载状态，确保每次连接都能重新获取
        // Reset load state to ensure fresh fetch on each connection
        this.fetchingAll = false;
        this.tempStationList = [];
        this.fetchStart = 0;

        this.host = host;
        if (this.ws) {
            // 关闭旧连接前清除定时器
            // Clear timers before closing old connection
            this.stopAutoRefresh();
            this.stopHeartbeat();
            this.ws.close();
            this.ws = null;
        }

        let requestId = null;
        try {
            requestId = await connectionManager.requestConnection('ws');
            
            // Wrap WebSocket creation in a Promise to wait for OPEN
            await new Promise((resolve, reject) => {
                try {
                    this.ws = new WebSocket(`${(window.location && window.location.protocol === 'https:' ? 'wss' : 'ws')}://${this.host}/ws`);
                    this.ws.binaryType = 'arraybuffer'; // Prevent UTF-8 decode errors on binary frames
                } catch (err) {
                    connectionManager.reportHandshakeFailure(requestId);
                    reject(err);
                    return;
                }
                
                connectionManager.trackConnection(this.ws, requestId);
                
                // Set temporary handlers for connection establishment
                const initialErrorHandler = (e) => {
                     console.error('WS Error during handshake:', e);
                     // Note: onclose will also fire, so we might rely on that, 
                     // but rejecting here ensures the await fails fast.
                     // However, connectionManager tracks close, so slot is released.
                     // We just need to fail the Promise.
                     // Remove temporary listeners to avoid double handling? 
                     // No, standard listeners will replace them or we can just reject.
                };

                this.ws.onopen = () => {
                    this.isConnecting = false;
                    this.connected = true;
                    this.emit('status', true);
                    this.stationList = []; // 重置列表 // Reset list
                    // 连接后自动获取所有列表和当前台站
                    // Auto-fetch full list and current station after connection
                    this.fetchList(); // 初始加载 // Initial load
                    this.send('station', 'getCurrent');

                    // 开启30秒自动更新
                    // Start 30s auto-refresh
                    this.startAutoRefresh();
                    // 启动心跳
                    // Start heartbeat
                    this.startHeartbeat();
                    console.log("WS连接成功"); // WS connected
                    resolve();
                };

                this.ws.onclose = (e) => {
                    this.isConnecting = false;
                    // If closed during handshake (before open), we reject
                    if (!this.connected) {
                         reject(new Error(`WebSocket closed during handshake: Code ${e.code}`));
                         return;
                    }
                    
                    this.connected = false;
                    this.emit('status', false);
                    this.stopHeartbeat();
                    
                    // 1007: Protocol Error (Invalid UTF-8 in Text Frame)
                    if (e.code === 1007) {
                        console.error('[Critical] WebSocket disconnected due to invalid UTF-8 data from server.');
                        console.error('Diagnostic suggestion: Check if server is sending binary data as Text Frame (Opcode 1).');
                        // Prevent immediate reconnect loop for fatal protocol errors
                        this.stopAutoRefresh();
                        return;
                    }

                    console.log("WS连接断开，准备重连"); // WS disconnected, preparing to reconnect
                    // 清除自动更新
                    // Clear auto-refresh
                    this.stopAutoRefresh();

                    // 3秒后重连
                    // Reconnect after 3 seconds
                    clearTimeout(this.reconnectTimer);
                    this.reconnectTimer = setTimeout(() => this.connect(this.host), this.CONFIG.RECONNECT_DELAY);
                };

                this.ws.onerror = (e) => {
                    this.isConnecting = false;
                    console.error('WS Error:', e);
                    // On error, we don't necessarily reject immediately as close follows.
                    // But for user feedback:
                    this.connected = false;
                    this.emit('status', false);
                    if (window.cordova) {
                            // alert(`WebSocket Error connecting to ${this.host}\nPlease check:\n1. Server is running\n2. Phone is on same Wi-Fi\n3. Use IP address instead of 'fmo.local'`);
                            console.warn('[WS] Connection failed (Cordova environment)');
                    }
                };

                this.ws.onmessage = async (e) => {
                    try {
                        let msg = null;
                        if (e.data instanceof ArrayBuffer) {
                            // Binary Frame: Try to decode as UTF-8, fallback to GBK
                            msg = this.decodeBinaryMessage(e.data);
                        } else if (e.data instanceof Blob) {
                             // Should not happen as we set binaryType = 'arraybuffer', but safe handling
                             const buf = await e.data.arrayBuffer();
                             msg = this.decodeBinaryMessage(buf);
                        } else {
                            // Text Frame: Browser already validated UTF-8
                            msg = JSON.parse(e.data);
                        }
                        
                        if (msg) {
                            if (msg.type === 'pong') {
                                console.log("心跳确认"); // Heartbeat ack
                            } else {
                                // console.log('WS Message:', msg); // Debug
                                this.handleMessage(msg);
                            }
                        }
                    } catch (err) {
                        console.error('Parse Error:', err);
                    }
                };
            });

        } catch (e) {
            this.isConnecting = false;
            console.error('Connection Failed:', e);
            this.emit('status', false);
            // Ensure slot is released if requestConnection succeeded but loop failed before trackConnection
            // Actually, if we are here, trackConnection might not have been called.
            // But if requestConnection threw, requestId is null.
            // If new WebSocket threw, we called reportHandshakeFailure(requestId).
            // If new WebSocket succeeded but onclose happened, trackConnection handled it.
            // If await Promise rejected, it means onclose happened or we manually rejected.
            // The only case is if requestConnection succeeded but we crashed before try block? No.
            
            if (window.cordova) {
                // alert(`Connection Exception: ${e.message}\nHost: ${host}`);
            }
            throw e; // Re-throw to allow app.js to handle sequence
        }
    }

    // 启动心跳
    // Start heartbeat
    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                // 发送自定义心跳包
                // Send custom heartbeat packet
                this.ws.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
            }
        }, this.heartbeatInterval);
    }

    // 停止心跳
    // Stop heartbeat
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    decodeBinaryMessage(buffer) {
        // Try UTF-8 first
        try {
            const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
            return JSON.parse(text);
        } catch (e) {
            // Fallback to GBK
            try {
                console.warn('[ControlClient] UTF-8 decode failed, trying GBK/GB18030...');
                const text = new TextDecoder('gb18030').decode(buffer); // gb18030 covers gbk
                return JSON.parse(text);
            } catch (e2) {
                console.error('[ControlClient] Binary decode failed:', e2);
                throw e2;
            }
        }
    }

    send(type, subType, data = {}) {
        if (!this.connected || !this.ws) return;
        this.ws.send(JSON.stringify({ type, subType, data }));
    }

    handleMessage(msg) {
        // 路由不同类型的消息
        // Route messages of different types
        if (msg.type === 'station') {
            switch (msg.subType) {
                case 'getListResponse':
                    const newList = msg.data.list || [];
                    const start = msg.data.start;

                    // 如果正在进行全量加载流程
                    // If full load process is in progress
                    if (this.fetchingAll) {
                        // 校验 start (如果服务器返回了 start)
                        // Verify start (if server returned start)
                        // Relaxed check: if start is undefined, assume it's correct (server might not echo it)
                        if (start !== undefined && start !== this.fetchStart) {
                            console.warn(`Fetch order mismatch: expected ${this.fetchStart}, got ${start}`);
                            // Don't abort, just warn. Aborting might kill the list if server is lazy.
                            // this.fetchingAll = false;
                            // return;
                        }

                        this.tempStationList = this.tempStationList.concat(newList);
                        
                        // 检查是否还有更多数据
                        // Check if there is more data
                        // 如果返回的数量少于请求的数量，说明是最后一页
                        // If returned count is less than requested count, it's the last page
                        if (newList.length < this.fetchPageSize) {
                            // 加载完成
                            // Load complete
                            console.log(`Fetch complete. Total: ${this.tempStationList.length}`);
                            this.stationList = this.tempStationList;
                            this.fetchingAll = false;
                            this.tempStationList = [];
                            
                            // 过滤空值
                            // Filter empty values
                            this.stationList = this.stationList.filter(i => i);
                            this.emit('stationList', this.stationList);
                        } else {
                            // 继续获取下一页
                            // Continue to fetch next page
                            this.fetchStart += this.fetchPageSize;
                            this.send('station', 'getListRange', { start: this.fetchStart, count: this.fetchPageSize });
                        }
                    } else {
                        // 非全量加载模式（兼容旧逻辑或单次更新）
                        // Non-full load mode (Compatible with old logic or single update)
                        if ((start === 0 || start === undefined) && newList.length > 0) {
                            this.stationList = newList;
                            this.emit('stationList', this.stationList);
                        }
                    }
                    break;
                case 'getCurrentResponse':
                    if (msg.data && msg.data.uid) {
                        this.currentStationId = msg.data.uid;
                    }
                    this.emit('stationCurrent', msg.data);
                    break;
                case 'setCurrentResponse':
                    // 操作结果，可加 Toast
                    // Operation result, can add Toast
                    break;
            }
        } else if (msg.type === 'qso') {
            this.emit('qsoMessage', msg);
        }
    }

    // 快捷指令
    // Shortcuts
    setStation(uid) { 
        // 乐观更新：立即更新本地状态，解决连续点击失效问题
        // Optimistic update: update local state immediately to solve continuous click failure
        this.currentStationId = uid;
        
        this.send('station', 'setCurrent', { uid }); 
        // Delay before fetching current station to ensure server state update
        setTimeout(() => this.send('station', 'getCurrent'), this.CONFIG.POST_SWITCH_DELAY);
    }

    nextStation() { 
        this.send('station', 'next');
        // Delay before fetching current station to ensure server state update
        setTimeout(() => this.send('station', 'getCurrent'), this.CONFIG.POST_SWITCH_DELAY);
    }

    prevStation() { 
        this.send('station', 'prev');
        // Delay before fetching current station to ensure server state update
        setTimeout(() => this.send('station', 'getCurrent'), this.CONFIG.POST_SWITCH_DELAY);
    }
    
    // 全量获取逻辑 (递归/分片获取)
    // Full fetch logic (Recursive/Chunked fetch)
    fetchList() {
        if (this.fetchingAll) return; // 避免重复触发 // Avoid duplicate triggers
        
        this.fetchingAll = true;
        this.tempStationList = [];
        this.fetchStart = 0;
        
        // 发起第一次请求
        // Initiate first request
        this.send('station', 'getListRange', { start: 0, count: this.fetchPageSize });
    }

    startAutoRefresh() {
        this.stopAutoRefresh();
        this.autoUpdateTimer = setInterval(() => {
            if (this.connected) {
                this.fetchList();
            }
        }, this.CONFIG.AUTO_REFRESH_INTERVAL); // 30秒间隔 // 30s interval
    }

    stopAutoRefresh() {
        if (this.autoUpdateTimer) {
            clearInterval(this.autoUpdateTimer);
            this.autoUpdateTimer = null;
        }
    }
    
    // QSO 指令
    // QSO commands
    getQsoList(page = 0, pageSize = 20) {
        this.send('qso', 'getList', { page, pageSize });
    }
    
    disconnect() {
        if (this.ws) {
            this.stopAutoRefresh();
            this.ws.close();
            this.ws = null;
        }
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.connected = false;
    }
}

/** 事件订阅客户端 (EventsService)
 * Event Subscription Client (EventsService)
 */
export class EventsClient extends EventEmitter {
    constructor() {
        super();
        this.ws = null;
        this.connected = false;
        this.reconnectTimer = null;
        this.retryMs = 1000;
        this.listeners = new Set();
        this.speakingTimeout = null;
        this.onCallsign = null;
        this.onSpeakingState = null;
        
        // Heartbeat config
        this.heartbeatInterval = 30000; // 30s
        this.heartbeatTimer = null;
    }

    decodeBinaryMessage(buffer) {
        // Try UTF-8 first
        try {
            const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
            return JSON.parse(text);
        } catch (e) {
            // Fallback to GBK
            try {
                // console.warn('[EventsClient] UTF-8 decode failed, trying GBK...');
                const text = new TextDecoder('gb18030').decode(buffer);
                return JSON.parse(text);
            } catch (e2) {
                throw e2;
            }
        }
    }

    async connect(host) {
        if (this.isConnecting) {
             console.warn('[EventsClient] Connection attempt ignored: Already connecting.');
             return;
        }
        this.isConnecting = true;

        this.host = host;
        if (this.ws) {
            this.isConnecting = false;
            return;
        }

        let requestId = null;
        try {
            requestId = await connectionManager.requestConnection('events');
            
            await new Promise((resolve, reject) => {
                try {
                    this.ws = new WebSocket(`${(window.location && window.location.protocol === 'https:' ? 'wss' : 'ws')}://${host}/events`);
                    // this.ws.binaryType = 'arraybuffer'; // Disabled to match remote.html implementation
                } catch (err) {
                    connectionManager.reportHandshakeFailure(requestId);
                    reject(err);
                    return;
                }
                
                connectionManager.trackConnection(this.ws, requestId);
                
                this.ws.onopen = () => {
                    this.isConnecting = false;
                    this.connected = true;
                    this.emit('status', true);
                    this.retryMs = 1000;
                    console.log('Events connected');
                    this.startHeartbeat();
                    resolve();
                };

                this.ws.onmessage = async (e) => {
                    try {
                        let msg = null;
                        if (e.data instanceof ArrayBuffer) {
                            msg = this.decodeBinaryMessage(e.data); // Reuse same decoder
                        } else if (e.data instanceof Blob) {
                             const buf = await e.data.arrayBuffer();
                             msg = this.decodeBinaryMessage(buf);
                        } else {
                            msg = JSON.parse(e.data);
                        }
                        
                        if (msg) {
                            if (msg.type === 'pong') {
                                console.log("Events心跳确认"); // Events heartbeat ack
                            } else {
                                this.handleMessage(msg);
                            }
                        }
                    } catch (err) {
                        console.error('Events parse error:', err);
                    }
                };

                this.ws.onclose = (e) => {
                    this.isConnecting = false;
                    this.stopHeartbeat();
                    if (!this.connected) {
                         reject(new Error(`Events WebSocket closed during handshake: ${e.code}`));
                         return;
                    }
                    
                    this.connected = false;
                    this.emit('status', false);
                    this.ws = null;
                    console.log("Events WS连接断开，准备重连"); // Events WS disconnected, preparing to reconnect
                    
                    if (e.code === 1007) {
                        console.error('[Critical] Events WebSocket disconnected due to invalid UTF-8.');
                        return; // Do not reconnect automatically on protocol error
                    }
                    this.scheduleReconnect();
                };

                this.ws.onerror = () => {
                    this.isConnecting = false;
                    // this.ws = null; // Let onclose handle it
                };
            });

        } catch (e) {
            this.isConnecting = false;
            console.error('Events connect failed:', e);
            // If it failed during handshake (await rejected), we should retry
            this.scheduleReconnect();
            throw e; 
        }
    }

    // 启动心跳
    // Start heartbeat
    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                try {
                    this.ws.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
                } catch (e) {
                    console.warn('[EventsClient] Heartbeat failed', e);
                }
            }
        }, this.heartbeatInterval);
    }

    // 停止心跳
    // Stop heartbeat
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    disconnect() {
        this.stopHeartbeat();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.onclose = null; // Prevent reconnect
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
        this.emit('status', false);
    }

    scheduleReconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            console.log(`[EventsClient] Reconnecting in ${this.retryMs}ms...`);
            this.connect(this.host);
            // Exponential backoff: 1s -> 2s -> 4s -> 8s (capped)
            this.retryMs = Math.min(this.retryMs * 2, 8000); 
        }, this.retryMs);
    }

    handleMessage(msg) {
        // console.log('Event received:', msg); // Debug log
        // 处理 QSO 发言人事件
        // Handle QSO speaker events
        if (msg.type === 'qso' && msg.subType === 'callsign' && msg.data) {
            console.log('Callsign event:', msg.data);
            const { callsign, isSpeaking, isHost } = msg.data;
            // 只处理开始发言事件，或者根据需要处理
            // Only handle start speaking events, or handle as needed
            // 这里假设每次 isSpeaking=true 都是一次新的发言或持续发言
            // Assuming every isSpeaking=true is a new speech or continuous speech
            // 为了避免重复，我们可以简单去重，或者每次都添加（作为新的事件）
            // To avoid duplicates, we can simply de-duplicate or add every time (as a new event)
            // 用户需求是“接收到一个新的呼号时，触发显示更新”，通常意味着新的发言开始
            // User requirement is "trigger display update when a new callsign is received", usually means new speech starts
            
            if (isSpeaking) {
                // 简单的去重逻辑：如果最后一个呼号相同且时间很近，则不添加？
                // Simple de-duplication logic: if the last callsign is the same and time is close, do not add?
                // 暂时直接添加，让Ticker处理队列
                // Add directly for now, let Ticker handle the queue
                if (this.onCallsign) this.onCallsign(callsign);
                if (this.onSpeakingState) this.onSpeakingState(callsign, true, isHost);
            } else {
                if (this.onSpeakingState) this.onSpeakingState(callsign, false, isHost);
            }
        }
    }

    // 注册回调
    // Register callback
    onCallsignReceived(callback) {
        this.onCallsign = callback;
    }

    onSpeakingStateChanged(callback) {
        this.onSpeakingState = callback;
    }
}

/** 发现管理器 (mDNS)
 * Discovery Manager (mDNS)
 */
export class DiscoveryManager extends EventEmitter {
    constructor() {
        super();
        this.services = new Map();
        this.isScanning = false;
        this.serviceType = '_http._tcp.local.'; 
        this.listEl = document.getElementById('discovered-list');
        
        // 监听 deviceready 事件自动开始扫描
        // Listen for deviceready event to start scanning automatically
        document.addEventListener('deviceready', () => this.startScan(), false);
    }

    startScan() {
        if (this.isScanning) return;
        
        const performScan = () => {
            if (this.isScanning) return; 
            
            if (window.cordova && cordova.plugins && cordova.plugins.zeroconf) {
                console.log('Starting mDNS scan...');
                this.isScanning = true;
                this.services.clear();
                this.updateUI();
                
                cordova.plugins.zeroconf.watch(this.serviceType, 'local.', 
                    (result) => {
                        const { action, service } = result;
                        if (action === 'resolved') {
                            if (service.ipv4Addresses && service.ipv4Addresses.length > 0) {
                                service.ip = service.ipv4Addresses[0];
                                this.services.set(service.name, service);
                                this.updateUI();
                            }
                        } else if (action === 'removed') {
                            this.services.delete(service.name);
                            this.updateUI();
                        }
                    },
                    (err) => {
                        console.error('ZeroConf Watch Error:', err);
                        this.isScanning = false;
                    }
                );
            } else {
                console.warn('ZeroConf plugin not available');
            }
        };

        // Request NEARBY_WIFI_DEVICES permission for Android 13+ (API 33)
        if (window.cordova && cordova.plugins && cordova.plugins.permissions) {
            const permissions = cordova.plugins.permissions;
            const nearbyPerm = 'android.permission.NEARBY_WIFI_DEVICES';

            permissions.checkPermission(nearbyPerm, (status) => {
                if (status.hasPermission) {
                    performScan();
                } else {
                    permissions.requestPermission(nearbyPerm, 
                        (s) => {
                            // 无论权限请求成功与否，都尝试进行扫描
                            // Attempt to scan regardless of permission request success
                            // 1. 如果是 Android 13+ 且用户授权，扫描正常工作
                            // 1. If Android 13+ and user granted, scan works normally
                            // 2. 如果是旧版本 Android，该权限可能不适用，直接扫描
                            // 2. If older Android version, permission might not apply, scan directly
                            performScan();
                        },
                        (err) => {
                            console.warn('Permission request failed:', err);
                            performScan();
                        }
                    );
                }
            }, (err) => {
                console.warn('Permission check failed:', err);
                performScan();
            });
        } else {
            performScan();
        }
    }

    stopScan() {
        if (this.isScanning && window.cordova && cordova.plugins && cordova.plugins.zeroconf) {
            cordova.plugins.zeroconf.unwatch(this.serviceType, 'local.');
        }
        this.isScanning = false;
    }

    updateUI() {
        if (!this.listEl) return;
        
        // 只有当有设备时才显示容器，或者正在扫描且没有任何历史记录时可以提示
        // Only show container when there are devices, or hint when scanning and no history
        if (this.services.size === 0) {
            this.listEl.style.display = 'none';
            return;
        }
        
        this.listEl.style.display = 'flex';
        this.listEl.innerHTML = '';
        
        // 添加标题
        // Add title
        const header = document.createElement('div');
        header.style.width = '100%';
        header.style.fontSize = '0.8rem';
        header.style.color = '#888';
        header.style.marginBottom = '5px';
        header.textContent = '发现设备 (Nearby)';
        this.listEl.appendChild(header);

        this.services.forEach(service => {
            const tag = document.createElement('div');
            tag.className = 'device-tag';
            tag.style.borderColor = 'var(--accent-magenta)';
            
            const name = service.name || service.ip;
            const ip = service.ip;
            
            tag.innerHTML = `
                <span style="color:var(--accent-magenta)">●</span> ${name} <small style="color:#666">(${ip})</small>
            `;
            
            tag.onclick = () => {
                document.getElementById('inp-host').value = ip;
                // Trigger connect
                document.getElementById('btn-connect').click();
            };
            
            this.listEl.appendChild(tag);
        });
    }
}
