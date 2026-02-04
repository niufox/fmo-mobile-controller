/**
 * FMO Audio Controller - UI Components
 * 包含音量控制、呼号显示、设备历史、QSO日志等界面组件
 * Includes volume control, callsign display, device history, QSO log, and other UI components
 */

import { Utils } from './utils.js';
import {
    TIME_CONSTANTS,
    UI_CONSTANTS,
    VOLUME_CONSTANTS,
    MESSAGE_TYPES,
} from './constants.js';

/** 音量条控制器
 * Volume Slider Controller
 */
export class VolumeSlider {
    constructor(container, player) {
        this.container = container;
        this.player = player;
        this.trackWrapper = container.querySelector('#vol-track-wrapper');
        this.fill = container.querySelector('#vol-fill');
        this.text = container.querySelector('#vol-value-text');
        this.muteBtn = container.querySelector('#vol-mute-btn');
        this.localMuteBtn = container.querySelector('#local-mute-toggle');

        this.isDragging = false;
        this.value = VOLUME_CONSTANTS.DEFAULT_VOLUME;
        this.lastValue = VOLUME_CONSTANTS.DEFAULT_VOLUME;

        // 绑定方法到实例，确保可以正确移除事件监听器
        // Bind methods to instance to ensure event listeners can be removed correctly
        this.onMove = this.onMove.bind(this);
        this.onUp = this.onUp.bind(this);
        this.onTouchMove = this.onTouchMove.bind(this);
        this.onTouchEnd = this.onTouchEnd.bind(this);

        this.initEvents();
        this.updateUI(this.value);
        if (this.player.localMuteEnabled !== undefined) {
            this.updateLocalMuteUI(this.player.localMuteEnabled);
        }
    }

    updateFromEvent(e) {
        const rect = this.trackWrapper.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        let percent = (clientX - rect.left) / rect.width;
        percent = Math.max(0, Math.min(1, percent));

        // Map to volume range (0.0 - 2.0)
        const volumeValue = percent * VOLUME_CONSTANTS.VOLUME_MULTIPLIER;
        this.setVolume(volumeValue);
    }

    onMove(e) {
        if (this.isDragging) {
            this.updateFromEvent(e);
            e.preventDefault();
        }
    }

    onUp() {
        this.isDragging = false;
    }

    onTouchMove(e) {
        if (this.isDragging) {
            this.updateFromEvent(e);
            e.preventDefault();
        }
    }

    onTouchEnd() {
        this.isDragging = false;
    }

