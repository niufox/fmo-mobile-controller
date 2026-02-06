/**
 * @fileoverview Sci-Fi Radar Panel UI
 */

export class RadarPanel {
    constructor() {
        this.angle = 0;
        this.blips = [];
        this.lastUpdate = 0;
        
        // Initialize random blips with Linear Movement
        for(let i=0; i<3; i++) {
            this.blips.push(this.createBlip());
        }
    }

    createBlip() {
        // Position normalized (-1 to 1)
        return {
            x: (Math.random() - 0.5) * 1.6, 
            y: (Math.random() - 0.5) * 1.6,
            // Linear velocity
            vx: (Math.random() - 0.5) * 0.2, // Moderate speed
            vy: (Math.random() - 0.5) * 0.2,
            size: 2 + Math.random() * 3,
            pulse: Math.random() * Math.PI * 2
        };
    }

    /**
     * Update radar state
     * @param {number} dt 
     */
    update(dt) {
        this.angle += 2.0 * dt; // Scan line speed
        if (this.angle > Math.PI * 2) this.angle -= Math.PI * 2;
        
        this.blips.forEach(b => {
            b.pulse += dt * 5; // Faster pulse
            
            // Linear Movement
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            
            // Boundary check (Respawn if out of "range")
            if (b.x*b.x + b.y*b.y > 1.2) { // Circle radius ~1.1
                const newBlip = this.createBlip();
                Object.assign(b, newBlip);
            }
        });
    }

    /**
     * Render Radar Panel
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} w Canvas width
     * @param {number} h Canvas height
     * @param {Array} squadron List of fighters
     * @param {string} selfId ID of the current view/main fighter (to exclude)
     */
    render(ctx, w, h, squadron, selfId) {
        // Rectangular Panel Dimensions
        const panelH = Math.min(w, h) * 0.25; // 25% of min dimension height
        const panelW = panelH * 1.5; // Aspect Ratio 1.5:1 (Rectangular)
        
        const x = w - panelW - 20; // Right margin
        const y = h - panelH - 20; // Bottom margin
        const cx = x + panelW/2;
        const cy = y + panelH/2;
        
        // Radar Scan Radius (cover the rectangle corners)
        const r = Math.sqrt(panelW*panelW/4 + panelH*panelH/4);
        
        ctx.save();
        
        // 1. Panel Background (Glassy/Holographic)
        ctx.fillStyle = 'rgba(0, 20, 40, 0.5)';
        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 2;
        
        // Rectangular Frame with Chamfered Corners
        ctx.beginPath();
        const corner = 15;
        ctx.moveTo(x + corner, y);
        ctx.lineTo(x + panelW - corner, y);
        ctx.lineTo(x + panelW, y + corner);
        ctx.lineTo(x + panelW, y + panelH - corner);
        ctx.lineTo(x + panelW - corner, y + panelH);
        ctx.lineTo(x + corner, y + panelH);
        ctx.lineTo(x, y + panelH - corner);
        ctx.lineTo(x, y + corner);
        ctx.closePath();
        
        ctx.shadowColor = '#00f3ff';
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fill();
        
        // Clip content to this rectangle
        ctx.clip();
        
        // Inner Grid (Rectangular + Circular Arcs)
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.2)';
        ctx.lineWidth = 1;
        
        // Crosshair
        ctx.moveTo(cx - panelW/2, cy); ctx.lineTo(cx + panelW/2, cy);
        ctx.moveTo(cx, cy - panelH/2); ctx.lineTo(cx, cy + panelH/2);
        
        // Range Rings (Clipped by rect)
        ctx.arc(cx, cy, panelH * 0.3, 0, Math.PI * 2);
        ctx.moveTo(cx + panelH * 0.6, cy); // Move to next ring start to avoid connection line
        ctx.arc(cx, cy, panelH * 0.6, 0, Math.PI * 2);
        ctx.stroke();

