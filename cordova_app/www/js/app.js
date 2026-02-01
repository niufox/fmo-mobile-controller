
/** Injected Configuration */
window.APP_CONFIG = {
    "FETCH_PAGE_SIZE": 20,
    "AUTO_REFRESH_INTERVAL": 30000,
    "RECONNECT_DELAY": 3000,
    "POST_SWITCH_DELAY": 3000,
    "WS_PATH": "/ws"
};
// --- 工具函数 ---
        const Utils = {
            // 防抖函数
            debounce(fn, delay) {
                let timer;
                return (...args) => {
                    clearTimeout(timer);
                    timer = setTimeout(() => fn(...args), delay);
                };
            },

            // 节流函数
            throttle(fn, limit) {
                let inThrottle;
                return (...args) => {
                    if (!inThrottle) {
                        fn(...args);
                        inThrottle = true;
                        setTimeout(() => inThrottle = false, limit);
                    }
                };
            },

            // 显示用户友好的错误提示
            showError(message, error = null) {
                console.error('[Error]', message, error);
                console.log('Alert suppressed:', `${message}${error ? `\n\n详细信息: ${error.message}` : ''}`);
            },

            // 安全的JSON解析
            safeJSONParse(str, fallback = null) {
                try {
                    return JSON.parse(str);
                } catch (e) {
                    console.warn('JSON parse failed:', e);
                    return fallback;
                }
            },

            // 检查网络连接状态
            isOnline() {
                return navigator.onLine;
            }
        };

        // --- 错误处理增强 ---
        window.addEventListener('error', (e) => {
            console.error('[Global Error]', e.message, e.filename, e.lineno, e.error);
        });

        window.addEventListener('unhandledrejection', (e) => {
            console.error('[Unhandled Promise Rejection]', e.reason);
            e.preventDefault();
        });

        // --- 网络状态监听 ---
        window.addEventListener('online', () => {
            console.log('[Network] Online');
            if (ctrl && !ctrl.connected) {
                ctrl.connect(ui.inpHost.value.trim());
            }
        });

        window.addEventListener('offline', () => {
            console.log('[Network] Offline');
            Utils.showError('网络连接已断开，请检查网络设置');
        });

        // --- Debug Log Capture ---
        window.__DEBUG_LOGS__ = [];
        (function(){
            const MAX_LOGS = 100;
            const capture = (type, args) => {
                try {
                    const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
                    window.__DEBUG_LOGS__.push(`[${new Date().toLocaleTimeString()}] [${type}] ${msg}`);
                    if (window.__DEBUG_LOGS__.length > MAX_LOGS) window.__DEBUG_LOGS__.shift();
                } catch(e) {}
            };
            const originalLog = console.log;
            const originalWarn = console.warn;
            const originalError = console.error;
            console.log = (...args) => { capture('LOG', args); originalLog.apply(console, args); };
            console.warn = (...args) => { capture('WARN', args); originalWarn.apply(console, args); };
            console.error = (...args) => { capture('ERR', args); originalError.apply(console, args); };
        })();

        // --- 核心类定义区域 ---
        
        /** 音量条控制器 */
        class VolumeSlider {
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

        /** 基础事件发射器 */
        class EventEmitter {
            constructor() { this.events = {}; }
            on(event, listener) {
                if (!this.events[event]) this.events[event] = [];
                this.events[event].push(listener);
            }
            emit(event, ...args) {
                if (this.events[event]) this.events[event].forEach(fn => fn(...args));
            }
        }

        /** WebSocket 控制客户端 */
        class ControlClient extends EventEmitter {
            constructor() {
                super();
                // 配置常量 - 提取以提高可维护性
                this.CONFIG = Object.assign({
                    FETCH_PAGE_SIZE: 20,
                    AUTO_REFRESH_INTERVAL: 30000,
                    RECONNECT_DELAY: 3000,
                    POST_SWITCH_DELAY: 3000,
                    WS_PATH: '/ws'
                }, window.APP_CONFIG || {});

                this.ws = null;
                this.connected = false;
                this.reconnectTimer = null;
                this.autoUpdateTimer = null; // 自动更新定时器
                this.host = '';
                this.stationList = []; // 存储所有已加载的台站
                this.currentStationId = null; // 当前台站ID
                
                // 全量加载状态管理
                this.fetchingAll = false;
                this.tempStationList = [];
                this.fetchStart = 0;
                this.fetchPageSize = this.CONFIG.FETCH_PAGE_SIZE; // 每次获取限制
            }

            connect(host) {
                // 重置加载状态，确保每次连接都能重新获取
                this.fetchingAll = false;
                this.tempStationList = [];
                this.fetchStart = 0;

                this.host = host;
                if (this.ws) {
                    // 关闭旧连接前清除定时器
                    this.stopAutoRefresh();
                    this.ws.close();
                    this.ws = null;
                }

                try {
                    this.ws = new WebSocket(`${(window.location && window.location.protocol === 'https:' ? 'wss' : 'ws')}://${this.host}/ws`);
                    
                    this.ws.onopen = () => {
                        this.connected = true;
                        this.emit('status', true);
                        this.stationList = []; // 重置列表
                        // 连接后自动获取所有列表和当前台站
                        this.fetchList(); // 初始加载
                        this.send('station', 'getCurrent');

                        // 开启30秒自动更新
                        this.startAutoRefresh();
                    };

                    this.ws.onclose = () => {
                        this.connected = false;
                        this.emit('status', false);
                        
                        // 清除自动更新
                        this.stopAutoRefresh();

                        // 3秒后重连
                        clearTimeout(this.reconnectTimer);
                        this.reconnectTimer = setTimeout(() => this.connect(this.host), this.CONFIG.RECONNECT_DELAY);
                    };

                    this.ws.onerror = (e) => {
                        console.error('WS Error connecting to ' + (this.host || 'unknown') + ':', e);
             if (this.host && this.host.indexOf(':') === -1) {
                 console.warn('⚠️ No port specified in host (' + this.host + '). Defaulting to port 80. If your server is on another port (e.g. 8000), please add it like: ' + this.host + ':8000');
             }
                        this.connected = false;
                        this.emit('status', false);
                        // APK Debugging helper
                        if (window.cordova) {
                             // Try to extract useful info, though WS errors are often empty in JS
                             console.log('Alert suppressed:', `WebSocket Error connecting to ${this.host}\nPlease check:\n1. Server is running\n2. Phone is on same Wi-Fi\n3. Use IP address instead of 'fmo.local'`);
                        }
                    };

                    this.ws.onmessage = (e) => {
                        try {
                            const msg = JSON.parse(e.data);
                            this.handleMessage(msg);
                        } catch (err) {
                            console.error('Parse Error:', err);
                        }
                    };

                } catch (e) {
                    console.error('Connection Failed:', e);
                    this.emit('status', false);
                    if (window.cordova) {
                        console.log('Alert suppressed:', `Connection Exception: ${e.message}\nHost: ${host}`);
                    }
                }
            }

            send(type, subType, data = {}) {
                if (!this.connected || !this.ws) return;
                this.ws.send(JSON.stringify({ type, subType, data }));
            }

            handleMessage(msg) {
                // 路由不同类型的消息
                if (msg.type === 'station') {
                    switch (msg.subType) {
                        case 'getListResponse':
                            const newList = msg.data.list || [];
                            const start = msg.data.start;

                            // 如果正在进行全量加载流程
                            if (this.fetchingAll) {
                                // 校验 start (如果服务器返回了 start)
                                if (start !== undefined && start !== this.fetchStart) {
                                    console.warn(`Fetch order mismatch: expected ${this.fetchStart}, got ${start}`);
                                    this.fetchingAll = false;
                                    return;
                                }

                                this.tempStationList = this.tempStationList.concat(newList);
                                
                                // 检查是否还有更多数据
                                // 如果返回的数量少于请求的数量，说明是最后一页
                                if (newList.length < this.fetchPageSize) {
                                    // 加载完成
                                    console.log(`Fetch complete. Total: ${this.tempStationList.length}`);
                                    this.stationList = this.tempStationList;
                                    this.fetchingAll = false;
                                    this.tempStationList = [];
                                    
                                    // 过滤空值
                                    this.stationList = this.stationList.filter(i => i);
                                    this.emit('stationList', this.stationList);
                                } else {
                                    // 继续获取下一页
                                    this.fetchStart += this.fetchPageSize;
                                    this.send('station', 'getListRange', { start: this.fetchStart, count: this.fetchPageSize });
                                }
                            } else {
                                // 非全量加载模式（兼容旧逻辑或单次更新）
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
                            break;
                    }
                } else if (msg.type === 'qso') {
                    this.emit('qsoMessage', msg);
                }
            }

            // 快捷指令
            setStation(uid) { 
                // 乐观更新：立即更新本地状态，解决连续点击失效问题
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
            fetchList() {
                if (this.fetchingAll) return; // 避免重复触发
                
                this.fetchingAll = true;
                this.tempStationList = [];
                this.fetchStart = 0;
                
                // 发起第一次请求
                this.send('station', 'getListRange', { start: 0, count: this.fetchPageSize });
            }

            startAutoRefresh() {
                this.stopAutoRefresh();
                this.autoUpdateTimer = setInterval(() => {
                    if (this.connected) {
                        this.fetchList();
                    }
                }, this.CONFIG.AUTO_REFRESH_INTERVAL); // 30秒间隔
            }

            stopAutoRefresh() {
                if (this.autoUpdateTimer) {
                    clearInterval(this.autoUpdateTimer);
                    this.autoUpdateTimer = null;
                }
            }
            
            // QSO 指令
            getQsoList(page = 0, pageSize = 20) {
                this.send('qso', 'getList', { page, pageSize });
            }
        }

        /** 音频播放器 (基于 api3.0/audioPlayer.js 改进) */
        class AudioPlayer extends EventEmitter {
            constructor({ url = `ws://${window.location.host}/audio`, inputSampleRate = 8000 } = {}) {
                super();
                this.url = url;
                this.inputSampleRate = inputSampleRate;

                // WebAudio
                this.audioCtx = null;
                this.gainNode = null;
                this.analyser = null;

                // WS
                this.ws = null;
                this.connected = false;

                // Buffering & scheduling (来自 api3.0)
                this.chunkQueue = [];
                this.queuedSamples = 0;
                this.scheduledEndTime = 0;
                this.buffering = true;
                this.started = false;

                // Tunables (来自 api3.0 优化参数)
                this.minStartBufferSec = 0.1;
                this.lowBufferSec = 0.3;
                this.targetLeadSec = 0.5;
                this.maxBufferSec = 1.0;

                // State callbacks
                this.onStatus = null;

                // 音频处理链节点 (优化后的处理链)
                this._chainInput = null;
                this.hpfNode = null;
                this.lpfNode = null;
                this.eqLow = null;
                this.eqMid = null;
                this.eqHigh = null;
                this.compressor = null;

                // 录音相关
                this.recording = false;
                this.recordedChunks = [];

                // 本地静音相关 (保持原有功能)
                this.localMuteEnabled = localStorage.getItem('fmo_local_mute') === 'true';
                this.isLocalTransmitting = false;
                this.audioQueueBuffer = []; // FIFO buffer for delay
            }

            setStatus(text) {
                if (this.onStatus) this.onStatus(text);
            }

            async ensureAudio() {
                if (this.audioCtx) return;
                // Create context on user gesture
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                this.gainNode = this.audioCtx.createGain();
                this.gainNode.gain.value = 1;

                // Create analyser for FFT visualization
                this.analyser = this.audioCtx.createAnalyser();
                this.analyser.fftSize = 1024; // 1024-point FFT; freqBinCount = 512
                this.analyser.smoothingTimeConstant = 0.8;
                // Destination chain (tail): analyser -> gain -> destination
                // We'll feed analyser from our processing chain
                this.analyser.connect(this.gainNode);
                this.gainNode.connect(this.audioCtx.destination);

                // Build processing chain (head): source -> _chainInput -> HPF -> LPF -> EQ(Low,Mid,High) -> Compressor -> analyser
                // Create once and reuse for all scheduled chunks
                if (!this._chainInput) {
                    // Unified entry for all sources
                    this._chainInput = this.audioCtx.createGain();
                    this._chainInput.gain.value = 1.0;

                    // High-pass to remove DC/rumble (walkie‑talkie voice) - 优化参数
                    this.hpf = this.audioCtx.createBiquadFilter();
                    this.hpf.type = 'highpass';
                    this.hpf.frequency.value = 220; // slightly lower for more body/warmth
                    this.hpf.Q.value = 0.5; // gentler slope to avoid plastic/boxy feel

                    // Low-pass to tame hiss/sibilance given 8 kHz sampling (Nyquist 4 kHz) - 优化参数
                    this.lpf = this.audioCtx.createBiquadFilter();
                    this.lpf.type = 'lowpass';
                    this.lpf.frequency.value = 3000; // a touch lower to soften edge
                    this.lpf.Q.value = 0.5; // reduce resonance/phasey artifacts

                    // EQ: subtle voice shaping
                    this.eqLow = this.audioCtx.createBiquadFilter();
                    this.eqLow.type = 'lowshelf';
                    this.eqLow.frequency.value = 180; // slight warmth
                    this.eqLow.gain.value = 0.5; // dB, tiny lift

                    this.eqMid = this.audioCtx.createBiquadFilter();
                    this.eqMid.type = 'peaking';
                    this.eqMid.frequency.value = 1400; // reduce nasality
                    this.eqMid.Q.value = 0.8; // broader, more natural
                    this.eqMid.gain.value = 1.0; // dB, milder boost

                    this.eqHigh = this.audioCtx.createBiquadFilter();
                    this.eqHigh.type = 'highshelf';
                    this.eqHigh.frequency.value = 2600; // keep brightness conservative
                    this.eqHigh.gain.value = 0.0; // dB, remove added sheen to avoid plasticky top

                    // Gentle compression to increase loudness consistency - 优化参数
                    this.compressor = this.audioCtx.createDynamicsCompressor();
                    this.compressor.threshold.value = -22; // dB, a bit lighter
                    this.compressor.knee.value = 24; // dB, softer knee
                    this.compressor.ratio.value = 2.0; // :1, reduce flattening
                    this.compressor.attack.value = 0.006; // s, let transients breathe
                    this.compressor.release.value = 0.30; // s, smoother recovery

                    // Wire: input -> HPF -> LPF -> EQ(Low -> Mid -> High) -> Compressor -> Analyser (-> Gain -> Dest)
                    this._chainInput.connect(this.hpf);
                    this.hpf.connect(this.lpf);
                    this.lpf.connect(this.eqLow);
                    this.eqLow.connect(this.eqMid);
                    this.eqMid.connect(this.eqHigh);
                    this.eqHigh.connect(this.compressor);
                    this.compressor.connect(this.analyser);
                }
            }

            unlock() {
                // Try to create if missing (e.g. failed during auto-connect)
                if (!this.audioCtx) {
                    this.ensureAudio();
                }

                if (this.audioCtx && this.audioCtx.state === 'suspended') {
                    this.audioCtx.resume().then(() => {
                        console.log('AudioContext resumed via user interaction');
                    }).catch(e => console.error('AudioContext resume failed:', e));
                }
            }

            connect(host) {
                if (this.ws && (this.connected || this.ws.readyState === WebSocket.CONNECTING)) return;
                this.ensureAudio();
                this.url = `${(window.location && window.location.protocol === 'https:' ? 'wss' : 'ws')}://${host}/audio`;
                this.resetBuffers();

                this.ws = new WebSocket(this.url);
                this.ws.binaryType = 'arraybuffer';

                this.ws.onopen = () => {
                    this.connected = true;
                    this.emit('status', true);
                    this.setStatus('音频已连接');
                    // Resume audio if it was suspended
                    if (this.audioCtx?.state === 'suspended') this.audioCtx.resume();
                };

                this.ws.onclose = () => {
                    this.connected = false;
                    this.emit('status', false);
                    this.setStatus('音频未连接');
                };

                this.ws.onerror = () => {
                    this.emit('status', false);
                    this.setStatus('音频连接错误');
                };

                this.ws.onmessage = (evt) => {
                    const buf = evt.data; // ArrayBuffer
                    if (!(buf instanceof ArrayBuffer)) return;
                    this._ingestPCM16(buf);
                    this._maybeSchedule();
                };
            }

            disconnect() {
                if (this.ws) {
                    try { this.ws.close(); } catch {}
                    this.ws = null;
                }
                this.connected = false;
                // Stop scheduling and clear buffers
                this.resetBuffers();
                // Optionally pause audio to save CPU
                if (this.audioCtx?.state === 'running') this.audioCtx.suspend();
                this.setStatus('音频未连接');
                this.emit('status', false);
            }

            resetBuffers() {
                // stop periodic tick if any
                if (this._tickTimer) {
                    clearTimeout(this._tickTimer);
                    this._tickTimer = null;
                }
                this.chunkQueue = [];
                this.queuedSamples = 0;
                this.scheduledEndTime = this.audioCtx ? this.audioCtx.currentTime : 0;
                this.buffering = true;
                this.started = false;
                // 本地静音缓冲区也清空
                this.audioQueueBuffer = [];
            }

            _ingestPCM16(arrayBuffer) {
                // 触发PCM事件供转录器使用
                this.emit('pcm', arrayBuffer);

                // 录音收集
                if (this.recording) {
                    this.recordedChunks.push(arrayBuffer.slice(0));
                }

                const view = new Int16Array(arrayBuffer);
                // Convert to Float32 [-1,1]
                const f32 = new Float32Array(view.length);
                for (let i = 0; i < view.length; i++) {
                    f32[i] = view[i] / 32768;
                }

                // Latency control: if too much queued, drop oldest to ~targetLeadSec (api3.0 优化)
                const queuedSec = this.queuedSamples / this.inputSampleRate;
                if (queuedSec > this.maxBufferSec) {
                    const targetSamples = Math.floor(this.targetLeadSec * this.inputSampleRate);
                    // Drop enough from head
                    let toDrop = (this.queuedSamples + f32.length) - targetSamples;
                    while (toDrop > 0 && this.chunkQueue.length) {
                        const c = this.chunkQueue[0];
                        if (c.length <= toDrop) {
                            this.chunkQueue.shift();
                            this.queuedSamples -= c.length;
                            toDrop -= c.length;
                        } else {
                            // Trim head of first chunk
                            const remain = c.length - toDrop;
                            const trimmed = c.subarray(c.length - remain);
                            this.chunkQueue[0] = trimmed;
                            this.queuedSamples -= toDrop;
                            toDrop = 0;
                        }
                    }
                }

                // 本地静音逻辑 (500ms 延迟)
                if (this.localMuteEnabled) {
                    this.audioQueueBuffer.push({
                        data: f32,
                        ts: Date.now()
                    });
                    this.processAudioQueueBuffer();
                } else {
                    this.chunkQueue.push(f32);
                    this.queuedSamples += f32.length;
                }
            }
            
            _maybeSchedule() {
                if (!this.audioCtx) return;

                const now = this.audioCtx.currentTime;
                if (this.scheduledEndTime < now) this.scheduledEndTime = now;

                const queuedSec = this.queuedSamples / this.inputSampleRate;

                // Buffering logic (api3.0 优化)
                if (this.buffering) {
                    if (queuedSec >= this.minStartBufferSec) {
                        this.buffering = false;
                        this.started = true;
                        this.setStatus('播放中');
                    } else {
                        // Not enough yet for the very first start
                        this.setStatus('缓冲中...');
                        return;
                    }
                }

                // Schedule ahead to maintain target lead time (api3.0 优化)
                while ((this.scheduledEndTime - now) < this.targetLeadSec && this.chunkQueue.length) {
                    const chunk = this.chunkQueue.shift();
                    this.queuedSamples -= chunk.length;

                    const buffer = this.audioCtx.createBuffer(1, chunk.length, this.inputSampleRate);
                    buffer.copyToChannel(chunk, 0, 0);

                    const src = this.audioCtx.createBufferSource();
                    src.buffer = buffer;
                    // Route each source into processing chain entry (shared), or analyser if chain missing
                    if (this._chainInput) {
                        src.connect(this._chainInput);
                    } else {
                        src.connect(this.analyser);
                    }

                    const duration = chunk.length / this.inputSampleRate;
                    src.start(this.scheduledEndTime);
                    this.scheduledEndTime += duration;
                }

                // If we've started and currently没有可用数据，不要重回缓冲状态；等待新数据并保持"播放中"状态
                if (this.started && !this.buffering) {
                    this.setStatus('播放中');
                }

                // Keep a light scheduling tick while connected
                if (this.connected) {
                    clearTimeout(this._tickTimer);
                    this._tickTimer = setTimeout(() => this._maybeSchedule(), 60);
                }
            }

            processAudioQueueBuffer() {
                const now = Date.now();
                // 处理缓冲区
                while(this.audioQueueBuffer.length > 0) {
                    // 检查最早的包
                    if (now - this.audioQueueBuffer[0].ts >= 500) {
                        const item = this.audioQueueBuffer.shift();
                        // 判定是否为本地发射 (根据延迟后的时刻判定)
                        // 若当前状态为本地发射，则丢弃该包
                        if (this.isLocalTransmitting) {
                            // Mute (discard)
                        } else {
                            this.chunkQueue.push(item.data);
                            this.queuedSamples += item.data.length;
                            this._maybeSchedule();
                        }
                    } else {
                        break;
                    }
                }

                // Continue checking if buffer is not empty
                if (this.audioQueueBuffer.length > 0) {
                    setTimeout(() => this.processAudioQueueBuffer(), 50);
                }
            }

            setLocalMute(enabled) {
                this.localMuteEnabled = enabled;
                localStorage.setItem('fmo_local_mute', enabled);
                if (!enabled) {
                    this.audioQueueBuffer = []; // Clear buffer to be responsive
                }
            }

            setLocalTransmission(isLocal) {
                this.isLocalTransmitting = isLocal;
            }

            setVolume(val) {
                if (this.gainNode) this.gainNode.gain.value = Number(val) || 0;
            }

            startRecording() {
                this.recording = true;
                this.recordedChunks = [];
            }

            stopRecording() {
                this.recording = false;
                const blob = this.exportWAV();
                this.recordedChunks = [];
                return blob;
            }

            exportWAV() {
                if (this.recordedChunks.length === 0) return null;
                // 计算总长度
                const totalLen = this.recordedChunks.reduce((acc, c) => acc + c.byteLength, 0);
                const buffer = new Uint8Array(totalLen);
                let offset = 0;
                for (const chunk of this.recordedChunks) {
                    buffer.set(new Uint8Array(chunk), offset);
                    offset += chunk.byteLength;
                }

                // 创建 WAV 头
                const wavHeader = this.createWavHeader(totalLen, 1, this.inputSampleRate, 16);
                return new Blob([wavHeader, buffer], { type: 'audio/wav' });
            }

            createWavHeader(dataLength, numChannels, sampleRate, bitsPerSample) {
                const header = new ArrayBuffer(44);
                const view = new DataView(header);

                // RIFF chunk descriptor
                this.writeString(view, 0, 'RIFF');
                view.setUint32(4, 36 + dataLength, true);
                this.writeString(view, 8, 'WAVE');

                // fmt sub-chunk
                this.writeString(view, 12, 'fmt ');
                view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
                view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
                view.setUint16(22, numChannels, true);
                view.setUint32(24, sampleRate, true);
                view.setUint32(28, sampleRate * numChannels * bitsPerSample / 8, true); // ByteRate
                view.setUint16(32, numChannels * bitsPerSample / 8, true); // BlockAlign
                view.setUint16(34, bitsPerSample, true);

                // data sub-chunk
                this.writeString(view, 36, 'data');
                view.setUint32(40, dataLength, true);

                return header;
            }

            writeString(view, offset, string) {
                for (let i = 0; i < string.length; i++) {
                    view.setUint8(offset + i, string.charCodeAt(i));
                }
            }
        }

        /** 可视化引擎 */
        /** 基础渲染器 */
        class BaseRenderer {
            constructor(ctx) { this.ctx = ctx; this.width = 0; this.height = 0; }
            resize(w, h) { this.width = w; this.height = h; }
            draw(analyser, dataArray, bufferLength, theme) {}
        }

        /** 1. 频谱模式渲染器 (SPECTRUM) */
        class SpectrumRenderer extends BaseRenderer {
            constructor(ctx) {
                super(ctx);
                this.peaks = [];
            }

            draw(analyser, dataArray, bufferLength, theme) {
                analyser.getByteFrequencyData(dataArray);
                const { ctx, width: w, height: h } = this;
                
                const displayW = this.ctx.canvas.clientWidth || (w / window.devicePixelRatio);
                const barCount = Math.max(24, Math.min(36, Math.floor(displayW / 12)));
                const step = Math.max(1, Math.floor(bufferLength / barCount));
                
                // Visualization Shift: Start from 20% width to avoid left-side callsign overlap
                const startX = w * 0.2;
                const availableW = w * 0.8;
                const colWidth = availableW / barCount;
                const groundY = h * 0.85; // Reverted to original height
                
                if (this.peaks.length !== barCount) this.peaks = new Array(barCount).fill(0);

                ctx.shadowBlur = 0;
                ctx.shadowColor = theme.primary;

                for(let i = 0; i < barCount; i++) {
                    const value = dataArray[i * step] || 0;
                    const barHeight = (value / 255) * groundY * 0.95; 
                    const x = startX + i * colWidth + colWidth/2;
                    
                    // 1. 主体粒子柱
                    const particleCount = Math.floor(barHeight / 14); 
                    for (let j = 0; j < particleCount; j++) {
                        const y = groundY - (j * 14 + 10);
                        const ratio = j / particleCount; 
                        
                        ctx.beginPath();
                        const size = 3 + ratio * 3.5; 
                        ctx.arc(x, y, size, 0, Math.PI * 2);
                        
                        if (j === particleCount - 1) {
                            ctx.fillStyle = '#ffffff';
                            ctx.shadowBlur = 8;
                            ctx.shadowColor = '#ffffff';
                        } else {
                            ctx.fillStyle = i % 2 === 0 ? theme.primary : theme.secondary;
                            ctx.shadowBlur = 0;
                        }
                        
                        ctx.globalAlpha = ratio * 0.7 + 0.3;
                        ctx.fill();
                    }
                    ctx.shadowBlur = 0;

                    // 2. 倒影
                    const reflectCount = Math.floor(particleCount / 3);
                    for (let j = 0; j < reflectCount; j++) {
                        const y = groundY + (j * 14 + 10);
                        if (y > h) break;
                        const ratio = 1 - (j / reflectCount);
                        ctx.beginPath();
                        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
                        ctx.fillStyle = i % 2 === 0 ? theme.primary : theme.secondary;
                        ctx.globalAlpha = ratio * 0.15;
                        ctx.fill();
                    }
                    
                    // 3. 掉落峰值
                    if (barHeight > this.peaks[i]) this.peaks[i] = barHeight;
                    else this.peaks[i] -= 2; 
                    
                    if (this.peaks[i] > 0) {
                        const peakY = groundY - this.peaks[i] - 12;
                        ctx.beginPath();
                        ctx.arc(x, peakY, 3, 0, Math.PI * 2);
                        ctx.fillStyle = theme.secondary;
                        ctx.globalAlpha = 1.0;
                        ctx.fill();
                    }
                }
                
                // 地平线
                ctx.beginPath();
                ctx.moveTo(0, groundY);
                ctx.lineTo(w, groundY);
                ctx.strokeStyle = theme.primary;
                ctx.lineWidth = 2;
                ctx.globalAlpha = 0.4;
                ctx.stroke();
                ctx.globalAlpha = 1.0;
            }
        }

        /** 2. 镜像模式渲染器 (MIRROR) - 优化：离屏Canvas缓存背景 */
        class MirrorRenderer extends BaseRenderer {
            constructor(ctx) {
                super(ctx);
                this.bgCanvas = document.createElement('canvas');
                this.bgCtx = this.bgCanvas.getContext('2d');
                this.bgCached = false;
            }

            resize(w, h) {
                super.resize(w, h);
                this.bgCanvas.width = w;
                this.bgCanvas.height = h;
                this.bgCached = false;
            }

            drawBackground() {
                if (this.bgCached) return;
                const { width: w, height: h } = this;
                const ctx = this.bgCtx;
                
                ctx.clearRect(0, 0, w, h);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                for(let i=0; i<=w; i+=40) { ctx.moveTo(i, 0); ctx.lineTo(i, h); }
                for(let i=0; i<=h; i+=40) { ctx.moveTo(0, i); ctx.lineTo(w, i); }
                ctx.stroke();
                this.bgCached = true;
            }

            draw(analyser, dataArray, bufferLength, theme) {
                analyser.getByteFrequencyData(dataArray);
                const { ctx, width: w, height: h } = this;
                const cx = w / 2;
                const cy = h / 2;

                this.drawBackground();
                ctx.drawImage(this.bgCanvas, 0, 0);

                const bars = 48;
                const step = Math.floor(bufferLength / bars);
                const barW = (w / 2) / bars;

                for(let i = 0; i < bars; i++) {
                    const value = dataArray[i * step];
                    const percent = value / 255;
                    let barH = percent * (h * 0.7);
                    if (i < 5) barH *= 1.2;

                    ctx.fillStyle = i % 3 === 0 ? theme.secondary : theme.primary;
                    
                    if (percent > 0.6) {
                        ctx.shadowBlur = 15;
                        ctx.shadowColor = ctx.fillStyle;
                    } else {
                        ctx.shadowBlur = 0;
                    }

                    const xOffset = i * barW;
                    const blockHeight = 6;
                    const gap = 2;
                    const totalBlocks = Math.floor(barH / (blockHeight + gap));

                    for (let b = 0; b < totalBlocks; b++) {
                        ctx.globalAlpha = 1.0 - (b / totalBlocks) * 0.6;
                        const yOffset = b * (blockHeight + gap);
                        
                        ctx.fillRect(cx + xOffset, cy - yOffset, barW - 2, blockHeight);
                        ctx.fillRect(cx + xOffset, cy + yOffset, barW - 2, blockHeight);
                        ctx.fillRect(cx - xOffset - barW, cy - yOffset, barW - 2, blockHeight);
                        ctx.fillRect(cx - xOffset - barW, cy + yOffset, barW - 2, blockHeight);
                    }
                }
                ctx.globalAlpha = 1.0;
                ctx.shadowBlur = 0;

                const bass = dataArray[3] / 255;
                ctx.fillStyle = '#ffffff';
                ctx.globalAlpha = 0.5 + bass * 0.5;
                ctx.fillRect(cx - 1, cy - (h/2)*bass, 2, h*bass);
                ctx.globalAlpha = 1.0;
            }
        }

        /** 3. 波形模式渲染器 (WAVEFORM) */
        class WaveformRenderer extends BaseRenderer {
            draw(analyser, dataArray, bufferLength, theme) {
                analyser.getByteTimeDomainData(dataArray);
                const { ctx, width: w, height: h } = this;
                
                // 1. 电流光晕
                ctx.lineWidth = 3;
                ctx.strokeStyle = theme.primary;
                ctx.shadowBlur = 20;
                ctx.shadowColor = theme.primary;
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';
                
                ctx.beginPath();
                const sliceWidth = w * 1.0 / bufferLength;
                let x = 0;
                for(let i = 0; i < bufferLength; i++) {
                    const v = dataArray[i] / 128.0;
                    const y = v * h/2;
                    if(i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                    x += sliceWidth;
                }
                ctx.stroke();
                
                // 2. 幻影重影 (RGB分离)
                ctx.lineWidth = 2;
                ctx.strokeStyle = theme.secondary;
                ctx.globalAlpha = 0.4;
                ctx.shadowBlur = 0;
                
                ctx.beginPath();
                x = 0;
                for(let i = 0; i < bufferLength; i++) {
                    const v = dataArray[i] / 128.0;
                    const y = v * h/2 + 4; 
                    if(i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                    x += sliceWidth;
                }
                ctx.stroke();
                ctx.globalAlpha = 1.0;
            }
        }

        /** 4. 示波器渲染器 (OSCILLOSCOPE) */
        class OscilloscopeRenderer extends BaseRenderer {
            draw(analyser, dataArray, bufferLength, theme) {
                analyser.getByteTimeDomainData(dataArray);
                const { ctx, width: w, height: h } = this;

                // 1. 全息网格
                const time = Date.now() / 1000;
                const gridOffset = (time * 50) % 50;
                
                ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                for (let gx = 0; gx < w; gx += 50) { ctx.moveTo(gx, 0); ctx.lineTo(gx, h); }
                for (let gy = gridOffset; gy < h; gy += 50) { ctx.moveTo(0, gy); ctx.lineTo(w, gy); }
                ctx.stroke();

                // 2. 高亮信号线
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#00ff00';
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#00ff00';
                ctx.beginPath();
                
                const sliceWidth = w * 1.0 / bufferLength;
                let x = 0;
                for(let i = 0; i < bufferLength; i++) {
                    const v = dataArray[i] / 128.0;
                    const y = v * h/2;
                    if(i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                    x += sliceWidth;
                }
                ctx.stroke();
                ctx.shadowBlur = 0;

                // 3. 扫描线纹理
                ctx.fillStyle = 'rgba(0,0,0,0.1)';
                for(let i=0; i<h; i+=3) { ctx.fillRect(0, i, w, 1); }
            }
        }

        /** 5. 放射模式渲染器 (RADIAL) */
        class RadialRenderer extends BaseRenderer {
            draw(analyser, dataArray, bufferLength, theme, extra) {
                analyser.getByteFrequencyData(dataArray);
                const { ctx, width: w, height: h } = this;
                const cx = w / 2;
                const cy = h / 2;
                const radius = Math.min(w, h) / 4.5; 
                
                ctx.save();
                ctx.translate(cx, cy);
                
                // 1. 核心 (空心)
                const bass = dataArray[5] / 255.0;
                ctx.beginPath();
                const coreRadius = radius * (0.8 + bass * 0.3);
                ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
                ctx.strokeStyle = theme.primary;
                ctx.lineWidth = 2 + bass * 8; 
                ctx.globalAlpha = 0.6 + bass * 0.4;
                ctx.shadowBlur = 15;
                ctx.shadowColor = theme.primary;
                ctx.stroke();
                ctx.globalAlpha = 1.0;
                ctx.shadowBlur = 0;

                // 1.1 显示呼号 (动态)
                if (extra && extra.callsign && extra.opacity > 0) {
                    ctx.save();
                    ctx.globalAlpha = extra.opacity;
                    ctx.fillStyle = '#ffffff';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    
                    const baseSize = radius * 0.4;
                    const dynamicSize = baseSize * (1 + bass * 0.2); 
                    ctx.font = `bold ${Math.floor(dynamicSize)}px "Roboto Mono", monospace`;
                    
                    ctx.shadowBlur = 10 + bass * 20;
                    ctx.shadowColor = theme.primary;
                    
                    ctx.fillText(extra.callsign, 0, 0);
                    ctx.restore();
                }

                // 2. 旋转环
                ctx.rotate(Date.now() * 0.0005); 
                const bars = 64; 
                const step = Math.floor(bufferLength / bars);
                
                for(let i = 0; i < bars; i++) { 
                    const value = dataArray[i * step];
                    const percent = value / 255;
                    const angle = (i / bars) * Math.PI * 2;
                    const nextAngle = ((i + 0.8) / bars) * Math.PI * 2;
                    
                    const innerR = radius;
                    const barH = percent * (radius * 0.8);
                    
                    ctx.beginPath();
                    ctx.arc(0, 0, innerR + barH, angle, nextAngle);
                    ctx.arc(0, 0, innerR, nextAngle, angle, true);
                    ctx.fillStyle = i % 2 === 0 ? theme.primary : theme.secondary;
                    ctx.fill();
                    
                    if (percent > 0.5) {
                        const outerStart = radius * 2.0;
                        const outerEnd = outerStart + (percent * radius * 0.5);
                        ctx.beginPath();
                        ctx.moveTo(Math.cos(angle)*outerStart, Math.sin(angle)*outerStart);
                        ctx.lineTo(Math.cos(angle)*outerEnd, Math.sin(angle)*outerEnd);
                        ctx.strokeStyle = theme.secondary;
                        ctx.lineWidth = 2;
                        ctx.stroke();
                    }
                }
                ctx.restore();
            }
        }

        /** 6. 粒子模式渲染器 (PARTICLES) */
        class ParticlesRenderer extends BaseRenderer {
            constructor(ctx) {
                super(ctx);
                this.particles = [];
                this.initialized = false;
            }

            resize(w, h) {
                super.resize(w, h);
                if (!this.initialized) {
                    this.initParticles(w, h);
                    this.initialized = true;
                }
            }

            initParticles(w, h) {
                this.particles = [];
                for(let i=0; i<150; i++) {
                    this.particles.push({
                        x: Math.random() * w,
                        y: Math.random() * h,
                        baseSize: Math.random() * 5 + 3,
                        randomSpeed: Math.random() * 0.05 + 0.02,
                        colorType: Math.random() > 0.5 ? 'primary' : 'secondary'
                    });
                }
            }

            draw(analyser, dataArray, bufferLength, theme) {
                analyser.getByteFrequencyData(dataArray);
                const { ctx, width: w, height: h } = this;
                
                if (this.particles.length === 0) this.initParticles(w, h);

                let bass = 0;
                for(let i=0; i<20; i++) bass += dataArray[i];
                bass = bass / 20 / 255; 

                const cx = w / 2;
                const cy = h / 2;
                const speedBase = 1 + bass * 8;

                ctx.globalCompositeOperation = 'lighter'; 

                this.particles.forEach((p) => {
                    const oldX = p.x;
                    const oldY = p.y;
                    
                    let dx = p.x - cx;
                    let dy = p.y - cy;
                    let dist = Math.sqrt(dx*dx + dy*dy);
                    let angle = Math.atan2(dy, dx);
                    
                    const maxDist = Math.max(w, h) * 0.8;
                    if (dist < 5 || dist > maxDist) {
                        angle = Math.random() * Math.PI * 2;
                        dist = 10 + Math.random() * 20;
                        p.x = cx + Math.cos(angle) * dist;
                        p.y = cy + Math.sin(angle) * dist;
                        return;
                    }

                    angle += 0.01 * p.randomSpeed * (bass > 0.5 ? 2 : 1); 
                    dist += speedBase * p.randomSpeed * 5;

                    p.x = cx + Math.cos(angle) * dist;
                    p.y = cy + Math.sin(angle) * dist;

                    const size = p.baseSize * (0.3 + bass * 0.7);
                    const alpha = Math.min(1, (dist / (w/3))); 

                    ctx.beginPath();
                    ctx.moveTo(oldX, oldY);
                    ctx.lineTo(p.x, p.y);
                    ctx.lineWidth = size;
                    ctx.strokeStyle = p.colorType === 'primary' ? theme.primary : theme.secondary;
                    ctx.lineCap = 'round';
                    ctx.globalAlpha = alpha;
                    ctx.stroke();
                    
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, size * 0.6, 0, Math.PI*2);
                    ctx.fillStyle = '#ffffff';
                    ctx.globalAlpha = alpha;
                    ctx.fill();
                });
                
                ctx.globalCompositeOperation = 'source-over'; 
                ctx.globalAlpha = 1.0;
            }
        }

        /** 7. 太阳系模拟渲染器 (SOLAR_SYSTEM) */
        class SolarSystemRenderer extends BaseRenderer {
            constructor(ctx) {
                super(ctx);
                
                // 艺术配色库 (用于行星云微粒)
                const palette = [
                    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD',
                    '#D4A5A5', '#9B59B6', '#3498DB', '#E67E22', '#2ECC71',
                    '#F1C40F', '#E74C3C', '#1ABC9C', '#8E44AD', '#FF9F43'
                ];
                const getRandomColor = () => palette[Math.floor(Math.random() * palette.length)];

                // 行星样式定义 (高饱和度艺术配色)
                const planetStyles = {
                    'Mercury': { type: 'crater', color1: '#B0B0B0', color2: '#808080', highlight: '#E0E0E0' }, 
                    'Venus': { type: 'cloud', color1: '#FFD700', color2: '#DAA520', highlight: '#FFFACD' }, 
                    'Earth': { type: 'earth', color1: '#00BFFF', color2: '#0000CD', highlight: '#87CEFA' }, 
                    'Mars': { type: 'rust', color1: '#FF4500', color2: '#8B0000', highlight: '#FF7F50' }, 
                    'Jupiter': { type: 'banded', color1: '#FFA500', color2: '#D2691E', highlight: '#FFE4B5', bands: ['#FFA500', '#FFE4B5', '#D2691E', '#FFE4B5'] }, 
                    'Saturn': { type: 'banded', color1: '#FFD700', color2: '#B8860B', highlight: '#FFF8DC', bands: ['#FFD700', '#FFF8DC', '#DAA520'] }, 
                    'Uranus': { type: 'gas', color1: '#00FFFF', color2: '#008B8B', highlight: '#E0FFFF' }, 
                    'Neptune': { type: 'gas', color1: '#1E90FF', color2: '#00008B', highlight: '#87CEFA' }, 
                    'Pluto': { type: 'ice', color1: '#F5DEB3', color2: '#A0522D', highlight: '#FFF5EE' } 
                };

                // 卫星配置 (相对于行星的尺寸和距离)
                // 轨道速度符合开普勒定律 (T^2 ~ R^3, v ~ R^-0.5) 
                // 基础速度: Earth = 1.0 (120s Period)
                this.planets = [
                    { name: 'Mercury', r: 0.8, dist: 1.5, speed: 4.15, style: planetStyles['Mercury'], moons: [] },
                    { name: 'Venus', r: 1.8, dist: 2.5, speed: 1.62, style: planetStyles['Venus'], moons: [] },
                    { name: 'Earth', r: 2.0, dist: 3.3, speed: 1.0, style: planetStyles['Earth'], moons: [
                        { name: 'Moon', r: 0.27, dist: 0.3, speed: 2.5, color: '#D3D3D3' }
                    ]},
                    { name: 'Mars', r: 1.2, dist: 4.0, speed: 0.53, style: planetStyles['Mars'], moons: [
                        { name: 'Phobos', r: 0.15, dist: 0.2, speed: 4.0, color: '#C0C0C0' },
                        { name: 'Deimos', r: 0.12, dist: 0.3, speed: 2.0, color: '#A9A9A9' }
                    ]},
                    { name: 'Jupiter', r: 5.5, dist: 6.5, speed: 0.084, style: planetStyles['Jupiter'], moons: [
                        { name: 'Io', r: 0.3, dist: 0.7, speed: 3.0, color: '#FFFFE0' },
                        { name: 'Europa', r: 0.25, dist: 0.9, speed: 2.5, color: '#F0F8FF' },
                        { name: 'Ganymede', r: 0.4, dist: 1.2, speed: 2.0, color: '#D3D3D3' },
                        { name: 'Callisto', r: 0.35, dist: 1.5, speed: 1.5, color: '#708090' }
                    ]},
                    { name: 'Saturn', r: 4.8, dist: 8.0, speed: 0.034, style: planetStyles['Saturn'], moons: [
                        { name: 'Titan', r: 0.4, dist: 0.8, speed: 2.0, color: '#F4A460' },
                        { name: 'Rhea', r: 0.2, dist: 0.5, speed: 3.0, color: '#D3D3D3' }
                    ]},
                    { name: 'Uranus', r: 4.2, dist: 9.2, speed: 0.012, style: planetStyles['Uranus'], moons: [
                        { name: 'Titania', r: 0.2, dist: 0.5, speed: 2.5, color: '#E0FFFF' },
                        { name: 'Oberon', r: 0.2, dist: 0.6, speed: 2.0, color: '#E0FFFF' }
                    ]},
                    { name: 'Neptune', r: 4.0, dist: 10.2, speed: 0.006, style: planetStyles['Neptune'], moons: [
                        { name: 'Triton', r: 0.3, dist: 0.5, speed: -2.0, color: '#FFC0CB' } // 逆行卫星
                    ]},
                    { name: 'Pluto', r: 2.5, dist: 11.0, speed: 0.004, style: planetStyles['Pluto'], moons: [
                        { name: 'Charon', r: 1.2, dist: 0.3, speed: 1.0, color: '#808080' }
                    ]}
                ];
                
                // 构建呼号分配目标列表 (行星 + 卫星)
                this.targets = [];
                this.planets.forEach((p, pIdx) => {
                    this.targets.push({ type: 'planet', pIdx: pIdx, name: p.name });
                    if (p.moons) {
                        p.moons.forEach((m, mIdx) => {
                            this.targets.push({ type: 'moon', pIdx: pIdx, mIdx: mIdx, name: m.name });
                        });
                    }
                });
                
                // 预计算恒星背景 (动态旋转与闪烁)
                this.stars = [];
                for(let i=0; i<300; i++) {
                    this.stars.push({
                        r: Math.random() * 1.5, // 归一化极径
                        angle: Math.random() * Math.PI * 2, // 初始角度
                        size: Math.random() * 2.5 + 0.5, // 大小差异化 (0.5 - 3.0)
                        blinkSpeed: Math.random() * 0.005 + 0.002, // 闪烁速度
                        blinkPhase: Math.random() * Math.PI * 2, // 闪烁相位
                        baseAlpha: Math.random() * 0.5 + 0.2 // 基础透明度
                    });
                }
                this.starRotation = 0; // 整体旋转角度

                // 速度设置: 120s per Earth orbit
                // Logic: 60fps, angleOffset += speed * 0.02
                // 2*PI / (speed * 0.02 * 60) = 120  => speed = 0.0436
                this.baseSpeed = 0.0436; 
                this.currentSpeed = this.baseSpeed;
                this.angleOffset = 0;
                this.tilt = 0.6; // 视角倾斜 (0.6 约等于 37度，增加垂直空间)
                this.orbitSpeedScale = 0.5;
                
                // 行星云数据 (右上角)
                this.cloudAngle = 0;
                this.cloudParticles = Array.from({length: 40}, () => ({
                    x: (Math.random() - 0.5) * 100,
                    y: (Math.random() - 0.5) * 60,
                    size: Math.random() * 2 + 1,
                    color: getRandomColor(),
                    alpha: Math.random() * 0.6 + 0.2
                }));

                this.activeTarget = null;
                this.lastCallsign = '';

                // 中继台星星系统
                this.repeaterStars = []; // 存储中继台星星数据
                this.repeaterStations = []; // 中继台列表
                this.repeaterSpawnTimer = 0; // 中继台浮现计时器
                this.repeaterSpawnInterval = 5000; // 每5秒尝试浮现1-3个中继台
                this.repeaterFadeTimer = 0; // 中继台消失计时器
                this.repeaterFadeInterval = 8000; // 8秒后开始消失
                this.repeaterFadeDuration = 2000; // 2秒完全消失

                // 太阳喷发系统配置
                this.eruptions = [];
                this.eruptionConfig = {
                    sensitivity: 1.0,   // 音调敏感度
                    randomness: 0.5,    // 随机性程度
                    intensity: 1.0,     // 光芒强度缩放
                    speed: 0.5          // 喷发速度缩放
                };
            }

            draw(analyser, dataArray, bufferLength, theme, extra) {
                analyser.getByteFrequencyData(dataArray);
                const { ctx, width: w, height: h } = this;
                const cx = w / 2;
                const cy = h / 2;
                const minDim = Math.min(w, h); // 用于自适应字体大小和显隐

                // 辅助函数: 计算对比色文本
                const getTextColor = (hex) => {
                    if(!hex || hex[0]!=='#') return '#ffffff';
                    const r = parseInt(hex.slice(1,3), 16);
                    const g = parseInt(hex.slice(3,5), 16);
                    const b = parseInt(hex.slice(5,7), 16);
                    return (r*0.299 + g*0.587 + b*0.114) > 160 ? '#000000' : '#ffffff';
                };
                
                // 1. 计算音频能量与速度
                let energy = 0;
                let bass = 0;
                let mid = 0;
                let treble = 0;
                
                for(let i=0; i<bufferLength; i++) {
                    const val = dataArray[i];
                    energy += val;
                    if(i < 20) bass += val;
                    else if(i < 200) mid += val;
                    else treble += val;
                }
                energy /= (bufferLength * 255);
                bass /= (20 * 255);
                mid /= (180 * 255);
                treble /= ((bufferLength - 200) * 255);

                // 加速逻辑: 通联时(有能量)显著加速
                const targetSpeed = this.baseSpeed + energy * 6.0;
                this.currentSpeed += (targetSpeed - this.currentSpeed) * 0.05;
                this.angleOffset += this.currentSpeed * 0.01;

                // 2. 呼号分配逻辑
                const callsign = (extra && extra.callsign && extra.opacity > 0) ? extra.callsign : null;
                const input = extra.input || { x: 0, y: 0, active: false };

                if (callsign && callsign !== this.lastCallsign) {
                    this.lastCallsign = callsign;
                    let hash = 0;
                    for (let i = 0; i < callsign.length; i++) hash = callsign.charCodeAt(i) + ((hash << 5) - hash);
                    this.activeTarget = this.targets[Math.abs(hash) % this.targets.length];
                }

                // 3. 绘制背景星空
                this.starRotation += 0.0001;
                const maxDim = Math.max(w, h);
                const nowTime = Date.now();

                // 处理中继台浮现/消失逻辑
                this.repeaterSpawnTimer += 16; // 假设60fps，每次约16ms
                this.repeaterFadeTimer += 16;

                // 定期浮现新的中继台星星
                if (this.repeaterSpawnTimer >= this.repeaterSpawnInterval && this.repeaterStations.length > 0) {
                    this.repeaterSpawnTimer = 0;
                    // 随机选择5-9个中继台
                    const count = Math.floor(Math.random() * 5) + 5;
                    const shuffled = [...this.repeaterStations].sort(() => Math.random() - 0.5);
                    const selectedRepeater = shuffled.slice(0, count);

                    selectedRepeater.forEach(station => {
                        // 检查是否已存在
                        const exists = this.repeaterStars.find(rs => rs.uid === station.uid);
                        if (!exists) {
                            // 创建新的中继台星星
                            const starIndex = Math.floor(Math.random() * this.stars.length);
                            const baseStar = this.stars[starIndex];
                            this.repeaterStars.push({
                                ...station,
                                starIndex: starIndex,
                                spawnTime: nowTime,
                                alpha: 0,
                                targetAlpha: 1,
                                phase: 'spawning', // spawning -> visible -> fading
                                blinkOffset: Math.random() * Math.PI * 2
                            });
                        }
                    });
                }

                // 绘制中继台星星
                this.repeaterStars.forEach((rs, idx) => {
                    const baseStar = this.stars[rs.starIndex];
                    if (!baseStar) return;

                    // 计算透明度（浮现/消失动画）
                    if (rs.phase === 'spawning') {
                        rs.alpha += 0.05;
                        if (rs.alpha >= 1) {
                            rs.alpha = 1;
                            rs.phase = 'visible';
                            rs.visibleStartTime = nowTime;
                        }
                    } else if (rs.phase === 'visible') {
                        // 8秒后开始消失
                        if (nowTime - rs.visibleStartTime > this.repeaterFadeInterval) {
                            rs.phase = 'fading';
                        }
                    } else if (rs.phase === 'fading') {
                        rs.alpha -= 0.02;
                        if (rs.alpha <= 0) {
                            this.repeaterStars.splice(idx, 1);
                            return;
                        }
                    }

                    const blink = Math.sin(nowTime * baseStar.blinkSpeed + baseStar.blinkPhase + rs.blinkOffset);
                    const starAlpha = Math.max(0.1, Math.min(1, baseStar.baseAlpha + blink * 0.3 + energy * 0.5));
                    const finalAlpha = starAlpha * rs.alpha;

                    const currentAngle = baseStar.angle + this.starRotation;
                    const x = cx + Math.cos(currentAngle) * baseStar.r * maxDim * 0.8;
                    const y = cy + Math.sin(currentAngle) * baseStar.r * maxDim * 0.8;

                    // 绘制发光效果
                    ctx.save();
                    ctx.shadowBlur = 15;
                    ctx.shadowColor = theme.primary || '#ff9800';
                    ctx.fillStyle = `rgba(255, 200, 100, ${finalAlpha * 0.6})`;
                    ctx.beginPath();
                    ctx.arc(x, y, baseStar.size * 1.5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();

                    // 绘制星星本体
                    ctx.fillStyle = `rgba(255, 220, 150, ${finalAlpha})`;
                    ctx.beginPath();
                    ctx.arc(x, y, baseStar.size, 0, Math.PI * 2);
                    ctx.fill();

                    // 绘制台站名称
                    if (rs.alpha > 0.5 && rs.name) {
                        ctx.save();
                        ctx.font = 'bold 10px "Roboto Mono"';
                        const text = rs.name;
                        const textMetrics = ctx.measureText(text);
                        const textW = textMetrics.width;
                        const textH = 14;

                        // 背景
                        ctx.fillStyle = `rgba(255, 152, 0, ${finalAlpha * 0.7})`;
                        ctx.globalAlpha = finalAlpha;
                        ctx.beginPath();
                        ctx.roundRect(x - textW / 2 - 4, y - textH - 8, textW + 8, textH, 4);
                        ctx.fill();

                        // 文字
                        ctx.fillStyle = `rgba(255, 255, 255, ${finalAlpha})`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(text, x, y - 14);
                        ctx.restore();
                    }
                });

                this.stars.forEach(star => {
                    // 跳过已被中继台占用的星星
                    const isRepeaterStar = this.repeaterStars.some(rs => rs.starIndex === this.stars.indexOf(star));
                    if (isRepeaterStar) return;

                    const blink = Math.sin(nowTime * star.blinkSpeed + star.blinkPhase);
                    const alpha = Math.max(0.1, Math.min(1, star.baseAlpha + blink * 0.3 + energy * 0.5));

                    const currentAngle = star.angle + this.starRotation;
                    const x = cx + Math.cos(currentAngle) * star.r * maxDim * 0.8;
                    const y = cy + Math.sin(currentAngle) * star.r * maxDim * 0.8;

                    ctx.fillStyle = `rgba(255,255, 255, ${alpha})`;
                    ctx.beginPath();
                    ctx.arc(x, y, star.size, 0, Math.PI*2);
                    ctx.fill();
                });

                // 4. 绘制轨道 (动态计算缩放以铺满屏幕) - 已隐藏
                // 目标：让最外层行星(冥王星 dist=11.0)贴近屏幕边缘
                // 计算 X 轴和 Y 轴方向的最大允许缩放比例，取较小值以确保完整显示
                const maxDist = 11.0;
                const scaleX = w / 2 / maxDist;
                const scaleY = h / 2 / (maxDist * this.tilt);
                const scale = Math.min(scaleX, scaleY) * 0.95; // 0.95 留一点点边距

                ctx.lineWidth = 1;
                // 注释掉行星轨道绘制 - 隐藏所有轨道
                // this.planets.forEach(p => {
                //     ctx.beginPath();
                //     ctx.ellipse(cx, cy, p.dist * scale, p.dist * scale * this.tilt, 0, 0, Math.PI*2);
                //     ctx.strokeStyle = `rgba(255, 255, 255, ${0.05 + bass * 0.1})`;
                //     ctx.stroke();
                // });

                // 5. 准备渲染列表
                const renderList = [];
                let hoveredItem = null;

                // 太阳 (含光芒喷发系统)
                renderList.push({
                    y: cy,
                    draw: () => {
                        const sunBaseSize = 25; 
                        const sunSize = sunBaseSize + bass * 30;

                        // --- 光芒喷发 ---
                        const sensitivity = this.eruptionConfig.sensitivity;
                        if (energy * sensitivity > 0.05) { 
                            const count = Math.floor(energy * 8 * sensitivity); 
                            let colorBase = '255, 69, 0'; 
                            let type = 'bass';
                            if (treble > mid && treble > bass) { colorBase = '200, 255, 255'; type = 'treble'; } 
                            else if (mid > bass) { colorBase = '255, 215, 0'; type = 'mid'; }

                            for(let k=0; k<count; k++) {
                                const angle = Math.random() * Math.PI * 2;
                                const speedVar = Math.random() * this.eruptionConfig.randomness;
                                this.eruptions.push({
                                    x: cx, y: cy, angle: angle,
                                    r: sunSize * 0.8,
                                    speed: (2 + speedVar * 5 + energy * 10) * this.eruptionConfig.speed,
                                    length: (10 + Math.random() * 20 + energy * 50) * this.eruptionConfig.intensity,
                                    width: (type === 'treble' ? 1 : (type === 'mid' ? 2 : 3)) * (1 + Math.random()),
                                    colorBase: colorBase, alpha: 0.8 + Math.random() * 0.2, decay: 0.02 + Math.random() * 0.05
                                });
                            }
                        }

                        ctx.save();
                        ctx.globalCompositeOperation = 'lighter';
                        for (let i = this.eruptions.length - 1; i >= 0; i--) {
                            const p = this.eruptions[i];
                            p.r += p.speed;
                            p.alpha -= p.decay;
                            if (p.alpha <= 0) { this.eruptions.splice(i, 1); continue; }
                            const sx = cx + Math.cos(p.angle) * p.r;
                            const sy = cy + Math.sin(p.angle) * p.r;
                            const ex = cx + Math.cos(p.angle) * (p.r + p.length);
                            const ey = cy + Math.sin(p.angle) * (p.r + p.length);
                            ctx.strokeStyle = `rgba(${p.colorBase}, ${p.alpha})`;
                            ctx.lineWidth = p.width;
                            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
                        }
                        ctx.restore();
                        
                        // 太阳本体 (明亮橙黄渐变 - 65%透明度)
                        const sunGrad = ctx.createRadialGradient(cx, cy, sunSize*0.2, cx, cy, sunSize);
                        sunGrad.addColorStop(0, 'rgba(255, 215, 0, 0.85)'); // 金黄
                        sunGrad.addColorStop(1, 'rgba(255, 140, 0, 0.65)'); // 深橙
                        
                        ctx.fillStyle = sunGrad;
                        ctx.beginPath();
                        ctx.arc(cx, cy, sunSize, 0, Math.PI*2);
                        ctx.fill();

                        // 交互检测
                        if (input.active && Math.hypot(input.x - cx, input.y - cy) < sunSize + 10) {
                            hoveredItem = { name: 'Sun', info: 'Star Type: G2V', x: cx, y: cy - sunSize - 10 };
                        }
                    }
                });

                // 行星与卫星
                this.planets.forEach((p, i) => {
                    const angle = this.angleOffset * p.speed * this.orbitSpeedScale + i * 137.5; 
                    const x = cx + Math.cos(angle) * p.dist * scale;
                    const y = cy + Math.sin(angle) * p.dist * scale * this.tilt;
                    
                    renderList.push({
                        y: y,
                        draw: () => {
                            const size = Math.max(3, p.r * scale * 0.12);
                            const style = p.style;

                            // 绘制卫星 (先画卫星，如果在行星后面会被行星遮挡? 不，这里作为行星的一部分绘制，顺序可能需要细化，但简化起见一起画)
                            // 简单的卫星轨道绘制
                            if (p.moons && p.moons.length > 0) {
                                p.moons.forEach((m, idx) => {
                                    // 卫星速度更快
                                    const mAngle = this.angleOffset * m.speed * 4 * this.orbitSpeedScale + idx; 
                                    // 卫星轨道半径需适当放大以可见
                                    const mDist = (size + m.dist * scale * 2); 
                                    const mx = x + Math.cos(mAngle) * mDist;
                                    const my = y + Math.sin(mAngle) * mDist * this.tilt; // 卫星也受倾斜影响
                                    // 增大卫星尺寸以提升可见度
                                    const mSize = Math.max(2.0, m.r * scale * 0.15);

                                     // 卫星轨道线 - 已隐藏
                                    // ctx.beginPath();
                                    // ctx.ellipse(x, y, mDist, mDist * this.tilt, 0, 0, Math.PI*2);
                                    // ctx.strokeStyle = 'rgba(255,255,255,0.1)';
                                    // ctx.stroke();

                                    // 卫星本体
                                    ctx.fillStyle = m.color;
                                    ctx.beginPath();
                                    ctx.arc(mx, my, mSize, 0, Math.PI*2);
                                    ctx.fill();

                                    // 卫星交互
                                    if (input.active && Math.hypot(input.x - mx, input.y - my) < mSize + 5) {
                                        hoveredItem = { name: m.name, info: `Moon of ${p.name}`, x: mx, y: my - 10 };
                                    }

                                    // 呼号显示 (卫星)
                                    if (callsign && this.activeTarget && this.activeTarget.type === 'moon' && this.activeTarget.pIdx === i && this.activeTarget.mIdx === idx) {
                                        // 连接线
                                        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(mx, my);
                                        ctx.strokeStyle = theme.primary; ctx.globalAlpha = 0.3; ctx.stroke(); ctx.globalAlpha = 1.0;

                                        // 呼号背景 (圆角矩形)
                                        ctx.save();
                                        ctx.translate(mx, my - mSize * 2.5 - 10);
                                        
                                        const text = callsign;
                                        ctx.font = 'bold 12px "Roboto Mono"';
                                        const textMetrics = ctx.measureText(text);
                                        const bgW = textMetrics.width + 16;
                                        const bgH = 20;
                                        
                                        // 使用卫星颜色作为背景
                                        ctx.fillStyle = m.color; 
                                        ctx.globalAlpha = 0.8;
                                        ctx.shadowBlur = 10;
                                        ctx.shadowColor = m.color;
                                        
                                        ctx.beginPath();
                                        ctx.roundRect(-bgW/2, -bgH/2 - 5, bgW, bgH, 10);
                                        ctx.fill();
                                        
                                        ctx.fillStyle = getTextColor(m.color); // 自适应对比色文字
                                        ctx.textAlign = 'center';
                                        ctx.textBaseline = 'middle';
                                        ctx.shadowBlur = 0; 
                                        ctx.fillText(text, 0, -5);
                                        ctx.restore();
                                    }
                                });
                            }

                            // 绘制行星
                            ctx.save();
                            ctx.beginPath();
                            ctx.arc(x, y, size, 0, Math.PI*2);
                            ctx.clip(); 

                            const grad = ctx.createRadialGradient(x - size*0.3, y - size*0.3, size*0.1, x, y, size);
                            grad.addColorStop(0, style.highlight || style.color1);
                            grad.addColorStop(0.5, style.color1);
                            grad.addColorStop(1, style.color2);
                            ctx.fillStyle = grad;
                            ctx.fill();

                            // 纹理细节
                            if (style.type === 'banded' && style.bands) {
                                ctx.globalCompositeOperation = 'overlay';
                                const bandHeight = size * 2 / style.bands.length;
                                style.bands.forEach((color, idx) => {
                                    ctx.fillStyle = color;
                                    ctx.fillRect(x - size, y - size + idx * bandHeight, size * 2, bandHeight);
                                });
                                ctx.globalCompositeOperation = 'source-over';
                            } else if (style.type === 'earth') {
                                ctx.globalCompositeOperation = 'source-atop';
                                ctx.fillStyle = '#4CAF50'; 
                                ctx.beginPath(); ctx.arc(x - size*0.4, y - size*0.2, size*0.6, 0, Math.PI*2); ctx.fill();
                                ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'; 
                                ctx.beginPath(); ctx.arc(x + size*0.3, y + size*0.3, size*0.7, 0, Math.PI*2); ctx.fill();
                                ctx.globalCompositeOperation = 'source-over';
                            } else if (style.type === 'crater' || style.type === 'rust') {
                                ctx.globalCompositeOperation = 'multiply';
                                ctx.fillStyle = 'rgba(0,0,0,0.1)';
                                for(let k=0; k<3; k++) {
                                    ctx.beginPath(); ctx.arc(x + (Math.random()-0.5)*size, y + (Math.random()-0.5)*size, size*0.2, 0, Math.PI*2); ctx.fill();
                                }
                                ctx.globalCompositeOperation = 'source-over';
                            }

                            // 阴影
                            const shadowGrad = ctx.createRadialGradient(x, y, size * 0.8, x, y, size);
                            shadowGrad.addColorStop(0, 'rgba(0,0,0,0)');
                            shadowGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
                            ctx.fillStyle = shadowGrad;
                            ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI*2); ctx.fill();
                            ctx.restore();
                            
                            // 行星名 (自适应显隐)
                            if (minDim > 320) {
                                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                                const nameSize = Math.max(10, Math.floor(minDim / 60));
                                ctx.font = `${nameSize}px "Roboto Mono"`;
                                ctx.textAlign = 'center';
                                ctx.fillText(p.name, x, y + size + nameSize + 4);
                            }

                            // 行星交互
                            if (input.active && Math.hypot(input.x - x, input.y - y) < size + 5) {
                                hoveredItem = { name: p.name, info: `Dist: ${p.dist} AU`, x: x, y: y - size - 10 };
                            }

                            // 呼号显示 (行星)
                            if (callsign && this.activeTarget && this.activeTarget.type === 'planet' && this.activeTarget.pIdx === i) {
                                // 连接线
                                ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y);
                                ctx.strokeStyle = theme.primary; ctx.globalAlpha = 0.3; ctx.stroke(); ctx.globalAlpha = 1.0;

                                // 呼号背景 (圆角矩形)
                                ctx.save();
                                ctx.translate(x, y - size * 2.5);
                                
                                const text = callsign;
                                ctx.font = 'bold 14px "Roboto Mono"';
                                const textMetrics = ctx.measureText(text);
                                const bgW = textMetrics.width + 20;
                                const bgH = 24;
                                
                                // 使用行星主色作为背景，半透明
                                ctx.fillStyle = style.color1; 
                                ctx.globalAlpha = 0.8;
                                ctx.shadowBlur = 10;
                                ctx.shadowColor = style.color1;
                                
                                // 绘制圆角矩形
                                ctx.beginPath();
                                ctx.roundRect(-bgW/2, -bgH/2 - 5, bgW, bgH, 12);
                                ctx.fill();
                                
                                ctx.fillStyle = getTextColor(style.color1); // 自适应对比色文字
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'middle';
                                ctx.shadowBlur = 0; // 文字不加阴影以保持清晰
                                ctx.fillText(text, 0, -5);
                                ctx.restore();
                            }
                        }
                    });
                });

                // 排序并绘制
                renderList.sort((a, b) => a.y - b.y);
                renderList.forEach(item => item.draw());

                // 6. 右上角行星云 (不变)
                this.cloudAngle += 0.001;
                const cloudCx = w - 60; const cloudCy = 60;
                ctx.save(); ctx.translate(cloudCx, cloudCy); ctx.rotate(this.cloudAngle);
                this.cloudParticles.forEach(p => {
                    ctx.fillStyle = p.color; ctx.globalAlpha = p.alpha;
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
                });
                ctx.restore(); ctx.globalAlpha = 1.0;

                // 7. 时钟 (自适应)
                if (minDim > 280) { // 时钟保留优先级稍高
                    const now = new Date();
                    const offset = 8;
                    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
                    const bjTime = new Date(utc + (3600000 * offset));
                    const pad = (n) => n.toString().padStart(2, '0');
                    const fullTimeStr = `${bjTime.getFullYear()}-${pad(bjTime.getMonth()+1)}-${pad(bjTime.getDate())} ${pad(bjTime.getHours())}:${pad(bjTime.getMinutes())}:${pad(bjTime.getSeconds())}`;
                    
                    const timeSize = Math.max(14, Math.floor(minDim / 40));

                    ctx.save();
                    ctx.fillStyle = theme.primary || '#00f3ff'; ctx.shadowColor = theme.primary || '#00f3ff'; ctx.shadowBlur = 10;
                    ctx.font = `bold ${timeSize}px "Courier New", monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
                    ctx.fillText(fullTimeStr, cx, 30);
                    ctx.restore();
                }

                // 8. 图例 (自适应)
                if (minDim > 350) { // 图例需要更多空间，阈值稍高
                    const legendY = h - 60; // 移到60px上方，留出空间给UI元素
                    const legendItems = [
                        { color: '#FFD700', label: 'Sun' },
                        { color: '#A9A9A9', label: 'Rocky' },
                        { color: '#FFA500', label: 'Gas Giant' },
                        { color: '#00FFFF', label: 'Ice Giant' },
                        { color: '#A0522D', label: 'Dwarf' },
                        { color: '#D3D3D3', label: 'Moon' }
                    ];
                    
                    const legendSize = Math.max(10, Math.floor(minDim / 70));

                    ctx.save();
                    ctx.font = `${legendSize}px "Roboto Mono"`;
                    ctx.textBaseline = 'middle';
                
                // Calculate total width for centering
                let totalWidth = 0;
                const itemGap = 20;
                const itemsWithWidth = legendItems.map(item => {
                    const w = ctx.measureText(item.label).width + 15; // 8px circle + 7px gap
                    totalWidth += w;
                    return { ...item, w };
                });
                totalWidth += (legendItems.length - 1) * itemGap;
                
                let currentX = cx - totalWidth / 2;
                
                itemsWithWidth.forEach((item, idx) => {
                    // Color dot
                    ctx.fillStyle = item.color;
                    ctx.beginPath();
                    ctx.arc(currentX + 4, legendY, 4, 0, Math.PI*2);
                    ctx.fill();
                    
                    // Text
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                    ctx.textAlign = 'left';
                    ctx.fillText(item.label, currentX + 12, legendY);
                    
                    currentX += item.w + itemGap;
                });
                ctx.restore();
                }

                // 9. 悬停提示
                if (hoveredItem) {
                    ctx.save();
                    ctx.translate(hoveredItem.x, hoveredItem.y);
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                    ctx.strokeStyle = theme.primary;
                    ctx.lineWidth = 1;
                    const infoW = ctx.measureText(hoveredItem.info).width + 20;
                    ctx.beginPath();
                    ctx.roundRect(-infoW/2, -40, infoW, 35, 5);
                    ctx.fill();
                    ctx.stroke();
                    
                    ctx.fillStyle = theme.primary;
                    ctx.font = 'bold 12px "Roboto Mono"';
                    ctx.textAlign = 'center';
                    ctx.fillText(hoveredItem.name, 0, -25);
                    ctx.fillStyle = '#ccc';
                    ctx.font = '10px "Roboto Mono"';
                    ctx.fillText(hoveredItem.info, 0, -12);
                    ctx.restore();
                }
            }

            // 更新中继台列表
            updateRepeaterStations(stations) {
                this.repeaterStations = stations.filter(s => s.name && s.name.length > 0);
            }
        }

        /** 可视化引擎 (重构版) */
        class Visualizer {
            constructor(canvas, analyser) {
                this.canvas = canvas;
                this.ctx = canvas.getContext('2d');
                this.analyser = analyser;
                this.freqData = null;
                this.mode = 0; 
                this.modes = ['SOLAR', 'SPECTRUM', 'MIRROR', 'WAVEFORM', 'OSCILLOSCOPE', 'RADIAL', 'PARTICLES'];
                this.running = false;
                this.currentCallsign = '';
                this.callsignState = { text: '', opacity: 0, targetOpacity: 0 };
                this.lastLoopTime = 0;
                
                this.colorTheme = '#00f3ff';
                this.colorSecondary = '#ff00ff';
                this.updateThemeColors();

                this.renderers = [
                    new SolarSystemRenderer(this.ctx),
                    new SpectrumRenderer(this.ctx),
                    new MirrorRenderer(this.ctx),
                    new WaveformRenderer(this.ctx),
                    new OscilloscopeRenderer(this.ctx),
                    new RadialRenderer(this.ctx),
                    new ParticlesRenderer(this.ctx)
                ];

                this.resize();
                
                // 交互状态追踪
                this.inputState = { x: 0, y: 0, active: false };
                
                // 监听鼠标/触摸移动
                const updateInput = (x, y) => {
                    const rect = this.canvas.getBoundingClientRect();
                    this.inputState.x = (x - rect.left) * window.devicePixelRatio;
                    this.inputState.y = (y - rect.top) * window.devicePixelRatio;
                    this.inputState.active = true;
                };

                this.canvas.addEventListener('mousemove', e => updateInput(e.clientX, e.clientY));
                this.canvas.addEventListener('touchmove', e => {
                    if(e.touches.length > 0) updateInput(e.touches[0].clientX, e.touches[0].clientY);
                }, {passive: true});
                
                this.canvas.addEventListener('mouseleave', () => { this.inputState.active = false; });
                this.canvas.addEventListener('touchend', () => { this.inputState.active = false; });

                this.resizeObserver = new ResizeObserver(() => this.resize());
                this.resizeObserver.observe(this.canvas);
            }

            updateThemeColors() {
                const styles = getComputedStyle(document.body);
                this.colorTheme = styles.getPropertyValue('--accent-cyan').trim() || '#00f3ff';
                this.colorSecondary = styles.getPropertyValue('--accent-magenta').trim() || '#ff00ff';
            }

            resize() {
                this.canvas.width = this.canvas.clientWidth * window.devicePixelRatio;
                this.canvas.height = this.canvas.clientHeight * window.devicePixelRatio;
                this.renderers.forEach(r => r.resize(this.canvas.width, this.canvas.height));
            }

            setAnalyser(analyser) { this.analyser = analyser; this.freqData = null; }

            setCallsign(callsign) { 
                if (callsign) {
                    this.callsignState.text = callsign;
                    this.callsignState.targetOpacity = 1;
                    this.currentCallsign = callsign;
                } else {
                    this.callsignState.targetOpacity = 0;
                }
            }

            switchMode() {
                this.mode = (this.mode + 1) % this.modes.length;
                return this.modes[this.mode];
            }

            start() {
                if (this.running) return;
                this.running = true;
                this.loop();
            }

            loop() {
                if (!this.running) return;
                requestAnimationFrame(() => this.loop());
                
                const now = Date.now();
                const dt = (now - (this.lastLoopTime || now)) / 1000;
                this.lastLoopTime = now;
                
                const fadeSpeed = 3.0;
                if (this.callsignState.opacity < this.callsignState.targetOpacity) {
                    this.callsignState.opacity = Math.min(1, this.callsignState.opacity + fadeSpeed * dt);
                } else if (this.callsignState.opacity > this.callsignState.targetOpacity) {
                    this.callsignState.opacity = Math.max(0, this.callsignState.opacity - fadeSpeed * dt);
                }
                
                if (this.callsignState.opacity <= 0 && this.callsignState.targetOpacity === 0) {
                    this.callsignState.text = '';
                    this.currentCallsign = '';
                }

                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

                // Use dummy analyser if real one is missing, to ensure rendering (especially callsigns) continues
                let effectiveAnalyser = this.analyser;
                if (!effectiveAnalyser) {
                    effectiveAnalyser = {
                        frequencyBinCount: 128,
                        getByteFrequencyData: (arr) => arr.fill(0),
                        getByteTimeDomainData: (arr) => arr.fill(128),
                        fftSize: 256
                    };
                }

                const bufferLength = effectiveAnalyser.frequencyBinCount;
                const dataArray = (this.freqData && this.freqData.length === bufferLength)
                    ? this.freqData
                    : (this.freqData = new Uint8Array(bufferLength));

                // Note: Renderers usually call getByteFrequencyData themselves, so we pass effectiveAnalyser
                this.renderers[this.mode].draw(effectiveAnalyser, dataArray, bufferLength, {
                    primary: this.colorTheme,
                    secondary: this.colorSecondary
                }, { 
                    callsign: this.callsignState.text,
                    opacity: this.callsignState.opacity,
                    input: this.inputState
                });
            }

            getAudioEnergy() {
                if (!this.analyser) return 0;
                const bufferLength = this.analyser.frequencyBinCount;
                if (!this.freqData || this.freqData.length !== bufferLength) {
                    this.freqData = new Uint8Array(bufferLength);
                }
                this.analyser.getByteFrequencyData(this.freqData);
                let sum = 0;
                const count = Math.floor(bufferLength / 2);
                for(let i = 0; i < count; i++) sum += this.freqData[i];
                return (sum / count) / 255.0;
            }

            destroy() {
                this.running = false;
                if (this.resizeObserver) {
                    this.resizeObserver.disconnect();
                    this.resizeObserver = null;
                }
                // 清理渲染器
                this.renderers = null;
                // 清理引用
                this.canvas = null;
                this.ctx = null;
                this.analyser = null;
                this.freqData = null;
            }
        }

        /** 呼号队列显示管理器 (新增) */
        class CallsignTicker {
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
                // console.log(`Ticker capacity updated: ${this.maxItems} (h=${containerHeight})`);
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
                // 样式移至CSS类中处理

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
                        if (removed.parentNode === this.container) {
                            this.container.removeChild(removed);
                        }
                    }, 400); // 配合 transition 时间
                }
            }

            animateLoop() {
                requestAnimationFrame(() => this.animateLoop());
                
                if (this.visualizer && this.items.length > 0) {
                    // 获取当前能量值 (0.0 - 1.0)
                    let energy = 0;
                    if (this.visualizer.getAudioEnergy) {
                        energy = this.visualizer.getAudioEnergy();
                    }
                    
                    // 平滑处理 (简单的低通滤波)
                    if (this.lastEnergy === undefined) this.lastEnergy = 0;
                    this.lastEnergy += (energy - this.lastEnergy) * 0.2;
                    
                    // 更新所有呼号的 CSS 变量
                    const level = this.lastEnergy.toFixed(3);
                    
                    this.items.forEach(el => {
                        el.style.setProperty('--level', level);
                    });
                }
            }
        }

        /** 发现管理器 (mDNS) */
        class DiscoveryManager extends EventEmitter {
            constructor() {
                super();
                this.services = new Map();
                this.isScanning = false;
                this.serviceType = '_http._tcp.local.'; 
                this.listEl = document.getElementById('discovered-list');
                
                // 监听 deviceready 事件自动开始扫描
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
                                    // 1. 如果是 Android 13+ 且用户授权，扫描正常工作
                                    // 2. 如果是旧版本 Android，该权限可能不适用，直接扫描
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
                if (this.services.size === 0) {
                    this.listEl.style.display = 'none';
                    return;
                }
                
                this.listEl.style.display = 'flex';
                this.listEl.innerHTML = '';
                
                // 添加标题
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

        /** 设备历史管理 */
        class DeviceManager {
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
                
                const currentIp = document.getElementById('inp-host').value;

                this.devices.forEach(ip => {
                    const tag = document.createElement('div');
                    tag.className = 'device-tag';
                    if (currentIp === ip) tag.classList.add('active');
                    
                    tag.innerHTML = `
                        ${ip}
                        <span class="device-del" title="删除">✕</span>
                    `;
                    
                    tag.onclick = () => {
                        document.getElementById('inp-host').value = ip;
                        this.render(); // 更新高亮
                        // 触发连接
                        document.getElementById('btn-connect').click();
                    };
                    
                    const delBtn = tag.querySelector('.device-del');
                    delBtn.onclick = (e) => this.remove(ip, e);
                    
                    container.appendChild(tag);
                });
            }
        }

        /** QSO 日志管理器 */
        class QsoManager {
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
                this.btnClose.addEventListener('click', () => {
                    this.hide();
                });
                
                // Close on backdrop click
                this.modal.addEventListener('click', (e) => {
                    if (e.target === this.modal) this.hide();
                });
                
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
                this.modal.classList.add('show');
                this.fetchData(true);
            }

            hide() {
                this.modal.classList.remove('show');
                this.restoreBadge();
            }

            fetchData(showLoading = false) {
                if (showLoading) {
                    this.listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">Loading...</div>';
                }
                this.client.getQsoList(this.page, this.pageSize);
            }

            locateGrid(grid) {
                if (this.mapFrame && this.mapFrame.contentWindow) {
                    console.log('Locating grid:', grid);

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
                    console.log('Displaying all QSOs on map:', grids);
                    this.mapFrame.contentWindow.postMessage({
                        type: 'DISPLAY_ALL_QSOS',
                        grids: grids
                    }, '*');
                }
            }

            highlightQsoOnMap(grid, callsign) {
                if (this.mapFrame && this.mapFrame.contentWindow) {
                    console.log('Highlighting QSO on map:', grid, callsign);
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

        /** 事件订阅客户端 (EventsService) */
        class EventsClient {
            constructor() {
                this.ws = null;
                this.host = '';
                this.connected = false;
                this.reconnectTimer = null;
                this.retryMs = 1000;
                this.listeners = new Set();
                this.speakingTimeout = null;
            }

            connect(host) {
                this.host = host;
                if (this.ws) return;

                try {
                    this.ws = new WebSocket(`${(window.location && window.location.protocol === 'https:' ? 'wss' : 'ws')}://${host}/events`);
                    
                    this.ws.onopen = () => {
                        this.connected = true;
                        this.retryMs = 1000;
                        console.log('Events connected');
                    };

                    this.ws.onmessage = (e) => {
                        try {
                            const msg = JSON.parse(e.data);
                            this.handleMessage(msg);
                        } catch (err) {
                            console.error('Events parse error:', err);
                        }
                    };

                    this.ws.onclose = () => {
                        this.connected = false;
                        this.ws = null;
                        this.scheduleReconnect();
                    };

                    this.ws.onerror = () => {
                        this.ws = null; // Let onclose handle it
                    };

                } catch (e) {
                    console.error('Events connect failed:', e);
                    this.scheduleReconnect();
                }
            }

            disconnect() {
                if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
                if (this.ws) {
                    this.ws.onclose = null; // Prevent reconnect
                    this.ws.close();
                    this.ws = null;
                }
                this.connected = false;
            }

            scheduleReconnect() {
                if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
                this.reconnectTimer = setTimeout(() => {
                    this.retryMs = 1000; // 保持 1秒 重试，不增加时间
                    this.connect(this.host);
                }, this.retryMs);
            }

            handleMessage(msg) {
                // console.log('Event received:', msg); // Debug log
                // 处理 QSO 发言人事件
                if (msg.type === 'qso' && msg.subType === 'callsign' && msg.data) {
                    console.log('Callsign event:', msg.data);
                    const { callsign, isSpeaking, isHost } = msg.data;
                    // 只处理开始发言事件，或者根据需要处理
                    // 这里假设每次 isSpeaking=true 都是一次新的发言或持续发言
                    // 为了避免重复，我们可以简单去重，或者每次都添加（作为新的事件）
                    // 用户需求是“接收到一个新的呼号时，触发显示更新”，通常意味着新的发言开始
                    
                    if (isSpeaking) {
                        // 简单的去重逻辑：如果最后一个呼号相同且时间很近，则不添加？
                        // 暂时直接添加，让Ticker处理队列
                        if (this.onCallsign) this.onCallsign(callsign);
                        if (this.onSpeakingState) this.onSpeakingState(callsign, true, isHost);
                    } else {
                        if (this.onSpeakingState) this.onSpeakingState(callsign, false, isHost);
                    }
                }
            }

            // 注册回调
            onCallsignReceived(callback) {
                this.onCallsign = callback;
            }

            onSpeakingStateChanged(callback) {
                this.onSpeakingState = callback;
            }
        }

        // --- 应用逻辑 ---
        const ctrl = new ControlClient();
        const player = new AudioPlayer();
        const events = new EventsClient(); // 实例化
        const viz = new Visualizer(document.getElementById('viz-canvas'), null);
        const qsoMgr = new QsoManager(ctrl); // 初始化 QSO 管理器 (供 Ticker 使用)

        // 实例化呼号显示组件
        const ticker = new CallsignTicker('callsign-ticker', viz, qsoMgr);
        // Expose to window for Python injection
        window.ticker = ticker;

        // 连接事件
        events.onCallsignReceived((callsign) => {
            ticker.addCallsign(callsign);
        });

        events.onSpeakingStateChanged((callsign, isSpeaking, isHost) => {
            if (isSpeaking) {
                viz.setCallsign(callsign);
                player.setLocalTransmission(isHost);
            } else {
                player.setLocalTransmission(false);
                // 如果当前显示的正是停止说话的人，则清除
                if (viz.currentCallsign === callsign) {
                    viz.setCallsign('');
                }
            }
        });

        const deviceMgr = new DeviceManager();
        const discoveryMgr = new DiscoveryManager();
        // qsoMgr 已提前初始化
        
        const ui = {
            ledWs: document.getElementById('led-ws'),
            ledAudio: document.getElementById('led-audio'),
            btnTheme: document.getElementById('btn-theme'),
            btnSettingsToggle: document.getElementById('btn-settings-toggle'),
            settingsArea: document.getElementById('settings-area'),
            btnPlay: document.getElementById('btn-play'),
            btnRecord: document.getElementById('btn-record'),
            vizArea: document.getElementById('viz-area'),
            vizModeText: document.getElementById('viz-mode-text'),
            currentStationText: document.getElementById('current-station-text'),
            stCount: document.getElementById('st-count'),
            stList: document.getElementById('st-list'),
            btnPrev: document.getElementById('btn-prev'),
            btnNext: document.getElementById('btn-next'),
            inpHost: document.getElementById('inp-host'),
            btnConnect: document.getElementById('btn-connect'),
            btnOpenStations: document.getElementById('btn-open-stations'),
            stationModal: document.getElementById('station-modal'),
            stCountModal: document.getElementById('st-count-modal'),
        };

        let currentStationId = null;

        // 设备检测与适配
        const checkDevice = () => {
            // 简单判断：屏幕宽度大于 768px 视为桌面端/平板
            if (window.innerWidth >= 768) {
                document.documentElement.classList.add('device-desktop');
            } else {
                document.documentElement.classList.remove('device-desktop');
            }
        };
        // 初始化检测
        checkDevice();
        // 监听窗口大小变化 - 使用防抖优化性能
        window.addEventListener('resize', Utils.debounce(checkDevice, 200));

        // 0. 主题切换
        // 扩展主题列表：包含新增的4款主题
        const themes = ['', 'matrix', 'ocean', 'sunset', 'light', 'pink', 'purple', 'red', 'black'];
        let currentThemeIndex = 0;

        // 初始化主题 - 从localStorage加载
        const savedTheme = localStorage.getItem('fmo_theme');
        if (savedTheme !== null && themes.includes(savedTheme)) {
            currentThemeIndex = themes.indexOf(savedTheme);
            if (savedTheme) {
                document.body.dataset.theme = savedTheme;
            } else {
                document.body.removeAttribute('data-theme');
            }
        }

        ui.btnTheme.addEventListener('click', () => {
            const currentTheme = themes[currentThemeIndex];
            if (currentTheme) {
                document.body.removeAttribute('data-theme');
            }
            currentThemeIndex = (currentThemeIndex + 1) % themes.length;
            const newTheme = themes[currentThemeIndex];
            if (newTheme) {
                document.body.dataset.theme = newTheme;
            } else {
                document.body.removeAttribute('data-theme');
            }
            // 保存主题设置
            localStorage.setItem('fmo_theme', newTheme);
            // Update visualizer colors
            viz.updateThemeColors();
        });

        // 0.1 设置开关
        ui.btnSettingsToggle.addEventListener('click', () => {
            ui.settingsArea.classList.toggle('open');
        });



        // 1. 连接逻辑
        ui.btnConnect.addEventListener('click', () => {
            const host = ui.inpHost.value.trim();
            if (!host) return;
            ctrl.connect(host);
            player.connect(host);
            events.connect(host);
            viz.start();
            deviceMgr.add(host);
        });

        ctrl.on('status', (connected) => {
            ui.ledWs.className = `status-dot ${connected ? 'connected' : 'error'}`;
            if (connected) {
                ui.btnConnect.textContent = '已连接';
                ui.btnConnect.style.color = 'var(--accent-green)';
            } else {
                ui.btnConnect.textContent = 'CONNECT';
                ui.btnConnect.style.color = 'var(--accent-cyan)';
            }
        });

        player.on('status', (connected) => {
            ui.ledAudio.className = `status-dot ${connected ? 'connected' : 'error'}`;
            // 音频连接后，将分析节点交给可视化引擎
            if (connected && player.analyser) {
                viz.setAnalyser(player.analyser);
            }
        });

        // 2. 播放控制
        ui.btnPlay.addEventListener('click', () => {
            const host = ui.inpHost.value.trim();
            if (!player.connected) {
                player.connect(host);
            } else {
                // 仅作为重连或断开开关
                player.disconnect();
            }
        });
        
        // 监听音频连接状态改变按钮样式
        player.on('status', (connected) => {
            if (connected) {
                ui.btnPlay.classList.add('active');
                ui.btnPlay.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
            } else {
                ui.btnPlay.classList.remove('active');
                ui.btnPlay.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
            }
        });

        // 音量条初始化
        const volContainer = document.getElementById('vol-container');
        const volSlider = new VolumeSlider(volContainer, player);

        // 3. 可视化切换
        // 改为仅点击文字切换，避免误触
        ui.vizModeText.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止冒泡
            const modeName = viz.switchMode();
            ui.vizModeText.textContent = modeName;
        });

        // 最大化按钮逻辑
        const btnMaximize = document.getElementById('btn-maximize');
        if (btnMaximize) {
            btnMaximize.addEventListener('click', () => {
                const elem = document.documentElement;
                if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
                    if (elem.requestFullscreen) {
                        elem.requestFullscreen();
                    } else if (elem.webkitRequestFullscreen) { /* Safari */
                        elem.webkitRequestFullscreen();
                    } else if (elem.msRequestFullscreen) { /* IE11 */
                        elem.msRequestFullscreen();
                    }
                } else {
                    if (document.exitFullscreen) {
                        document.exitFullscreen();
                    } else if (document.webkitExitFullscreen) { /* Safari */
                        document.webkitExitFullscreen();
                    } else if (document.msExitFullscreen) { /* IE11 */
                        document.msExitFullscreen();
                    }
                }
            });
        }

        // 5. 录音控制：开始/停止录音，导出为 WAV
        ui.btnRecord.addEventListener('click', () => {
            if (!player.recording) {
                // 开始录音（需要音频已连接）
                if (!player.connected) {
                    console.log('Alert suppressed:', '请先连接音频！');
                    return;
                }
                player.startRecording();
                ui.btnRecord.classList.add('recording');
            } else {
                // 停止录音并下载（文件名带时间戳）
                ui.btnRecord.classList.remove('recording');
                const blob = player.stopRecording();
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    // 文件名：fmo_rec_时间戳.wav
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    a.download = `fmo_rec_${timestamp}.wav`;
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);
                    }, 100);
                } else {
                    console.log('Alert suppressed:', '录音时长太短或无数据');
                }
            }
        });

         // 4. 台站列表逻辑 - 性能优化版本
          ctrl.on('stationList', (list) => {
              ui.stCount.textContent = list.length;

             // 将台站列表传递给太阳系可视化器的中继台系统
             if (viz && viz.renderers && viz.renderers[0]) {
                 const solarRenderer = viz.renderers[0]; // SolarSystemRenderer是第一个
                 if (solarRenderer && solarRenderer.updateRepeaterStations) {
                     solarRenderer.updateRepeaterStations(list);
                 }
             }
             if (ui.stCountModal) {
                 ui.stCountModal.textContent = list.length;
             }

             // 使用requestAnimationFrame进行批量DOM更新
             requestAnimationFrame(() => {
                 ui.stList.innerHTML = '';

                 if (list.length === 0) {
                     const emptyMsg = document.createElement('div');
                     emptyMsg.className = 'station-item';
                     emptyMsg.style.gridColumn = '1 / -1';
                     emptyMsg.style.justifyContent = 'center';
                     emptyMsg.style.alignItems = 'center';
                     emptyMsg.style.color = '#666';
                     emptyMsg.textContent = '暂无台站';
                     ui.stList.appendChild(emptyMsg);
                     return;
                 }

                 // 性能优化：限制初始渲染数量（最多50个）
                 const RENDER_LIMIT = 50;
                 const renderList = list.slice(0, RENDER_LIMIT);

                 // 使用DocumentFragment进行批量插入
                 const fragment = document.createDocumentFragment();

                 renderList.forEach(st => {
                     const el = document.createElement('div');
                     el.className = 'station-item';
                     el.dataset.uid = st.uid;
                     if (st.uid == currentStationId) el.classList.add('active');

                     // Security Fix: Use textContent instead of innerHTML to prevent XSS
                     const nameEl = document.createElement('div');
                     nameEl.className = 'st-name';
                     nameEl.textContent = st.name || 'Station ' + st.uid;
                     el.appendChild(nameEl);

                     // 优化点击处理 - 使用事件委托
                     el.addEventListener('click', () => {
                         ctrl.setStation(st.uid);
                         // 乐观更新 UI
                         const allItems = ui.stList.querySelectorAll('.station-item');
                         for (let i = 0; i < allItems.length; i++) {
                             allItems[i].classList.remove('active');
                         }
                         el.classList.add('active');
                         currentStationId = st.uid;

                         // Update viz text immediately
                         if (ui.currentStationText) {
                             ui.currentStationText.textContent = st.name || 'Station ' + st.uid;
                             ui.currentStationText.style.display = 'block';
                         }

                         // 关闭弹出框（在 modal 中点击时）
                         if (ui.stationModal && ui.stationModal.classList.contains('show')) {
                             ui.stationModal.classList.remove('show');
                         }
                     });
                     fragment.appendChild(el);
                 });
                 ui.stList.appendChild(fragment);

                 // 如果有更多台站，显示加载更多提示（可选扩展）
                 if (list.length > RENDER_LIMIT) {
                     const loadMore = document.createElement('div');
                     loadMore.className = 'station-item';
                     loadMore.style.gridColumn = '1 / -1';
                     loadMore.style.justifyContent = 'center';
                     loadMore.style.alignItems = 'center';
                     loadMore.style.color = 'var(--text-muted)';
                     loadMore.style.fontSize = '0.8rem';
                     loadMore.textContent = `已显示 ${RENDER_LIMIT} / ${list.length} 个台站`;
                     ui.stList.appendChild(loadMore);
                 }
             });
         });

        ctrl.on('stationCurrent', (data) => {
            currentStationId = data.uid;

            // Update current station text in viz area
            if (ui.currentStationText) {
                if (data && data.name) {
                    ui.currentStationText.textContent = data.name;
                    ui.currentStationText.style.display = 'block';
                } else {
                    ui.currentStationText.style.display = 'none';
                }
            }

            // 高亮当前 - 使用局部查询优化性能
            if (ui.stList) {
                const items = ui.stList.querySelectorAll('.station-item');
                items.forEach(el => {
                    if (el.dataset.uid == currentStationId) el.classList.add('active');
                    else el.classList.remove('active');
                });
            }
        });

        ui.btnPrev.addEventListener('click', () => ctrl.prevStation());
        ui.btnNext.addEventListener('click', () => ctrl.nextStation());

        // 6. 台站弹出框逻辑
        if (ui.btnOpenStations && ui.stationModal) {
            // 打开弹出框
            ui.btnOpenStations.addEventListener('click', () => {
                ui.stationModal.classList.add('show');
            });

            // 点击遮罩层关闭弹出框
            ui.stationModal.addEventListener('click', (e) => {
                if (e.target === ui.stationModal) {
                    ui.stationModal.classList.remove('show');
                }
            });

            // 点击标题栏关闭弹出框
            const modalHeader = ui.stationModal.querySelector('.station-modal-header');
            modalHeader.addEventListener('click', (e) => {
                ui.stationModal.classList.remove('show');
            });
        }

        // 7. 全局点击唤醒音频上下文（解决自动连接时的 AudioContext 策略限制）
        const unlockAudio = () => {
            if (player) player.unlock();
        };
        document.addEventListener('click', unlockAudio);
        document.addEventListener('touchstart', unlockAudio);
        document.addEventListener('keydown', unlockAudio);

        // 6. 启动
        // 初始化设备历史列表
        deviceMgr.render();

        /* Auto-connect disabled by build */ 