    initEvents() {
        // 鼠标事件
        // Mouse events
        this.trackWrapper.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.updateFromEvent(e);
            document.addEventListener('mousemove', this.onMove);
            document.addEventListener('mouseup', this.onUp);
        });

        // 触摸事件
        // Touch events
        this.trackWrapper.addEventListener('touchstart', (e) => {
            this.isDragging = true;
            this.updateFromEvent(e);
            document.addEventListener('touchmove', this.onTouchMove, { passive: false });
            document.addEventListener('touchend', this.onTouchEnd);
        }, { passive: false });

        // 静音切换
        // Mute toggle
        this.muteBtn.addEventListener('click', () => {
            if (this.value > VOLUME_CONSTANTS.MUTE_THRESHOLD) {
                this.lastValue = this.value;
                this.setVolume(VOLUME_CONSTANTS.MIN_VOLUME);
            } else {
                this.setVolume(this.lastValue || VOLUME_CONSTANTS.DEFAULT_VOLUME);
            }
            // 震动
            // Vibrate
            if (navigator.vibrate) navigator.vibrate(10);
        });

        // 本地静音切换
        // Local mute toggle
        if (this.localMuteBtn) {
            this.localMuteBtn.addEventListener('click', () => {
                const newState = !this.player.localMuteEnabled;
                this.player.setLocalMute(newState);
                this.updateLocalMuteUI(newState);
                if (navigator.vibrate) navigator.vibrate(10);
            });
        }
    }

    setVolume(val) {
        this.value = val;
        this.player.setVolume(val); // 假设 player 支持 0-2.0 // Assume player supports 0-2.0
        this.updateUI(val);
    }

    updateUI(val) {
        // 显示百分比 (0-200%)
        // Display percentage (0-200%)
        const displayPercent = Math.round(val * 100);
        // 进度条宽度 (映射 0-2.0 到 0-100%)
        // Progress bar width (Map 0-2.0 to 0-100%)
        const fillWidth = Math.min(100, (val / VOLUME_CONSTANTS.VOLUME_MULTIPLIER) * 100);

        this.fill.style.width = `${fillWidth}%`;
        this.text.textContent = `${displayPercent}%`;

        // 更新图标状态
        // Update icon state
        if (val === VOLUME_CONSTANTS.MIN_VOLUME) {
            this.muteBtn.style.opacity = '0.5';
            this.setMuteIcon(true);
        } else {
            this.muteBtn.style.opacity = '1';
            this.setMuteIcon(false);
        }
    }

    setMuteIcon(isMuted) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '20');
        svg.setAttribute('height', '20');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'currentColor');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        if (isMuted) {
            path.setAttribute('d', 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z');
        } else {
            path.setAttribute('d', 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z');
        }

        svg.appendChild(path);
        this.muteBtn.innerHTML = '';
        this.muteBtn.appendChild(svg);
    }

    updateLocalMuteUI(enabled) {
        if (!this.localMuteBtn) return;
        if (enabled) {
            this.localMuteBtn.className = 'local-mute-toggle active';
            this.setLocalMuteIcon(true);
        } else {
            this.localMuteBtn.className = 'local-mute-toggle inactive';
            this.setLocalMuteIcon(false);
        }
    }

    setLocalMuteIcon(isMuted) {
        if (!this.localMuteBtn) return;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '14');
        svg.setAttribute('height', '14');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'currentColor');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        if (isMuted) {
            path.setAttribute('d', 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z');
        } else {
            path.setAttribute('d', 'M8 5v14l11-7z');
        }

        svg.appendChild(path);
        this.localMuteBtn.innerHTML = '';
        this.localMuteBtn.appendChild(svg);
    }

    destroy() {
        // 清理所有事件监听器，防止内存泄漏
        // Clear all event listeners to prevent memory leaks
        document.removeEventListener('mousemove', this.onMove);
        document.removeEventListener('mouseup', this.onUp);
        document.removeEventListener('touchmove', this.onTouchMove);
        document.removeEventListener('touchend', this.onTouchEnd);

        // 清理组件引用
        // Clear component references
        this.container = null;
        this.trackWrapper = null;
        this.fill = null;
        this.text = null;
        this.muteBtn = null;
        this.localMuteBtn = null;
    }
}

/** 呼号队列显示管理器
 * Callsign Queue Display Manager
 */
export class CallsignTicker {
    constructor(containerId, visualizer, qsoManager) {
        this.container = document.getElementById(containerId);
        this.visualizer = visualizer;
        this.qsoManager = qsoManager;
        this.maxItems = UI_CONSTANTS.CALLSIGN_TICKER_MIN_ITEMS;
        this.items = [];

        // 启动呼吸灯循环
        // Start breathing light loop
        this.animateLoop();

        // 动态计算容量
        // Dynamically calculate capacity
        this.updateCapacity();
        window.addEventListener('resize', () => this.updateCapacity());
    }

    updateCapacity() {
        if (!this.container) return;
        // 计算容器可用高度
        // Calculate container available height
        const containerHeight = this.container.clientHeight;
        // 估算每个条目的高度
        // Estimate item height
        const itemHeight = UI_CONSTANTS.CALLSIGN_ITEM_HEIGHT;
        // 计算最大容纳数量
        // Calculate max items
        const capacity = Math.floor(containerHeight / itemHeight);
        // 限制在最小和最大值之间
        // Limit between min and max
        this.maxItems = Math.max(
            UI_CONSTANTS.CALLSIGN_TICKER_MIN_ITEMS,
            Math.min(UI_CONSTANTS.CALLSIGN_TICKER_MAX_ITEMS, capacity)
        );
    }

