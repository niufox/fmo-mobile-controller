/**
 * @fileoverview Particles Renderer Module (Space Fighters + Background Particles)
 * 粒子渲染器模块（太空战机 + 背景粒子）
 */

import { BaseRenderer } from '../../core/base-renderer.js';
import { SpaceFighter } from './fighter.js';

/**
 * Particles Renderer
 * 粒子渲染器
 * Combines background particle effects with 3D Space Fighter simulation
 * 结合背景粒子效果与 3D 太空战机模拟
 */
export class ParticlesRenderer extends BaseRenderer {
    /**
     * @param {CanvasRenderingContext2D} ctx 
     */
    constructor(ctx) {
        super(ctx);
        this.particles = [];
        this.initialized = false;
        
        // 3D Engine State
        // 3D 引擎状态
        this.rotation = { x: 0.2, y: 0, z: 0 }; 
        this.targetRotation = { x: 0.2, y: 0, z: 0 };
        this.isDragging = false;
        this.lastMouse = { x: 0, y: 0 };
        this.zoom = 0.5;
        this.squadron = [];
        this.model = null; // Legacy reference if needed // 如果需要，保留遗留引用
        
        this.init3DModel();
        this.bindInteraction();
    }

    /**
     * Handle resize
     * 处理调整大小
     * @param {number} w 
     * @param {number} h 
     */
    resize(w, h) {
        super.resize(w, h);
        if (!this.initialized) {
            this.initParticles(w, h);
            this.initialized = true;
        }
    }

    /**
     * Initialize background particles
     * 初始化背景粒子
     * @param {number} w 
     * @param {number} h 
     */
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

    /**
     * Initialize 3D Space Fighter Model
     * 初始化 3D 太空战机模型
     */
    init3DModel() {
        // High-Fidelity Sci-Fi Fighter Jet Model (Procedural)
        // 高保真科幻战斗机模型（程序生成）
        this.squadron = [];
        
        // Check for Performance Test Mode
        // Enable by setting window.test = 'on' in console
        // 检查性能测试模式
        // 通过在控制台设置 window.test = 'on' 启用
        const isTestMode = (typeof window !== 'undefined' && (window.TEST_FIGHTERS || window.test === 'on')) || false;
        
        if (isTestMode) {
             console.log('Initializing Space Fighter Test Mode: 25 Instances');
             this.createFormation(25);
        } else {
             this.createFormation(1);
        }
    }

    /**
     * Create a formation of space fighters
     * 创建太空战机编队
     * @param {number} count Number of fighters (default: 25) 战机数量（默认：25）
     */
    createFormation(count = 25) {
        this.squadron = [];
        if (count === 1) {
             this.squadron.push(new SpaceFighter(Math.random(), {x:0, y:0, z:0}));
        } else if (count === 5) {
            // Triangle / Pyramid Formation (品字形)
            //     F1 (Top/Lead)
            //  F2    F3 (Wingmen)
            // F4      F5 (Rear)
            const spreadX = 3.5;
            const spreadY = 3.0; // Y is vertical on screen, so -Y is up (if Y-up coord system) or down. 
            // In our system, x/y are on the "wall".
            // Y 在屏幕上是垂直的，所以 -Y 是向上（如果是 Y-up 坐标系）或向下。
            // 在我们的系统中，x/y 在“墙”上。
            
            // F1: Lead 长机
            this.squadron.push(new SpaceFighter(Math.random(), {x: 0, y: -spreadY * 1.5, z: 0}));
            
            // F2, F3: Middle Row 中排
            this.squadron.push(new SpaceFighter(Math.random(), {x: -spreadX * 0.8, y: 0, z: 0}));
            this.squadron.push(new SpaceFighter(Math.random(), {x: spreadX * 0.8, y: 0, z: 0}));
            
            // F4, F5: Bottom Row 底排
            this.squadron.push(new SpaceFighter(Math.random(), {x: -spreadX * 1.6, y: spreadY * 1.5, z: 0}));
            this.squadron.push(new SpaceFighter(Math.random(), {x: spreadX * 1.6, y: spreadY * 1.5, z: 0}));
            
        } else {
            // Rectangular Formation
            // 矩形编队
            const side = Math.ceil(Math.sqrt(count));
            const offset = Math.floor(side / 2);
            let created = 0;
            
            for(let x = -offset; x <= offset; x++) {
                for(let y = -offset; y <= offset; y++) {
                    if (created >= count) break;
                    this.squadron.push(new SpaceFighter(Math.random(), {x: x*3.5, y: y*3.0, z: 0}));
                    created++;
                }
            }
        }

        if (this.squadron.length > 0) {
            this.model = this.squadron[0].model; 
        }
    }

