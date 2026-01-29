
/** Injected Configuration */
window.APP_CONFIG = {
    "FETCH_PAGE_SIZE": 20,
    "AUTO_REFRESH_INTERVAL": 30000,
    "RECONNECT_DELAY": 3000,
    "POST_SWITCH_DELAY": 3000,
    "WS_PATH": "/ws"
};
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
                
                this.isDragging = false;
                this.value = 1.0; // 0.0 - 1.0
                
                this.initEvents();
                this.updateUI(this.value);
            }

            initEvents() {
                // 点击或拖动处理
                const updateFromEvent = (e) => {
                    const rect = this.trackWrapper.getBoundingClientRect();
                    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                    let percent = (clientX - rect.left) / rect.width;
                    percent = Math.max(0, Math.min(1, percent));
                    
                    // 0-200% 音量映射 (0.0 - 2.0)
                    const volumeValue = percent * 2.0;
                    this.setVolume(volumeValue);
                };

                // 鼠标事件
                this.trackWrapper.addEventListener('mousedown', (e) => {
                    this.isDragging = true;
                    updateFromEvent(e);
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                });

                const onMove = (e) => {
                    if (this.isDragging) {
                        updateFromEvent(e);
                        e.preventDefault();
                    }
                };

                const onUp = () => {
                    this.isDragging = false;
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                };

                // 触摸事件
                this.trackWrapper.addEventListener('touchstart', (e) => {
                    this.isDragging = true;
                    updateFromEvent(e);
                    document.addEventListener('touchmove', onTouchMove, { passive: false });
                    document.addEventListener('touchend', onTouchEnd);
                });

                const onTouchMove = (e) => {
                    if (this.isDragging) {
                        updateFromEvent(e);
                        e.preventDefault();
                    }
                };

                const onTouchEnd = () => {
                    this.isDragging = false;
                    document.removeEventListener('touchmove', onTouchMove);
                    document.removeEventListener('touchend', onTouchEnd);
                };

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

        /** 音频播放器 (PCM 流处理) */
        class AudioPlayer extends EventEmitter {
            constructor() {
                super();
                this.audioCtx = null;
                this.ws = null;
                this.connected = false;
                this.analyser = null;
                this.gainNode = null;
                // 音频处理链节点
                this.hpfNode = null;
                this.lpfNode = null;
                this.eqLow = null;
                this.eqMid = null;
                this.eqHigh = null;
                this.compressor = null;
                
                // 缓冲调度相关
                this.chunkQueue = [];
                this.scheduledEndTime = 0;
                this.started = false;
                this.buffering = true;
                
                // 音频参数
                this.sampleRate = 8000;
                this.targetLead = 0.5; // 目标领先时间(s)

                // 录音相关
                this.recording = false;
                this.recordedChunks = [];
            }

            async ensureAudioContext() {
                if (!this.audioCtx) {
                    try {
                        const AudioContext = window.AudioContext || window.webkitAudioContext;
                        this.audioCtx = new AudioContext();
                        
                        this.analyser = this.audioCtx.createAnalyser();
                        this.analyser.fftSize = 1024; // 降低分辨率以提高性能 (原 2048)
                        this.analyser.smoothingTimeConstant = 0.8;
                        
                        this.gainNode = this.audioCtx.createGain();
                        this.gainNode.gain.value = 1.0;

                        // 音频处理链优化 (参考 API 文档)
                        // 1. 300Hz HPF: 去除亚音频 (CTCSS/DCS) 和低频噪声
                        this.hpfNode = this.audioCtx.createBiquadFilter();
                        this.hpfNode.type = 'highpass';
                        this.hpfNode.frequency.value = 300;

                        // 2. 3000Hz LPF: 模拟电台带宽，去除高频刺耳噪声
                        this.lpfNode = this.audioCtx.createBiquadFilter();
                        this.lpfNode.type = 'lowpass';
                        this.lpfNode.frequency.value = 3000;
                        this.lpfNode.Q.value = 0.5;

                        // 3. EQ 低频 (LowShelf 180Hz +0.5dB)
                        this.eqLow = this.audioCtx.createBiquadFilter();
                        this.eqLow.type = 'lowshelf';
                        this.eqLow.frequency.value = 180;
                        this.eqLow.gain.value = 0.5;

                        // 4. EQ 中频 (Peaking 1400Hz +1.0dB Q=0.8) - 增强人声清晰度
                        this.eqMid = this.audioCtx.createBiquadFilter();
                        this.eqMid.type = 'peaking';
                        this.eqMid.frequency.value = 1400;
                        this.eqMid.Q.value = 0.8;
                        this.eqMid.gain.value = 1.0;

                        // 5. EQ 高频 (HighShelf 2600Hz 0dB)
                        this.eqHigh = this.audioCtx.createBiquadFilter();
                        this.eqHigh.type = 'highshelf';
                        this.eqHigh.frequency.value = 2600;
                        this.eqHigh.gain.value = 0;

                        // 6. 动态压缩器: 平衡音量，防止爆音
                        this.compressor = this.audioCtx.createDynamicsCompressor();
                        this.compressor.threshold.value = -22;
                        this.compressor.knee.value = 24;
                        this.compressor.ratio.value = 2;

                        // 连线: Source -> Gain -> HPF -> LPF -> EQ(L/M/H) -> Comp -> Analyser -> Dest
                        this.gainNode.connect(this.hpfNode);
                        this.hpfNode.connect(this.lpfNode);
                        this.lpfNode.connect(this.eqLow);
                        this.eqLow.connect(this.eqMid);
                        this.eqMid.connect(this.eqHigh);
                        this.eqHigh.connect(this.compressor);
                        this.compressor.connect(this.analyser);
                        this.analyser.connect(this.audioCtx.destination);
                    } catch (e) {
                        console.warn('AudioContext creation failed (waiting for user gesture):', e);
                        return;
                    }
                }
                
                // Do NOT auto-resume here. Rely on unlock() called by user gesture.
            }

            unlock() {
                // Try to create if missing (e.g. failed during auto-connect)
                if (!this.audioCtx) {
                    this.ensureAudioContext();
                }
                
                if (this.audioCtx && this.audioCtx.state === 'suspended') {
                    this.audioCtx.resume().then(() => {
                        console.log('AudioContext resumed via user interaction');
                    }).catch(e => console.error('AudioContext resume failed:', e));
                }
            }

            connect(host) {
                if (this.connected) return;
                this.ensureAudioContext();
                
                // 重置状态
                this.chunkQueue = [];
                this.scheduledEndTime = this.audioCtx.currentTime;
                this.started = false;
                this.buffering = true;

                try {
                    this.ws = new WebSocket(`${(window.location && window.location.protocol === 'https:' ? 'wss' : 'ws')}://${host}/audio`);
                    this.ws.binaryType = 'arraybuffer';

                    this.ws.onopen = () => {
                        this.connected = true;
                        this.emit('status', true);
                    };

                    this.ws.onclose = () => {
                        this.connected = false;
                        this.emit('status', false);
                    };

                    this.ws.onmessage = (e) => {
                        if (e.data instanceof ArrayBuffer) {
                            this.handlePCM(e.data);
                        }
                    };
                } catch (e) {
                    console.error('Audio Connect Failed:', e);
                }
            }

            disconnect() {
                if (this.ws) {
                    this.ws.close();
                    this.ws = null;
                }
                this.connected = false;
                this.emit('status', false);
            }

            handlePCM(buffer) {
                // 录音收集
                if (this.recording) {
                    this.recordedChunks.push(buffer.slice(0));
                }

                // PCM16 -> Float32
                const int16 = new Int16Array(buffer);
                const float32 = new Float32Array(int16.length);
                const scale = 1.0 / 32768;
                for (let i = 0; i < int16.length; i++) {
                    float32[i] = int16[i] * scale;
                }
                
                this.chunkQueue.push(float32);
                this.schedule();
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
                const wavHeader = this.createWavHeader(totalLen, 1, this.sampleRate, 16);
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

            schedule() {
                if (!this.audioCtx) return;
                
                // 如果处于挂起状态，不进行调度，避免错误日志刷屏
                if (this.audioCtx.state === 'suspended') return;

                const now = this.audioCtx.currentTime;
                if (this.scheduledEndTime < now) this.scheduledEndTime = now;

                // 简单的缓冲策略
                if (this.buffering) {
                    // 积攒约 0.1s 数据再开始 (原为 0.5s，降低延迟)
                    const totalSamples = this.chunkQueue.reduce((acc, c) => acc + c.length, 0);
                    if (totalSamples / this.sampleRate > 0.1) {
                        this.buffering = false;
                        this.started = true;
                    } else {
                        return;
                    }
                }

                // 延迟控制/追赶逻辑
                // 如果计划时间落后当前时间太多（欠载），重置为当前时间
                if (this.scheduledEndTime < now) {
                    this.scheduledEndTime = now + 0.01; // 给一点小缓冲
                }
                
                // 如果计划时间超前当前时间太多（积压），进行丢包处理以减少延迟
                const latency = this.scheduledEndTime - now;
                if (latency > 0.3) { // 允许最大 300ms 延迟
                    // 丢弃队列头部的包，直到延迟在此范围内
                    // 注意：这会导致音频跳跃，但在实时通信中低延迟优先
                    console.log(`Latency too high (${latency.toFixed(3)}s), skipping packets...`);
                    // 简单粗暴：清空队列，重置时间
                    this.chunkQueue = [];
                    this.scheduledEndTime = now + 0.05;
                    return;
                }

                // 调度所有队列中的块
                while (this.chunkQueue.length) {
                    const chunk = this.chunkQueue.shift();
                    const buffer = this.audioCtx.createBuffer(1, chunk.length, this.sampleRate);
                    buffer.copyToChannel(chunk, 0);

                    const source = this.audioCtx.createBufferSource();
                    source.buffer = buffer;
                    source.connect(this.gainNode);
                    source.start(this.scheduledEndTime);

                    this.scheduledEndTime += chunk.length / this.sampleRate;
                }
            }

            setVolume(val) {
                if (this.gainNode) this.gainNode.gain.value = val;
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
                const colWidth = w / barCount;
                const groundY = h * 0.85;
                
                if (this.peaks.length !== barCount) this.peaks = new Array(barCount).fill(0);

                ctx.shadowBlur = 0;
                ctx.shadowColor = theme.primary;

                for(let i = 0; i < barCount; i++) {
                    const value = dataArray[i * step] || 0;
                    const barHeight = (value / 255) * groundY * 0.95; 
                    const x = i * colWidth + colWidth/2;
                    
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

                // 太阳喷发系统配置
                this.eruptions = [];
                this.eruptionConfig = {
                    sensitivity: 1.0,   // 音调敏感度
                    randomness: 0.5,    // 随机性程度
                    intensity: 1.0,     // 光芒强度缩放
                    speed: 1.0          // 喷发速度缩放
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
                this.angleOffset += this.currentSpeed * 0.02;

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
                this.starRotation += 0.0002; 
                const maxDim = Math.max(w, h);
                const nowTime = Date.now();

                this.stars.forEach(star => {
                    const blink = Math.sin(nowTime * star.blinkSpeed + star.blinkPhase);
                    const alpha = Math.max(0.1, Math.min(1, star.baseAlpha + blink * 0.3 + energy * 0.5));
                    
                    const currentAngle = star.angle + this.starRotation;
                    const x = cx + Math.cos(currentAngle) * star.r * maxDim * 0.8;
                    const y = cy + Math.sin(currentAngle) * star.r * maxDim * 0.8;

                    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                    ctx.beginPath();
                    ctx.arc(x, y, star.size, 0, Math.PI*2);
                    ctx.fill();
                });

                // 4. 绘制轨道 (动态计算缩放以铺满屏幕)
                // 目标：让最外层行星(冥王星 dist=11.0)贴近屏幕边缘
                // 计算 X 轴和 Y 轴方向的最大允许缩放比例，取较小值以确保完整显示
                const maxDist = 11.0; 
                const scaleX = w / 2 / maxDist;
                const scaleY = h / 2 / (maxDist * this.tilt);
                const scale = Math.min(scaleX, scaleY) * 0.95; // 0.95 留一点点边距

                ctx.lineWidth = 1;
                this.planets.forEach(p => {
                    ctx.beginPath();
                    ctx.ellipse(cx, cy, p.dist * scale, p.dist * scale * this.tilt, 0, 0, Math.PI*2);
                    ctx.strokeStyle = `rgba(255, 255, 255, ${0.05 + bass * 0.1})`;
                    ctx.stroke();
                });

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
                    const angle = this.angleOffset * p.speed + i * 137.5; 
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
                                    const mAngle = this.angleOffset * m.speed * 4 + idx; 
                                    // 卫星轨道半径需适当放大以可见
                                    const mDist = (size + m.dist * scale * 2); 
                                    const mx = x + Math.cos(mAngle) * mDist;
                                    const my = y + Math.sin(mAngle) * mDist * this.tilt; // 卫星也受倾斜影响
                                    // 增大卫星尺寸以提升可见度
                                    const mSize = Math.max(2.0, m.r * scale * 0.15);

                                    // 卫星轨道线
                                    ctx.beginPath();
                                    ctx.ellipse(x, y, mDist, mDist * this.tilt, 0, 0, Math.PI*2);
                                    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
                                    ctx.stroke();

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
                this.cloudAngle += 0.002;
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
                    const legendY = h - 25;
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

                if (!this.analyser) return;

                const bufferLength = this.analyser.frequencyBinCount;
                const dataArray = (this.freqData && this.freqData.length === bufferLength)
                    ? this.freqData
                    : (this.freqData = new Uint8Array(bufferLength));

                this.renderers[this.mode].draw(this.analyser, dataArray, bufferLength, {
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
        }

        /** 呼号队列显示管理器 (新增) */
        class CallsignTicker {
            constructor(containerId, visualizer) {
                this.container = document.getElementById(containerId);
                this.visualizer = visualizer;
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

                // 创建呼号文本元素
                const textEl = document.createElement('div');
                textEl.className = 'callsign-text';
                textEl.textContent = callsign;

                el.appendChild(timeEl);
                el.appendChild(textEl);
                
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
                            if (grid && grid !== '-') {
                                this.locateGrid(grid);
                                
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
                        this.renderList(msg.data.list || []);
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
                    this.mapFrame.contentWindow.postMessage({
                        type: 'LOCATE_GRID',
                        grid: grid
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
                const d = new Date(ts * 1000);
                const pad = (n) => String(n).padStart(2, '0');
                return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
            }

            renderList(list) {
                if (!list || list.length === 0) {
                    this.listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #666; font-size: 0.8rem;">No logs</div>';
                    return;
                }

                this.listEl.innerHTML = list.map((item, index) => {
                    const call = item.toCallsign || 'UNKNOWN';
                    const grid = item.grid || '-';
                    // Use item.ts if available, otherwise current time
                    const ts = this.formatDate(item.ts || Date.now()/1000);
                    
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
                this.subtitleEl = document.getElementById('subtitle-overlay');
                this.subtitleText = document.getElementById('subtitle-text');
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
                // 处理 QSO 发言人事件
                if (msg.type === 'qso' && msg.subType === 'callsign' && msg.data) {
                    const { callsign, isSpeaking } = msg.data;
                    // 只处理开始发言事件，或者根据需要处理
                    // 这里假设每次 isSpeaking=true 都是一次新的发言或持续发言
                    // 为了避免重复，我们可以简单去重，或者每次都添加（作为新的事件）
                    // 用户需求是“接收到一个新的呼号时，触发显示更新”，通常意味着新的发言开始
                    
                    if (isSpeaking) {
                        // 简单的去重逻辑：如果最后一个呼号相同且时间很近，则不添加？
                        // 暂时直接添加，让Ticker处理队列
                        if (this.onCallsign) this.onCallsign(callsign);
                        if (this.onSpeakingState) this.onSpeakingState(callsign, true);
                    } else {
                        if (this.onSpeakingState) this.onSpeakingState(callsign, false);
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
        
        // 实例化呼号显示组件
        const ticker = new CallsignTicker('callsign-ticker', viz);
        // Expose to window for Python injection
        window.ticker = ticker;
        
        // 连接事件
        events.onCallsignReceived((callsign) => {
            ticker.addCallsign(callsign);
        });

        events.onSpeakingStateChanged((callsign, isSpeaking) => {
            if (isSpeaking) {
                viz.setCallsign(callsign);
            } else {
                // 如果当前显示的正是停止说话的人，则清除
                if (viz.currentCallsign === callsign) {
                    viz.setCallsign('');
                }
            }
        });

        const deviceMgr = new DeviceManager();
        const discoveryMgr = new DiscoveryManager();
        const qsoMgr = new QsoManager(ctrl);
        
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
        // 监听窗口大小变化
        window.addEventListener('resize', checkDevice);

        // 0. 主题切换
        // 扩展主题列表：包含新增的4款主题
        const themes = ['', 'theme-matrix', 'theme-ocean', 'theme-sunset', 'theme-light', 'theme-pink', 'theme-purple', 'theme-red', 'theme-black'];
        let currentThemeIndex = 0;
        
        ui.btnTheme.addEventListener('click', () => {
            if (themes[currentThemeIndex]) {
                document.body.classList.remove(themes[currentThemeIndex]);
            }
            currentThemeIndex = (currentThemeIndex + 1) % themes.length;
            if (themes[currentThemeIndex]) {
                document.body.classList.add(themes[currentThemeIndex]);
            }
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

        // 4. 台站列表逻辑
        ctrl.on('stationList', (list) => {
            ui.stCount.textContent = `${list.length} STATIONS`;
            ui.stList.innerHTML = '';
            
            if (list.length === 0) {
                ui.stList.innerHTML = '<div class="station-item" style="grid-column: 1 / -1; justify-content: center; align-items: center; color: #666;">暂无台站</div>';
                return;
            }

            // Optimization: Use DocumentFragment for batch insertion
            const fragment = document.createDocumentFragment();

            list.forEach(st => {
                const el = document.createElement('div');
                el.className = 'station-item';
                el.dataset.uid = st.uid;
                if (st.uid == currentStationId) el.classList.add('active');
                
                // Security Fix: Use textContent instead of innerHTML to prevent XSS
                const nameEl = document.createElement('div');
                nameEl.className = 'st-name';
                nameEl.textContent = st.name || 'Station ' + st.uid;
                el.appendChild(nameEl);

                el.onclick = () => {
                    ctrl.setStation(st.uid);
                    // 乐观更新 UI
                    // Use ui.stList scope to avoid global query
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
                };
                fragment.appendChild(el);
            });
            ui.stList.appendChild(fragment);


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

            // 高亮当前
            const items = document.querySelectorAll('.station-item');
            items.forEach(el => {
                if (el.dataset.uid == currentStationId) el.classList.add('active');
                else el.classList.remove('active');
            });
        });

        ui.btnPrev.addEventListener('click', () => ctrl.prevStation());
        ui.btnNext.addEventListener('click', () => ctrl.nextStation());

        // 5. 全局点击唤醒音频上下文（解决自动连接时的 AudioContext 策略限制）
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
