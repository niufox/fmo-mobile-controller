/**
 * @fileoverview Missile System for Space Fighter
 * Implements interactive missile launch with physics and effects
 */

/**
 * Single Missile Entity
 */
class Missile {
    /**
     * @param {number} x Position X
     * @param {number} y Position Y
     * @param {number} z Position Z
     * @param {Object} velocity {x,y,z}
     * @param {string} callsign Speaker callsign
     */
    constructor(x, y, z, velocity, callsign) {
        // 1. Model Specs (Randomized)
        // Diameter: 0.3 - 0.6m
        this.diameter = 0.3 + Math.random() * 0.3;
        // Aspect Ratio: 3:1 to 5:1
        const ratio = 3 + Math.random() * 2;
        this.length = this.diameter * ratio; // 0.9m - 3.0m

        // 2. Physics State
        this.pos = { x, y, z };
        this.vel = { ...velocity }; // Copy vector
        this.acc = 8 + Math.random() * 4; // 8 - 12 m/s^2
        this.gravity = 0.5 + Math.random() * 0.3; // 0.5 - 0.8
        
        // 3. Info
        this.callsign = callsign;
        this.life = 10.0; // Safety timeout
        this.active = true;

        // 4. Trail System
        this.trail = [];
        this.trailTimer = 0;
        this.trailFadeTime = 0.5 + Math.random() * 0.5; // 0.5 - 1.0s
        
        // 5. Visuals
        this.colorBody = '#E0E0E0';
        this.colorHead = '#FF3333';
    }

    /**
     * Update missile physics and trail
     * @param {number} dt Delta time
     */
    update(dt) {
        if (!this.active) return;

        // --- Physics Simulation ---
        
        // 1. Acceleration (Propulsion) - Direction of current velocity
        const speed = Math.sqrt(this.vel.x**2 + this.vel.y**2 + this.vel.z**2);
        if (speed > 0) {
            const dir = { x: this.vel.x/speed, y: this.vel.y/speed, z: this.vel.z/speed };
            this.vel.x += dir.x * this.acc * dt;
            this.vel.y += dir.y * this.acc * dt;
            this.vel.z += dir.z * this.acc * dt;
        }

        // 2. Gravity (Parabolic Trajectory)
        // Assuming +Y is "down" in the visualizer 3D space (screen coordinate system)
        this.vel.y += this.gravity * 9.8 * dt;

        // 3. Position Update
        this.pos.x += this.vel.x * dt;
        this.pos.y += this.vel.y * dt;
        this.pos.z += this.vel.z * dt;

        // 4. Lifecycle
        this.life -= dt;
        if (this.life <= 0 || this.pos.y > 100) { // Off screen (bottom)
            this.active = false;
        }

        // --- Trail System ---
        
        // Emission
        this.trailTimer += dt;
        // Density: 50-100 particles/sec
        const emissionRate = 50 + Math.random() * 50;
        const interval = 1 / emissionRate;
        
        while (this.trailTimer > interval) {
            this.trailTimer -= interval;
            this.addTrailParticle(speed);
        }

        // Update Particles
        for (let i = this.trail.length - 1; i >= 0; i--) {
            const p = this.trail[i];
            p.life -= dt;
            if (p.life <= 0) {
                this.trail.splice(i, 1);
            }
        }
    }

    /**
     * Add a single trail particle
     * @param {number} missileSpeed Current speed for length scaling
     */
    addTrailParticle(missileSpeed) {
        // Tail position (approximate, opposite to velocity)
        // Simply use current pos for "exhaust" point
        this.trail.push({
            x: this.pos.x + (Math.random()-0.5)*0.1,
            y: this.pos.y + (Math.random()-0.5)*0.1,
            z: this.pos.z + (Math.random()-0.5)*0.1,
            life: this.trailFadeTime,
            maxLife: this.trailFadeTime,
            size: this.diameter * (0.8 + Math.random() * 0.4), // Random size around nozzle size
            // Initial velocity for trail (slight spread)
            vx: (Math.random()-0.5) * 1.0,
            vy: (Math.random()-0.5) * 1.0,
            vz: (Math.random()-0.5) * 1.0
        });
    }

    /**
     * Render the missile
     * @param {CanvasRenderingContext2D} ctx 
     * @param {Function} transformFn 3D Projection function
     */
    render(ctx, transformFn) {
        if (!this.active) return;

        // Project Position
        const t = transformFn(this.pos.x, this.pos.y, this.pos.z);
        if (!t || t.p <= 0) return; // Behind camera or invalid

        const scale = t.p * 20; // Base scale factor
        
        // LOD Check: Distance > 500m (Approximated by low perspective scale)
        // If t.p is very small, object is far. 
        // Let's say p=1 is close, p=0.01 is far.
        const isLOD = t.p < 0.05; // ~20x distance

        // --- 1. Draw Tail Flame ---
        this.renderTrail(ctx, transformFn, scale);

        // --- 2. Draw Missile Body ---
        this.renderBody(ctx, transformFn, t, scale, isLOD);

        // --- 3. Draw Subtitle ---
        if (!isLOD) {
            this.renderSubtitle(ctx, t, scale);
        }
    }