    addCallsign(callsign) {
        if (!this.container) return;

        // 1. 创建新元素
        // 1. Create new element
        const el = document.createElement('div');
        el.className = 'callsign-item breathing';
        
        // 创建时间元素
        // Create time element
        const timeEl = document.createElement('div');
        timeEl.className = 'callsign-time';
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-GB', { hour12: false });
        timeEl.textContent = timeStr;

        // 检查是否在日志中
        // Check if logged
        const isLogged = this.qsoManager && this.qsoManager.hasCallsign(callsign);
        
        // 创建星星元素
        // Create star element
        const starEl = document.createElement('div');
        starEl.className = isLogged ? 'star-icon solid' : 'star-icon hollow';
        starEl.innerHTML = isLogged ? '★' : '☆';
        
        // 创建内容容器 (Row)
        // Create content container (Row)
        const rowEl = document.createElement('div');
        rowEl.className = 'callsign-row';
        rowEl.style.display = 'flex';
        rowEl.style.alignItems = 'center';
        rowEl.style.justifyContent = 'center';

        // 创建呼号文本元素
        // Create callsign text element
        const textEl = document.createElement('div');
        textEl.className = 'callsign-text';
        textEl.textContent = callsign;

        rowEl.appendChild(starEl);
        rowEl.appendChild(textEl);

        el.appendChild(timeEl);
        el.appendChild(rowEl);
        
        // 2. 添加到容器开头 (最新的在最上面)
        // 2. Add to container start (Newest on top)
        if (this.container.firstChild) {
            this.container.insertBefore(el, this.container.firstChild);
        } else {
            this.container.appendChild(el);
        }
        this.items.unshift(el);
        
        // 3. 强制重绘以触发 transition
        // 3. Force reflow to trigger transition
        el.offsetHeight; 
        
        // 4. 激活进场动画 (从左侧滑入，挤开下方)
        // 4. Activate entrance animation (Slide in from left, push down)
        el.classList.add('active');

        // 5. 移除多余元素 (移除最底部/最旧的)
        // 5. Remove excess elements (Remove bottom/oldest)
        if (this.items.length > this.maxItems) {
            const removed = this.items.pop();
            // 优雅移除
            // Graceful removal
            removed.style.maxHeight = '0';
            removed.style.padding = '0';
            removed.style.marginBottom = '0';
            removed.style.opacity = '0';
            removed.style.border = 'none';

            setTimeout(() => {
                if (removed.parentNode) {
                    removed.parentNode.removeChild(removed);
                }
            }, TIME_CONSTANTS.ANIMATION_TRANSITION); // 应该和CSS transition匹配 // Should match CSS transition
        }
    }
    
    animateLoop() {
        // 呼吸灯效果通过CSS animation实现，这里不需要JS循环
        // Breathing light effect implemented via CSS animation, no JS loop needed here
        // 如果有其他需要每帧更新的逻辑，可以在这里添加
        // If there is other logic needing per-frame update, add here
    }
}

/** 设备历史管理
 * Device History Manager
 */
export class DeviceManager {
    constructor() {
        this.devices = [];
        this.storageKey = 'fmo_saved_devices';
        this.load();
    }

