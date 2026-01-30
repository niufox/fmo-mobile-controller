import { EventEmitter } from '../core/EventEmitter.js';

export class AudioPlayer extends EventEmitter {
    constructor() {
        super();
        this.audioCtx = null;
        this.ws = null;
        this.connected = false;
        this.analyser = null;
        this.gainNode = null;
        this.hpfNode = null;
        this.lpfNode = null;
        this.eqLow = null;
        this.eqMid = null;
        this.eqHigh = null;
        this.compressor = null;
        
        this.chunkQueue = [];
        this.scheduledEndTime = 0;
        this.started = false;
        this.buffering = true;
        
        this.sampleRate = 8000;
        this.targetLead = 0.5;

        this.recording = false;
        this.recordedChunks = [];
        
        this.localMuteEnabled = localStorage.getItem('fmo_local_mute') === 'true';
        this.isLocalTransmitting = false;
        this.audioQueueBuffer = [];
    }

    async ensureAudioContext() {
        if (!this.audioCtx) {
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                this.audioCtx = new AudioContext();
                
                this.analyser = this.audioCtx.createAnalyser();
                this.analyser.fftSize = 1024;
                this.analyser.smoothingTimeConstant = 0.8;
                
                this.gainNode = this.audioCtx.createGain();
                this.gainNode.gain.value = 1.0;

                this.hpfNode = this.audioCtx.createBiquadFilter();
                this.hpfNode.type = 'highpass';
                this.hpfNode.frequency.value = 300;

                this.lpfNode = this.audioCtx.createBiquadFilter();
                this.lpfNode.type = 'lowpass';
                this.lpfNode.frequency.value = 3000;
                this.lpfNode.Q.value = 0.5;

                this.eqLow = this.audioCtx.createBiquadFilter();
                this.eqLow.type = 'lowshelf';
                this.eqLow.frequency.value = 180;
                this.eqLow.gain.value = 0.5;

                this.eqMid = this.audioCtx.createBiquadFilter();
                this.eqMid.type = 'peaking';
                this.eqMid.frequency.value = 1400;
                this.eqMid.Q.value = 0.8;
                this.eqMid.gain.value = 1.0;

                this.eqHigh = this.audioCtx.createBiquadFilter();
                this.eqHigh.type = 'highshelf';
                this.eqHigh.frequency.value = 2600;
                this.eqHigh.gain.value = 0;

                this.compressor = this.audioCtx.createDynamicsCompressor();
                this.compressor.threshold.value = -22;
                this.compressor.knee.value = 24;
                this.compressor.ratio.value = 2;

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
    }

    unlock() {
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
        this.emit('pcm', buffer);

        if (this.recording) {
            this.recordedChunks.push(buffer.slice(0));
        }

        const int16 = new Int16Array(buffer);
        const float32 = new Float32Array(int16.length);
        const scale = 1.0 / 32768;
        for (let i = 0; i < int16.length; i++) {
            float32[i] = int16[i] * scale;
        }
        
        if (this.localMuteEnabled) {
            this.audioQueueBuffer.push({
                data: float32,
                ts: Date.now()
            });
            this.processAudioQueueBuffer();
        } else {
            this.chunkQueue.push(float32);
            this.schedule();
        }
    }
    
    processAudioQueueBuffer() {
        const now = Date.now();
        while(this.audioQueueBuffer.length > 0) {
            if (now - this.audioQueueBuffer[0].ts >= 500) {
                const item = this.audioQueueBuffer.shift();
                if (this.isLocalTransmitting) {
                } else {
                    this.chunkQueue.push(item.data);
                    this.schedule();
                }
            } else {
                break;
            }
        }
        
        if (this.audioQueueBuffer.length > 0) {
            setTimeout(() => this.processAudioQueueBuffer(), 50);
        }
    }

    setLocalMute(enabled) {
        this.localMuteEnabled = enabled;
        localStorage.setItem('fmo_local_mute', enabled);
        if (!enabled) {
            this.audioQueueBuffer = [];
        }
    }
    
    setLocalTransmission(isLocal) {
        this.isLocalTransmitting = isLocal;
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
        const totalLen = this.recordedChunks.reduce((acc, c) => acc + c.byteLength, 0);
        const buffer = new Uint8Array(totalLen);
        let offset = 0;
        for (const chunk of this.recordedChunks) {
            buffer.set(new Uint8Array(chunk), offset);
            offset += chunk.byteLength;
        }
        
        const wavHeader = this.createWavHeader(totalLen, 1, this.sampleRate, 16);
        return new Blob([wavHeader, buffer], { type: 'audio/wav' });
    }

    createWavHeader(dataLength, numChannels, sampleRate, bitsPerSample) {
        const header = new ArrayBuffer(44);
        const view = new DataView(header);
        
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataLength, true);
        this.writeString(view, 8, 'WAVE');
        
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * bitsPerSample / 8, true);
        view.setUint16(32, numChannels * bitsPerSample / 8, true);
        view.setUint16(34, bitsPerSample, true);
        
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
        
        if (this.audioCtx.state === 'suspended') return;

        const now = this.audioCtx.currentTime;
        if (this.scheduledEndTime < now) this.scheduledEndTime = now;

        if (this.buffering) {
            const totalSamples = this.chunkQueue.reduce((acc, c) => acc + c.length, 0);
            if (totalSamples / this.sampleRate > 0.5) {
                this.buffering = false;
                this.started = true;
            } else {
                return;
            }
        }

        if (this.scheduledEndTime < now) {
            this.scheduledEndTime = now + 0.01;
        }
        
        const latency = this.scheduledEndTime - now;
        if (latency > 1.0) {
            console.log(`Latency too high (${latency.toFixed(3)}s), skipping packets...`);
            this.chunkQueue = [];
            this.scheduledEndTime = now + 0.05;
            return;
        }

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
