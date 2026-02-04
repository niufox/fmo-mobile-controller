/**
 * @fileoverview Star field and repeater station renderer for Solar System visualization
 * 太阳系可视化的星空和中继站渲染器
 */

/**
 * Manages the background star field and dynamic repeater station visualization
 * 管理背景星空和动态中继站可视化
 */
export class StarField {
    constructor() {
        /** @type {Array<Object>} Background stars 背景星星 */
        this.stars = [];
        /** @type {Array<Object>} Active repeater station stars 活跃的中继站星星 */
        this.repeaterStars = [];
        /** @type {Array<Object>} Available repeater station data 可用的中继站数据 */
        this.repeaterStations = [];
        
        /** @type {number} Global rotation angle for stars 星星的全局旋转角度 */
        this.starRotation = 0;
        
        // Repeater spawning configuration
        // 中继站生成配置
        this.repeaterSpawnTimer = 0;
        this.repeaterSpawnInterval = 5000; // 5 seconds // 5秒
        this.repeaterFadeInterval = 10000; // 10 seconds active // 10秒活跃时间
        
        this.initStars();
    }

    /**
     * Initialize background stars
     * 初始化背景星星
     * @private
     */
    initStars() {
        for(let i = 0; i < 300; i++) {
            this.stars.push({
                r: Math.random() * 1.5, // Normalized polar radius // 归一化极坐标半径
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
     * 更新可用的中继站列表
     * @param {Array<Object>} stations List of stations 中继站列表
     */
    updateRepeaterStations(stations) {
        this.repeaterStations = stations.filter(s => s.name && s.name.length > 0);
    }

    /**
     * Render the star field and repeaters
     * 渲染星空和中继站
     * @param {CanvasRenderingContext2D} ctx Context 画布上下文
     * @param {number} width Canvas width 画布宽度
     * @param {number} height Canvas height 画布高度
     * @param {number} energy Audio energy level (0-1) for twinkling 音频能量级别 (0-1) 用于闪烁
     * @param {Object} theme Theme colors 主题颜色
     */
    render(ctx, width, height, energy, theme) {
        const nowTime = Date.now();
        const cx = width / 2;
        const cy = height / 2;
        const maxDim = Math.max(width, height);
        
        this.starRotation += 0.0001;
        this.repeaterSpawnTimer += 16; // Assuming ~60fps call rate // 假设~60fps调用率

        // --- Handle Repeater Spawning ---
        // --- 处理中继站生成 ---
        if (this.repeaterSpawnTimer >= this.repeaterSpawnInterval && this.repeaterStations.length > 0) {
            this.repeaterSpawnTimer = 0;
            // Randomly select 5-9 repeaters
            // 随机选择 5-9 个中继站
            const count = Math.floor(Math.random() * 5) + 5;
            const shuffled = [...this.repeaterStations].sort(() => Math.random() - 0.5);
            const selectedRepeater = shuffled.slice(0, count);

            selectedRepeater.forEach(station => {
                const exists = this.repeaterStars.find(rs => rs.uid === station.uid);
                if (!exists) {
                    const starIndex = Math.floor(Math.random() * this.stars.length);
                    // Ensure star isn't already used
                    // 确保星星未被占用
                    if (!this.repeaterStars.some(rs => rs.starIndex === starIndex)) {
                        this.repeaterStars.push({
                            ...station,
                            starIndex: starIndex,
                            spawnTime: nowTime,
                            alpha: 0,
                            phase: 'spawning', // spawning -> visible -> fading // 生成 -> 可见 -> 消失
                            blinkOffset: Math.random() * Math.PI * 2,
                            visibleStartTime: 0 // Set when fully spawned // 完全生成时设置
                        });
                    }
                }
            });
        }

        // --- Render Repeaters ---
        // --- 渲染中继站 ---
        // Iterate backwards to allow removal
        // 反向迭代以便移除
        for (let i = this.repeaterStars.length - 1; i >= 0; i--) {
            const rs = this.repeaterStars[i];
            const baseStar = this.stars[rs.starIndex];
            
            if (!baseStar) {
                this.repeaterStars.splice(i, 1);
                continue;
            }

            // Lifecycle State Machine
            // 生命周期状态机
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
            // 发光
            ctx.save();
            ctx.shadowBlur = 15;
            ctx.shadowColor = theme.primary || '#ff9800';
            ctx.fillStyle = `rgba(255, 200, 100, ${finalAlpha * 0.6})`;
            ctx.beginPath();
            ctx.arc(x, y, baseStar.size * 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Core
            // 核心
            ctx.fillStyle = `rgba(255, 220, 150, ${finalAlpha})`;
            ctx.beginPath();
            ctx.arc(x, y, baseStar.size, 0, Math.PI * 2);
            ctx.fill();

            // Label
            // 标签
            if (rs.alpha > 0.5 && rs.name) {
                this.drawRepeaterLabel(ctx, x, y, rs.name, finalAlpha);
            }
        }

        // --- Render Background Stars ---
        // --- 渲染背景星星 ---
        this.stars.forEach((star, idx) => {
            // Skip stars currently occupied by repeaters
            // 跳过当前被中继站占用的星星
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
     * 绘制中继站标签
     * @private
     */
    drawRepeaterLabel(ctx, x, y, text, alpha) {
        ctx.save();
        ctx.font = 'bold 10px "Roboto Mono"';
        const textMetrics = ctx.measureText(text);
        const textW = textMetrics.width;
        const textH = 14;

        // Background
        // 背景
        ctx.fillStyle = `rgba(255, 152, 0, ${alpha * 0.7})`;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.roundRect(x - textW / 2 - 4, y - textH - 8, textW + 8, textH, 4);
        ctx.fill();

        // Text
        // 文本
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y - 14);
        ctx.restore();
    }
}
