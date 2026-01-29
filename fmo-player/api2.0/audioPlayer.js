// Lightweight 8kHz PCM audio streaming player with buffering and scheduling
// Assumptions:
// - WebSocket endpoint provides raw 16-bit PCM (LE), mono, 8000 Hz
// - Endpoint path: ws://<host>/audio
// - We resample implicitly via WebAudio by creating buffers with sampleRate 8000
// - Minimizes copies via chunk queue; adaptive buffering & simple latency control

export class AudioStreamPlayer {
  constructor({ url = `ws://${window.location.host}/audio`, inputSampleRate = 8000 } = {}) {
  //constructor({ url = `ws://192.168.1.9/audio`, inputSampleRate = 8000 } = {}) {
      this.url = url;
    this.inputSampleRate = inputSampleRate;

    // WebAudio
    this.audioCtx = null;
  this.gainNode = null;
  this.analyser = null;
  this._raf = 0;
  this._fftCanvas = null;
  this._fftCtx = null;
  this._freqBuf = null;

    // WS
    this.ws = null;
    this.connected = false;

    // Buffering & scheduling
    this.chunkQueue = []; // Array<Float32Array>
    this.queuedSamples = 0;
    this.scheduledEndTime = 0; // in audioCtx time
    this.buffering = true;
  this.started = false; // once playback started, don't re-enter buffering

    // Tunables
  this.minStartBufferSec = 0.1;   // require at least this to start
  this.lowBufferSec = 0.3;        // legacy: kept for compat, no rebuffering once started
    this.targetLeadSec = 0.5;       // try to keep this much scheduled ahead
    this.maxBufferSec = 1.0;        // if queue exceeds this, drop oldest to reduce latency

    // State callbacks
    this.onStatus = null; // (statusText) => void
  }

  setStatus(text) {
    if (this.onStatus) this.onStatus(text);
  }

