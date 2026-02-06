
import { BaseRenderer } from '../core/base-renderer.js';

/**
 * 5. 放射模式渲染器 (RADIAL)
 */
export class RadialRenderer extends BaseRenderer {
    /**
     * @param {AnalyserNode} analyser 
     * @param {Uint8Array} dataArray 
     * @param {number} bufferLength 
     * @param {object} theme 
     * @param {object} extra Extra data like callsign
     */
    draw(analyser, dataArray, bufferLength, theme, extra) {
        analyser.getByteFrequencyData(dataArray);
        const { ctx, width: w, height: h } = this;
        const cx = w / 2;
        const cy = h / 2;
        const radius = Math.min(w, h) / 4.5; 
        
        ctx.save();
        ctx.translate(cx, cy);
        
        // 1. 核心 (空心)
        const bass = dataArray[5] / 255.0;
        ctx.beginPath();
        const coreRadius = radius * (0.8 + bass * 0.3);
        ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
        ctx.strokeStyle = theme.primary;
        ctx.lineWidth = 2 + bass * 8; 
        ctx.globalAlpha = 0.6 + bass * 0.4;
        ctx.shadowBlur = 15;
        ctx.shadowColor = theme.primary;
        ctx.stroke();
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;

        // 1.1 显示呼号 (动态)
        if (extra && extra.callsign && extra.opacity > 0) {
            ctx.save();
            ctx.globalAlpha = extra.opacity;
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const baseSize = radius * 0.4;
            const dynamicSize = baseSize * (1 + bass * 0.2); 
            ctx.font = `bold ${Math.floor(dynamicSize)}px "Roboto Mono", monospace`;
            
            ctx.shadowBlur = 10 + bass * 20;
            ctx.shadowColor = theme.primary;
            
            ctx.fillText(extra.callsign, 0, 0);
            ctx.restore();
        }

        // 2. 旋转环
        ctx.rotate(Date.now() * 0.0005); 
        const bars = 64; 
        const step = Math.floor(bufferLength / bars);
        
        for(let i = 0; i < bars; i++) { 
            const value = dataArray[i * step];
            const percent = value / 255;
            const angle = (i / bars) * Math.PI * 2;
            const nextAngle = ((i + 0.8) / bars) * Math.PI * 2;
            
            const innerR = radius;
            const barH = percent * (radius * 0.8);
            
            ctx.beginPath();
            ctx.arc(0, 0, innerR + barH, angle, nextAngle);
            ctx.arc(0, 0, innerR, nextAngle, angle, true);
            ctx.fillStyle = i % 2 === 0 ? theme.primary : theme.secondary;
            ctx.fill();
            
            if (percent > 0.5) {
                const outerStart = radius * 2.0;
                const outerEnd = outerStart + (percent * radius * 0.5);
                ctx.beginPath();
                ctx.moveTo(Math.cos(angle)*outerStart, Math.sin(angle)*outerStart);
                ctx.lineTo(Math.cos(angle)*outerEnd, Math.sin(angle)*outerEnd);
                ctx.strokeStyle = theme.secondary;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
        ctx.restore();

        this.drawTime(theme);
    }
}
