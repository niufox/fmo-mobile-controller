import { BaseRenderer } from './BaseRenderer.js';

export class ParticlesRenderer extends BaseRenderer {
    constructor(ctx) {
        super(ctx);
        this.particles = [];
        this.initialized = false;
    }

    resize(w, h) {
        super.resize(w, h);
        if (!this.initialized) {
            this.initParticles(w, h);
            this.initialized = true;
        }
    }

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
    }
}
