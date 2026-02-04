/**
 * @fileoverview Main Solar System Renderer Module
 */

import { BaseRenderer } from '../../core/base-renderer.js';
import { StarField } from './stars.js';
import { PlanetSystem } from './planets.js';
import { UFOController } from './ufo.js';

/**
 * Solar System Renderer
 * 太阳系渲染器
 * Renders a realistic solar system with audio-reactive elements,
 * dynamic camera, and easter eggs.
 * 渲染一个包含音频响应元素、动态摄像机和彩蛋的逼真太阳系。
 */
export class SolarSystemRenderer extends BaseRenderer {
    /**
     * @param {CanvasRenderingContext2D} ctx Context 画布上下文
     */
    constructor(ctx) {
        super(ctx);

        // Sub-systems
        // 子系统
        this.starField = new StarField();
        this.planetSystem = new PlanetSystem();
        this.ufoController = new UFOController();

        // Camera / Orbit Settings
        // 摄像机/轨道设置
        this.baseSpeed = 0.0436; // 120s per Earth orbit // 地球每圈120秒
        this.currentSpeed = this.baseSpeed;
        this.angleOffset = 0;
        this.tilt = 0.6; // ~37 degrees // 约37度倾角
        this.orbitSpeedScale = 0.5;

        // Cloud Particles (Foreground effect)
        // 云雾粒子（前景效果）
        this.cloudAngle = 0;
        this.cloudParticles = this.initCloudParticles();

        // Camera System - 720° full rotation (pan & tilt) + Zoom
        // 摄像机系统 - 720°全方位旋转（平移+俯仰）+ 缩放
        this.camera = {
            pan: 0,                   // Y-axis rotation (horizontal on screen) in radians
            targetPan: 0,             // Target pan angle for smooth animation
            tilt: 0.6,                // X-axis rotation (vertical on screen) in radians (~37 degrees)
            targetTilt: 0.6,          // Target tilt angle for smooth animation
            zoom: 1.0,                // Current zoom level
            targetZoom: 1.0,           // Target zoom for smooth animation
            minZoom: 0.2,             // Minimum zoom level
            maxZoom: 5.0,             // Maximum zoom level
            zoomSmoothing: 0.1,       // Zoom animation smoothing factor
            rotationSmoothing: 0.15,   // Rotation animation smoothing factor
            showOrbits: true,         // Show orbital paths
            minPan: -Math.PI * 2,     // Minimum pan angle (-720°)
            maxPan: Math.PI * 2,       // Maximum pan angle (720°)
            minTilt: -Math.PI / 3,     // Minimum tilt angle (-60°)
            maxTilt: Math.PI / 3      // Maximum tilt angle (60°)
        };

        // State
        // 状态
        this.activeTarget = null;
        this.lastCallsign = '';
    }

    /**
     * Reset camera to initial state
     * 重置摄像机到初始状态
     */
    resetCamera() {
        this.camera.pan = 0;
        this.camera.targetPan = 0;
        this.camera.tilt = 0.6;
        this.camera.targetTilt = 0.6;
        this.camera.targetZoom = 1.0;
    }

    /**
     * Set zoom level
     * 设置缩放级别
     * @param {number} zoomLevel New zoom level 新的缩放级别
     */
    setZoom(zoomLevel) {
        this.camera.targetZoom = Math.max(
            this.camera.minZoom,
            Math.min(this.camera.maxZoom, zoomLevel)
        );
    }

    /**
     * Rotate camera (720° full rotation: pan + tilt)
     * 旋转摄像机（720°全方位旋转：平移+俯仰）
     * @param {number} panDelta Y-axis rotation change (radians) Y轴旋转变化（弧度）
     * @param {number} tiltDelta X-axis rotation change (radians) X轴旋转变化（弧度）
     */
    rotateCamera(panDelta, tiltDelta = 0) {
        this.camera.targetPan += panDelta;
        this.camera.targetTilt += tiltDelta;

        // Clamp to limits
        this.camera.targetPan = Math.max(
            this.camera.minPan,
            Math.min(this.camera.maxPan, this.camera.targetPan)
        );
        this.camera.targetTilt = Math.max(
            this.camera.minTilt,
            Math.min(this.camera.maxTilt, this.camera.targetTilt)
        );

        console.log('[SolarSystem] rotateCamera:', {
            panDelta,
            tiltDelta,
            pan: this.camera.targetPan.toFixed(3),
            tilt: this.camera.targetTilt.toFixed(3)
        });
    }