    load() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            this.devices = saved ? JSON.parse(saved) : [];
        } catch (e) {
            this.devices = [];
        }
    }

    save() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.devices));
        this.render();
    }

    add(ip) {
        if (!ip) return;
        // 移除已存在的（为了置顶）
        // Remove existing (to move to top)
        this.devices = this.devices.filter(d => d !== ip);
        // 添加到头部
        // Add to head
        this.devices.unshift(ip);
        // 限制数量
        // Limit count
        if (this.devices.length > UI_CONSTANTS.STATION_MODAL_MAX_ITEMS) this.devices.pop();
        this.save();
    }

    remove(ip, e) {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        this.devices = this.devices.filter(d => d !== ip);
        this.save();
    }

    render() {
        const container = document.getElementById('device-history');
        if (!container) return;
        container.innerHTML = '';
        
        const inpHost = document.getElementById('inp-host');
        const currentIp = inpHost ? inpHost.value : '';

        this.devices.forEach(ip => {
            const tag = document.createElement('div');
            tag.className = 'device-tag';
            if (currentIp === ip) tag.classList.add('active');

            const ipText = document.createElement('span');
            ipText.textContent = ip;
            tag.appendChild(ipText);

            const delBtn = document.createElement('span');
            delBtn.className = 'device-del';
            delBtn.textContent = '✕';
            delBtn.title = '删除'; // Delete
            tag.appendChild(delBtn);

            tag.onclick = () => {
                if (inpHost) inpHost.value = ip;
                this.render(); // 更新高亮 // Update highlight
                // 触发连接
                // Trigger connect
                const btnConnect = document.getElementById('btn-connect');
                if (btnConnect) btnConnect.click();
            };

            delBtn.onclick = (e) => this.remove(ip, e);

            container.appendChild(tag);
        });
    }
}

/** QSO 日志管理器
 * QSO Log Manager
 */
export class QsoManager {
    constructor(client) {
        this.client = client;
        this.modal = document.getElementById('qso-modal');
        this.listEl = document.getElementById('qso-list');
        this.mapFrame = document.getElementById('qso-map-frame'); // Map iframe
        this.btn = document.getElementById('btn-qso');
        this.btnClose = document.getElementById('btn-qso-close');
        this.countEl = document.getElementById('qso-count-value');
        this.badge = document.getElementById('qso-badge');

        this.page = 0;
        this.pageSize = 20; // Default page size
        this.isLoading = false;
        this.refreshTimer = null;
        this.qsos = new Set();

        // Allowed origins for postMessage security
        this.allowedOrigins = [
            window.location.origin,
            'http://localhost',
            'https://map.srv.ink'
        ];
    }

    /**
     * Start auto refresh with interval from constants
     * 使用常量间隔启动自动刷新
     */
    startAutoRefresh() {
        this.stopAutoRefresh();
        // Use constant for refresh interval
        // 使用常量作为刷新间隔
        this.refreshTimer = setInterval(() => {
            this.fetchData();
        }, TIME_CONSTANTS.QSO_REFRESH_INTERVAL);
    }

    /**
     * Check if origin is allowed for postMessage
     * 检查 origin 是否允许 postMessage
     */
    isAllowedOrigin(origin) {
        return this.allowedOrigins.some(allowed => {
            if (allowed === '*') return true;
            try {
                const allowedUrl = new URL(allowed);
                const originUrl = new URL(origin);
                return originUrl.origin === allowedUrl.origin;
            } catch {
                return origin === allowed;
            }
        });
    }

