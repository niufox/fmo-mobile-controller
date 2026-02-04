
import { BaseRenderer } from '../core/base-renderer.js';

/**
 * 3. 波形模式渲染器 (WAVEFORM)
 * 3. Waveform Mode Renderer (WAVEFORM)
 */
export class WaveformRenderer extends BaseRenderer {
    /**
     * @param {AnalyserNode} analyser 
     * @param {Uint8Array} dataArray 
     * @param {number} bufferLength 
     * @param {object} theme 
     */
    draw(analyser, dataArray, bufferLength, theme) {
        analyser.getByteTimeDomainData(dataArray);
        const { ctx, width: w, height: h } = this;
        
        // 1. 电流光晕
        // 1. Electric Glow
        ctx.lineWidth = 3;
        ctx.strokeStyle = theme.primary;
        ctx.shadowBlur = 20;
        ctx.shadowColor = theme.primary;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        
        ctx.beginPath();
        const sliceWidth = w * 1.0 / bufferLength;
        let x = 0;
        for(let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * h/2;
            if(i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            x += sliceWidth;
        }
        ctx.stroke();
        
        // 2. 幻影重影 (RGB分离)
        // 2. Ghost Echo (RGB Split)
        ctx.lineWidth = 2;
        ctx.strokeStyle = theme.secondary;
        ctx.globalAlpha = 0.4;
        ctx.shadowBlur = 0;
        
        ctx.beginPath();
        x = 0;
        for(let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * h/2 + 4; 
            if(i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            x += sliceWidth;
        }
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        this.drawTime(theme);
    }
}
