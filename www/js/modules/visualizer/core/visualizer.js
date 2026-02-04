import { SpectrumRenderer } from '../renderers/spectrum.js';
import { MirrorRenderer } from '../renderers/mirror.js';
import { WaveformRenderer } from '../renderers/waveform.js';
import { OscilloscopeRenderer } from '../renderers/oscilloscope.js';
import { RadialRenderer } from '../renderers/radial.js';
import { SolarSystemRenderer } from '../renderers/solar-system/renderer.js';
import { ParticlesRenderer } from '../renderers/particles/renderer.js';

/**
 * Main Visualizer Engine Class
 * 主可视化引擎类
 * Responsible for canvas management, audio analyser, renderer switching, and interaction
 * 负责管理画布、音频分析器、渲染器切换及交互
 */
export class Visualizer {
    /**
     * @param {HTMLCanvasElement} canvas The canvas element 画布元素
     * @param {AnalyserNode} analyser Audio analyser node 音频分析器节点
     */
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
        
        // Expose instance to global scope for console interaction
        // 将实例暴露到全局作用域以便控制台交互
        window.fmoVisualizer = this;
        // Global helper for user convenience
        // 用户便捷操作的全局辅助函数
        window.generateFighterFormation = (count) => this.createFighterFormation(count);
        
