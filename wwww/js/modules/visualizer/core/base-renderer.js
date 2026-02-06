/**
 * 基础渲染器模块
 * Base class for all visualizer renderers
 */
export class BaseRenderer {
    /**
     * @param {CanvasRenderingContext2D} ctx 
     */
    constructor(ctx) { 
        this.ctx = ctx; 
        this.width = 0; 
        this.height = 0; 
    }

    /**
     * Update dimensions
     * @param {number} w Width
     * @param {number} h Height
     */
    resize(w, h) { 
        this.width = w; 
        this.height = h; 
    }

    /**
     * Legacy Sci-Fi Plane Renderer (Appears unused in current implementation)
     * @param {number} w 
     * @param {number} h 
     * @param {number} bass 
     * @param {object} theme 
     */
    drawSciFiPlane(w, h, bass, theme) {
        const ctx = this.ctx;
        const cx = w / 2;
        const cy = h / 2;
        const size = Math.min(w, h) / 5;
        const time = Date.now() / 1000;
        
        // Sway animation (Hovering effect)
        const swayX = Math.sin(time * 0.8) * size * 0.05;
        const swayY = Math.cos(time * 0.5) * size * 0.05;
        
        ctx.save();
        ctx.translate(cx + swayX, cy + swayY);
        ctx.scale(size, size);
        
        // Draw Shadow (to make it pop from stars)
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        
        // 1. Engine Glow (Reactive)
        const glowIntensity = 0.6 + bass * 0.4;
        const glowColor = '#00f3ff'; // Cyan glow
        
        // Engines (Twin)
        ctx.fillStyle = `rgba(0, 243, 255, ${glowIntensity})`;
        ctx.shadowBlur = 20 * glowIntensity;
        ctx.shadowColor = glowColor;
        
        // Left Engine
        ctx.beginPath();
        ctx.arc(-0.15, 0.35, 0.06, 0, Math.PI * 2);
        ctx.fill();
        
        // Right Engine
        ctx.beginPath();
        ctx.arc(0.15, 0.35, 0.06, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
        
        // 2. Main Body (Fuselage)
        // Gradient for metallic look
        const bodyGrad = ctx.createLinearGradient(0, -0.6, 0, 0.6);
        bodyGrad.addColorStop(0, '#f0f0f0');
        bodyGrad.addColorStop(0.5, '#b0b0b0');
        bodyGrad.addColorStop(1, '#808080');
        
        ctx.fillStyle = bodyGrad;
        
        // Central Fuselage
        ctx.beginPath();
        ctx.moveTo(0, -0.7); // Nose tip
        ctx.lineTo(0.08, -0.3);
        ctx.lineTo(0.12, 0.4); 
        ctx.lineTo(0, 0.5); // Tail cone
        ctx.lineTo(-0.12, 0.4);
        ctx.lineTo(-0.08, -0.3);
        ctx.closePath();
        ctx.fill();
        
        // 3. Wings (Delta)
        ctx.fillStyle = '#d0d0d0';
        ctx.beginPath();
        ctx.moveTo(0.08, -0.1);
        ctx.lineTo(0.5, 0.3); // Wing tip
        ctx.lineTo(0.12, 0.4); // Wing root rear
        ctx.closePath();
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(-0.08, -0.1);
        ctx.lineTo(-0.5, 0.3);
        ctx.lineTo(-0.12, 0.4);
        ctx.closePath();
        ctx.fill();
        
        // Wing details (lines)
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 0.005;
        ctx.beginPath();
        ctx.moveTo(0.1, 0); ctx.lineTo(0.4, 0.3);
        ctx.moveTo(-0.1, 0); ctx.lineTo(-0.4, 0.3);
        ctx.stroke();
        
        // 4. Canards (Front wings)
        ctx.fillStyle = '#c0c0c0';
        ctx.beginPath();
        ctx.moveTo(0.08, -0.4);
        ctx.lineTo(0.25, -0.25);
        ctx.lineTo(0.08, -0.2);
        ctx.closePath();
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(-0.08, -0.4);
        ctx.lineTo(-0.25, -0.25);
        ctx.lineTo(-0.08, -0.2);
        ctx.closePath();
        ctx.fill();
        
        // 5. Vertical Stabilizers (Canted V-Tail)
        ctx.fillStyle = '#a0a0a0';
        ctx.beginPath();
        ctx.moveTo(0.1, 0.2);
        ctx.lineTo(0.22, 0.5);
        ctx.lineTo(0.1, 0.45);
        ctx.closePath();
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(-0.1, 0.2);
        ctx.lineTo(-0.22, 0.5);
        ctx.lineTo(-0.1, 0.45);
        ctx.closePath();
        ctx.fill();
        
        // 6. Cockpit Canopy
        const cockpitGrad = ctx.createLinearGradient(0, -0.5, 0, -0.3);
        cockpitGrad.addColorStop(0, '#111');
        cockpitGrad.addColorStop(1, '#333');
        ctx.fillStyle = cockpitGrad;
        
        ctx.beginPath();
        ctx.moveTo(0, -0.55);
        ctx.lineTo(0.04, -0.4);
        ctx.lineTo(0, -0.35);
        ctx.lineTo(-0.04, -0.4);
        ctx.closePath();
        ctx.fill();
        
        // Cockpit Glint
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.ellipse(0, -0.45, 0.01, 0.03, 0, 0, Math.PI*2);
        ctx.fill();

        ctx.restore();
    }

    /**
     * Abstract draw method
     * @param {AnalyserNode} analyser 
     * @param {Uint8Array} dataArray 
     * @param {number} bufferLength 
     * @param {object} theme 
     * @param {object} [extra] 
     */
    draw(analyser, dataArray, bufferLength, theme, extra) {}
    
    /**
     * Draw standardized time display
     * @param {object} theme 
     */
    drawTime(theme) {
        const { ctx, width: w, height: h } = this;
        const minDim = Math.min(w, h);
        
        if (minDim > 280) {
            const now = new Date();
            const offset = 8;
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
            const bjTime = new Date(utc + (3600000 * offset));
            
            const pad = (n) => n.toString().padStart(2, '0');
            const sec = bjTime.getSeconds();
            const ms = bjTime.getMilliseconds();
            // 2 decimal places for seconds: SS.ss
            const secStr = sec.toString().padStart(2, '0');
            const msStr = Math.floor(ms / 10).toString().padStart(2, '0');
            
            const fullTimeStr = `${bjTime.getFullYear()}-${pad(bjTime.getMonth()+1)}-${pad(bjTime.getDate())} ${pad(bjTime.getHours())}:${pad(bjTime.getMinutes())}:${secStr}.${msStr}`;
            
            const timeSize = Math.max(14, Math.floor(minDim / 40));

            ctx.save();
            ctx.fillStyle = theme.primary || '#00f3ff'; 
            ctx.shadowColor = theme.primary || '#00f3ff'; 
            ctx.shadowBlur = 10;
            ctx.font = `bold ${timeSize}px "Courier New", monospace`; 
            ctx.textAlign = 'center'; 
            ctx.textBaseline = 'top';
            ctx.fillText(fullTimeStr, w / 2, 30);
            ctx.restore();
        }
    }
}
