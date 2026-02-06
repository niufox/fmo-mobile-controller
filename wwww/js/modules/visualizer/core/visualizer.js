import { SpectrumRenderer } from '../renderers/spectrum.js';
import { MirrorRenderer } from '../renderers/mirror.js';
import { WaveformRenderer } from '../renderers/waveform.js';
import { OscilloscopeRenderer } from '../renderers/oscilloscope.js';
import { RadialRenderer } from '../renderers/radial.js';
import { SolarSystemRenderer } from '../renderers/solar-system/renderer.js';
import { FighterRenderer } from '../renderers/fighter/renderer.js';

/**
 * 主可视化引擎类
 * 负责管理画布、音频分析器、渲染器切换及交互
 */
export class Visualizer {
    /**
     * @param {HTMLCanvasElement} canvas 
     * @param {AnalyserNode} analyser 
     */
    constructor(canvas, analyser) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        // WebGL Canvas initialization
        this.webglCanvas = document.getElementById('webgl-canvas');
        if (this.webglCanvas) {
            this.webglCanvas.style.pointerEvents = 'none'; // Allow events to pass through to 2D canvas
        }
        this.analyser = analyser;
        this.freqData = null;
        this.mode = 0; 
        this.modes = ['SOLAR', 'SPECTRUM', 'MIRROR', 'WAVEFORM', 'OSCILLOSCOPE', 'RADIAL', 'FIGHTER'];
        this.running = false;
        this.currentCallsign = '';
        this.callsignState = { text: '', opacity: 0, targetOpacity: 0 };
        // Repeater Stations Data
        this.repeaterStations = [];
        this.lastLoopTime = 0;
        
        // Expose instance to global scope for console interaction
        window.fmoVisualizer = this;
        // Global helper for user convenience
        window.generateFighterFormation = (count) => this.createFighterFormation(count);
        
        // Console Command: test=n to trigger performance test
        Object.defineProperty(window, 'test', {
            set: (value) => {
                const count = parseInt(value);
                if (!isNaN(count)) {
                    console.log(`Test Mode: Generating ${count} Fighters`);
                    this.createFighterFormation(count);
                    
                    const fighterRenderer = this.renderers[6];
                    if (fighterRenderer) {
                        // If n < 10, set zoom to 1/5 of default (0.5 * 0.2 = 0.1)
                        // Otherwise restore default zoom 0.5
                        fighterRenderer.targetZoom = count < 10 ? 0.1 : 0.5;
                    }
                } else if (value === 'on') {
                    console.log('Performance Test Mode Activated via test=on (5 Fighters - Triangle Formation)');
                    this.createFighterFormation(5);
                    // Legacy 'on' maintains default zoom unless specified otherwise, 
                    // but for consistency with n<10 rule (5<10), let's strictly follow "test=n" rule for numbers.
                    // If user types 'on', we assume they want the demo. 
                }
            },
            get: () => {
                return 'Type test=n (number) to generate n fighters. (n < 10: small size)';
            },
            configurable: true
        });
        
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
            new FighterRenderer(this.ctx, this.webglCanvas)
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

        // Zoom control (Mouse Wheel)
        // 缩放控制（鼠标滚轮）
        this.canvas.addEventListener('wheel', e => {
            e.preventDefault();
            // Normalize wheel delta (Standardize direction and speed)
            // 归一化滚轮增量（标准化方向和速度）
            const delta = Math.sign(e.deltaY) * -0.1;
            this.handleZoom(delta);
        }, {passive: false});

        // Stop zoom on click
        // 点击页面停止缩放
        this.canvas.addEventListener('click', () => {
            this.stopZoom();
        });

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
        
        if (this.webglCanvas) {
            this.webglCanvas.width = this.canvas.width;
            this.webglCanvas.height = this.canvas.height;
        }

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

    /**
     * Update Repeater Stations List
     * 更新中继台站列表
     * @param {Array} stations 
     */
    updateRepeaterStations(stations) {
        if (Array.isArray(stations)) {
            this.repeaterStations = stations;
            // Optional: Log for debug
            // console.log(`[Visualizer] Updated ${stations.length} repeater stations`);
        }
    }

    switchMode() {
        this.mode = (this.mode + 1) % this.modes.length;
        this.updateCanvasVisibility();
        return this.modes[this.mode];
    }

    updateCanvasVisibility() {
        if (this.webglCanvas) {
            // Mode 6 is FIGHTER
            this.webglCanvas.style.display = (this.mode === 6) ? 'block' : 'none';
        }
    }

    /**
     * Handle Zoom Action
     * 处理缩放动作
     * @param {number} delta Zoom delta 缩放增量
     */
    handleZoom(delta) {
        const currentRenderer = this.renderers[this.mode];
        if (currentRenderer && typeof currentRenderer.adjustZoom === 'function') {
            currentRenderer.adjustZoom(delta);
        }
    }

    /**
     * Stop zoom transition
     * 停止缩放过渡
     */
    stopZoom() {
        const currentRenderer = this.renderers[this.mode];
        if (currentRenderer && typeof currentRenderer.stopZoom === 'function') {
            currentRenderer.stopZoom();
        }
    }

    /**
     * Trigger formation generation in Particles Renderer
     * @param {number} count Number of fighters
     */
    createFighterFormation(count = 25) {
        // ParticlesRenderer is at index 6
        const particlesRenderer = this.renderers[6];
        if (particlesRenderer && typeof particlesRenderer.createFormation === 'function') {
            particlesRenderer.createFormation(count);
            // Auto-switch to particles mode
            this.mode = 6; 
            this.updateCanvasVisibility();
            console.log(`Formation created with ${count} fighters. Switched to FIGHTER mode.`);
        } else {
            console.error('ParticlesRenderer not found or invalid.');
        }
    }

    triggerUFO() {
        // Trigger UFO on SolarSystemRenderer (index 0)
        const solarRenderer = this.renderers[0];
        if (solarRenderer && typeof solarRenderer.triggerUFO === 'function') {
            solarRenderer.triggerUFO();
        }
    }

    /**
     * Trigger missile launch in Particles Renderer
     * @param {string} callsign 
     */
    triggerMissileLaunch(callsign) {
        const particlesRenderer = this.renderers[6];
        if (particlesRenderer && typeof particlesRenderer.triggerLaunch === 'function') {
            particlesRenderer.triggerLaunch(callsign);
        }
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
            input: this.inputState,
            repeaterStations: this.repeaterStations
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