  ensureAudio() {
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
  // We'll feed the analyser from our processing chain
  this.analyser.connect(this.gainNode);
  this.gainNode.connect(this.audioCtx.destination);

  // Build processing chain (head): source -> _chainInput -> HPF -> LPF -> EQ(Low,Mid,High) -> Compressor -> analyser
  // Create once and reuse for all scheduled chunks
  if (!this._chainInput) {
    // Unified entry for all sources
    this._chainInput = this.audioCtx.createGain();
    this._chainInput.gain.value = 1.0;

  // High-pass to remove DC/rumble (walkie‑talkie voice)
    this.hpf = this.audioCtx.createBiquadFilter();
    this.hpf.type = 'highpass';
  this.hpf.frequency.value = 220; // slightly lower for more body/warmth
  this.hpf.Q.value = 0.5; // gentler slope to avoid plastic/boxy feel

  // Low-pass to tame hiss/sibilance given 8 kHz sampling (Nyquist 4 kHz)
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

    // Gentle compression to increase loudness consistency
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

  setVolume(v) {
    if (this.gainNode) this.gainNode.gain.value = Number(v) || 0;
  }

  connect() {
    if (this.ws && (this.connected || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.ensureAudio();
    this.resetBuffers();

    this.ws = new WebSocket(this.url);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      this.connected = true;
      this.setStatus('音频已连接');
      // Resume audio if it was suspended
      if (this.audioCtx?.state === 'suspended') this.audioCtx.resume();
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.setStatus('音频未连接');
    };

    this.ws.onerror = () => {
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
  }

  _ingestPCM16(arrayBuffer) {
    const view = new Int16Array(arrayBuffer);
    // Convert to Float32 [-1,1]
    const f32 = new Float32Array(view.length);
    for (let i = 0; i < view.length; i++) {
      f32[i] = view[i] / 32768;
    }

    // Latency control: if too much queued, drop oldest to ~targetLeadSec
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
          // Trim the head of the first chunk
          const remain = c.length - toDrop;
          const trimmed = c.subarray(c.length - remain);
          this.chunkQueue[0] = trimmed;
          this.queuedSamples -= toDrop;
          toDrop = 0;
        }
      }
    }

    this.chunkQueue.push(f32);
    this.queuedSamples += f32.length;
  }

  _maybeSchedule() {
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    if (this.scheduledEndTime < now) this.scheduledEndTime = now;

    const queuedSec = this.queuedSamples / this.inputSampleRate;

    // Buffering logic
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

    // Schedule ahead to maintain target lead time
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

    // If we've started and currently没有可用数据，不要重回缓冲状态；等待新数据并保持“播放中”状态
    if (this.started && !this.buffering) {
      this.setStatus('播放中');
    }

    // Keep a light scheduling tick while connected
    if (this.connected) {
      clearTimeout(this._tickTimer);
      this._tickTimer = setTimeout(() => this._maybeSchedule(), 60);
    }
  }
}

// UI wiring
export function initAudioUI() {
  const elConnect = document.getElementById('audio-connect');
  const elDisconnect = document.getElementById('audio-disconnect');
  const elVolume = document.getElementById('audio-volume');
  const elStatus = document.getElementById('audio-status');
  const elFFT = document.getElementById('audio-fft');
  
  if (!elConnect || !elDisconnect || !elVolume) return;

  const player = new AudioStreamPlayer();
  player.onStatus = (txt) => { if (elStatus) elStatus.textContent = txt; };
  if (elFFT) player.attachFFTCanvas?.(elFFT);

  elConnect.addEventListener('click', () => {
    player.connect();
  });
  elDisconnect.addEventListener('click', () => {
    player.disconnect();
  });
  elVolume.addEventListener('input', (e) => {
    player.setVolume(e.target.value);
  });
}

// Attach methods to prototype without breaking existing exports
AudioStreamPlayer.prototype.attachFFTCanvas = function(canvas){
  this._fftCanvas = canvas || null;
  this._fftCtx = this._fftCanvas ? this._fftCanvas.getContext('2d') : null;
  this._freqBuf = this.analyser ? new Uint8Array(this.analyser.frequencyBinCount) : null;

  const resize = () => {
    if (!this._fftCanvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = Math.floor(this._fftCanvas.clientWidth * dpr) || 300;
    const h = Math.floor(this._fftCanvas.clientHeight * dpr) || 100;
    if (this._fftCanvas.width !== w || this._fftCanvas.height !== h){
      this._fftCanvas.width = w; this._fftCanvas.height = h;
    }
  };
  const draw = () => {
    if (!this._fftCanvas || !this._fftCtx) return;
    resize();
    const ctx = this._fftCtx;
    const w = this._fftCanvas.width;
    const h = this._fftCanvas.height;
    // background
    ctx.fillStyle = '#101010';
    ctx.fillRect(0, 0, w, h);
    // subtle grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let gy = 0; gy <= 4; gy++) {
      const y = Math.floor((h / 4) * gy) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    if (this.analyser) {
      if (!this._freqBuf || this._freqBuf.length !== this.analyser.frequencyBinCount) {
        this._freqBuf = new Uint8Array(this.analyser.frequencyBinCount);
      }
      this.analyser.getByteFrequencyData(this._freqBuf);
      const bins = this._freqBuf.length;
      // Draw bars across full width
      const gap = 1 * Math.max(1, Math.floor(window.devicePixelRatio || 1));
      const barW = Math.max(1, Math.floor((w - bins*gap) / bins));
      const grad = ctx.createLinearGradient(0, h, 0, 0);
      grad.addColorStop(0, '#5a3a00');
      grad.addColorStop(1, '#FF8800');
      let x = 0;
      for (let i = 0; i < bins; i++) {
        const v = this._freqBuf[i] / 255; // 0..1
        const barH = Math.max(1, Math.floor(v * (h - 2)));
        // Use gradient for bars
        ctx.fillStyle = grad;
        ctx.fillRect(x, h - barH, barW, barH);
        x += barW + gap;
        if (x > w) break;
      }
    }
    this._raf = window.requestAnimationFrame(draw);
  };

  // Start loop
  if (this._raf) cancelAnimationFrame(this._raf);
  this._raf = window.requestAnimationFrame(draw);

  // Handle resize
  this._onResizeFFT && window.removeEventListener('resize', this._onResizeFFT);
  this._onResizeFFT = () => { resize(); };
  window.addEventListener('resize', this._onResizeFFT);
};

AudioStreamPlayer.prototype.detachFFTCanvas = function(){
  if (this._raf) cancelAnimationFrame(this._raf);
  this._raf = 0;
  if (this._onResizeFFT) window.removeEventListener('resize', this._onResizeFFT);
  this._onResizeFFT = null;
  // Clear the canvas
  if (this._fftCanvas && this._fftCtx){
    const w = this._fftCanvas.width, h = this._fftCanvas.height;
    this._fftCtx.clearRect(0, 0, w, h);
  }
};