/* // 自动连接
        setTimeout(() => {
            const lastHost = deviceMgr.devices.length > 0 ? deviceMgr.devices[0] : 'fmo.local';
            if (ui.inpHost) {
                ui.inpHost.value = lastHost;
                // 触发连接按钮点击事件以复用连接逻辑
                if (ui.btnConnect) {
                    ui.btnConnect.click();
                }
            }
        }, 1000); */

        // 6.5 Debug Info Logic
        const btnShowDebug = document.getElementById('btn-show-debug');
        const debugContainer = document.getElementById('debug-container');
        const debugContent = document.getElementById('debug-content');
        const btnCopyDebug = document.getElementById('btn-copy-debug');

        // Periodic Status Logger (10s)
        setInterval(() => {
            try {
                const status = [
                    `Ctrl:${ctrl.connected?'ON':'OFF'}`,
                    `Audio:${player.connected?'ON':'OFF'}`,
                    `WS:${events.connected?'ON':'OFF'}`,
                    `St:${currentStationId||'-'}`,
                    `Viz:${viz.modes[viz.mode]}`
                ].join('|');
                console.log('[STATUS] ' + status);
            } catch(e) {}
        }, 10000);

        if (btnShowDebug && debugContainer && debugContent) {
            btnShowDebug.addEventListener('click', () => {
                if (debugContainer.style.display === 'none') {
                    // Gather Info
                    const info = {
                        fmo: {
                            control: {
                                connected: ctrl.connected,
                                host: ctrl.host,
                                stationCount: ctrl.stationList.length,
                                currentStationId: currentStationId
                            },
                            audio: {
                                connected: player.connected,
                                state: player.audioCtx ? player.audioCtx.state : 'no-ctx',
                                recording: player.recording,
                                sampleRate: player.audioCtx ? player.audioCtx.sampleRate : 0
                            },
                            events: {
                                connected: events.connected
                            },
                            visualizer: {
                                mode: viz.modes[viz.mode],
                                running: viz.running,
                                resolution: `${viz.canvas.width}x${viz.canvas.height}`
                            },
                            device: {
                                isDesktop: document.documentElement.classList.contains('device-desktop'),
                                historyCount: deviceMgr.devices.length
                            },
                            version: document.getElementById('credits-version')?.dataset?.version || 'unknown'
                        },
                        browser: {
                            userAgent: navigator.userAgent,
                            platform: navigator.platform,
                            screen: `${window.innerWidth}x${window.innerHeight} (dpr:${window.devicePixelRatio})`,
                            location: window.location.href,
                            secure: window.isSecureContext,
                            webSocket: 'WebSocket' in window,
                            webAudio: 'AudioContext' in window || 'webkitAudioContext' in window,
                            cordova: !!window.cordova
                        }
                    };

                    const logs = window.__DEBUG_LOGS__ ? window.__DEBUG_LOGS__.join('\n') : 'No logs captured';
                    
                    const report = `=== FMO SYSTEM INFO ===\n${JSON.stringify(info.fmo, null, 2)}\n\n=== BROWSER RUNTIME INFO ===\n${JSON.stringify(info.browser, null, 2)}\n\n=== RECENT LOGS (Last 100) ===\n${logs}`;
                    
                    debugContent.textContent = report;
                    debugContainer.style.display = 'block';
                    btnShowDebug.textContent = 'Hide Debug Info';
                } else {
                    debugContainer.style.display = 'none';
                    btnShowDebug.textContent = 'Show Debug Info';
                }
            });

            if (btnCopyDebug) {
                btnCopyDebug.addEventListener('click', () => {
                    if (navigator.clipboard) {
                        navigator.clipboard.writeText(debugContent.textContent)
                            .then(() => {
                                const originalText = btnCopyDebug.textContent;
                                btnCopyDebug.textContent = 'Copied!';
                                setTimeout(() => btnCopyDebug.textContent = originalText, 2000);
                            })
                            .catch(err => console.log('Alert suppressed:', 'Copy failed: ' + err));
                    } else {
                        // Fallback for older WebViews
                        const range = document.createRange();
                        range.selectNode(debugContent);
                        window.getSelection().removeAllRanges();
                        window.getSelection().addRange(range);
                        document.execCommand('copy');
                        window.getSelection().removeAllRanges();
                        console.log('Alert suppressed:', 'Copied to clipboard');
                    }
                });
            }
        }

        // 7. 彩蛋逻辑
        let eggClicks = 0;
        let eggTimer = null;
        const statusIndicators = document.querySelector('.status-indicators');
        const creditsModal = document.getElementById('credits-modal');
        const btnCreditsClose = document.getElementById('btn-credits-close');

        if (statusIndicators && creditsModal && btnCreditsClose) {
            statusIndicators.addEventListener('click', (e) => {
                if (eggClicks === 0) {
                    // 第一次点击，启动计时器
                    eggTimer = setTimeout(() => {
                        eggClicks = 0;
                        // console.log('Easter egg reset');
                    }, 10000); // 10秒内
                }

                eggClicks++;

                if (eggClicks >= 10) {
                    // 触发彩蛋
                    if (eggTimer) clearTimeout(eggTimer);
                    eggClicks = 0;
                    creditsModal.classList.add('show');
                }
            });

            btnCreditsClose.addEventListener('click', () => {
                creditsModal.classList.remove('show');
            });

            // 点击遮罩关闭
            creditsModal.addEventListener('click', (e) => {
                if (e.target === creditsModal) {
                    creditsModal.classList.remove('show');
                }
            });
        }

        // 8. 资源清理 - 页面关闭时清理所有资源
        const cleanupResources = () => {
            // 清理WebSocket连接
            if (ctrl) ctrl.disconnect();
            if (player) player.disconnect();
            if (events) events.disconnect();

            // 清理可视化器
            if (viz) viz.destroy();

            // 清理音量滑块
            if (volSlider) volSlider.destroy();

            // 清理定时器
            if (eggTimer) clearTimeout(eggTimer);

            // 清理事件监听器
            if (window.addEventListener) {
                window.removeEventListener('resize', checkDevice);
                window.removeEventListener('click', unlockAudio);
                window.removeEventListener('touchstart', unlockAudio);
                window.removeEventListener('keydown', unlockAudio);
            }

            console.log('[Cleanup] All resources cleaned up');
        };

        // 监听页面卸载事件
        window.addEventListener('beforeunload', cleanupResources);
        window.addEventListener('unload', cleanupResources);

        // 暴露清理函数到全局（供调试使用）
        window.cleanupResources = cleanupResources;
