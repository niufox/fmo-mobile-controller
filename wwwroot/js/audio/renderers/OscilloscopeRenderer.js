import { BaseRenderer } from './BaseRenderer.js';

export class OscilloscopeRenderer extends BaseRenderer {
    draw(analyser, dataArray, bufferLength, theme) {
        analyser.getByteTimeDomainData(dataArray);
        const { ctx, width: w, height: h } = this;

        const time = Date.now() / 1000;
        const gridOffset = (time * 50) % 50;
        
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let gx = 0; gx < w; gx += 50) { ctx.moveTo(gx, 0); ctx.lineTo(gx, h); }
        for (let gy = gridOffset; gy < h; gy += 50) { ctx.moveTo(0, gy); ctx.lineTo(w, gy); }
        ctx.stroke();

        ctx.lineWidth = 2;
        ctx.strokeStyle = '#00ff00';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00ff00';
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
        ctx.shadowBlur = 0;

        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        for(let i=0; i<h; i+=3) { ctx.fillRect(0, i, w, 1); }
    }
}