    /**
     * Set absolute rotation angles
     * 设置绝对旋转角度
     * @param {number} pan Pan angle (radians) 平移角度（弧度）
     * @param {number} tilt Tilt angle (radians) 俯仰角度（弧度）
     */
    setRotation(pan, tilt) {
        this.camera.targetPan = Math.max(
            this.camera.minPan,
            Math.min(this.camera.maxPan, pan)
        );
        this.camera.targetTilt = Math.max(
            this.camera.minTilt,
            Math.min(this.camera.maxTilt, tilt)
        );
    }

    /**
     * Toggle orbit paths visibility
     * 切换轨道线显示
     */
    toggleOrbits() {
        this.camera.showOrbits = !this.camera.showOrbits;
    }

    /**
     * Draw orbital paths for all planets
     * 绘制所有行星的轨道线
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} cx Center X
     * @param {number} cy Center Y
     * @param {number} scale Scale factor
     * @param {Object} theme Theme colors
     */
    drawOrbitalPaths(ctx, cx, cy, scale, theme) {
        ctx.save();
        ctx.translate(cx, cy);

        // Apply tilt (X-axis rotation) - affects perspective
        // 应用俯仰（X轴旋转）- 影响透视
        ctx.transform(1, 0, Math.sin(this.camera.tilt), Math.cos(this.camera.tilt), 0, 0);

        // Apply pan (Y-axis rotation) - rotates the view horizontally
        // 应用平移（Y轴旋转）- 水平旋转视图
        ctx.rotate(this.camera.pan);

        ctx.translate(-cx, -cy);

        // Draw orbital paths for each planet
        // 绘制每个行星的轨道线
        const planets = this.planetSystem.planets;
        planets.forEach(p => {
            // Calculate orbit radius
            // 计算轨道半径
            const orbitRadius = p.dist * scale;

            // Skip if too small
            // 如果太小则跳过
            if (orbitRadius < 2) return;

            // Draw orbit path
            // 绘制轨道线
            ctx.beginPath();
            ctx.arc(cx, cy, orbitRadius, 0, Math.PI * 2);

            // Style
            ctx.strokeStyle = theme.primary || '#00f3ff';
            ctx.lineWidth = 0.5;
            ctx.globalAlpha = 0.3;
            ctx.setLineDash([2, 4]); // Dashed line pattern
            ctx.stroke();

            // Fill (optional - semi-transparent)
            // 填充（可选 - 半透明）
            ctx.fillStyle = theme.primary || '#00f3ff';
            ctx.globalAlpha = 0.02;
            ctx.fill();
        });

        ctx.restore();
    }

    /**
     * Set absolute rotation angles
     * 设置绝对旋转角度
     * @param {number} pan Pan angle (radians) 平移角度（弧度）
     * @param {number} tilt Tilt angle (radians) 俯仰角度（弧度）
     */
    setRotation(pan, tilt) {
        this.camera.targetPan = Math.max(
            this.camera.minPan,
            Math.min(this.camera.maxPan, pan)
        );
        this.camera.targetTilt = Math.max(
            this.camera.minTilt,
            Math.min(this.camera.maxTilt, tilt)
        );
    }

    /**
     * Toggle orbit paths visibility
     * 切换轨道线显示
     */
    toggleOrbits() {
        this.camera.showOrbits = !this.camera.showOrbits;
    }

    /**
     * Rotate camera around the sun
     * 绕太阳旋转摄像机
     * @param {number} angleDelta Rotation angle change in radians 旋转角度变化（弧度）
     */
    rotateCamera(angleDelta) {
        this.camera.rotation += angleDelta;
    }

