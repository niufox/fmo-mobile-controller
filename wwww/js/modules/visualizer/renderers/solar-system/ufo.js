/**
 * UFO Easter Egg Controller
 */
export class UFOController {
    constructor() {
        this.active = false;
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.size = 2.0;
        this.angle = 0;
        
        // Bezier points
        this.p0 = { x: 0, y: 0 };
        this.p1 = { x: 0, y: 0 };
        this.p2 = { x: 0, y: 0 };
        
        this.t = 0;
        this.tSpeed = 0.001;
        
        this.shape = 'classic';
        this.colorBody = '#e0e0e0';
        this.colorDome = '#a0a0a0';
    }

    /**
     * Trigger a new UFO flight
     * @param {number} w Screen width
     * @param {number} h Screen height
     */
    trigger(w, h) {
        if (this.active) return;
        
        const offset = 100;
        const side = Math.floor(Math.random() * 4);
        let startX, startY;
        
        switch(side) {
            case 0: startX = Math.random() * w; startY = -offset; break; // Top
            case 1: startX = w + offset; startY = Math.random() * h; break; // Right
            case 2: startX = Math.random() * w; startY = h + offset; break; // Bottom
            case 3: startX = -offset; startY = Math.random() * h; break; // Left
        }
        
        // Target central area
        const targetX = w/2 + (Math.random() - 0.5) * w * 0.5;
        const targetY = h/2 + (Math.random() - 0.5) * h * 0.5;
        
        const dx = targetX - startX;
        const dy = targetY - startY;
        
        const extendFactor = 4.0;
        const p2x = startX + dx * extendFactor;
        const p2y = startY + dy * extendFactor;
        
        const midX = (startX + p2x) / 2;
        const midY = (startY + p2y) / 2;
        
        const dist = Math.sqrt(dx*dx + dy*dy);
        const perpX = -dy / dist;
        const perpY = dx / dist;
        
        const curveDirection = Math.random() < 0.5 ? 1 : -1;
        const curveIntensity = (Math.min(w, h) * 0.8) * (0.8 + Math.random()); 
        
        const p1x = midX + perpX * curveIntensity * curveDirection;
        const p1y = midY + perpY * curveIntensity * curveDirection;
        
        this.p0 = { x: startX, y: startY };
        this.p1 = { x: p1x, y: p1y };
        this.p2 = { x: p2x, y: p2y };
        
        this.t = 0;
        const desiredDuration = 10 + Math.random() * 5; // 10-15s
        this.tSpeed = 1.0 / (desiredDuration * 60);

        this.size = 1.0 + Math.random() * 3.0; 
        
        const shapes = ['classic', 'triangle', 'cigar', 'orb'];
        this.shape = shapes[Math.floor(Math.random() * shapes.length)];

        const hue = Math.floor(Math.random() * 360);
        this.colorBody = `hsl(${hue}, 80%, 85%)`; 
        this.colorDome = `hsl(${hue}, 80%, 50%)`; 
        
        this.active = true;
        this.angle = 0;
    }

    /**
     * Update UFO state
     * @returns {boolean} True if active, false if finished
     */
    update() {
        if (!this.active) return false;
        
        this.t += this.tSpeed;
        
        if (this.t > 1.0) {
            this.active = false;
            return false;
        }
        
        const t = this.t;
        const invT = 1 - t;
        
        const nextX = (invT * invT * this.p0.x) + (2 * invT * t * this.p1.x) + (t * t * this.p2.x);
        const nextY = (invT * invT * this.p0.y) + (2 * invT * t * this.p1.y) + (t * t * this.p2.y);
        
        this.vx = nextX - this.x;
        this.vy = nextY - this.y;
        
        this.x = nextX;
        this.y = nextY;
        
        this.angle += 0.05;
        
        return true;
    }

    /**
     * Render the UFO
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} scale 
     */
    render(ctx, scale) {
        if (!this.active) return;
        
        const ufoSize = Math.max(3, this.size * scale * 0.12);
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.atan2(this.vy, this.vx) * 0.1);
        
        const time = Date.now();

        if (this.shape === 'triangle') {
            this.drawTriangle(ctx, ufoSize, time);
        } else if (this.shape === 'cigar') {
            this.drawCigar(ctx, ufoSize, time);
        } else if (this.shape === 'orb') {
            this.drawOrb(ctx, ufoSize);
        } else {
            this.drawClassic(ctx, ufoSize, time);
        }
        
        ctx.restore();
    }

    drawTriangle(ctx, ufoSize, time) {
        ctx.fillStyle = this.colorBody;
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#000000';
        ctx.beginPath();
        ctx.moveTo(ufoSize * 1.2, 0);
        ctx.lineTo(-ufoSize * 0.8, -ufoSize);
        ctx.lineTo(-ufoSize * 0.8, ufoSize);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        
        ctx.fillStyle = this.colorDome;
        ctx.beginPath();
        ctx.arc(-ufoSize*0.2, 0, ufoSize * 0.3, 0, Math.PI * 2);
        ctx.fill();

        const lights = [
            {x: ufoSize * 1.2, y: 0},
            {x: -ufoSize * 0.8, y: -ufoSize},
            {x: -ufoSize * 0.8, y: ufoSize}
        ];
        lights.forEach((l, i) => {
            ctx.fillStyle = (Math.floor(time / 150) + i) % 2 === 0 ? '#ff0000' : '#ffffff';
            ctx.beginPath();
            ctx.arc(l.x, l.y, ufoSize * 0.15, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    drawCigar(ctx, ufoSize, time) {
        const length = ufoSize * 3.0;
        const width = ufoSize * 0.8;
        const halfL = length / 2;
        const radius = width / 2;
        
        ctx.fillStyle = this.colorBody;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.colorDome;
        
        ctx.beginPath();
        ctx.arc(-halfL + radius, 0, radius, Math.PI/2, Math.PI * 1.5);
        ctx.arc(halfL - radius, 0, radius, -Math.PI/2, Math.PI/2);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;

        const windowCount = 5;
        const step = (length - width) / (windowCount - 1);
        const startX = -(length - width) / 2;
        
        for(let i=0; i<windowCount; i++) {
            ctx.fillStyle = (Math.floor(time / 200) + i) % 2 === 0 ? this.colorDome : '#111';
            ctx.beginPath();
            ctx.arc(startX + i * step, 0, width * 0.2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawOrb(ctx, ufoSize) {
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.colorDome;
        ctx.beginPath();
        ctx.arc(0, 0, ufoSize * 0.8, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = this.colorBody;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, ufoSize * 1.1, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    drawClassic(ctx, ufoSize, time) {
        ctx.fillStyle = this.colorDome || '#a0a0a0';
        ctx.beginPath();
        ctx.arc(0, -ufoSize*0.3, ufoSize*0.6, Math.PI, 0);
        ctx.fill();
        
        ctx.fillStyle = this.colorBody || '#e0e0e0';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(0, 0, ufoSize, ufoSize*0.4, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        const lightCount = 5;
        for(let k=0; k<lightCount; k++) {
            const la = (k / lightCount) * Math.PI * 2 + this.angle;
            const lx = Math.cos(la) * ufoSize * 0.7;
            const ly = Math.sin(la) * ufoSize * 0.25;
            ctx.fillStyle = (Math.floor(time / 100) + k) % 2 === 0 ? '#ff0000' : '#00ff00';
            ctx.beginPath();
            ctx.arc(lx, ly, ufoSize*0.15, 0, Math.PI*2);
            ctx.fill();
        }
    }
}
