/**
 * FMO Audio Controller - UI Components
 * 包含音量控制、呼号显示、设备历史、QSO日志等界面组件
 */

import { Utils } from './utils.js';

/** 音量条控制器 */
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
        this.value = 1.0; // 0.0 - 1.0
        this.lastValue = 1.0;

        // 绑定方法到实例，确保可以正确移除事件监听器
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

        // 0-200% 音量映射 (0.0 - 2.0)
        const volumeValue = percent * 2.0;
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
        this.trackWrapper.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.updateFromEvent(e);
            document.addEventListener('mousemove', this.onMove);
            document.addEventListener('mouseup', this.onUp);
        });

        // 触摸事件
        this.trackWrapper.addEventListener('touchstart', (e) => {
            this.isDragging = true;
            this.updateFromEvent(e);
            document.addEventListener('touchmove', this.onTouchMove, { passive: false });
            document.addEventListener('touchend', this.onTouchEnd);
        });

        // 静音切换
        this.muteBtn.addEventListener('click', () => {
            if (this.value > 0) {
                this.lastValue = this.value;
                this.setVolume(0);
            } else {
                this.setVolume(this.lastValue || 1.0);
            }
            // 震动
            if (navigator.vibrate) navigator.vibrate(10);
        });

        // 本地静音切换
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
        this.player.setVolume(val); // 假设 player 支持 0-2.0
        this.updateUI(val);
    }

    updateUI(val) {
        // 显示百分比 (0-200%)
        const displayPercent = Math.round(val * 100);
        // 进度条宽度 (映射 0-2.0 到 0-100%)
        const fillWidth = Math.min(100, (val / 2.0) * 100);
        
        this.fill.style.width = `${fillWidth}%`;
        this.text.textContent = `${displayPercent}%`;
        
        // 更新图标状态
        if (val === 0) {
            this.muteBtn.style.opacity = '0.5';
            this.muteBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`;
        } else {
            this.muteBtn.style.opacity = '1';
            this.muteBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
        }
    }

    updateLocalMuteUI(enabled) {
        if (!this.localMuteBtn) return;
        if (enabled) {
            this.localMuteBtn.className = 'local-mute-toggle active';
            // Muted icon (Red)
            this.localMuteBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>';
        } else {
            this.localMuteBtn.className = 'local-mute-toggle inactive';
            // Play icon (Green)
            this.localMuteBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
        }
    }

    destroy() {
        // 清理所有事件监听器，防止内存泄漏
        document.removeEventListener('mousemove', this.onMove);
        document.removeEventListener('mouseup', this.onUp);
        document.removeEventListener('touchmove', this.onTouchMove);
        document.removeEventListener('touchend', this.onTouchEnd);

        // 清理组件引用
        this.container = null;
        this.trackWrapper = null;
        this.fill = null;
        this.text = null;
        this.muteBtn = null;
        this.localMuteBtn = null;
    }
}

/** 呼号队列显示管理器 */
export class CallsignTicker {
    constructor(containerId, visualizer, qsoManager) {
        this.container = document.getElementById(containerId);
        this.visualizer = visualizer;
        this.qsoManager = qsoManager;
        this.maxItems = 8; // Default
        this.items = []; // 存储 DOM 元素
        
        // 启动呼吸灯循环
        this.animateLoop();
        
        // 动态计算容量
        this.updateCapacity();
        window.addEventListener('resize', () => this.updateCapacity());
    }

    updateCapacity() {
        if (!this.container) return;
        // 计算容器可用高度
        const containerHeight = this.container.clientHeight;
        // 估算每个条目的高度：内容(~40px) + 间距(10px) = ~50px
        const itemHeight = 50;
        // 计算最大容纳数量 (稍微多一点以填满)
        const capacity = Math.floor(containerHeight / itemHeight);
        // 至少保留8个，最大不超过30个
        this.maxItems = Math.max(8, Math.min(30, capacity));
    }

    addCallsign(callsign) {
        if (!this.container) return;

        // 1. 创建新元素
        const el = document.createElement('div');
        el.className = 'callsign-item breathing';
        
        // 创建时间元素
        const timeEl = document.createElement('div');
        timeEl.className = 'callsign-time';
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-GB', { hour12: false });
        timeEl.textContent = timeStr;

        // 检查是否在日志中
        const isLogged = this.qsoManager && this.qsoManager.hasCallsign(callsign);
        
        // 创建星星元素
        const starEl = document.createElement('div');
        starEl.className = isLogged ? 'star-icon solid' : 'star-icon hollow';
        starEl.innerHTML = isLogged ? '★' : '☆';
        
        // 创建内容容器 (Row)
        const rowEl = document.createElement('div');
        rowEl.className = 'callsign-row';
        rowEl.style.display = 'flex';
        rowEl.style.alignItems = 'center';
        rowEl.style.justifyContent = 'center';

        // 创建呼号文本元素
        const textEl = document.createElement('div');
        textEl.className = 'callsign-text';
        textEl.textContent = callsign;

        rowEl.appendChild(starEl);
        rowEl.appendChild(textEl);

        el.appendChild(timeEl);
        el.appendChild(rowEl);
        
        // 2. 添加到容器开头 (最新的在最上面)
        if (this.container.firstChild) {
            this.container.insertBefore(el, this.container.firstChild);
        } else {
            this.container.appendChild(el);
        }
        this.items.unshift(el);
        
        // 3. 强制重绘以触发 transition
        el.offsetHeight; 
        
        // 4. 激活进场动画 (从左侧滑入，挤开下方)
        el.classList.add('active');

        // 5. 移除多余元素 (移除最底部/最旧的)
        if (this.items.length > this.maxItems) {
            const removed = this.items.pop();
            // 优雅移除
            removed.style.maxHeight = '0';
            removed.style.padding = '0';
            removed.style.marginBottom = '0';
            removed.style.opacity = '0';
            removed.style.border = 'none';
            
            setTimeout(() => {
                if (removed.parentNode) {
                    removed.parentNode.removeChild(removed);
                }
            }, 300); // 这里的300ms应该和CSS transition匹配
        }
    }
    
    animateLoop() {
        // 呼吸灯效果通过CSS animation实现，这里不需要JS循环
        // 如果有其他需要每帧更新的逻辑，可以在这里添加
    }
}

/** 设备历史管理 */
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
        this.devices = this.devices.filter(d => d !== ip);
        // 添加到头部
        this.devices.unshift(ip);
        // 限制数量
        if (this.devices.length > 5) this.devices.pop();
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
            
            tag.innerHTML = `
                ${ip}
                <span class="device-del" title="删除">✕</span>
            `;
            
            tag.onclick = () => {
                if (inpHost) inpHost.value = ip;
                this.render(); // 更新高亮
                // 触发连接
                const btnConnect = document.getElementById('btn-connect');
                if (btnConnect) btnConnect.click();
            };
            
            const delBtn = tag.querySelector('.device-del');
            delBtn.onclick = (e) => this.remove(ip, e);
            
            container.appendChild(tag);
        });
    }
}

/** QSO 日志管理器 */
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
        this.refreshTimer = null; // Auto refresh timer
        this.qsos = new Set(); // 缓存 QSO 列表用于快速查找

        if (this.modal) {
            this.initEvents();
        }
    }

    initEvents() {
        // Open Modal
        const openModal = () => this.show();
        if (this.btn) this.btn.addEventListener('click', openModal);
        // 交互优化：点击星星直接打开 QSO 日志
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
        if (this.listEl) {
            this.listEl.addEventListener('click', (e) => {
                const item = e.target.closest('.qso-item');
                if (item) {
                    // 缩小图例
                    this.shrinkBadge();

                    const grid = item.dataset.grid;
                    const call = item.querySelector('.qso-call')?.textContent;
                    if (grid && grid !== '-') {
                        // 定位到特定的QSO标记并打开弹窗
                        this.highlightQsoOnMap(grid, call);

                        // 高亮选中项
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

        // Handle WS messages
        this.client.on('qsoMessage', (msg) => {
            if (msg.subType === 'getListResponse') {
                // 更新数量统计
                if (msg.data.total !== undefined) {
                    this.updateCount(msg.data.total);
                } else if (msg.data.list) {
                    this.updateCount(msg.data.list.length);
                }
                const list = msg.data.list || [];
                this.renderList(list);

                // 发送所有QSO网格到地图显示
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
        this.client.on('status', (connected) => {
            if (connected) {
                this.fetchData(); // 立即获取一次
                this.startAutoRefresh(); // 开启自动刷新
            } else {
                this.stopAutoRefresh(); // 停止刷新
            }
        });
    }

    startAutoRefresh() {
        this.stopAutoRefresh();
        // 每15秒刷新一次，确保星星数量（QSO计数）实时更新
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
            setTimeout(() => {
                this.mapFrame.contentWindow.postMessage({
                    type: 'LOCATE_GRID',
                    grid: grid
                }, '*');
            }, 100);
        }
    }

    displayAllQsosOnMap(grids) {
        if (this.mapFrame && this.mapFrame.contentWindow) {
            // console.log('Displaying all QSOs on map:', grids);
            this.mapFrame.contentWindow.postMessage({
                type: 'DISPLAY_ALL_QSOS',
                grids: grids
            }, '*');
        }
    }

    highlightQsoOnMap(grid, callsign) {
        if (this.mapFrame && this.mapFrame.contentWindow) {
            // console.log('Highlighting QSO on map:', grid, callsign);
            this.mapFrame.contentWindow.postMessage({
                type: 'HIGHLIGHT_QSO',
                grid: grid,
                callsign: callsign
            }, '*');
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
        this.qsos = new Set(list.map(item => item.toCallsign));

        this.listEl.innerHTML = list.map((item, index) => {
            const call = item.toCallsign || 'UNKNOWN';
            const grid = item.grid || '-';
            const ts = this.formatDate(item.timestamp);

            return `
        <div class="qso-item" data-grid="${grid}" tabindex="0" role="button" aria-label="QSO Record: ${call}, Grid: ${grid}">
            <div class="qso-main">
                <div class="qso-call" title="${call}">${call}</div>
                <div class="qso-time">${ts}</div>
            </div>
            <div class="qso-sub">
                <div class="qso-grid">${grid}</div>
            </div>
        </div>
        `;
        }).join('');
    }
}
