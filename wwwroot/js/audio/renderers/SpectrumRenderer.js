import { BaseRenderer } from './BaseRenderer.js';

export class SpectrumRenderer extends BaseRenderer {
    constructor(ctx) {
        super(ctx);
        this.peaks = [];
    }

    draw(analyser, dataArray, bufferLength, theme) {
        analyser.getByteFrequencyData(dataArray);
        const { ctx, width: w, height: h } = this;
        
        const displayW = this.ctx.canvas.clientWidth || (w / window.devicePixelRatio);
        const barCount = Math.max(24, Math.min(36, Math.floor(displayW / 12)));
        const step = Math.max(1, Math.floor(bufferLength / barCount));
        
        const startX = w * 0.2;
        const availableW = w * 0.8;
        const colWidth = availableW / barCount;
        const groundY = h * 0.85;
        
        if (this.peaks.length !== barCount) this.peaks = new Array(barCount).fill(0);

        ctx.shadowBlur = 0;
        ctx.shadowColor = theme.primary;

        for(let i = 0; i < barCount; i++) {
            const value = dataArray[i * step] || 0;
            const barHeight = (value / 255) * groundY * 0.95; 
            const x = startX + i * colWidth + colWidth/2;
            
            const particleCount = Math.floor(barHeight / 14); 
            for (let j = 0; j < particleCount; j++) {
                const y = groundY - (j * 14 + 10);
                const ratio = j / particleCount; 
                
                ctx.beginPath();
                const size = 3 + ratio * 3.5; 
                ctx.arc(x, y, size, 0, Math.PI * 2);
                
                if (j === particleCount - 1) {
                    ctx.fillStyle = '#ffffff';
                    ctx.shadowBlur = 8;
                    ctx.shadowColor = '#ffffff';
                } else {
                    ctx.fillStyle = i % 2 === 0 ? theme.primary : theme.secondary;
                    ctx.shadowBlur = 0;
                }
                
                ctx.globalAlpha = ratio * 0.7 + 0.3;
                ctx.fill();
            }
            ctx.shadowBlur = 0;

            const reflectCount = Math.floor(particleCount / 3);
            for (let j = 0; j < reflectCount; j++) {
                const y = groundY + (j * 14 + 10);
                if (y > h) break;
                const ratio = 1 - (j / reflectCount);
                ctx.beginPath();
                ctx.arc(x, y, 2.5, 0, Math.PI * 2);
                ctx.fillStyle = i % 2 === 0 ? theme.primary : theme.secondary;
                ctx.globalAlpha = ratio * 0.15;
                ctx.fill();
            }
            
            if (barHeight > this.peaks[i]) this.peaks[i] = barHeight;
            else this.peaks[i] -= 2; 
            
            if (this.peaks[i] > 0) {
                const peakY = groundY - this.peaks[i] - 12;
                ctx.beginPath();
                ctx.arc(x, peakY, 3, 0, Math.PI * 2);
                ctx.fillStyle = theme.secondary;
                ctx.globalAlpha = 1.0;
                ctx.fill();
            }
        }
        
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(w, groundY);
        ctx.strokeStyle = theme.primary;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.4;
        ctx.stroke();
        ctx.globalAlpha = 1.0;
    }
}
