/**
 * @fileoverview Exhaust Particle System for Space Fighters
 */

/**
 * Individual exhaust particle
 * 单个排气粒子
 */
class ExhaustParticle {
    constructor(x, y, z, vx, vy, vz, life, color) {
        this.x = x; this.y = y; this.z = z;
        this.vx = vx; this.vy = vy; this.vz = vz;
        this.life = life;
        this.maxLife = life;
        this.color = color;
    }

    /**
     * Update particle position and life
     * 更新粒子位置和生命值
     * @param {number} dt Delta time 时间增量
     */
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.z += this.vz * dt;
        this.life -= dt;
        // Turbulence
        // 湍流效果
        this.x += (Math.random() - 0.5) * 0.1 * dt;
        this.y += (Math.random() - 0.5) * 0.1 * dt;
    }
}

/**
 * Manages exhaust particles for a fighter
 * 管理战机的排气粒子系统
 */
export class ExhaustSystem {
    constructor() {
        this.particles = [];
        this.emissionRate = 0.01; // Seconds per particle per nozzle // 每个喷口每秒产生的粒子数
        this.timer = 0;
    }

    /**
     * Update system state
     * 更新系统状态
     * @param {number} dt Delta time in seconds 秒级时间增量
     * @param {Array<Object>} nozzles Array of {x, y, z} positions 喷口位置数组
     * @param {number} bass Audio bass level (0-1) 音频低音电平 (0-1)
     */
    update(dt, nozzles, bass) {
        // Emit new particles
        // 发射新粒子
        const boost = 1.0 + bass * 2.0;
        const speed = 5.0 * boost;
        
        for(let n of nozzles) {
            // High rate emission
            // 高频发射
            let count = Math.floor(dt / 0.005); 
            if (count > 5) count = 5; // Limit // 限制最大数量
            
            for(let i=0; i<count; i++) {
                // Layer 1: Core (White/Hot)
                // 第一层：核心（白色/高温）
                this.particles.push(new ExhaustParticle(
                    n.x, n.y, n.z,
                    (Math.random()-0.5)*0.5, (Math.random()-0.5)*0.5, speed + Math.random(),
                    0.2, '#FFFFFF'
                ));
                // Layer 2: Mid (Cyan/Blue)
                // 第二层：中间层（青色/蓝色）
                this.particles.push(new ExhaustParticle(
                    n.x, n.y, n.z,
                    (Math.random()-0.5)*1.0, (Math.random()-0.5)*1.0, speed * 0.8,
                    0.4, '#00FFFF'
                ));
                // Layer 3: Outer (Dark Blue/Purple) - Wide spray
                // 第三层：外层（深蓝/紫色）- 宽喷射
                this.particles.push(new ExhaustParticle(
                    n.x, n.y, n.z,
                    (Math.random()-0.5)*2.0, (Math.random()-0.5)*2.0, speed * 0.6,
                    0.6, '#4169E1'
                ));
            }
        }

        // Update existing
        // 更新现有粒子
        for(let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.update(dt);
            if(p.life <= 0) this.particles.splice(i, 1);
        }
    }

    /**
     * Render exhaust particles
     * 渲染排气粒子
     * @param {CanvasRenderingContext2D} ctx Context 画布上下文
     * @param {Function} transformFn Coordinate transform function 坐标变换函数
     */
    render(ctx, transformFn) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter'; // Additive blending for flame // 火焰使用加色混合
        
        for(let p of this.particles) {
            const t = transformFn(p.x, p.y, p.z);
            if (!t) continue;

            const alpha = p.life / p.maxLife;
            const size = (t.p * 10) * (1 - alpha) * 0.5;
            
            ctx.fillStyle = p.color;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(t.x, t.y, Math.max(0.5, size), 0, Math.PI*2);
            ctx.fill();
        }
        ctx.restore();
    }
}
