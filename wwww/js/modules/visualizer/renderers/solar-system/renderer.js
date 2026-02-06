/**
 * @fileoverview Main Solar System Renderer Module
 */

import { BaseRenderer } from '../../core/base-renderer.js';
import { StarField } from './stars.js';
import { PlanetSystem } from './planets.js';
import { UFOController } from './ufo.js';

/**
 * Solar System Renderer
 * Renders a realistic solar system with audio-reactive elements,
 * dynamic camera, and easter eggs.
 */
export class SolarSystemRenderer extends BaseRenderer {
    /**
     * @param {CanvasRenderingContext2D} ctx 
     */
    constructor(ctx) {
        super(ctx);

        // Sub-systems
        this.starField = new StarField();
        this.planetSystem = new PlanetSystem();
        this.ufoController = new UFOController();

        // Camera / Orbit Settings
        this.baseSpeed = 0.0436; // 120s per Earth orbit
        this.currentSpeed = this.baseSpeed;
        // Random start position for planets
        // 随机初始位置
        this.angleOffset = Math.random() * 1000;
        this.tilt = 0.6; // ~37 degrees
        this.orbitSpeedScale = 0.5;

        // Camera System
        // 摄像机系统
        this.camera = {
            zoom: 1, // Default to see all planets 默认缩放以显示所有行星
            targetZoom: 0.5,
            minZoom: 0.1, // Allow zooming out a bit more if needed
            maxZoom: 2.0,
            zoomSmoothing: 0.01
        };

        // Cloud Particles (Foreground effect)
        this.cloudAngle = 0;
        this.cloudParticles = this.initCloudParticles();

        // State
        this.activeTarget = null;
        this.lastCallsign = '';
    }

