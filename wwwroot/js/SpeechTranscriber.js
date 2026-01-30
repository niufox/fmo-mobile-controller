import { EventEmitter } from './core/EventEmitter.js';

export class SpeechTranscriber extends EventEmitter {
    constructor() {
        super();
        
        this.apiKey = localStorage.getItem('transcriber_apiKey') || 'sk-lickpcbkftopqzyemjqdtgggkcdcsafwpjeameotbtuqklao';
        this.apiUrl = 'https://api.siliconflow.cn/v1/audio/transcriptions';
        this.modelName = 'TeleAI/TeleSpeechASR';
        
        this.sampleRate = 8000;
        this.bitsPerSample = 16;
        this.numChannels = 1;
        
        this.CALLSIGN_END_DELAY_MS = 2000;
        this.MAX_CALLSIGN_DURATION_MS = 60000;
        this.lastCallsignTime = null;
        this.callsignStartTime = null;
        this.currentCallsign = null;
        this.callsignSegmentEndTimer = null;
        this.callsignMaxDurationTimer = null;
        
        this.enabled = false;
        this.pcmBuffer = new Uint8Array(0);
        this.transcriptionQueue = [];
        this.isProcessing = false;
        this.currentRetry = 0;
        this.maxRetries = 3;
        
        this.statusDot = null;
        this.statusText = null;
        this.transcriptArea = null;
        this.btnStart = null;
        this.btnStop = null;
        this.btnClear = null;
        
        this.typeWriterTimer = null;
        
        this.initUI();
    }
    
    initUI() {
        this.transcriptArea = document.getElementById('subtitle-overlay');
        this.btnStart = document.getElementById('btn-subtitle-toggle');
        
        if (!this.btnStart) return;
        
        if (!this.apiKey || this.apiKey.length < 10) {
            this.btnStart.textContent = '字幕: Key无效';
            this.btnStart.disabled = true;
            return;
        }
        
        const savedState = localStorage.getItem('transcriber_enabled');
        if (savedState === 'true') {
            setTimeout(() => this.start(), 1000);
        }
        
        this.btnStart.addEventListener('click', () => {
            if (this.enabled) {
                this.stop();
                localStorage.setItem('transcriber_enabled', 'false');
            } else {
                this.start();
                localStorage.setItem('transcriber_enabled', 'true');
            }
        });
    }
    
    onCallsignDetected(callsign) {
        if (!this.enabled) return;
        
        const now = Date.now();
        
        if (this.currentCallsign !== null && this.currentCallsign !== callsign && this.pcmBuffer.length > 0) {
            this.queueTranscription(this.pcmBuffer.slice(0), this.currentCallsign);
            this.pcmBuffer = new Uint8Array(0);
        }
        
        this.lastCallsignTime = now;
        this.callsignStartTime = now;
        this.currentCallsign = callsign;
        
        if (this.callsignSegmentEndTimer) {
            clearTimeout(this.callsignSegmentEndTimer);
        }
        
        if (this.callsignMaxDurationTimer) {
            clearTimeout(this.callsignMaxDurationTimer);
        }
        
        this.callsignSegmentEndTimer = setTimeout(() => {
            if (this.pcmBuffer.length > 0) {
                this.queueTranscription(this.pcmBuffer.slice(0), this.currentCallsign);
                this.pcmBuffer = new Uint8Array(0);
            }
            
            this.callsignSegmentEndTimer = null;
        }, this.CALLSIGN_END_DELAY_MS);
        
        this.callsignMaxDurationTimer = setTimeout(() => {
            if (this.pcmBuffer.length > 0) {
                this.queueTranscription(this.pcmBuffer.slice(0), this.currentCallsign);
                this.pcmBuffer = new Uint8Array(0);
            }
            
            if (this.callsignSegmentEndTimer) {
                clearTimeout(this.callsignSegmentEndTimer);
                this.callsignSegmentEndTimer = null;
            }
            
            this.callsignMaxDurationTimer = null;
        }, this.MAX_CALLSIGN_DURATION_MS);
    }
    
    addPCMChunk(buffer) {
        if (!this.enabled) return;
        
        const newBuffer = new Uint8Array(this.pcmBuffer.length + buffer.byteLength);
        newBuffer.set(this.pcmBuffer);
        newBuffer.set(new Uint8Array(buffer), this.pcmBuffer.length);
        this.pcmBuffer = newBuffer;
        
        const MAX_BUFFER_BYTES = this.sampleRate * 120 * (this.bitsPerSample / 8);
        if (this.pcmBuffer.length > MAX_BUFFER_BYTES) {
            this.pcmBuffer = new Uint8Array(0);
        }
    }
    
    onSpeakingEnd() {
        if (!this.enabled) return;
        if (!this.currentCallsign || this.pcmBuffer.length === 0) return;
        
        this.queueTranscription(this.pcmBuffer.slice(0), this.currentCallsign);
        this.pcmBuffer = new Uint8Array(0);
        
        if (this.callsignSegmentEndTimer) {
            clearTimeout(this.callsignSegmentEndTimer);
            this.callsignSegmentEndTimer = null;
        }
        if (this.callsignMaxDurationTimer) {
            clearTimeout(this.callsignMaxDurationTimer);
            this.callsignMaxDurationTimer = null;
        }
    }
    
    queueTranscription(pcmData, callsign) {
        const wavBlob = this.pcmToWav(pcmData);
        this.transcriptionQueue.push({ wavBlob, callsign });
        
        if (!this.isProcessing) {
            this.processQueue();
        }
    }
    