        // 2. Scan Line (Rotating Sweep)
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, this.angle - 0.3, this.angle);
        ctx.lineTo(cx, cy);
        const scanGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        scanGrad.addColorStop(0, 'rgba(0, 243, 255, 0.0)');
        scanGrad.addColorStop(1, 'rgba(0, 243, 255, 0.2)');
        ctx.fillStyle = scanGrad;
        ctx.fill();
        
        // Scan Line Edge
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(this.angle) * r, cy + Math.sin(this.angle) * r);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 3. Random Blips (Simulation) - Linear Movement
        this.blips.forEach(b => {
            // Map normalized pos to screen
            // Use panelH/2 as scale reference (keep aspect ratio of space correct)
            const scale = panelH * 0.4; 
            const bx = cx + b.x * scale;
            const by = cy + b.y * scale;
            
            let alpha = 0.5 + Math.sin(b.pulse) * 0.5;
            
            ctx.beginPath();
            ctx.arc(bx, by, b.size, 0, Math.PI*2);
            ctx.fillStyle = `rgba(255, 50, 50, ${alpha})`;
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 6;
            ctx.fill();
            ctx.shadowBlur = 0;
            
            // Tail trail (Velocity vector)
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(bx - b.vx * 200, by - b.vy * 200); // Inverse velocity trail
            ctx.strokeStyle = `rgba(255, 50, 50, ${alpha * 0.5})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        });

        // 4. Nearest Targets (Real Data)
        if (squadron && squadron.length > 0) {
            // Find nearest
            const targets = squadron
                .filter(f => f.id !== selfId)
                .map(f => ({
                    id: f.id,
                    dist: Math.sqrt(f.pos.x*f.pos.x + f.pos.y*f.pos.y + f.pos.z*f.pos.z), // Dist from origin
                    z: f.pos.z
                }))
                .sort((a, b) => a.dist - b.dist)
                .slice(0, 3);
            
            // Display List (Overlay on top-left of radar)
            const listX = x + 10;
            const listY = y + 20;
            
            ctx.font = '10px "Courier New", monospace';
            ctx.textAlign = 'left';
            
            targets.forEach((t, i) => {
                const rowY = listY + i * 15;
                const alpha = 1.0 - i * 0.2;
                
                // Glowing Text
                ctx.shadowColor = '#00f3ff';
                ctx.shadowBlur = 4;
                ctx.fillStyle = `rgba(0, 243, 255, ${alpha})`;
                ctx.fillText(`TRG-${i+1}: ${t.id}`, listX, rowY);
                
                // Distance bar
                const barW = 30 * (10 / (t.dist || 1));
                ctx.fillRect(listX + 80, rowY - 6, Math.min(40, barW), 4);
                
                ctx.shadowBlur = 0;
            });
        }
        
        ctx.restore();

        // 5. Memory Monitor (Overlay)
        this.drawMemoryStats(ctx, w, h);
    }

    drawMemoryStats(ctx, w, h) {
        // Chrome/Chromium only
        if (window.performance && window.performance.memory) {
            const mem = window.performance.memory;
            const used = Math.round(mem.usedJSHeapSize / 1048576); // MB
            const total = Math.round(mem.totalJSHeapSize / 1048576);
            
            ctx.save();
            ctx.font = 'bold 12px "Courier New", monospace';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'top';
            
            // Alarm Logic: > 100MB (Mobile Optimization Target)
            const isCritical = used > 100; 
            
            const text = `MEM: ${used} / ${total} MB`;
            const x = w - 20; // Align with Radar right margin
            const y = h - Math.min(w, h) * 0.25 - 40; // Above Radar
            
            // Background Box
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            const textWidth = ctx.measureText(text).width;
            ctx.fillRect(x - textWidth - 10, y - 5, textWidth + 20, 20);
            
            if (isCritical) {
                ctx.fillStyle = '#ff0000';
                // Blink effect
                if (Math.floor(Date.now() / 500) % 2 === 0) { 
                    ctx.fillText('⚠ MEMORY HIGH ⚠', x, y - 15);
                }
            } else {
                ctx.fillStyle = '#00ff00';
            }
            
            ctx.fillText(text, x, y);
            ctx.restore();
        }
    }
}
