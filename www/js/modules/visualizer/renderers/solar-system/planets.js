/**
 * @fileoverview Planet system renderer (Sun, Planets, Moons)
 * 行星系统渲染器（太阳、行星、卫星）
 */

import { PLANETS_DATA } from './constants.js';

export class PlanetSystem {
    constructor() {
        this.planets = PLANETS_DATA;
        this.targets = [];
        this.initTargets();
        
        // Sun Eruption System Configuration
        // 太阳爆发系统配置
        this.eruptions = [];
        this.eruptionConfig = {
            sensitivity: 1.0,
            randomness: 0.5,
            intensity: 1.0,
            speed: 0.5
        };
    }

    /**
     * Initialize callsign assignment targets (Planets + Moons)
     * 初始化呼号分配目标（行星 + 卫星）
     */
    initTargets() {
        this.targets = [];
        this.planets.forEach((p, pIdx) => {
            this.targets.push({ type: 'planet', pIdx: pIdx, name: p.name });
            if (p.moons) {
                p.moons.forEach((m, mIdx) => {
                    this.targets.push({ type: 'moon', pIdx: pIdx, mIdx: mIdx, name: m.name });
                });
            }
        });
    }

    /**
     * Get a target based on hash
     * 基于哈希获取目标
     * @param {number} hash Hash value 哈希值
     * @returns {Object} Target info 目标信息
     */
    getTarget(hash) {
        if (this.targets.length === 0) return null;
        return this.targets[Math.abs(hash) % this.targets.length];
    }

    /**
     * Determine text color based on background brightness
     * 根据背景亮度确定文本颜色
     * @param {string} hex Hex color code 十六进制颜色代码
     * @returns {string} '#000000' or '#ffffff'
     */
    getTextColor(hex) {
        if(!hex || hex[0]!=='#') return '#ffffff';
        const r = parseInt(hex.slice(1,3), 16);
        const g = parseInt(hex.slice(3,5), 16);
        const b = parseInt(hex.slice(5,7), 16);
        return (r*0.299 + g*0.587 + b*0.114) > 160 ? '#000000' : '#ffffff';
    }