    renderTrail(ctx, transformFn, scale) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        
        for (const p of this.trail) {
            const pt = transformFn(p.x, p.y, p.z);
            if (!pt || pt.p <= 0) continue;

            const alpha = p.life / p.maxLife;
            // Size fades with life
            const pSize = (pt.p * 20) * p.size * alpha; 

            // Blue Gradient: RGB(0,100,255) -> RGB(100,200,255)
            const r = 100 * (1-alpha); // 0 -> 100
            const g = 100 + 100 * (1-alpha); // 100 -> 200
            const b = 255;

            ctx.fillStyle = `rgba(${Math.floor(r)},${Math.floor(g)},${b},${alpha})`;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, Math.max(0.5, pSize), 0, Math.PI*2);
            ctx.fill();
        }
        ctx.restore();
    }

    renderBody(ctx, transformFn, t, scale, isLOD) {
        // Calculate rotation based on velocity
        const nextPos = {
            x: this.pos.x + this.vel.x * 0.1,
            y: this.pos.y + this.vel.y * 0.1,
            z: this.pos.z + this.vel.z * 0.1
        };
        const nt = transformFn(nextPos.x, nextPos.y, nextPos.z);
        
        if (nt) {
            const angle = Math.atan2(nt.y - t.y, nt.x - t.x);
            const len = this.length * scale;
            const width = this.diameter * scale;

            ctx.save();
            ctx.translate(t.x, t.y);
            ctx.rotate(angle);
            
            if (isLOD) {
                // Simplified Line
                ctx.strokeStyle = '#CCCCCC';
                ctx.lineWidth = width;
                ctx.beginPath();
                ctx.moveTo(-len/2, 0);
                ctx.lineTo(len/2, 0);
                ctx.stroke();
            } else {
                // Cylinder Approximation
                ctx.fillStyle = this.colorBody;
                ctx.fillRect(-len/2, -width/2, len, width);
                
                // Warhead
                ctx.fillStyle = this.colorHead;
                ctx.fillRect(len/2 - len*0.25, -width/2, len*0.25, width);
            }
            
            ctx.restore();
        }
    }

    renderSubtitle(ctx, t, scale) {
        if (!this.callsign) return;

        ctx.save();
        // Font size proportional to missile size
        const fontSize = Math.max(10, Math.floor(this.diameter * 20 * t.p * 2)); 
        ctx.font = `bold ${fontSize}px "Roboto Mono", monospace`;
        
        const text = this.callsign;
        const metrics = ctx.measureText(text);
        const padding = 4;
        const w = metrics.width + padding * 2;
        const h = fontSize + padding * 2;
        
        // Position: Above missile
        const x = t.x;
        const y = t.y - (20 * scale) - h/2;

        // Semi-transparent background
        ctx.fillStyle = 'rgba(0, 20, 40, 0.7)';
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.5)';
        ctx.lineWidth = 1;
        
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(x - w/2, y - h/2, w, h, 4);
        } else {
            ctx.rect(x - w/2, y - h/2, w, h);
        }
        ctx.fill();
        ctx.stroke();

        // Text
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y);

        ctx.restore();
    }
}

/**
 * Manager for Missile System
 */
export class MissileSystem {
    constructor() {
        this.missiles = [];
        this.maxMissiles = 20;
    }

    /**
     * Trigger a new missile launch
     * @param {Object} origin {x,y,z}
     * @param {Object} velocity {x,y,z} Initial velocity vector
     * @param {string} callsign 
     */
    launch(origin, velocity, callsign) {
        if (this.missiles.length >= this.maxMissiles) {
            this.missiles.shift();
        }
        const vel = { ...velocity };
        // Add slight spread
        vel.x += (Math.random() - 0.5) * 0.5; // Speed variation
        vel.y += (Math.random() - 0.5) * 0.5; // Pitch spread
        vel.z += (Math.random() - 0.5) * 0.5; // Yaw spread
        
        this.missiles.push(new Missile(origin.x, origin.y, origin.z, vel, callsign));
    }

    /**
     * Update all missiles
     * @param {number} dt 
     */
    update(dt) {
        for (let i = this.missiles.length - 1; i >= 0; i--) {
            const m = this.missiles[i];
            m.update(dt);
            if (!m.active) {
                this.missiles.splice(i, 1);
            }
        }
    }

    /**
     * Render all missiles
     * @param {CanvasRenderingContext2D} ctx 
     * @param {Function} transformFn 
     */
    render(ctx, transformFn) {
        for (const m of this.missiles) {
            m.render(ctx, transformFn);
        }
    }
}
