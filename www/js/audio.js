import { EventEmitter } from './utils.js';
import { connectionManager } from './connectionManager.js';

/** 音频播放器 (基于 api3.0/audioPlayer.js 改进)
 * Audio Player (Improved based on api3.0/audioPlayer.js)
 */
export class AudioPlayer extends EventEmitter {
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
        // Buffering & scheduling (from api3.0)
        this.chunkQueue = [];
        this.queuedSamples = 0;
        this.scheduledEndTime = 0;
        this.buffering = true;
        this.started = false;

        // Tunables (来自 api3.0 优化参数)
        // Tunables (Optimized parameters from api3.0)
        this.minStartBufferSec = 0.1;
        this.lowBufferSec = 0.3;
        this.targetLeadSec = 0.5;
        this.maxBufferSec = 1.0;

        // State callbacks
        this.onStatus = null;

        // 音频处理链节点 (优化后的处理链)
        // Audio processing chain nodes (Optimized chain)
        this._chainInput = null;
        this.hpfNode = null;
        this.lpfNode = null;
        this.eqLow = null;
        this.eqMid = null;
        this.eqHigh = null;
        this.compressor = null;

        // 录音相关
        // Recording related
        this.recording = false;
        this.recordedChunks = [];

        // 本地静音相关 (保持原有功能)
        // Local mute related (Keep original functionality)
        this.localMuteEnabled = localStorage.getItem('fmo_local_mute') === 'true';
        this.isLocalTransmitting = false;
        this.audioQueueBuffer = []; // FIFO buffer for delay
        