    /**
     * Set absolute rotation angle
     * 设置绝对旋转角度
     * @param {number} angle Rotation angle in radians 旋转角度（弧度）
     */
    setRotation(angle) {
        this.camera.rotation = angle;
    }

    /**
     * Get camera state
     * 获取摄像机状态
     * @returns {Object} Camera state object 摄像机状态对象
     */
    getCameraState() {
        return this.camera;
    }

    /**
     * Initialize foreground cloud particles
     * 初始化前景云雾粒子
     * @private
     */
    initCloudParticles() {
        // Simple palette for clouds
        // 云雾的简单调色板
        const palette = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD',
            '#D4A5A5', '#9B59B6', '#3498DB', '#E67E22', '#2ECC71'
        ];
        const getRandomColor = () => palette[Math.floor(Math.random() * palette.length)];

        return Array.from({length: 40}, () => ({
            x: (Math.random() - 0.5) * 100,
            y: (Math.random() - 0.5) * 60,
            size: Math.random() * 2 + 1,
            color: getRandomColor(),
            alpha: Math.random() * 0.6 + 0.2
        }));
    }

    /**
     * Trigger UFO flight (Easter Egg)
     * 触发 UFO 飞行（彩蛋）
     */
    triggerUFO() {
        this.ufoController.trigger(this.width, this.height);
    }

    /**
     * Main Render Loop
     * 主渲染循环
     * @param {AnalyserNode} analyser Audio analyser 音频分析器
     * @param {Uint8Array} dataArray Frequency data 频率数据
     * @param {number} bufferLength Buffer length 缓冲区长度
     * @param {Object} theme Theme colors 主题颜色
     * @param {Object} extra Extra params (callsign, input, etc.) 额外参数（呼号、输入等）
     */
    draw(analyser, dataArray, bufferLength, theme, extra) {
        analyser.getByteFrequencyData(dataArray);
        const { ctx, width: w, height: h } = this;
        const minDim = Math.min(w, h);

        // 1. Audio Analysis
        // 1. 音频分析
        let energy = 0, bass = 0, mid = 0, treble = 0;
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

        // 2. Dynamics Update
        // 2. 动态更新
        // Accelerate when transmitting (energy > 0)
        // 发射时加速（能量 > 0）
        const targetSpeed = this.baseSpeed + energy * 6.0;
        this.currentSpeed += (targetSpeed - this.currentSpeed) * 0.05;
        this.angleOffset += this.currentSpeed * 0.01;

        // 3. Callsign & Target Logic
        // 3. 呼号与目标逻辑
        const callsign = (extra && extra.callsign && extra.opacity > 0) ? extra.callsign : null;
        const input = extra.input || { x: 0, y: 0, active: false };

        if (callsign && callsign !== this.lastCallsign) {
            this.lastCallsign = callsign;
            // Hash callsign to select target
            // 哈希呼号以选择目标
            let hash = 0;
            for (let i = 0; i < callsign.length; i++) hash = callsign.charCodeAt(i) + ((hash << 5) - hash);
            this.activeTarget = this.planetSystem.getTarget(hash);
        }

        // 4. Update Repeater Stations
        // 4. 更新中继站
        if (extra && extra.repeaterStations) {
            this.starField.updateRepeaterStations(extra.repeaterStations);
        }

        // --- RENDER PASS ---
        // --- 渲染阶段 ---

        // A. Background Stars (not affected by rotation)
        // A. 背景星星（不受旋转影响）
        this.starField.render(ctx, w, h, energy, theme);

        // C. Solar System (Sun, Planets, Moons) - with 720° rotation
        // C. 太阳系（太阳、行星、卫星）- 带720°旋转
        // Apply camera zoom and rotation smoothing
        // 应用摄像机缩放和旋转平滑
        this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * this.camera.zoomSmoothing;
        this.camera.pan += (this.camera.targetPan - this.camera.pan) * this.camera.rotationSmoothing;
        this.camera.tilt += (this.camera.targetTilt - this.camera.tilt) * this.camera.rotationSmoothing;

        console.log('[SolarSystem] draw camera:', {
            pan: this.camera.pan.toFixed(3),
            tilt: this.camera.tilt.toFixed(3),
            targetPan: this.camera.targetPan.toFixed(3),
            targetTilt: this.camera.targetTilt.toFixed(3)
        });

        // Scale calculation to fit screen
        // 计算适应屏幕的比例
        // Use Pluto (dist=11.0) as baseline to show all planets
        // 以冥王星（距离=11.0）为基准以显示所有行星
        const maxPlanetDist = 11.0;
        const baseScale = (minDim * 0.45) / maxPlanetDist;
        const scale = baseScale * this.camera.zoom;

        // Center point (always at canvas center, no pan offset)
        // 中心点（始终在画布中心，无平移偏移）
        const cx = w / 2;
        const cy = h / 2;

        // Apply 720° rotation around sun (canvas center)
        // 应用绕太阳（画布中心）的720°旋转

        // D. Draw orbital paths (after cx, cy, scale are declared)
        // D. 绘制轨道线（在 cx, cy, scale 声明之后）
        if (this.camera.showOrbits) {
            this.drawOrbitalPaths(ctx, cx, cy, scale, theme);
        }

        ctx.save();
        ctx.translate(cx, cy);

        // Apply tilt (X-axis rotation) - affects perspective
        // 应用俯仰（X轴旋转）- 影响透视
        ctx.transform(1, 0, Math.sin(this.camera.tilt), Math.cos(this.camera.tilt), 0, 0);

        // Apply pan (Y-axis rotation) - rotates the view horizontally
        // 应用平移（Y轴旋转）- 水平旋转视图
        ctx.rotate(this.camera.pan);

        ctx.translate(-cx, -cy);

        const planetRenderResult = this.planetSystem.render(ctx, {
            cx, cy, scale,
            tilt: this.camera.tilt,
            angleOffset: this.angleOffset,
            orbitSpeedScale: this.orbitSpeedScale,
            bass, mid, treble, energy,
            theme, input, callsign,
            activeTarget: this.activeTarget,
            minDim,
            camera: this.camera
        });

        // Sort and Draw Planet System Elements (Z-sorting)
        // 排序并绘制行星系统元素（Z轴排序）
        // renderList contains objects with { y, draw() }
        // renderList 包含 { y, draw() } 对象
        planetRenderResult.renderList.sort((a, b) => a.y - b.y);
        planetRenderResult.renderList.forEach(item => item.draw());

        // Restore context (undo rotation)
        // 恢复上下文（撤销旋转）
        ctx.restore();

        // C. UFO Overlay (Easter Egg)
        // C. UFO 叠加层（彩蛋）
        if (this.ufoController.active) {
            this.ufoController.update();
            this.ufoController.render(ctx, scale);
        }

        // D. Foreground Cloud Particles (Top Right Decor)
        // D. 前景云雾粒子（右上角装饰）
        this.drawCloudParticles(ctx, w, h, energy);

        // E. Time Display
        // E. 时间显示
        this.drawTime(theme);

        // F. Return Interaction Info
        // F. 返回交互信息
        return planetRenderResult.hoveredItem;
    }

    /**
     * Draw decorative cloud particles
     * 绘制装饰性云雾粒子
     * @param {CanvasRenderingContext2D} ctx Context 画布上下文
     * @param {number} w Width 宽度
     * @param {number} h Height 高度
     * @param {number} energy Audio energy 音频能量
     */
    drawCloudParticles(ctx, w, h, energy) {
        ctx.save();
        ctx.translate(w - 60, 60); // Top right corner // 右上角
        this.cloudAngle += 0.005 + energy * 0.02;
        ctx.rotate(this.cloudAngle);
        
        this.cloudParticles.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.alpha * (0.5 + energy * 0.5);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
            ctx.fill();
        });
        ctx.restore();
    }
}