    /**
     * Bind mouse/touch interaction
     * 绑定鼠标/触摸交互
     */
    bindInteraction() {
        const canvas = this.ctx.canvas;
        if (canvas.getAttribute('data-3d-attached')) return;
        
        const startDrag = (x, y) => {
            this.isDragging = true;
            this.lastMouse = { x, y };
        };
        
        const moveDrag = (x, y) => {
            if (!this.isDragging) return;
            const dx = x - this.lastMouse.x;
            const dy = y - this.lastMouse.y;
            this.targetRotation.y += dx * 0.01;
            this.targetRotation.x += dy * 0.01;
            this.lastMouse = { x, y };
        };
        
        const endDrag = () => { this.isDragging = false; };
        
        canvas.addEventListener('mousedown', e => startDrag(e.clientX, e.clientY));
        window.addEventListener('mousemove', e => moveDrag(e.clientX, e.clientY));
        window.addEventListener('mouseup', endDrag);
        
        canvas.addEventListener('touchstart', e => {
            if (e.touches.length === 1) startDrag(e.touches[0].clientX, e.touches[0].clientY);
        }, {passive: false});
        window.addEventListener('touchmove', e => {
            if (e.touches.length === 1) moveDrag(e.touches[0].clientX, e.touches[0].clientY);
        }, {passive: false});
        window.addEventListener('touchend', endDrag);
        
        canvas.addEventListener('wheel', e => {
            e.preventDefault();
            this.zoom += e.deltaY * -0.001;
            this.zoom = Math.min(Math.max(0.1, this.zoom), 2.0);
        }, {passive: false});
        
        canvas.setAttribute('data-3d-attached', 'true');
    }

    /**
     * Render the 3D squadron
     * 渲染 3D 编队
     * @param {number} w 
     * @param {number} h 
     * @param {number} bass 
     * @param {Object} theme 
     */
    draw3DPlane(w, h, bass, theme) {
        const cx = w / 2;
        const cy = h / 2;
        const size = Math.min(w, h) / 5 * this.zoom;
        
        // Smooth Rotation
        // 平滑旋转
        this.rotation.x += (this.targetRotation.x - this.rotation.x) * 0.1;
        this.rotation.y += (this.targetRotation.y - this.rotation.y) * 0.1;
        this.rotation.z += (this.targetRotation.z - this.rotation.z) * 0.1;
        
        const time = Date.now() / 1000;
        const swayY = Math.sin(time) * 0.1;
        const dt = 0.016; // Approx 60fps
        // 约 60fps

        // Transform Function (Reusable)
        // 变换函数（可重用）
        const transform = (vx, vy, vz) => {
            let x = vx, y = vy + swayY, z = vz;
            
            // Rotate X
            // 绕 X 轴旋转
            let ty = y * Math.cos(this.rotation.x) - z * Math.sin(this.rotation.x);
            let tz = y * Math.sin(this.rotation.x) + z * Math.cos(this.rotation.x);
            y = ty; z = tz;
            
            // Rotate Y
            // 绕 Y 轴旋转
            let tx = x * Math.cos(this.rotation.y) + z * Math.sin(this.rotation.y);
            tz = -x * Math.sin(this.rotation.y) + z * Math.cos(this.rotation.y);
            x = tx; z = tz;
            
            // Perspective
            // 透视
            const dist = 8;
            const persp = dist / (dist - z); 
            
            if (persp <= 0) return { x: -9999, y: -9999, z: z, p: 0 }; // Behind camera clipping // 相机后裁剪

            return {
                x: cx + x * size * persp,
                y: cy + y * size * persp,
                z: z,
                p: persp
            };
        };

        // Render Squadron
        // 渲染编队
        const renderList = this.squadron.map(f => {
             const t = transform(f.pos.x, f.pos.y, f.pos.z); 
             return { fighter: f, z: t.z };
        });

        renderList.sort((a, b) => a.z - b.z); // Ascending Z (Far -> Near) // Z 轴升序（远 -> 近）

        renderList.forEach(item => {
            item.fighter.update(dt, bass);
            item.fighter.render(this.ctx, transform, bass);
        });
    }

    /**
     * Main Render Loop
     * 主渲染循环
     * @param {AnalyserNode} analyser 
     * @param {Uint8Array} dataArray 
     * @param {number} bufferLength 
     * @param {Object} theme 
     */
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

        // Render Background Particles
        // 渲染背景粒子
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

        // Draw 3D Sci-Fi Plane(s)
        // 绘制 3D 科幻战机
        this.draw3DPlane(w, h, bass, theme);

        this.drawTime(theme);
    }
}