        // Heartbeat config
        this.heartbeatInterval = 30000; // 30s
        this.heartbeatTimer = null;
    }

    setStatus(text) {
        if (this.onStatus) this.onStatus(text);
    }

    async ensureAudio() {
        if (!this.audioCtx) {
            // Create context on user gesture
            // 在用户手势上创建上下文
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this.gainNode = this.audioCtx.createGain();
            this.gainNode.gain.value = 3.0; // Boost volume (optimized)

            // Create analyser for FFT visualization
            // 创建用于 FFT 可视化的分析器
            this.analyser = this.audioCtx.createAnalyser();
            this.analyser.fftSize = 1024; // 1024-point FFT; freqBinCount = 512
            this.analyser.smoothingTimeConstant = 0.8;
            // Destination chain (tail): analyser -> gain -> destination
            // 目标链 (尾部): analyser -> gain -> destination
            // We'll feed analyser from our processing chain
            // 我们将从处理链向分析器提供数据
            this.analyser.connect(this.gainNode);
            this.gainNode.connect(this.audioCtx.destination);

            // Build processing chain (head): source -> _chainInput -> HPF -> LPF -> EQ(Low,Mid,High) -> Compressor -> analyser
            // 构建处理链 (头部): source -> _chainInput -> HPF -> LPF -> EQ(Low,Mid,High) -> Compressor -> analyser
            // Create once and reuse for all scheduled chunks
            // 创建一次并重用于所有调度的块
            if (!this._chainInput) {
                // Unified entry for all sources
                // 所有源的统一入口
                this._chainInput = this.audioCtx.createGain();
                this._chainInput.gain.value = 1.5; // Pre-gain boost

                // High-pass to remove DC/rumble (walkie‑talkie voice) - 优化参数
                // 高通滤波器移除直流/隆隆声 (对讲机声音) - Optimized parameters
                this.hpf = this.audioCtx.createBiquadFilter();
                this.hpf.type = 'highpass';
                this.hpf.frequency.value = 800; // User requested 800Hz HPF for clearer voice
                this.hpf.Q.value = 0.7;

                // Low-pass to tame hiss/sibilance given 8 kHz sampling (Nyquist 4 kHz) - 优化参数
                // 低通滤波器平滑嘶嘶声/齿音，基于 8 kHz 采样 (奈奎斯特 4 kHz) - Optimized parameters
                this.lpf = this.audioCtx.createBiquadFilter();
                this.lpf.type = 'lowpass';
                this.lpf.frequency.value = 3500; // Opened up slightly for clarity
                this.lpf.Q.value = 0.5;

                // EQ: Voice shaping
                // EQ: 声音整形
                this.eqLow = this.audioCtx.createBiquadFilter();
                this.eqLow.type = 'peaking'; // Changed to peaking to add body above cutoff
                this.eqLow.frequency.value = 1000; 
                this.eqLow.gain.value = 2.0; // dB boost

                this.eqMid = this.audioCtx.createBiquadFilter();
                this.eqMid.type = 'peaking';
                this.eqMid.frequency.value = 1400; // reduce nasality
                this.eqMid.Q.value = 0.8; 
                this.eqMid.gain.value = 1.0; 

                this.eqHigh = this.audioCtx.createBiquadFilter();
                this.eqHigh.type = 'highshelf';
                this.eqHigh.frequency.value = 2600; 
                this.eqHigh.gain.value = 1.0; // Slight boost for intelligibility

                // Dynamics Compressor - Optimized for voice & volume
                // 动态压缩器 - 针对语音和音量进行了优化
                this.compressor = this.audioCtx.createDynamicsCompressor();
                this.compressor.threshold.value = -24; // Lower threshold
                this.compressor.knee.value = 20;
                this.compressor.ratio.value = 4.0; // Higher ratio for limiting
                this.compressor.attack.value = 0.002; // Faster attack
                this.compressor.release.value = 0.25;

                // Wire: input -> HPF -> LPF -> EQ(Low -> Mid -> High) -> Compressor -> Analyser (-> Gain -> Dest)
                // 连线: input -> HPF -> LPF -> EQ(Low -> Mid -> High) -> Compressor -> Analyser (-> Gain -> Dest)
                this._chainInput.connect(this.hpf);
                this.hpf.connect(this.lpf);
                this.lpf.connect(this.eqLow);
                this.eqLow.connect(this.eqMid);
                this.eqMid.connect(this.eqHigh);
                this.eqHigh.connect(this.compressor);
                this.compressor.connect(this.analyser);
            }
        }

        // Always try to resume if suspended (crucial for autoplay policy)
        // 如果挂起则始终尝试恢复 (对于自动播放策略至关重要)
        if (this.audioCtx.state === 'suspended') {
            try {
                await this.audioCtx.resume();
                console.log('AudioContext resumed in ensureAudio');
            } catch (e) {
                console.error('AudioContext resume failed:', e);
            }
        }
    }

    unlock() {
        // Try to create if missing (e.g. failed during auto-connect)
        // 如果缺失则尝试创建 (例如在自动连接期间失败)
        if (!this.audioCtx) {
            this.ensureAudio();
        }

        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().then(() => {
                console.log('AudioContext resumed via user interaction');
            }).catch(e => console.error('AudioContext resume failed:', e));
        }
    }

    async connect(host) {
        if (this.isConnecting) {
             console.warn('[AudioPlayer] Connection attempt ignored: Already connecting.');
             return;
        }
        this.isConnecting = true;

        if (this.ws && (this.connected || this.ws.readyState === WebSocket.CONNECTING)) {
            this.isConnecting = false;
            return;
        }

        this.ensureAudio();
        this.url = `${(window.location && window.location.protocol === 'https:' ? 'wss' : 'ws')}://${host}/audio`;
        this.resetBuffers();

        let requestId = null;
        try {
            requestId = await connectionManager.requestConnection('audio');
            
            await new Promise((resolve, reject) => {
                try {
                    this.ws = new WebSocket(this.url);
                } catch (err) {
                    connectionManager.reportHandshakeFailure(requestId);
                    reject(err);
                    return;
                }
                this.ws.binaryType = 'arraybuffer';
                connectionManager.trackConnection(this.ws, requestId);

                this.ws.onopen = () => {
                    this.isConnecting = false;
                    this.connected = true;
                    this.emit('status', true);
                    this.setStatus('音频已连接'); // Audio connected
                    // Resume audio if it was suspended
                    // 如果音频已挂起，则恢复音频
                    if (this.audioCtx?.state === 'suspended') this.audioCtx.resume();
                    this.startHeartbeat();
                    resolve();
                };

                this.ws.onclose = (e) => {
                    this.isConnecting = false;
                    this.stopHeartbeat();
                    if (!this.connected) {
                         reject(new Error(`Audio WebSocket closed during handshake: ${e.code}`));
                    }
                    this.connected = false;
                    this.emit('status', false);
                    this.setStatus('音频未连接'); // Audio disconnected
                    
                    if (e.code === 1007) {
                        console.error('[Critical] Audio WebSocket disconnected due to invalid UTF-8.');
                        this.setStatus('音频协议错误'); // Audio protocol error
                    }
                };

                this.ws.onerror = () => {
                    this.isConnecting = false;
                    this.emit('status', false);
                    this.setStatus('音频连接错误'); // Audio connection error
                };

                this.ws.onmessage = (evt) => {
                    const buf = evt.data; // ArrayBuffer
                    if (!(buf instanceof ArrayBuffer)) return;
                    this._ingestPCM16(buf);
                    this._maybeSchedule();
                };
            });
            
        } catch (e) {
            this.isConnecting = false;
            console.error('[AudioPlayer] Connection failed:', e);
            // Ensure slot is released if it wasn't already
            // If handshake failed, connectionManager.reportHandshakeFailure() should have been called?
            // If we caught an error from requestConnection, it didn't reserve.
            // If we caught from new WebSocket, we called reportHandshakeFailure.
            // If we caught from Promise reject (onclose/onerror), trackConnection was called, so slot is released by onclose logic in connectionManager.
            // BUT, if reject happened, we might need to be sure.
            // The connectionManager monitors 'close', so if the socket closed, it released.
            
            this.emit('status', false);
            this.setStatus('音频连接受限'); // Audio connection restricted
            throw e;
        }
    }

    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                try {
                    this.ws.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
                } catch (e) {
                    console.warn('[AudioPlayer] Heartbeat failed', e);
                }
            }
        }, this.heartbeatInterval);
    }

    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    disconnect() {
        this.stopHeartbeat();
        if (this.ws) {
            try { this.ws.close(); } catch {}
            this.ws = null;
        }
        this.connected = false;
        // Stop scheduling and clear buffers
        // 停止调度并清除缓冲区
        this.resetBuffers();
        // Optionally pause audio to save CPU
        // 可选：暂停音频以节省 CPU
        if (this.audioCtx?.state === 'running') this.audioCtx.suspend();
        this.setStatus('音频未连接'); // Audio disconnected
        this.emit('status', false);
    }

    resetBuffers() {
        // stop periodic tick if any
        // 停止定期 tick (如果有)
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
        // Local mute buffer also cleared
        this.audioQueueBuffer = [];
    }

    _ingestPCM16(arrayBuffer) {
        // 触发PCM事件供转录器使用
        // Trigger PCM event for transcriber
        this.emit('pcm', arrayBuffer);

        // 录音收集
        // Recording collection
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
        // 延迟控制: 如果排队过多，丢弃最早的数据至 ~targetLeadSec (api3.0 优化)
        const queuedSec = this.queuedSamples / this.inputSampleRate;
        if (queuedSec > this.maxBufferSec) {
            const targetSamples = Math.floor(this.targetLeadSec * this.inputSampleRate);
            // Drop enough from head
            // 从头部丢弃足够的数据
            let toDrop = (this.queuedSamples + f32.length) - targetSamples;
            while (toDrop > 0 && this.chunkQueue.length) {
                const c = this.chunkQueue[0];
                if (c.length <= toDrop) {
                    this.chunkQueue.shift();
                    this.queuedSamples -= c.length;
                    toDrop -= c.length;
                } else {
                    // Trim head of first chunk
                    // 修剪第一个块的头部
                    const remain = c.length - toDrop;
                    const trimmed = c.subarray(c.length - remain);
                    this.chunkQueue[0] = trimmed;
                    this.queuedSamples -= toDrop;
                    toDrop = 0;
                }
            }
        }

        // 本地静音逻辑 (500ms 延迟)
        // Local mute logic (500ms delay)
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
        // Buffering logic (api3.0 optimization)
        if (this.buffering) {
            if (queuedSec >= this.minStartBufferSec) {
                this.buffering = false;
                this.started = true;
                this.setStatus('播放中'); // Playing
            } else {
                // Not enough yet for the very first start
                // 第一次启动时数据不足
                this.setStatus('缓冲中...'); // Buffering...
                return;
            }
        }

        // Schedule ahead to maintain target lead time (api3.0 优化)
        // 提前调度以维持目标提前时间 (api3.0 优化)
        while ((this.scheduledEndTime - now) < this.targetLeadSec && this.chunkQueue.length) {
            const chunk = this.chunkQueue.shift();
            this.queuedSamples -= chunk.length;

            const buffer = this.audioCtx.createBuffer(1, chunk.length, this.inputSampleRate);
            buffer.copyToChannel(chunk, 0, 0);

            const src = this.audioCtx.createBufferSource();
            src.buffer = buffer;
            // Route each source into processing chain entry (shared), or analyser if chain missing
            // 将每个源路由到处理链入口 (共享)，如果缺少链则路由到分析器
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
        // If we've started and currently have no available data, do not go back to buffering state; wait for new data and keep "Playing" state
        if (this.started && !this.buffering) {
            this.setStatus('播放中'); // Playing
        }

        // Keep a light scheduling tick while connected
        // 连接时保持轻量级调度 tick
        if (this.connected) {
            clearTimeout(this._tickTimer);
            this._tickTimer = setTimeout(() => this._maybeSchedule(), 60);
        }
    }

    processAudioQueueBuffer() {
        const now = Date.now();
        // 处理缓冲区
        // Process buffer
        while(this.audioQueueBuffer.length > 0) {
            // 检查最早的包
            // Check the earliest packet
            if (now - this.audioQueueBuffer[0].ts >= 500) {
                const item = this.audioQueueBuffer.shift();
                // 判定是否为本地发射 (根据延迟后的时刻判定)
                // Determine if it is local transmission (based on delayed time)
                // 若当前状态为本地发射，则丢弃该包
                // If current state is local transmission, discard this packet
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
        // 如果缓冲区不为空，继续检查
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
        // Calculate total length
        const totalLen = this.recordedChunks.reduce((acc, c) => acc + c.byteLength, 0);
        const buffer = new Uint8Array(totalLen);
        let offset = 0;
        for (const chunk of this.recordedChunks) {
            buffer.set(new Uint8Array(chunk), offset);
            offset += chunk.byteLength;
        }

        // 创建 WAV 头
        // Create WAV header
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
