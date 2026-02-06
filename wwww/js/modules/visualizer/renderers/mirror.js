
import { BaseRenderer } from '../core/base-renderer.js';

/**
 * 2. 镜像模式渲染器 (MIRROR)
 * 优化：离屏Canvas缓存背景
 */
export class MirrorRenderer extends BaseRenderer {
    /**
     * @param {CanvasRenderingContext2D} ctx 
     */
    constructor(ctx) {
        super(ctx);
        this.bgCanvas = document.createElement('canvas');
        this.bgCtx = this.bgCanvas.getContext('2d');
        this.bgCached = false;
    }

    /**
     * @param {number} w 
     * @param {number} h 
     */
    resize(w, h) {
        super.resize(w, h);
        this.bgCanvas.width = w;
        this.bgCanvas.height = h;
        this.bgCached = false;
    }

    drawBackground() {
        if (this.bgCached) return;
        const { width: w, height: h } = this;
        const ctx = this.bgCtx;
        
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for(let i=0; i<=w; i+=40) { ctx.moveTo(i, 0); ctx.lineTo(i, h); }
        for(let i=0; i<=h; i+=40) { ctx.moveTo(0, i); ctx.lineTo(w, i); }
        ctx.stroke();
        this.bgCached = true;
    }

    /**
     * @param {AnalyserNode} analyser 
     * @param {Uint8Array} dataArray 
     * @param {number} bufferLength 
     * @param {object} theme 
     */
    draw(analyser, dataArray, bufferLength, theme) {
        analyser.getByteFrequencyData(dataArray);
        const { ctx, width: w, height: h } = this;
        const cx = w / 2;
        const cy = h / 2;

        this.drawBackground();
        ctx.drawImage(this.bgCanvas, 0, 0);

        const bars = 48;
        const step = Math.floor(bufferLength / bars);
        const barW = (w / 2) / bars;

        for(let i = 0; i < bars; i++) {
            const value = dataArray[i * step];
            const percent = value / 255;
            let barH = percent * (h * 0.7);
            if (i < 5) barH *= 1.2;

            ctx.fillStyle = i % 3 === 0 ? theme.secondary : theme.primary;
            
            if (percent > 0.6) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = ctx.fillStyle;
            } else {
                ctx.shadowBlur = 0;
            }

            const xOffset = i * barW;
            const blockHeight = 6;
            const gap = 2;
            const totalBlocks = Math.floor(barH / (blockHeight + gap));

            for (let b = 0; b < totalBlocks; b++) {
                ctx.globalAlpha = 1.0 - (b / totalBlocks) * 0.6;
                const yOffset = b * (blockHeight + gap);
                
                ctx.fillRect(cx + xOffset, cy - yOffset, barW - 2, blockHeight);
                ctx.fillRect(cx + xOffset, cy + yOffset, barW - 2, blockHeight);
                ctx.fillRect(cx - xOffset - barW, cy - yOffset, barW - 2, blockHeight);
                ctx.fillRect(cx - xOffset - barW, cy + yOffset, barW - 2, blockHeight);
            }
        }
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;

        const bass = dataArray[3] / 255;
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.5 + bass * 0.5;
        ctx.fillRect(cx - 1, cy - (h/2)*bass, 2, h*bass);
        ctx.globalAlpha = 1.0;

        this.drawTime(theme);
    }
}
