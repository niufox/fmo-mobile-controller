/**
 * @fileoverview Exhaust Particle System for Space Fighters
 */

/**
 * Individual exhaust particle
 */
class ExhaustParticle {
    constructor(x, y, z, vx, vy, vz, life, color, sizeScale = 0.5, baseAlpha = 1.0) {
        this.reset(x, y, z, vx, vy, vz, life, color, sizeScale, baseAlpha);
    }

    reset(x, y, z, vx, vy, vz, life, color, sizeScale, baseAlpha) {
        this.x = x; this.y = y; this.z = z;
        this.vx = vx; this.vy = vy; this.vz = vz;
        this.life = life;
        this.maxLife = life;
        this.color = color;
        this.sizeScale = sizeScale;
        this.baseAlpha = baseAlpha;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.z += this.vz * dt;
        this.life -= dt;
        // Turbulence (Cone expansion)
        // Expand more as life decreases (further from source)
        const age = 1.0 - this.life / this.maxLife;
        const expansion = 0.3 * age; // Increased expansion for cone shape
        this.x += (Math.random() - 0.5) * expansion * dt;
        this.y += (Math.random() - 0.5) * expansion * dt;
    }
}

/**
 * Manages exhaust particles for a fighter
 */
export class ExhaustSystem {
    constructor(fighterScale = 1.0) {
        this.particles = [];
        this.pool = []; // Object pool for particles
        this.emissionRate = 0.01; // Seconds per particle per nozzle
        this.timer = 0;
        this.fighterScale = fighterScale;
    }

    /**
     * Get particle from pool or create new one
     */
    getParticle(x, y, z, vx, vy, vz, life, color, sizeScale, baseAlpha) {
        if (this.pool.length > 0) {
            const p = this.pool.pop();
            p.reset(x, y, z, vx, vy, vz, life, color, sizeScale, baseAlpha);
            return p;
        }
        return new ExhaustParticle(x, y, z, vx, vy, vz, life, color, sizeScale, baseAlpha);
    }

    /**
     * Return particle to pool
     */
    returnParticle(p) {
        this.pool.push(p);
    }

    /**
     * Update system state
     * @param {number} dt Delta time in seconds
     * @param {Array<Object>} nozzles Array of {x, y, z} positions
     * @param {number} bass Audio bass level (0-1)
     * @param {boolean} isSpeaking Whether someone is speaking
     */
    update(dt, nozzles, bass, isSpeaking = false) {
        // Emit new particles
        const speakingBoost = isSpeaking ? 1.5 : 1.0;
        const boost = (1.0 + bass * 0.5) * speakingBoost;
        const speed = 4.0 * boost; // Faster speed for tighter stream
        
        // Size scale: Smaller default (0.15), larger when speaking (0.5) - Thinner as requested
        const baseSizeScale = (isSpeaking ? 0.5 : 0.15) * this.fighterScale;
        
        for(let n of nozzles) {
            // Emission Rate
            let count = Math.floor(dt / 0.002); 
            if (isSpeaking) count = Math.floor(count * 1.2);
            if (count > 10) count = 10;
            
            for(let i=0; i<count; i++) {
                // Layer 1: Core (White/Hot) - High energy, opaque, very tight
                // Emit backwards (-X)
                this.particles.push(this.getParticle(
                    n.x, n.y, n.z,
                    -(speed + Math.random()), (Math.random()-0.5)*0.02, (Math.random()-0.5)*0.02, // -X
                    0.25, '#FFFFFF',
                    baseSizeScale * 0.8,
                    1.0 // Opaque core
                ));
                // Layer 2: Mid (Cyan/Blue) - Semi-transparent, medium spread
                this.particles.push(this.getParticle(
                    n.x, n.y, n.z,
                    -(speed * 0.9), (Math.random()-0.5)*0.08, (Math.random()-0.5)*0.08, 
                    0.35, '#00FFFF',
                    baseSizeScale,
                    0.5 // Semi-transparent
                ));
                // Layer 3: Outer (Dark Blue/Purple) - Highly transparent, wide cone start
                this.particles.push(this.getParticle(
                    n.x, n.y, n.z,
                    -(speed * 0.7), (Math.random()-0.5)*0.2, (Math.random()-0.5)*0.2,
                    0.45, '#4169E1',
                    baseSizeScale * 1.2,
                    0.2 // Very transparent edges
                ));
            }
        }

        // Update existing
        for(let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.update(dt);
            if(p.life <= 0) {
                this.returnParticle(p);
                this.particles.splice(i, 1);
            }
        }
    }

    /**
     * Render exhaust particles
     * @param {CanvasRenderingContext2D} ctx 
     * @param {Function} transformFn Coordinate transform function
     */
    render(ctx, transformFn) {
        ctx.save();
        // Use 'lighter' for additive blending to make core hot
        ctx.globalCompositeOperation = 'lighter';
        
        for(let p of this.particles) {
            const t = transformFn(p.x, p.y, p.z);
            if (!t) continue;
            // Alpha fades with life, modulated by baseAlpha (layer transparency)
            const lifeRatio = p.life / p.maxLife;
            const alpha = lifeRatio * p.baseAlpha;
            
            // Size grows slightly as it fades (expansion)
            const size = (t.p * 20) * (1 - lifeRatio * 0.2) * p.sizeScale;
            
            ctx.beginPath();
            ctx.arc(t.x, t.y, Math.max(0.5, size), 0, Math.PI*2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = alpha;
        ctx.fill();
        }
        ctx.restore();
    }

    /**
     * Update exhaust system scale
     * @param {number} scale New fighter scale
     */
    setScale(scale) {
        this.fighterScale = scale;
    }
}