// --- INJECTED DEBUG CONSOLE START ---
(function() {
    console.log("Initializing Debug Console...");
    
    // --- WebSocket Hook START ---
    if (window.WebSocket) {
        const OriginalWebSocket = window.WebSocket;
        window.WebSocket = function(url, protocols) {
            console.log('🔌 [WS-HOOK] Connecting to:', url);
            
            // Check for common errors in URL
            if (url.includes('undefined')) console.error('❌ [WS-HOOK] URL contains undefined!');
            if (!url.match(/:d+/)) console.warn('⚠️ [WS-HOOK] No port specified in URL! Default is 80/443.');
            
            try {
                const ws = new OriginalWebSocket(url, protocols);
                
                ws.addEventListener('open', () => {
                    console.log('✅ [WS-HOOK] Connected to:', url);
                });
                
                ws.addEventListener('error', (e) => {
                    console.error('❌ [WS-HOOK] Error for:', url, e);
                    // Try to inspect properties (usually empty in secure context)
                    try {
                        console.error('   Details:', JSON.stringify(e));
                    } catch(err) {}
                });
                
                ws.addEventListener('close', (e) => {
                    console.log('🔒 [WS-HOOK] Closed:', url, 'Code:', e.code, 'Reason:', e.reason);
                });
                
                return ws;
            } catch (e) {
                console.error('❌ [WS-HOOK] Exception during creation:', e);
                throw e;
            }
        };
        window.WebSocket.prototype = OriginalWebSocket.prototype;
        Object.assign(window.WebSocket, OriginalWebSocket); // Copy constants like CONNECTING, OPEN etc.
        console.log('✅ [WS-HOOK] WebSocket intercepted for debugging');
    }
    // --- WebSocket Hook END ---

    // 1. Create Debug Window UI
    const debugDiv = document.createElement('div');
    debugDiv.id = 'debug-console';
    debugDiv.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);color:#0f0;font-family:monospace;font-size:12px;overflow:auto;z-index:9999;display:none;padding:10px;box-sizing:border-box;pointer-events:auto;white-space:pre-wrap;backdrop-filter:blur(5px);';
    
    // Controls container
    const controlsDiv = document.createElement('div');
    controlsDiv.style.cssText = 'position:fixed;top:10px;right:10px;z-index:10001;display:flex;gap:10px;';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '❌ Close';
    closeBtn.style.cssText = 'padding:8px 12px;background:#d32f2f;color:#fff;border:none;border-radius:4px;font-weight:bold;';
    closeBtn.onclick = () => debugDiv.style.display = 'none';
    
    const clearBtn = document.createElement('button');
    clearBtn.textContent = '🧹 Clear';
    clearBtn.style.cssText = 'padding:8px 12px;background:#444;color:#fff;border:1px solid #666;border-radius:4px;';
    clearBtn.onclick = () => { contentDiv.innerHTML = ''; appendLog('SYS', ['Console cleared']); };

    const copyBtn = document.createElement('button');
    copyBtn.textContent = '📋 Copy';
    copyBtn.style.cssText = 'padding:8px 12px;background:#1976d2;color:#fff;border:none;border-radius:4px;';
    copyBtn.onclick = () => {
        const text = contentDiv.innerText;
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            alert('Logs copied to clipboard');
        } catch(e) {
            console.error('Copy failed', e);
        }
        document.body.removeChild(textarea);
    };
    
    controlsDiv.appendChild(copyBtn);
    controlsDiv.appendChild(clearBtn);
    controlsDiv.appendChild(closeBtn);
    debugDiv.appendChild(controlsDiv);
    
    const contentDiv = document.createElement('div');
    contentDiv.style.marginTop = '50px';
    contentDiv.style.marginBottom = '20px';
    debugDiv.appendChild(contentDiv);
    
    document.body.appendChild(debugDiv);

    // 2. Hijack Console
    const oldLog = console.log;
    const oldWarn = console.warn;
    const oldError = console.error;

    function appendLog(type, args) {
        const msg = args.map(a => {
            if (typeof a === 'object') {
                try { return JSON.stringify(a); } catch(e) { return String(a); }
            }
            return String(a);
        }).join(' ');
        
        const line = document.createElement('div');
        line.style.borderBottom = '1px solid #333';
        line.style.padding = '4px 0';
        line.style.wordBreak = 'break-all';
        
        if (type === 'ERR') {
            line.style.color = '#ff5555';
            line.style.background = 'rgba(255,0,0,0.1)';
        } else if (type === 'WARN') {
            line.style.color = '#ffaa00';
        } else if (type === 'SYS') {
            line.style.color = '#aaa';
            line.style.fontStyle = 'italic';
        }
        
        const time = new Date().toLocaleTimeString();
        line.textContent = `[${time}] [${type}] ${msg}`;
        contentDiv.appendChild(line);
        
        // Auto scroll if near bottom or if new message
        if (debugDiv.style.display !== 'none') {
             debugDiv.scrollTop = debugDiv.scrollHeight;
        }
    }

    console.log = (...args) => { oldLog.apply(console, args); appendLog('LOG', args); };
    console.warn = (...args) => { oldWarn.apply(console, args); appendLog('WARN', args); };
    console.error = (...args) => { oldError.apply(console, args); appendLog('ERR', args); };

    window.onerror = (msg, url, lineNo, columnNo, error) => {
        appendLog('FATAL', [msg, '@', lineNo, error]);
        return false;
    };

    // 3. Repurpose Maximize Button
    setTimeout(() => {
        const btn = document.getElementById('btn-maximize');
        if (btn) {
            // Clone to strip listeners
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            // Change Icon/Appearance
            newBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M20 8h-2.81c-.45-.78-1.07-1.45-1.82-1.96L17 4.41 15.59 3l-2.17 2.17C12.96 5.06 12.49 5 12 5c-.49 0-.96.06-1.41.17L8.41 3 7 4.41l1.62 1.63C7.88 6.55 7.26 7.22 6.81 8H4v2h2.09c-.05.33-.09.66-.09 1v1H4v2h2v1c0 .34.04.67.09 1H4v2h2.81c1.04 1.79 2.97 3 5.19 3s4.15-1.21 5.19-3H20v-2h-2.09c.05-.33.09-.66.09-1v-1h2v-2h-2v-1c0-.34-.04-.67-.09-1H20V8zm-6 12H8v-1h8v1zm0-2H8v-1h8v1zm0-2H8v-1h8v1z"/></svg>'; 
            newBtn.style.color = '#00e676'; // Bright green
            newBtn.style.zIndex = '100';
            
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                debugDiv.style.display = debugDiv.style.display === 'none' ? 'block' : 'none';
                console.log('Debug console toggled');
            });
            
            // Add initial log
            console.log("Debug Mode Enabled. Click 🐞 to toggle.");
            console.log("App Version: " + (document.body.getAttribute('data-version') || 'Unknown'));
            console.log("Host: " + window.location.host);
        } else {
            console.error("btn-maximize not found");
        }
    }, 1000);
})();
// --- INJECTED DEBUG CONSOLE END ---