    /**
     * Initialize foreground cloud particles
     * @private
     */
    initCloudParticles() {
        // Simple palette for clouds
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
     */
    triggerUFO() {
        this.ufoController.trigger(this.width, this.height);
    }

    /**
     * Adjust Camera Zoom
     * 调整摄像机缩放
     * @param {number} delta Zoom delta 缩放增量
     */
    adjustZoom(delta) {
        this.camera.targetZoom += delta;
        this.camera.targetZoom = Math.max(this.camera.minZoom, Math.min(this.camera.maxZoom, this.camera.targetZoom));
    }

    /**
     * Stop zoom transition immediately
     * 立即停止缩放过渡
     */
    stopZoom() {
        this.camera.targetZoom = this.camera.zoom;
    }

    /**
     * Draw Tooltip for hovered items
     * 绘制悬停提示框
     * @param {CanvasRenderingContext2D} ctx 
     * @param {Object} item 
     * @param {Object} theme 
     */
    drawTooltip(ctx, item, theme) {
        if (!item) return;
        const { x, y, name, info } = item;
        
        ctx.save();
        ctx.font = 'bold 12px "Roboto Mono"';
        const nameMetrics = ctx.measureText(name);
        ctx.font = '10px "Roboto Mono"';
        const infoMetrics = ctx.measureText(info);
        
        const width = Math.max(nameMetrics.width, infoMetrics.width) + 20;
        const height = 40;
        
        // Tooltip Background
        ctx.fillStyle = 'rgba(0, 20, 40, 0.9)';
        ctx.strokeStyle = theme.primary || '#00f3ff';
        ctx.lineWidth = 1;
        
        ctx.beginPath();
        // Adjust position to be above the item
        ctx.roundRect(x - width/2, y - height - 10, width, height, 5);
        ctx.fill();
        ctx.stroke();
        
        // Arrow
        ctx.beginPath();
        ctx.moveTo(x - 5, y - 10);
        ctx.lineTo(x, y);
        ctx.lineTo(x + 5, y - 10);
        ctx.fill();
        ctx.stroke();
        
        // Text
        ctx.textAlign = 'center';
        ctx.fillStyle = theme.primary || '#00f3ff';
        ctx.font = 'bold 12px "Roboto Mono"';
        ctx.fillText(name, x, y - height + 8);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px "Roboto Mono"';
        ctx.fillText(info, x, y - height + 24);
        
        ctx.restore();
    }

    /**
     * Main Render Loop
     * @param {AnalyserNode} analyser 
     * @param {Uint8Array} dataArray 
     * @param {number} bufferLength 
     * @param {Object} theme 
     * @param {Object} extra Extra params (callsign, input, etc.)
     */
    draw(analyser, dataArray, bufferLength, theme, extra) {
        analyser.getByteFrequencyData(dataArray);
        const { ctx, width: w, height: h } = this;
        const cx = w / 2;
        const cy = h / 2;
        const minDim = Math.min(w, h);

        // 1. Audio Analysis
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
        // Accelerate when transmitting (energy > 0)
        const targetSpeed = this.baseSpeed + energy * 6.0;
        this.currentSpeed += (targetSpeed - this.currentSpeed) * 0.05;
        this.angleOffset += this.currentSpeed * 0.01;

        // 3. Callsign & Target Logic
        const callsign = (extra && extra.callsign && extra.opacity > 0) ? extra.callsign : null;
        const input = extra.input || { x: 0, y: 0, active: false };

        if (callsign && callsign !== this.lastCallsign) {
            this.lastCallsign = callsign;
            // Hash callsign to select target
            let hash = 0;
            for (let i = 0; i < callsign.length; i++) hash = callsign.charCodeAt(i) + ((hash << 5) - hash);
            this.activeTarget = this.planetSystem.getTarget(hash);
        }

        // 4. Update Repeater Stations
        if (extra && extra.repeaterStations) {
            this.starField.updateRepeaterStations(extra.repeaterStations);
        }

        // --- RENDER PASS ---

        // A. Background Stars
        this.starField.render(ctx, w, h, energy, theme);

        // Update Camera Zoom (Smooth transition)
        // 更新摄像机缩放（平滑过渡）
        this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * this.camera.zoomSmoothing;

        // B. Solar System (Sun, Planets, Moons)
        // Scale calculation to fit screen
        // Earth (dist=3.3) should be roughly at 1/3 to 1/2 screen radius
        // Let's say 3.3 AU = 0.35 * minDim
        const baseScale = (minDim * 0.35) / 3.3; 
        const scale = baseScale * this.camera.zoom;

        const planetRenderResult = this.planetSystem.render(ctx, {
            cx, cy, scale, 
            tilt: this.tilt, 
            angleOffset: this.angleOffset, 
            orbitSpeedScale: this.orbitSpeedScale,
            bass, mid, treble, energy,
            theme, input, callsign, 
            activeTarget: this.activeTarget,
            minDim
        });

        // Sort and Draw Planet System Elements (Z-sorting)
        // renderList contains objects with { y, draw() }
        planetRenderResult.renderList.sort((a, b) => a.y - b.y);
        planetRenderResult.renderList.forEach(item => item.draw());

        // C. UFO Overlay (Easter Egg)
        if (this.ufoController.active) {
            this.ufoController.update();
            this.ufoController.render(ctx, scale);
        }

        // D. Foreground Cloud Particles (Top Right Decor)
        this.drawCloudParticles(ctx, w, h, energy);

        // E. Time Display
        this.drawTime(theme);

        // F. Tooltip
        if (planetRenderResult.hoveredItem) {
            this.drawTooltip(ctx, planetRenderResult.hoveredItem, theme);
        }

        // G. Return Interaction Info
        return planetRenderResult.hoveredItem;
    }

    /**
     * Draw decorative cloud particles
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} w 
     * @param {number} h 
     * @param {number} energy 
     */
    drawCloudParticles(ctx, w, h, energy) {
        ctx.save();
        ctx.translate(w - 60, 60); // Top right corner
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