    initEvents() {
        // Open Modal
        const openModal = () => this.show();
        if (this.btn) this.btn.addEventListener('click', openModal);
        // 交互优化：点击星星直接打开 QSO 日志
        // Interaction optimization: Click star to open QSO log directly
        if (this.badge) this.badge.addEventListener('click', openModal);

        // Close Modal
        if (this.btnClose) {
            this.btnClose.addEventListener('click', () => {
                this.hide();
            });
        }

        // Close on backdrop click
        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) this.hide();
            });
        }

        // 处理列表点击事件 (事件委托)
        // Handle list click events (Event delegation)
        if (this.listEl) {
            this.listEl.addEventListener('click', (e) => {
                const item = e.target.closest('.qso-item');
                if (item) {
                    // 缩小图例
                    // Shrink badge
                    this.shrinkBadge();

                    const grid = item.dataset.grid;
                    const call = item.querySelector('.qso-call')?.textContent;
                    if (grid && grid !== '-') {
                        // 定位到特定的QSO标记并打开弹窗
                        // Locate to specific QSO marker and open popup
                        this.highlightQsoOnMap(grid, call);

                        // 高亮选中项
                        // Highlight selected item
                        const prev = this.listEl.querySelector('.qso-item.active');
                        if (prev) prev.classList.remove('active');
                        item.classList.add('active');
                    }
                }
            });

            // Keyboard support for accessibility
            this.listEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    const item = e.target.closest('.qso-item');
                    if (item) item.click();
                    e.preventDefault();
                }
            });
        }

        // Listen for messages from iframe with origin validation
        // 监听来自 iframe 的消息并进行 origin 验证
        window.addEventListener('message', (event) => {
            if (!this.isAllowedOrigin(event.origin)) {
                console.warn('[QsoManager] Received message from untrusted origin:', event.origin);
                return;
            }

            // Handle trusted messages from iframe if needed
            // This can be extended to handle responses from the map
        });

        // Handle WS messages
        this.client.on('qsoMessage', (msg) => {
            if (msg.subType === 'getListResponse') {
                // 更新数量统计
                // Update count statistics
                if (msg.data.total !== undefined) {
                    this.updateCount(msg.data.total);
                } else if (msg.data.list) {
                    this.updateCount(msg.data.list.length);
                }
                const list = msg.data.list || [];
                this.renderList(list);

                // 发送所有QSO网格到地图显示
                // Send all QSO grids to map for display
                if (list.length > 0) {
                    const grids = list.filter(item => item.grid && item.grid !== '-')
                                   .map(item => ({
                                       grid: item.grid,
                                       callsign: item.toCallsign || 'UNKNOWN',
                                       timestamp: item.timestamp
                                   }));
                    setTimeout(() => {
                        this.displayAllQsosOnMap(grids);
                    }, 300);
                }
            }
        });

        // 连接状态变化处理
        // Connection status change handling
        this.client.on('status', (connected) => {
            if (connected) {
                this.fetchData(); // 立即获取一次 // Fetch once immediately
                this.startAutoRefresh(); // 开启自动刷新 // Start auto refresh
            } else {
                this.stopAutoRefresh(); // 停止刷新 // Stop refresh
            }
        });
    }

    startAutoRefresh() {
        this.stopAutoRefresh();
        // 每15秒刷新一次，确保星星数量（QSO计数）实时更新
        // Refresh every 15 seconds to ensure star count (QSO count) updates in real-time
        this.refreshTimer = setInterval(() => {
            this.fetchData();
        }, 15000);
    }

    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    updateCount(count) {
        if (this.countEl) {
            this.countEl.textContent = count;
        }
    }

    show() {
        if (this.modal) this.modal.classList.add('show');
        this.fetchData(true);
    }

    hide() {
        if (this.modal) this.modal.classList.remove('show');
        this.restoreBadge();
    }

    fetchData(showLoading = false) {
        console.log('[QsoManager] Fetching QSO list...');
        if (showLoading && this.listEl) {
            this.listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">Loading...</div>';
        }
        this.client.getQsoList(this.page, this.pageSize);
    }

    locateGrid(grid) {
        if (this.mapFrame && this.mapFrame.contentWindow) {
            // console.log('Locating grid:', grid);

            // 延迟发送消息，确保 iframe 已完全加载
            // Delay sending message to ensure iframe is fully loaded
            setTimeout(() => {
                try {
                    const targetOrigin = this.mapFrame.src ? new URL(this.mapFrame.src).origin : window.location.origin;
                    if (this.isAllowedOrigin(targetOrigin)) {
                        this.mapFrame.contentWindow.postMessage({
                            type: 'LOCATE_GRID',
                            grid: grid
                        }, targetOrigin);
                    }
                } catch (e) {
                    console.warn('[QsoManager] Failed to send LOCATE_GRID message:', e);
                }
            }, 100);
        }
    }

    displayAllQsosOnMap(grids) {
        if (this.mapFrame && this.mapFrame.contentWindow) {
            // console.log('Displaying all QSOs on map:', grids);
            try {
                const targetOrigin = this.mapFrame.src ? new URL(this.mapFrame.src).origin : window.location.origin;
                if (this.isAllowedOrigin(targetOrigin)) {
                    this.mapFrame.contentWindow.postMessage({
                        type: 'DISPLAY_ALL_QSOS',
                        grids: grids
                    }, targetOrigin);
                }
            } catch (e) {
                console.warn('[QsoManager] Failed to send DISPLAY_ALL_QSOS message:', e);
            }
        }
    }

    highlightQsoOnMap(grid, callsign) {
        if (this.mapFrame && this.mapFrame.contentWindow) {
            // console.log('Highlighting QSO on map:', grid, callsign);
            try {
                const targetOrigin = this.mapFrame.src ? new URL(this.mapFrame.src).origin : window.location.origin;
                if (this.isAllowedOrigin(targetOrigin)) {
                    this.mapFrame.contentWindow.postMessage({
                        type: 'HIGHLIGHT_QSO',
                        grid: grid,
                        callsign: callsign
                    }, targetOrigin);
                }
            } catch (e) {
                console.warn('[QsoManager] Failed to send HIGHLIGHT_QSO message:', e);
            }
        }
    }

    shrinkBadge() {
        if (this.badge) {
            this.badge.style.transition = 'all 300ms ease';
            this.badge.style.transform = 'scale(0.6)';
        }
    }

    restoreBadge() {
        if (this.badge) {
            this.badge.style.transform = 'scale(1)';
        }
    }

    formatDate(ts) {
        if (!ts) return '-';
        // Detect if timestamp is in seconds (e.g. < 10 billion) or milliseconds
        // 10 billion seconds is year 2286, so it's a safe threshold
        const isSeconds = ts < 10000000000;
        const d = new Date(isSeconds ? ts * 1000 : ts);
        const pad = (n) => String(n).padStart(2, '0');
        return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    hasCallsign(callsign) {
        return this.qsos.has(callsign);
    }

    renderList(list) {
        if (!this.listEl) return;
        
        if (!list || list.length === 0) {
            this.listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #666; font-size: 0.8rem;">No logs</div>';
            return;
        }

        // 更新缓存
        // Update cache
        this.qsos = new Set(list.map(item => item.toCallsign));

        this.listEl.innerHTML = '';

        list.forEach((item, index) => {
            const call = item.toCallsign || 'UNKNOWN';
            const grid = item.grid || '-';
            const ts = this.formatDate(item.timestamp);

            const el = document.createElement('div');
            el.className = 'qso-item';
            el.dataset.grid = grid;
            el.setAttribute('tabindex', '0');
            el.setAttribute('role', 'button');
            el.setAttribute('aria-label', `QSO Record: ${call}, Grid: ${grid}`);

            const mainDiv = document.createElement('div');
            mainDiv.className = 'qso-main';

            const callDiv = document.createElement('div');
            callDiv.className = 'qso-call';
            callDiv.textContent = call;
            callDiv.title = call;
            mainDiv.appendChild(callDiv);

            const timeDiv = document.createElement('div');
            timeDiv.className = 'qso-time';
            timeDiv.textContent = ts;
            mainDiv.appendChild(timeDiv);

            const subDiv = document.createElement('div');
            subDiv.className = 'qso-sub';

            const gridDiv = document.createElement('div');
            gridDiv.className = 'qso-grid';
            gridDiv.textContent = grid;
            subDiv.appendChild(gridDiv);

            el.appendChild(mainDiv);
            el.appendChild(subDiv);

            this.listEl.appendChild(el);
        });
    }
}