    /**
     * Render entire planet system
     * 渲染整个行星系统
     * @param {CanvasRenderingContext2D} ctx Context 画布上下文
     * @param {Object} params Rendering parameters 渲染参数
     * @returns {Object|null} Hovered item info if any 悬停项信息（如果有）
     */
    render(ctx, params) {
        const {
            cx, cy, scale, tilt, angleOffset, orbitSpeedScale,
            bass, mid, treble, energy,
            theme, input, callsign, activeTarget, minDim,
            camera
        } = params;

        const renderList = [];
        let hoveredItem = null;

        // --- 1. Sun & Eruptions ---
        // --- 1. 太阳与爆发 ---
        renderList.push({
            y: cy,
            draw: () => {
                const sunBaseSize = 25; 
                const sunSize = sunBaseSize + bass * 30;

                // Eruptions
                // 爆发
                const sensitivity = this.eruptionConfig.sensitivity;
                if (energy * sensitivity > 0.05) { 
                    const count = Math.floor(energy * 8 * sensitivity); 
                    let colorBase = '255, 69, 0'; 
                    let type = 'bass';
                    if (treble > mid && treble > bass) { colorBase = '200, 255, 255'; type = 'treble'; } 
                    else if (mid > bass) { colorBase = '255, 215, 0'; type = 'mid'; }

                    for(let k=0; k<count; k++) {
                        const angle = Math.random() * Math.PI * 2;
                        const speedVar = Math.random() * this.eruptionConfig.randomness;
                        this.eruptions.push({
                            x: cx, y: cy, angle: angle,
                            r: sunSize * 0.8,
                            speed: (2 + speedVar * 5 + energy * 10) * this.eruptionConfig.speed,
                            length: (10 + Math.random() * 20 + energy * 50) * this.eruptionConfig.intensity,
                            width: (type === 'treble' ? 1 : (type === 'mid' ? 2 : 3)) * (1 + Math.random()),
                            colorBase: colorBase, alpha: 0.8 + Math.random() * 0.2, decay: 0.02 + Math.random() * 0.05
                        });
                    }
                }

                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                for (let i = this.eruptions.length - 1; i >= 0; i--) {
                    const p = this.eruptions[i];
                    p.r += p.speed;
                    p.alpha -= p.decay;
                    if (p.alpha <= 0) { this.eruptions.splice(i, 1); continue; }
                    
                    const sx = cx + Math.cos(p.angle) * p.r;
                    const sy = cy + Math.sin(p.angle) * p.r;
                    const ex = cx + Math.cos(p.angle) * (p.r + p.length);
                    const ey = cy + Math.sin(p.angle) * (p.r + p.length);
                    
                    ctx.strokeStyle = `rgba(${p.colorBase}, ${p.alpha})`;
                    ctx.lineWidth = p.width;
                    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
                }
                ctx.restore();
                
                // Sun Body
                // 太阳本体
                const sunGrad = ctx.createRadialGradient(cx, cy, sunSize*0.2, cx, cy, sunSize);
                sunGrad.addColorStop(0, 'rgba(255, 215, 0, 0.85)'); 
                sunGrad.addColorStop(1, 'rgba(255, 140, 0, 0.65)'); 
                
                ctx.fillStyle = sunGrad;
                ctx.beginPath();
                ctx.arc(cx, cy, sunSize, 0, Math.PI*2);
                ctx.fill();

                // Interaction - Use world coordinates for hover detection
                // 交互 - 使用世界坐标进行悬停检测
                if (input.active) {
                    const worldX = (input.x - cx) / scale;
                    const worldY = (input.y - cy) / scale;
                    if (Math.hypot(worldX, worldY) < sunSize / scale + 10) {
                        hoveredItem = { name: 'Sun', info: 'Star Type: G2V', x: cx, y: cy - sunSize - 10 };
                    }
                }
            }
        });

        // --- 2. Planets & Moons ---
        // --- 2. 行星与卫星 ---
        this.planets.forEach((p, i) => {
            const angle = angleOffset * p.speed * orbitSpeedScale + i * 137.5; 
            const x = cx + Math.cos(angle) * p.dist * scale;
            const y = cy + Math.sin(angle) * p.dist * scale * tilt;
            
            renderList.push({
                y: y,
                draw: () => {
                    const size = Math.max(3, p.r * scale * 0.12);
                    const style = p.style;

                    // Moons
                    // 卫星
                    if (p.moons && p.moons.length > 0) {
                        p.moons.forEach((m, idx) => {
                            const mAngle = angleOffset * m.speed * 4 * orbitSpeedScale + idx; 
                            const mDist = (size + m.dist * scale * 2); 
                            const mx = x + Math.cos(mAngle) * mDist;
                            const my = y + Math.sin(mAngle) * mDist * tilt;
                            const mSize = Math.max(2.0, m.r * scale * 0.15);

                            // Moon Body
                            // 卫星本体
                            ctx.fillStyle = m.color;
                            ctx.beginPath();
                            ctx.arc(mx, my, mSize, 0, Math.PI*2);
                            ctx.fill();

                            // Moon Interaction - Use world coordinates for hover detection
                            // 卫星交互
                            if (input.active) {
                                const worldX = (input.x - mx) / scale;
                                const worldY = (input.y - my) / scale;
                                if (Math.hypot(worldX, worldY) < mSize / scale + 5) {
                                    hoveredItem = { name: m.name, info: `Moon of ${p.name}`, x: mx, y: my - 10 };
                                }
                            }

                            // Moon Callsign
                            // 卫星呼号
                            if (callsign && activeTarget && activeTarget.type === 'moon' && activeTarget.pIdx === i && activeTarget.mIdx === idx) {
                                this.drawCallsign(ctx, cx, cy, mx, my, mSize, m.color, callsign, theme);
                            }
                        });
                    }

                    // Planet Body
                    // 行星本体
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(x, y, size, 0, Math.PI*2);
                    ctx.clip(); 

                    const grad = ctx.createRadialGradient(x - size*0.3, y - size*0.3, size*0.1, x, y, size);
                    grad.addColorStop(0, style.highlight || style.color1);
                    grad.addColorStop(0.5, style.color1);
                    grad.addColorStop(1, style.color2);
                    ctx.fillStyle = grad;
                    ctx.fill();

                    // Planet Details
                    // 行星细节
                    this.drawPlanetDetails(ctx, x, y, size, style);

                    // Planet Shadow
                    // 行星阴影
                    const shadowGrad = ctx.createRadialGradient(x, y, size * 0.8, x, y, size);
                    shadowGrad.addColorStop(0, 'rgba(0,0,0,0)');
                    shadowGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
                    ctx.fillStyle = shadowGrad;
                    ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI*2); ctx.fill();
                    ctx.restore();
                    
                    // Planet Name
                    // 行星名称
                    if (minDim > 320) {
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                        const nameSize = Math.max(10, Math.floor(minDim / 60));
                        ctx.font = `${nameSize}px "Roboto Mono"`;
                        ctx.textAlign = 'center';
                        ctx.fillText(p.name, x, y + size + nameSize + 4);
                    }

                    // Planet Interaction - Use world coordinates for hover detection
                    // 行星交互
                    if (input.active) {
                        const worldX = (input.x - x) / scale;
                        const worldY = (input.y - y) / scale;
                        if (Math.hypot(worldX, worldY) < size / scale + 5) {
                            hoveredItem = { name: p.name, info: `Dist: ${p.dist} AU`, x: x, y: y - size - 10 };
                        }
                    }

                    // Planet Callsign
                    // 行星呼号
                    if (callsign && activeTarget && activeTarget.type === 'planet' && activeTarget.pIdx === i) {
                        this.drawCallsign(ctx, cx, cy, x, y, size, style.color1, callsign, theme);
                    }
                }
            });
        });