    processQueue() {
        if (this.transcriptionQueue.length === 0 || this.isProcessing) {
            return;
        }
        
        this.isProcessing = true;
        const queueItem = this.transcriptionQueue.shift();
        const wavBlob = queueItem.wavBlob || queueItem;
        const callsign = queueItem.callsign;
        this.currentRetry = 0;
        
        this.sendToAPI(wavBlob, callsign);
    }
    
    typeWriter(text) {
        if (!this.transcriptArea) return;
        
        if (this.typeWriterTimer) {
            clearTimeout(this.typeWriterTimer);
            this.typeWriterTimer = null;
        }
        
        let i = 0;
        this.transcriptArea.textContent = '';
        
        const speed = text.length > 20 ? 30 : 50;
        
        const type = () => {
            if (i < text.length) {
                this.transcriptArea.textContent += text.charAt(i);
                i++;
                this.typeWriterTimer = setTimeout(type, speed);
            } else {
                this.typeWriterTimer = null;
            }
        };
        
        type();
    }
    
    sendToAPI(wavBlob, callsign) {
        this.setStatus('processing', '识别中...');
        
        const formData = new FormData();
        formData.append('file', wavBlob, 'audio.wav');
        formData.append('model', this.modelName);
        
        fetch(this.apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(`API Error: ${response.status} - ${text}`);
                });
            }
            return response.json();
        })
        .then(data => {
            this.currentRetry = 0;
            
            if (data.text && data.text.trim()) {
                const callsignPrefix = callsign ? `[${callsign}] ` : '';
                const result = `${callsignPrefix}${data.text}`;
                
                this.typeWriter(result);
                
                this.setStatus('idle', '就绪');
            }
            
            this.isProcessing = false;
            setTimeout(() => this.processQueue(), 200);
        })
        .catch(error => {
            if (this.currentRetry < this.maxRetries) {
                this.currentRetry++;
                this.setStatus('error', `错误，重试 ${this.currentRetry}/${this.maxRetries}...`);
                setTimeout(() => this.sendToAPI(wavBlob, callsign), 1000 * this.currentRetry);
            } else {
                this.setStatus('error', '识别失败');
                this.isProcessing = false;
                
                setTimeout(() => this.processQueue(), 1000);
            }
        });
    }
    
    pcmToWav(pcmData) {
        const wavHeader = this.createWavHeader(pcmData.length, this.numChannels, this.sampleRate, this.bitsPerSample);
        return new Blob([wavHeader, pcmData], { type: 'audio/wav' });
    }
    
    createWavHeader(dataLength, numChannels, sampleRate, bitsPerSample) {
        const header = new ArrayBuffer(44);
        const view = new DataView(header);
        
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };
        
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + dataLength, true);
        writeString(8, 'WAVE');
        
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * bitsPerSample / 8, true);
        view.setUint16(32, numChannels * bitsPerSample / 8, true);
        view.setUint16(34, bitsPerSample, true);
        
        writeString(36, 'data');
        view.setUint32(40, dataLength, true);
        
        return header;
    }
    
    setStatus(state, text) {
        if (!this.btnStart) return;
        
        if (state === 'processing') {
            this.btnStart.textContent = '字幕: 识别中...';
            this.btnStart.style.color = 'var(--accent-magenta)';
        } else if (state === 'error') {
            this.btnStart.textContent = '字幕: 错误';
            this.btnStart.style.color = '#ff3333';
        } else if (this.enabled) {
            this.btnStart.textContent = '字幕: ON';
            this.btnStart.style.color = 'var(--accent-green)';
        } else {
            this.btnStart.textContent = '字幕: OFF';
            this.btnStart.style.color = '';
        }
    }
    
    start() {
        this.enabled = true;
        this.setStatus('idle', '就绪');
        
        if (this.transcriptArea) {
            this.transcriptArea.classList.add('active');
            this.transcriptArea.textContent = 'Ready ...';
        }
    }
    
    stop() {
        this.enabled = false;
        
        if (this.callsignSegmentEndTimer) {
            clearTimeout(this.callsignSegmentEndTimer);
            this.callsignSegmentEndTimer = null;
        }
        if (this.callsignMaxDurationTimer) {
            clearTimeout(this.callsignMaxDurationTimer);
            this.callsignMaxDurationTimer = null;
        }
        
        this.setStatus('idle', '已停止');
        
        if (this.transcriptArea) {
            this.transcriptArea.classList.remove('active');
        }
    }
    
    clear() {
        this.transcriptArea.textContent = '';
        this.pcmBuffer = new Uint8Array(0);
        this.transcriptionQueue = [];
        this.isProcessing = false;
        this.setStatus('idle', '已清空');
    }
    
    setAPIKey(key) {
        if (!key || key.length < 10) {
            this.setStatus('error', 'API KEY格式无效');
            return false;
        }
        this.apiKey = key;
        localStorage.setItem('transcriber_apiKey', key);
        this.setStatus('idle', '就绪');
        return true;
    }
    
    getAPIKeyStatus() {
        const keyLength = this.apiKey ? this.apiKey.length : 0;
        return {
            valid: keyLength >= 10,
            keyPrefix: this.apiKey ? this.apiKey.substring(0, 10) + '...' : 'Not set',
            message: keyLength >= 10 ? '✓ API Key已设置' : '✗ API Key无效或未设置'
        };
    }
    
    getConfig() {
        return {
            mode: 'callsign',
            apiModel: this.modelName,
            callsign: {
                endDelayMs: this.CALLSIGN_END_DELAY_MS,
                maxDurationMs: this.MAX_CALLSIGN_DURATION_MS
            }
        };
    }
}
