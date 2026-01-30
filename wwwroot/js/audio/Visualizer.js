import { EventEmitter } from '../core/EventEmitter.js';
import { SpectrumRenderer } from './renderers/SpectrumRenderer.js';
import { MirrorRenderer } from './renderers/MirrorRenderer.js';
import { WaveformRenderer } from './renderers/WaveformRenderer.js';
import { OscilloscopeRenderer } from './renderers/OscilloscopeRenderer.js';
import { RadialRenderer } from './renderers/RadialRenderer.js';
import { ParticlesRenderer } from './renderers/ParticlesRenderer.js';
import { SolarSystemRenderer } from './renderers/SolarSystemRenderer.js';

export class Visualizer extends EventEmitter {
    constructor(canvas, analyser) {
        super();
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
        
        this.inputState = { x: 0, y: 0, active: false };
        
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

    setAnalyser(analyser) { 
        this.analyser = analyser; 
        this.freqData = null; 
    }

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

    destroy() {
        this.running = false;
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        this.renderers = null;
        this.canvas = null;
        this.ctx = null;
        this.analyser = null;
        this.freqData = null;
    }
}