        // Console Command: test=n to trigger performance test
        // 控制台指令：test=n 触发性能测试
        Object.defineProperty(window, 'test', {
            set: (value) => {
                const count = parseInt(value);
                if (!isNaN(count)) {
                    console.log(`Test Mode: Generating ${count} Fighters`);
                    this.createFighterFormation(count);
                    
                    const particlesRenderer = this.renderers[6];
                    if (particlesRenderer) {
                        // If n < 10, set zoom to 1/5 of default (0.5 * 0.2 = 0.1)
                        // Otherwise restore default zoom 0.5
                        // 如果 n < 10，设置缩放为默认值的 1/5 (0.5 * 0.2 = 0.1)
                        // 否则恢复默认缩放 0.5
                        particlesRenderer.zoom = count < 10 ? 0.1 : 0.5;
                    }
                } else if (value === 'on') {
                    console.log('Performance Test Mode Activated via test=on (5 Fighters - Triangle Formation)');
                    this.createFighterFormation(5);
                    // Legacy 'on' maintains default zoom unless specified otherwise, 
                    // but for consistency with n<10 rule (5<10), let's strictly follow "test=n" rule for numbers.
                    // If user types 'on', we assume they want the demo.
                    // 遗留的 'on' 指令保持默认缩放，除非另有指定，
                    // 但为了与 n<10 规则 (5<10) 保持一致，我们将严格遵循 "test=n" 的数字规则。
                    // 如果用户输入 'on'，我们假设他们想要演示。
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

        // Initialize all renderers
        // 初始化所有渲染器
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
        
        // Interaction state tracking
        // 交互状态追踪
        this.inputState = { x: 0, y: 0, active: false };

        // Camera interaction state for Solar System mode
        // 太阳系模式的相机交互状态
        this.cameraState = {
            isDragging: false,
            isMultiTouch: false,
            lastMouseX: 0,
            lastMouseY: 0,
            lastTouchX: 0,
            lastTouchY: 0,
            lastTouch0X: 0,
            lastTouch0Y: 0,
            lastTouch1X: 0,
            lastTouch1Y: 0,
            initialPinchDistance: 0,
            initialPinchZoom: 1.0
        };

        // Store event handler references for proper cleanup
        // 保存事件处理器引用以便正确清理
        this.eventHandlers = {};

        // Listen for mouse/touch movement
        // 监听鼠标/触摸移动
        const updateInput = (x, y) => {
            const rect = this.canvas.getBoundingClientRect();
            this.inputState.x = (x - rect.left) * window.devicePixelRatio;
            this.inputState.y = (y - rect.top) * window.devicePixelRatio;
            this.inputState.active = true;
        };

        // Mouse move handler
        // 鼠标移动处理器
        this.eventHandlers.mousemove = (e) => {
            updateInput(e.clientX, e.clientY);

            // Handle camera 720° rotation for Solar System mode
            // 处理太阳系模式的相机720°旋转
            if (this.mode === 0 && this.cameraState.isDragging) {
                const dx = e.clientX - this.cameraState.lastMouseX;
                const dy = e.clientY - this.cameraState.lastMouseY;
                const solarRenderer = this.renderers[0];
                console.log('[Visualizer] mousemove isDragging:', this.cameraState.isDragging, 'dx:', dx, 'dy:', dy);
                console.log('[Visualizer] solarRenderer:', solarRenderer.constructor.name, 'has rotateCamera:', typeof solarRenderer.rotateCamera);
                if (solarRenderer && typeof solarRenderer.rotateCamera === 'function') {
                    // dx -> pan (Y-axis rotation), dy -> tilt (X-axis rotation)
                    // dx -> 平移（Y轴旋转），dy -> 俯仰（X轴旋转）
                    const panDelta = dx * 0.01; // 0.01 radians per pixel
                    const tiltDelta = dy * 0.01; // 0.01 radians per pixel
                    console.log('[Visualizer] calling rotateCamera:', panDelta, tiltDelta);
                    solarRenderer.rotateCamera(panDelta, tiltDelta);
                    console.log('[Visualizer] rotateCamera called, targetPan:', solarRenderer.camera.targetPan);
                }
                this.cameraState.lastMouseX = e.clientX;
                this.cameraState.lastMouseY = e.clientY;
            }
        };

        this.eventHandlers.touchmove = (e) => {
            // Update input state for hover detection (single touch only)
            // 更新输入状态用于悬停检测（仅单指）
            if (e.touches.length > 0) {
                updateInput(e.touches[0].clientX, e.touches[0].clientY);
            }

            // Handle two-finger pinch zoom for Solar System mode
            // 处理太阳系模式的双指捏合缩放
            if (this.mode === 0 && e.touches.length === 2) {
                e.preventDefault();

                const solarRenderer = this.renderers[0];
                const camera = solarRenderer ? solarRenderer.getCameraState() : null;

                if (camera) {
                    // Calculate pinch zoom
                    // 计算捏合缩放
                    const dxTouches = e.touches[0].clientX - e.touches[1].clientX;
                    const dyTouches = e.touches[0].clientY - e.touches[1].clientY;
                    const currentDistance = Math.sqrt(dxTouches * dxTouches + dyTouches * dyTouches);

                    if (this.cameraState.initialPinchDistance > 0) {
                        const zoomRatio = currentDistance / this.cameraState.initialPinchDistance;
                        const newZoom = this.cameraState.initialPinchZoom * zoomRatio;
                        solarRenderer.setZoom(newZoom);
                    }

                     // Calculate two-finger center movement for rotation
                     // 计算双指中心点移动用于旋转
                     const cx1 = (this.cameraState.lastTouch0X + this.cameraState.lastTouch1X) / 2;
                     const cy1 = (this.cameraState.lastTouch0Y + this.cameraState.lastTouch1Y) / 2;
                    const cx2 = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                    const cy2 = (e.touches[0].clientY + e.touches[1].clientY) / 2;

                    const dx = cx2 - cx1;
                    const dy = cy2 - cy1;

                    // 720° rotation: dx -> pan, dy -> tilt
                    // 720°旋转：dx -> 平移，dy -> 俯仰
                    const panDelta = dx * 0.01; // 0.01 radians per pixel
                    const tiltDelta = dy * 0.01; // 0.01 radians per pixel

                    if (solarRenderer && typeof solarRenderer.rotateCamera === 'function') {
                        solarRenderer.rotateCamera(panDelta, tiltDelta);
                    }

                    // Update last touch positions
                    // 更新最后的触摸位置
                    this.cameraState.lastTouch0X = e.touches[0].clientX;
                    this.cameraState.lastTouch0Y = e.touches[0].clientY;
                    this.cameraState.lastTouch1X = e.touches[1].clientX;
                    this.cameraState.lastTouch1Y = e.touches[1].clientY;
                    this.cameraState.lastTouchX = e.touches[0].clientX;
                    this.cameraState.lastTouchY = e.touches[0].clientY;
                    this.cameraState.lastMouseX = e.touches[0].clientX;
                    this.cameraState.lastMouseY = e.touches[0].clientY;
                }
            }
        };

        // Mouse wheel zoom handler
        // 鼠标滚轮缩放处理器
        this.eventHandlers.wheel = (e) => {
            e.preventDefault();

            if (this.mode !== 0) return;

            const solarRenderer = this.renderers[0];
            const camera = solarRenderer ? solarRenderer.getCameraState() : null;

            if (camera) {
                // Zoom factor: scroll 100 pixels = 10% zoom change
                // 缩放因子：滚动 100 像素 = 10% 缩放变化
                const zoomFactor = 1 + (e.deltaY / -1000);
                const newZoom = camera.targetZoom * zoomFactor;
                solarRenderer.setZoom(newZoom);
            }
        };

        // Mouse down handler for dragging
        // 鼠标按下处理器用于拖动
        this.eventHandlers.mousedown = (e) => {
            console.log('[Visualizer] mousedown, mode:', this.mode);
            if (this.mode !== 0) return;

            this.cameraState.isDragging = true;
            this.cameraState.lastMouseX = e.clientX;
            this.cameraState.lastMouseY = e.clientY;
            this.canvas.style.cursor = 'grabbing';
            console.log('[Visualizer] mousedown isDragging:', this.cameraState.isDragging);
        };

        // Mouse up handler
        // 鼠标释放处理器
        this.eventHandlers.mouseup = () => {
            this.cameraState.isDragging = false;
            this.canvas.style.cursor = 'default';
        };

        // Mouse leave handler
        // 鼠标离开处理器
        this.eventHandlers.mouseleave = () => {
            this.inputState.active = false;
            this.cameraState.isDragging = false;
            this.canvas.style.cursor = 'default';
        };

        // Touch start handler
        // 触摸开始处理器
        this.eventHandlers.touchstart = (e) => {
            if (this.mode !== 0) return;

            if (e.touches.length === 2) {
                // Two-finger pinch and pan
                // 双指捏合和平移
                this.cameraState.isMultiTouch = true;
                this.cameraState.isDragging = true;

                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                this.cameraState.initialPinchDistance = Math.sqrt(dx * dx + dy * dy);

                const solarRenderer = this.renderers[0];
                const camera = solarRenderer ? solarRenderer.getCameraState() : null;
                if (camera) {
                    this.cameraState.initialPinchZoom = camera.targetZoom;
                }

                // Save both touch positions for center calculation
                // 保存两个触摸点的位置用于计算中心点
                this.cameraState.lastTouch0X = e.touches[0].clientX;
                this.cameraState.lastTouch0Y = e.touches[0].clientY;
                this.cameraState.lastTouch1X = e.touches[1].clientX;
                this.cameraState.lastTouch1Y = e.touches[1].clientY;
                this.cameraState.lastTouchX = e.touches[0].clientX;
                this.cameraState.lastTouchY = e.touches[0].clientY;
                this.cameraState.lastMouseX = e.touches[0].clientX;
                this.cameraState.lastMouseY = e.touches[0].clientY;
            }
        };

        // Touch end handler
        // 触摸结束处理器
        this.eventHandlers.touchend = (e) => {
            if (e.touches.length < 2) {
                this.cameraState.isMultiTouch = false;
                this.cameraState.isDragging = false;
                this.cameraState.initialPinchDistance = 0;
                this.canvas.style.cursor = 'default';
            }

            if (e.touches.length === 0) {
                this.inputState.active = false;
            }
        };

        // Double click handler for reset and toggle orbits
        // 双击处理器用于重置视图和切换轨道线
        this.eventHandlers.dblclick = (e) => {
            if (this.mode !== 0) return;

            const solarRenderer = this.renderers[0];
            if (solarRenderer && typeof solarRenderer.resetCamera === 'function') {
                solarRenderer.resetCamera();
            }
            if (solarRenderer && typeof solarRenderer.toggleOrbits === 'function') {
                solarRenderer.toggleOrbits();
            }
        };
        // Keyboard handler for orbit toggle (O key)
        // 键盘处理器用于切换轨道线（按 O 键）
        this.eventHandlers.keydown = (e) => {
            if (this.mode !== 0) return;
            if (e.key.toLowerCase() === 'o') {
                e.preventDefault();
                const solarRenderer = this.renderers[0];
                if (solarRenderer && typeof solarRenderer.toggleOrbits === 'function') {
                    solarRenderer.toggleOrbits();
                }
            }
        };

        // Attach event listeners
        // 附加事件监听器
        this.canvas.addEventListener('mousemove', this.eventHandlers.mousemove);
        this.canvas.addEventListener('touchmove', this.eventHandlers.touchmove, { passive: false });
        this.canvas.addEventListener('wheel', this.eventHandlers.wheel, { passive: false });
        this.canvas.addEventListener('mousedown', this.eventHandlers.mousedown);
        this.canvas.addEventListener('mouseup', this.eventHandlers.mouseup);
        this.canvas.addEventListener('mouseleave', this.eventHandlers.mouseleave);
        this.canvas.addEventListener('touchstart', this.eventHandlers.touchstart, { passive: false });
        this.canvas.addEventListener('touchend', this.eventHandlers.touchend);
        this.canvas.addEventListener('dblclick', this.eventHandlers.dblclick);

        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.canvas);
    }

    updateThemeColors() {
        const styles = getComputedStyle(document.body);
        this.colorTheme = styles.getPropertyValue('--accent-cyan').trim() || '#00f3ff';
        this.colorSecondary = styles.getPropertyValue('--accent-magenta').trim() || '#ff00ff';
    }

    /**
     * Handle window resize events
     * 处理窗口调整大小事件
     */
    resize() {
        this.canvas.width = this.canvas.clientWidth * window.devicePixelRatio;
        this.canvas.height = this.canvas.clientHeight * window.devicePixelRatio;
        this.renderers.forEach(r => r.resize(this.canvas.width, this.canvas.height));
    }

    /**
     * Update audio analyser
     * 更新音频分析器
     */
    setAnalyser(analyser) { this.analyser = analyser; this.freqData = null; }

    /**
     * Set current callsign for display
     * 设置当前显示的呼号
     */
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
     * Switch to next visualization mode
     * 切换到下一个可视化模式
     */
    switchMode() {
        this.mode = (this.mode + 1) % this.modes.length;
        return this.modes[this.mode];
    }

    /**
     * Trigger formation generation in Particles Renderer
     * 在粒子渲染器中触发编队生成
     * @param {number} count Number of fighters 战机数量
     */
    createFighterFormation(count = 25) {
        // ParticlesRenderer is at index 6
        // 粒子渲染器在索引 6
        const particlesRenderer = this.renderers[6];
        if (particlesRenderer && typeof particlesRenderer.createFormation === 'function') {
            particlesRenderer.createFormation(count);
            // Auto-switch to particles mode
            // 自动切换到粒子模式
            this.mode = 6; 
            console.log(`Formation created with ${count} fighters. Switched to PARTICLES mode.`);
        } else {
            console.error('ParticlesRenderer not found or invalid.');
        }
    }

    triggerUFO() {
        // Trigger UFO on SolarSystemRenderer (index 0)
        // 在太阳系渲染器（索引 0）上触发 UFO
        const solarRenderer = this.renderers[0];
        if (solarRenderer && typeof solarRenderer.triggerUFO === 'function') {
            solarRenderer.triggerUFO();
        }
    }

    /**
     * Start the animation loop
     * 启动动画循环
     */
    start() {
        if (this.running) return;
        this.running = true;
        this.loop();
    }

    /**
     * Main animation loop
     * 主动画循环
     */
    loop() {
        if (!this.running) return;
        requestAnimationFrame(() => this.loop());
        
        const now = Date.now();
        const dt = (now - (this.lastLoopTime || now)) / 1000;
        this.lastLoopTime = now;
        
        // Handle callsign fading
        // 处理呼号淡入淡出
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
        // 如果缺少真正的分析器，使用虚拟分析器，以确保渲染（特别是呼号）继续
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
        // 注意：渲染器通常自己调用 getByteFrequencyData，所以我们传递 effectiveAnalyser
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

    /**
     * Clean up resources
     * 清理资源
     */
    destroy() {
        this.running = false;
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }

        // Remove event listeners
        // 移除事件监听器
        if (this.canvas && this.eventHandlers) {
            if (this.eventHandlers.mousemove) this.canvas.removeEventListener('mousemove', this.eventHandlers.mousemove);
            if (this.eventHandlers.touchmove) this.canvas.removeEventListener('touchmove', this.eventHandlers.touchmove);
            if (this.eventHandlers.wheel) this.canvas.removeEventListener('wheel', this.eventHandlers.wheel);
            if (this.eventHandlers.mousedown) this.canvas.removeEventListener('mousedown', this.eventHandlers.mousedown);
            if (this.eventHandlers.mouseup) this.canvas.removeEventListener('mouseup', this.eventHandlers.mouseup);
            if (this.eventHandlers.mouseleave) this.canvas.removeEventListener('mouseleave', this.eventHandlers.mouseleave);
            if (this.eventHandlers.touchstart) this.canvas.removeEventListener('touchstart', this.eventHandlers.touchstart);
            if (this.eventHandlers.touchend) this.canvas.removeEventListener('touchend', this.eventHandlers.touchend);
            if (this.eventHandlers.dblclick) this.canvas.removeEventListener('dblclick', this.eventHandlers.dblclick);
        }

        // Clean up renderers
        // 清理渲染器
        this.renderers = null;
        // Clean up references
        // 清理引用
        this.canvas = null;
        this.ctx = null;
        this.analyser = null;
        this.freqData = null;
        this.eventHandlers = null;
    }
}