        return { renderList, hoveredItem };
    }

    /**
     * Draw planet details (surface features)
     * 绘制行星细节（表面特征）
     */
    drawPlanetDetails(ctx, x, y, size, style) {
        if (style.type === 'banded' && style.bands) {
            ctx.globalCompositeOperation = 'overlay';
            const bandHeight = size * 2 / style.bands.length;
            style.bands.forEach((color, idx) => {
                ctx.fillStyle = color;
                ctx.fillRect(x - size, y - size + idx * bandHeight, size * 2, bandHeight);
            });
            ctx.globalCompositeOperation = 'source-over';
        } else if (style.type === 'earth') {
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = '#4CAF50'; 
            ctx.beginPath(); ctx.arc(x - size*0.4, y - size*0.2, size*0.6, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'; 
            ctx.beginPath(); ctx.arc(x + size*0.3, y + size*0.3, size*0.7, 0, Math.PI*2); ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
        } else if (style.type === 'crater' || style.type === 'rust') {
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            for(let k=0; k<3; k++) {
                ctx.beginPath(); ctx.arc(x + (Math.random()-0.5)*size, y + (Math.random()-0.5)*size, size*0.2, 0, Math.PI*2); ctx.fill();
            }
            ctx.globalCompositeOperation = 'source-over';
        }
    }

    /**
     * Draw callsign label
     * 绘制呼号标签
     */
    drawCallsign(ctx, cx, cy, tx, ty, tSize, color, callsign, theme) {
        // Line
        // 连接线
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tx, ty);
        ctx.strokeStyle = theme.primary; ctx.globalAlpha = 0.3; ctx.stroke(); ctx.globalAlpha = 1.0;

        // Background
        // 背景
        ctx.save();
        ctx.translate(tx, ty - tSize * 2.5 - 5); // Adjusted offset // 调整偏移量
        
        ctx.font = 'bold 12px "Roboto Mono"';
        const textMetrics = ctx.measureText(callsign);
        const bgW = textMetrics.width + 16;
        const bgH = 20;
        
        ctx.fillStyle = color; 
        ctx.globalAlpha = 0.8;
        ctx.shadowBlur = 10;
        ctx.shadowColor = color;
        
        ctx.beginPath();
        ctx.roundRect(-bgW/2, -bgH/2 - 5, bgW, bgH, 10);
        ctx.fill();
        
        ctx.fillStyle = this.getTextColor(color);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 0; 
        ctx.fillText(callsign, 0, -5);
        ctx.restore();
    }
}
