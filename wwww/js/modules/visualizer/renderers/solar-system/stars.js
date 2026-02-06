/**
 * @fileoverview Star field and repeater station renderer for Solar System visualization
 */

/**
 * Manages the background star field and dynamic repeater station visualization
 */
export class StarField {
    constructor() {
        /** @type {Array<Object>} Background stars */
        this.stars = [];
        /** @type {Array<Object>} Active repeater station stars */
        this.repeaterStars = [];
        /** @type {Array<Object>} Available repeater station data */
        this.repeaterStations = [];
        
        /** @type {number} Global rotation angle for stars */
        this.starRotation = 0;
        
        // Repeater spawning configuration
        this.repeaterSpawnTimer = 0;
        this.repeaterSpawnInterval = 5000; // 5 seconds
        this.repeaterFadeInterval = 10000; // 10 seconds active
        
        this.initStars();
    }

    /**
     * Initialize background stars
     * @private
     */
    initStars() {
        for(let i = 0; i < 300; i++) {
            this.stars.push({
                r: Math.random() * 1.5, // Normalized polar radius
                angle: Math.random() * Math.PI * 2,
                size: Math.random() * 2.5 + 0.5,
                blinkSpeed: Math.random() * 0.005 + 0.002,
                blinkPhase: Math.random() * Math.PI * 2,
                baseAlpha: Math.random() * 0.5 + 0.2
            });
        }
    }

    /**
     * Update the list of available repeater stations
     * @param {Array<Object>} stations 
     */
    updateRepeaterStations(stations) {
        this.repeaterStations = stations.filter(s => s.name && s.name.length > 0);
    }

    /**
     * Render the star field and repeaters
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} width Canvas width
     * @param {number} height Canvas height
     * @param {number} energy Audio energy level (0-1) for twinkling
     * @param {Object} theme Theme colors
     */
    render(ctx, width, height, energy, theme) {
        const nowTime = Date.now();
        const cx = width / 2;
        const cy = height / 2;
        const maxDim = Math.max(width, height);
        
        this.starRotation += 0.0001;
        this.repeaterSpawnTimer += 16; // Assuming ~60fps call rate

        // --- Handle Repeater Spawning ---
        if (this.repeaterSpawnTimer >= this.repeaterSpawnInterval && this.repeaterStations.length > 0) {
            this.repeaterSpawnTimer = 0;
            // Randomly select 5-9 repeaters
            const count = Math.floor(Math.random() * 5) + 5;
            const shuffled = [...this.repeaterStations].sort(() => Math.random() - 0.5);
            const selectedRepeater = shuffled.slice(0, count);

            selectedRepeater.forEach(station => {
                const exists = this.repeaterStars.find(rs => rs.uid === station.uid);
                if (!exists) {
                    const starIndex = Math.floor(Math.random() * this.stars.length);
                    // Ensure star isn't already used
                    if (!this.repeaterStars.some(rs => rs.starIndex === starIndex)) {
                        this.repeaterStars.push({
                            ...station,
                            starIndex: starIndex,
                            spawnTime: nowTime,
                            alpha: 0,
                            phase: 'spawning', // spawning -> visible -> fading
                            blinkOffset: Math.random() * Math.PI * 2,
                            visibleStartTime: 0 // Set when fully spawned
                        });
                    }
                }
            });
        }

        // --- Render Repeaters ---
        // Iterate backwards to allow removal
        for (let i = this.repeaterStars.length - 1; i >= 0; i--) {
            const rs = this.repeaterStars[i];
            const baseStar = this.stars[rs.starIndex];
            
            if (!baseStar) {
                this.repeaterStars.splice(i, 1);
                continue;
            }

            // Lifecycle State Machine
            if (rs.phase === 'spawning') {
                rs.alpha += 0.05;
                if (rs.alpha >= 1) {
                    rs.alpha = 1;
                    rs.phase = 'visible';
                    rs.visibleStartTime = nowTime;
                }
            } else if (rs.phase === 'visible') {
                if (nowTime - rs.visibleStartTime > this.repeaterFadeInterval) {
                    rs.phase = 'fading';
                }
            } else if (rs.phase === 'fading') {
                rs.alpha -= 0.02;
                if (rs.alpha <= 0) {
                    this.repeaterStars.splice(i, 1);
                    continue;
                }
            }

            const blink = Math.sin(nowTime * baseStar.blinkSpeed + baseStar.blinkPhase + rs.blinkOffset);
            const starAlpha = Math.max(0.1, Math.min(1, baseStar.baseAlpha + blink * 0.3 + energy * 0.5));
            const finalAlpha = starAlpha * rs.alpha;

            const currentAngle = baseStar.angle + this.starRotation;
            const x = cx + Math.cos(currentAngle) * baseStar.r * maxDim * 0.8;
            const y = cy + Math.sin(currentAngle) * baseStar.r * maxDim * 0.8;

            // Glow
            ctx.save();
            ctx.shadowBlur = 15;
            ctx.shadowColor = theme.primary || '#ff9800';
            ctx.fillStyle = `rgba(255, 200, 100, ${finalAlpha * 0.6})`;
            ctx.beginPath();
            ctx.arc(x, y, baseStar.size * 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Core
            ctx.fillStyle = `rgba(255, 220, 150, ${finalAlpha})`;
            ctx.beginPath();
            ctx.arc(x, y, baseStar.size, 0, Math.PI * 2);
            ctx.fill();

            // Label
            // Only draw label if screen is large enough (minDim > 320px) to prevent clutter
            if (rs.alpha > 0.5 && rs.name && minDim > 320) {
                this.drawRepeaterLabel(ctx, x, y, rs.name, finalAlpha);
            }
        }

        // --- Render Background Stars ---
        this.stars.forEach((star, idx) => {
            // Skip stars currently occupied by repeaters
            if (this.repeaterStars.some(rs => rs.starIndex === idx)) return;

            const blink = Math.sin(nowTime * star.blinkSpeed + star.blinkPhase);
            const alpha = Math.max(0.1, Math.min(1, star.baseAlpha + blink * 0.3 + energy * 0.5));

            const currentAngle = star.angle + this.starRotation;
            const x = cx + Math.cos(currentAngle) * star.r * maxDim * 0.8;
            const y = cy + Math.sin(currentAngle) * star.r * maxDim * 0.8;

            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(x, y, star.size, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    /**
     * Draw the repeater station label
     * @private
     */
    drawRepeaterLabel(ctx, x, y, text, alpha) {
        ctx.save();
        ctx.font = 'bold 10px "Roboto Mono"';
        const textMetrics = ctx.measureText(text);
        const textW = textMetrics.width;
        const textH = 14;

        // Background
        ctx.fillStyle = `rgba(255, 152, 0, ${alpha * 0.7})`;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.roundRect(x - textW / 2 - 4, y - textH - 8, textW + 8, textH, 4);
        ctx.fill();

        // Text
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y - 14);
        ctx.restore();
    }
}
