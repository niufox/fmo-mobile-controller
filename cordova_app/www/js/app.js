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
                this.CONFIG = {
                    FETCH_PAGE_SIZE: 20,
                    AUTO_REFRESH_INTERVAL: 30000,
                    RECONNECT_DELAY: 3000,
                    POST_SWITCH_DELAY: 3000
                };

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
                    this.ws = new WebSocket(`ws://${this.host}/ws`);
                    
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
                        console.error('WS Error:', e);
                        this.connected = false;
                        this.emit('status', false);
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
                    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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
                }
                if (this.audioCtx.state === 'suspended') {
                    try {
                        await this.audioCtx.resume();
                    } catch (e) {
                        console.warn('Auto-resume failed, waiting for user gesture.');
                    }
                }
            }

            unlock() {
                if (this.audioCtx && this.audioCtx.state === 'suspended') {
                    this.audioCtx.resume().then(() => {
                        console.log('AudioContext resumed via user interaction');
                    }).catch(e => console.error(e));
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
                    this.ws = new WebSocket(`ws://${host}/audio`);
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
        class Visualizer {
            constructor(canvas, analyser) {
                this.canvas = canvas;
                this.ctx = canvas.getContext('2d');
                this.analyser = analyser;
                this.freqData = null;
                this.mode = 0; 
                this.modes = ['SPECTRUM', 'MIRROR', 'WAVEFORM', 'OSCILLOSCOPE', 'RADIAL', 'PARTICLES'];
                this.running = false;
                
                // 粒子系统状态 (用于 PARTICLES 模式)
                this.particles = [];
                for(let i=0; i<100; i++) {
                    this.particles.push({
                        x: Math.random() * canvas.width,
                        y: Math.random() * canvas.height,
                        vx: (Math.random() - 0.5) * 2,
                        vy: (Math.random() - 0.5) * 2,
                        size: Math.random() * 3,
                        color: this.colorTheme
                    });
                }

                // 缓存主题颜色
                this.colorTheme = '#00f3ff';
                this.colorSecondary = '#ff00ff';
                this.updateThemeColors();

                this.resize();
                
                // 使用 ResizeObserver 监听容器大小变化，解决布局变动导致的变形问题
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
            }

            setAnalyser(analyser) { this.analyser = analyser; this.freqData = null; }

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
                
                const w = this.canvas.width;
                const h = this.canvas.height;
                
                // 使用缓存的主题颜色
                const colorTheme = this.colorTheme;
                const colorSecondary = this.colorSecondary;

                // 清空画布
                this.ctx.clearRect(0, 0, w, h);

                if (!this.analyser) return;

                const bufferLength = this.analyser.frequencyBinCount;
                const dataArray = (this.freqData && this.freqData.length === bufferLength)
                    ? this.freqData
                    : (this.freqData = new Uint8Array(bufferLength));
                const modeName = this.modes[this.mode];

                // 通用粒子绘制设置
                // 性能优化：移动端减少阴影渲染
                this.ctx.shadowBlur = 0; 
                this.ctx.shadowColor = colorTheme;
                this.ctx.fillStyle = colorTheme;
                this.ctx.strokeStyle = colorTheme;

                if (modeName === 'SPECTRUM') { 
                    this.analyser.getByteFrequencyData(dataArray);
                    
                    const displayW = this.canvas.clientWidth || (w / window.devicePixelRatio);
                    const barCount = Math.max(24, Math.min(36, Math.floor(displayW / 12)));
                    const step = Math.max(1, Math.floor(bufferLength / barCount));
                    const colWidth = w / barCount;
                    const groundY = h * 0.85; // 地平线位置
                    
                    // 初始化峰值数组
                    if (!this.peaks || this.peaks.length !== barCount) {
                        this.peaks = new Array(barCount).fill(0);
                    }

                    for(let i = 0; i < barCount; i++) {
                        const value = dataArray[i * step] || 0;
                        
                        // 增强：增加高度敏感度
                        const barHeight = (value / 255) * groundY * 0.95; 
                        const x = i * colWidth + colWidth/2;
                        
                        // 1. 绘制主体粒子柱 (向上)
                        // 增强：增加粒子密度和大小
                        const particleCount = Math.floor(barHeight / 14); 
                        for (let j = 0; j < particleCount; j++) {
                            const y = groundY - (j * 14 + 10);
                            const ratio = j / particleCount; 
                            
                            this.ctx.beginPath();
                            // 增强：粒子更大，随高度变化
                            const size = 3 + ratio * 3.5; 
                            this.ctx.arc(x, y, size, 0, Math.PI * 2);
                            
                            if (j === particleCount - 1) {
                                this.ctx.fillStyle = '#ffffff';
                                this.ctx.shadowBlur = 8;
                                this.ctx.shadowColor = '#ffffff';
                            } else {
                                this.ctx.fillStyle = i % 2 === 0 ? colorTheme : colorSecondary;
                                this.ctx.shadowBlur = 0;
                            }
                            
                            this.ctx.globalAlpha = ratio * 0.7 + 0.3;
                            this.ctx.fill();
                        }
                        this.ctx.shadowBlur = 0; // Reset

                        // 2. 绘制倒影粒子 (向下)
                        const reflectCount = Math.floor(particleCount / 3);
                        for (let j = 0; j < reflectCount; j++) {
                            const y = groundY + (j * 14 + 10);
                            // 超出屏幕不绘制
                            if (y > h) break;
                            
                            const ratio = 1 - (j / reflectCount); // 越远越淡
                            
                            this.ctx.beginPath();
                            this.ctx.arc(x, y, 2.5, 0, Math.PI * 2);
                            this.ctx.fillStyle = i % 2 === 0 ? colorTheme : colorSecondary;
                            this.ctx.globalAlpha = ratio * 0.15;
                            this.ctx.fill();
                        }
                        
                        // 3. 绘制掉落峰值
                        if (barHeight > this.peaks[i]) {
                            this.peaks[i] = barHeight;
                        } else {
                            this.peaks[i] -= 2; 
                        }
                        
                        if (this.peaks[i] > 0) {
                            const peakY = groundY - this.peaks[i] - 12;
                            this.ctx.beginPath();
                            this.ctx.arc(x, peakY, 3, 0, Math.PI * 2);
                            this.ctx.fillStyle = colorSecondary;
                            this.ctx.globalAlpha = 1.0;
                            this.ctx.fill();
                        }
                    }
                    
                    // 绘制地平线光晕
                    this.ctx.beginPath();
                    this.ctx.moveTo(0, groundY);
                    this.ctx.lineTo(w, groundY);
                    this.ctx.strokeStyle = colorTheme;
                    this.ctx.lineWidth = 2;
                    this.ctx.globalAlpha = 0.4;
                    this.ctx.stroke();
                    
                    this.ctx.globalAlpha = 1.0;
                }
                else if (modeName === 'MIRROR') {
                    this.analyser.getByteFrequencyData(dataArray);
                    const step = Math.ceil(bufferLength / 64);
                    const cx = w / 2;
                    
                    for(let i = 0; i < bufferLength; i += step) {
                        const value = dataArray[i];
                        const barHeight = (value / 255) * (h / 2);
                        const offset = (i / bufferLength) * (w / 2);
                        
                        // 绘制对称粒子
                        const particleCount = Math.floor(barHeight / 8);
                        for (let j = 0; j < particleCount; j++) {
                            const dy = j * 10;
                            const size = 2.5;
                            const alpha = (j / particleCount) * 0.8 + 0.2;
                            
                            this.ctx.globalAlpha = alpha;
                            
                            // 右侧
                            this.ctx.beginPath();
                            this.ctx.arc(cx + offset, (h/2) - dy, size, 0, Math.PI*2); // 上
                            this.ctx.fill();
                            this.ctx.beginPath();
                            this.ctx.arc(cx + offset, (h/2) + dy, size, 0, Math.PI*2); // 下
                            this.ctx.fill();

                            // 左侧
                            this.ctx.beginPath();
                            this.ctx.arc(cx - offset, (h/2) - dy, size, 0, Math.PI*2);
                            this.ctx.fill();
                            this.ctx.beginPath();
                            this.ctx.arc(cx - offset, (h/2) + dy, size, 0, Math.PI*2);
                            this.ctx.fill();
                        }
                    }
                    this.ctx.globalAlpha = 1.0;
                }
                else if (modeName === 'WAVEFORM') {
                    this.analyser.getByteTimeDomainData(dataArray);
                    this.ctx.lineWidth = 0; // 不画线
                    
                    const sliceWidth = w * 1.0 / bufferLength;
                    let x = 0;
                    
                    // 仅每隔几个点绘制一个发光粒子，形成离散波形
                    const pointStep = 4; 
                    for(let i = 0; i < bufferLength; i += pointStep) {
                        const v = dataArray[i] / 128.0;
                        const y = v * h/2; // 居中
                        
                        this.ctx.beginPath();
                        this.ctx.arc(x, y, 2, 0, Math.PI * 2);
                        this.ctx.fillStyle = colorTheme;
                        // 动态透明度模拟闪烁
                        this.ctx.globalAlpha = Math.random() * 0.5 + 0.5;
                        this.ctx.fill();
                        
                        x += sliceWidth * pointStep;
                    }
                    this.ctx.globalAlpha = 1.0;
                }
                else if (modeName === 'OSCILLOSCOPE') {
                    this.analyser.getByteTimeDomainData(dataArray);
                    // 示波器：高速运动的粒子轨迹
                    const sliceWidth = w * 1.0 / bufferLength;
                    let x = 0;
                    
                    for(let i = 0; i < bufferLength; i++) {
                        const v = dataArray[i] / 128.0;
                        const y = v * h/2;
                        
                        if (i % 2 === 0) { // 减少绘制点数优化性能
                            this.ctx.beginPath();
                            this.ctx.rect(x, y, 2, 2); // 使用方块增加科技感
                            this.ctx.fillStyle = colorTheme;
                            this.ctx.fill();
                        }
                        x += sliceWidth;
                    }
                    
                    // 网格背景 (点阵)
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                    this.ctx.shadowBlur = 0;
                    for (let gx = 0; gx < w; gx += 50) {
                        for (let gy = 0; gy < h; gy += 50) {
                            this.ctx.fillRect(gx, gy, 1, 1);
                        }
                    }
                }
                else if (modeName === 'RADIAL') { 
                    this.analyser.getByteFrequencyData(dataArray);
                    const cx = w / 2;
                    const cy = h / 2;
                    const radius = Math.min(w, h) / 5; // 稍微缩小基础半径
                    
                    // 整体旋转效果
                    this.ctx.save();
                    this.ctx.translate(cx, cy);
                    this.ctx.rotate(Date.now() * 0.0005); // 缓慢自转
                    
                    // 镜像绘制两圈
                    const count = 40; 
                    const step = Math.floor(bufferLength / count);
                    
                    for(let i = 0; i < count; i++) { 
                        const value = dataArray[i * step];
                        const angle = (i / count) * Math.PI * 2;
                        
                        // 1. 内圈 (Theme Color)
                        const r1 = radius + (value / 255) * 40;
                        const x1 = Math.cos(angle) * r1;
                        const y1 = Math.sin(angle) * r1;
                        
                        this.ctx.beginPath();
                        this.ctx.arc(x1, y1, 3, 0, Math.PI * 2);
                        this.ctx.fillStyle = colorTheme;
                        this.ctx.fill();
                        
                        // 2. 外圈 (Secondary Color) - 增加偏移
                        const v2 = dataArray[Math.min((i * step + 5), bufferLength-1)];
                        const r2 = radius * 1.8 + (v2 / 255) * 60;
                        const x2 = Math.cos(angle) * r2;
                        const y2 = Math.sin(angle) * r2;
                        
                        this.ctx.beginPath();
                        this.ctx.arc(x2, y2, 2, 0, Math.PI * 2);
                        this.ctx.fillStyle = colorSecondary;
                        this.ctx.fill();
                        
                        // 3. 能量连线 (当音量较大时)
                        if (value > 128) {
                            this.ctx.beginPath();
                            this.ctx.moveTo(x1, y1);
                            this.ctx.lineTo(x2, y2);
                            this.ctx.strokeStyle = colorTheme;
                            this.ctx.lineWidth = 1;
                            this.ctx.globalAlpha = 0.3;
                            this.ctx.stroke();
                            this.ctx.globalAlpha = 1.0;
                        }
                    }
                    
                    // 核心呼吸效果
                    const bass = dataArray[5] / 255.0;
                    this.ctx.beginPath();
                    this.ctx.arc(0, 0, radius * (0.8 + bass * 0.4), 0, Math.PI * 2);
                    this.ctx.fillStyle = colorTheme;
                    this.ctx.globalAlpha = 0.1 + bass * 0.2;
                    this.ctx.fill();
                    
                    this.ctx.restore();
                }
                else if (modeName === 'PARTICLES') {
                    this.analyser.getByteFrequencyData(dataArray);
                    
                    // 计算能量分区
                    let bass = 0, mid = 0, treble = 0;
                    for(let i=0; i<bufferLength; i++) {
                        if(i < 10) bass += dataArray[i];
                        else if(i < 100) mid += dataArray[i];
                        else treble += dataArray[i];
                    }
                    bass = bass / 10;
                    mid = mid / 90;
                    treble = treble / (bufferLength - 100);
                    
                    const cx = w / 2;
                    const cy = h / 2;
                    
                    // 粒子漩涡效果
                    this.particles.forEach((p, index) => {
                        // 1. 运动逻辑
                        const dx = p.x - cx;
                        const dy = p.y - cy;
                        const dist = Math.sqrt(dx*dx + dy*dy);
                        const angle = Math.atan2(dy, dx);
                        
                        // 速度随低频能量变化
                        const spiralSpeed = 0.01 + (bass / 1000);
                        const outSpeed = 1 + (mid / 20) + (dist * 0.01);
                        
                        const newAngle = angle + spiralSpeed;
                        const newDist = dist + outSpeed;
                        
                        p.x = cx + Math.cos(newAngle) * newDist;
                        p.y = cy + Math.sin(newAngle) * newDist;
                        
                        // 2. 边界重生
                        const maxDist = Math.max(w, h) * 0.7;
                        if(dist > maxDist) {
                            p.x = cx + (Math.random() - 0.5) * 10;
                            p.y = cy + (Math.random() - 0.5) * 10;
                            p.color = Math.random() > 0.5 ? colorTheme : colorSecondary;
                        }
                        
                        // 3. 绘制
                        this.ctx.beginPath();
                        // 大小随高频颤动
                        const pSize = p.size * (0.5 + (treble / 100)); 
                        this.ctx.arc(p.x, p.y, pSize, 0, Math.PI * 2);
                        this.ctx.fillStyle = p.color;
                        
                        // 透明度随距离增加
                        const alpha = Math.min(1, dist / (maxDist/2));
                        this.ctx.globalAlpha = alpha;
                        this.ctx.fill();
                        
                        // 4. 动态连线 (当低频强劲时)
                        if (bass > 180) {
                            // 只与附近的点连线，优化性能
                            for(let j=index+1; j<Math.min(index+10, this.particles.length); j++) {
                                const p2 = this.particles[j];
                                const d2 = Math.hypot(p.x - p2.x, p.y - p2.y);
                                if (d2 < 50) {
                                    this.ctx.beginPath();
                                    this.ctx.moveTo(p.x, p.y);
                                    this.ctx.lineTo(p2.x, p2.y);
                                    this.ctx.strokeStyle = p.color;
                                    this.ctx.lineWidth = 0.5;
                                    this.ctx.globalAlpha = 0.3 * (bass/255);
                                    this.ctx.stroke();
                                }
                            }
                        }
                    });
                    this.ctx.globalAlpha = 1.0;
                }
                
                // Reset shadow for next frame performance
                this.ctx.shadowBlur = 0;
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
                this.btn = document.getElementById('btn-qso');
                this.btnClose = document.getElementById('btn-qso-close');
                this.countEl = document.getElementById('qso-count-value');
                this.badge = document.getElementById('qso-badge');
                
                this.page = 0;
                this.pageSize = 20; // Default page size
                this.isLoading = false;
                this.refreshTimer = null; // Auto refresh timer

                if (this.btn && this.modal) {
                    this.initEvents();
                }
            }

            initEvents() {
                // Open Modal
                const openModal = () => this.show();
                this.btn.addEventListener('click', openModal);
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
            }

            fetchData(showLoading = false) {
                if (showLoading) {
                    this.listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">Loading...</div>';
                }
                this.client.getQsoList(this.page, this.pageSize);
            }

            formatDate(ts) {
                if (!ts) return '-';
                const d = new Date(ts * 1000);
                const pad = (n) => String(n).padStart(2, '0');
                return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
            }

            renderList(list) {
                if (!list || list.length === 0) {
                    this.listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No QSO logs found.</div>';
                    return;
                }

                this.listEl.innerHTML = list.map(item => {
                    const call = item.toCallsign || 'UNKNOWN';
                    const grid = item.grid || '-';
                    const time = this.formatDate(item.timestamp);
                    // item.freqHz unit is uncertain, assuming Hz and converting to MHz
                    const freq = item.freqHz ? (item.freqHz / 1000000).toFixed(4) + ' MHz' : ''; 
                    
                    return `
                    <div class="qso-item">
                        <div class="qso-info">
                            <div class="qso-call">
                                ${call}
                                <span class="qso-mode">${grid}</span>
                            </div>
                            <div class="qso-meta">
                                ${freq ? `<span class="qso-freq">${freq}</span>` : ''}
                                <span class="qso-time">${time}</span>
                            </div>
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
                    this.ws = new WebSocket(`ws://${host}/events`);
                    
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
                    this.updateSubtitle(callsign, isSpeaking);
                }
            }

            updateSubtitle(callsign, isSpeaking) {
                if (!this.subtitleEl || !this.subtitleText) return;

                if (isSpeaking) {
                    this.subtitleText.textContent = callsign;
                    this.subtitleEl.style.display = 'flex';
                    
                    // 去除自动隐藏的时间判断，只要 isSpeaking 为 true 就一直显示
                    if (this.speakingTimeout) clearTimeout(this.speakingTimeout);
                } else {
                    // 停止发言时立即隐藏
                    this.subtitleEl.style.display = 'none';
                    if (this.speakingTimeout) clearTimeout(this.speakingTimeout);
                }
            }
        }

        // --- 应用逻辑 ---
        const ctrl = new ControlClient();
        const player = new AudioPlayer();
        const events = new EventsClient(); // 实例化
        const viz = new Visualizer(document.getElementById('viz-canvas'), null);
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
        ui.vizArea.addEventListener('click', () => {
            const modeName = viz.switchMode();
            ui.vizModeText.textContent = modeName;
        });

        // 5. 录音控制：开始/停止录音，导出为 WAV
        ui.btnRecord.addEventListener('click', () => {
            if (!player.recording) {
                // 开始录音（需要音频已连接）
                if (!player.connected) {
                    alert('请先连接音频！');
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
                    alert('录音时长太短或无数据');
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

            list.forEach(st => {
                const el = document.createElement('div');
                el.className = 'station-item';
                el.dataset.uid = st.uid;
                if (st.uid == currentStationId) el.classList.add('active');
                
                el.innerHTML = `
                    <div class="st-name">${st.name || 'Station ' + st.uid}</div>
                `;
                el.onclick = () => {
                    ctrl.setStation(st.uid);
                    // 乐观更新 UI
                    document.querySelectorAll('.station-item').forEach(i => i.classList.remove('active'));
                    el.classList.add('active');
                    currentStationId = st.uid;
                    
                    // Update viz text immediately
                    if (ui.currentStationText) {
                        ui.currentStationText.textContent = st.name || 'Station ' + st.uid;
                        ui.currentStationText.style.display = 'block';
                    }
                };
                ui.stList.appendChild(el);
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

        // 自动连接
        setTimeout(() => {
            const lastHost = deviceMgr.devices.length > 0 ? deviceMgr.devices[0] : 'fmo.local';
            if (ui.inpHost) {
                ui.inpHost.value = lastHost;
                // 触发连接按钮点击事件以复用连接逻辑
                if (ui.btnConnect) {
                    ui.btnConnect.click();
                }
            }
        }, 1000);

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