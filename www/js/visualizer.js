/** 可视化引擎 */

/** 基础渲染器 */
export class BaseRenderer {
    constructor(ctx) { this.ctx = ctx; this.width = 0; this.height = 0; }
    resize(w, h) { this.width = w; this.height = h; }
    draw(analyser, dataArray, bufferLength, theme) {}
}

/** 1. 频谱模式渲染器 (SPECTRUM) */
export class SpectrumRenderer extends BaseRenderer {
    constructor(ctx) {
        super(ctx);
        this.peaks = [];
    }

    draw(analyser, dataArray, bufferLength, theme) {
        analyser.getByteFrequencyData(dataArray);
        const { ctx, width: w, height: h } = this;
        
        const displayW = this.ctx.canvas.clientWidth || (w / window.devicePixelRatio);
        const barCount = Math.max(24, Math.min(36, Math.floor(displayW / 12)));
        const step = Math.max(1, Math.floor(bufferLength / barCount));
        
        // Visualization Shift: Start from 20% width to avoid left-side callsign overlap
        const startX = w * 0.2;
        const availableW = w * 0.8;
        const colWidth = availableW / barCount;
        const groundY = h * 0.85; // Reverted to original height
        
        if (this.peaks.length !== barCount) this.peaks = new Array(barCount).fill(0);

        ctx.shadowBlur = 0;
        ctx.shadowColor = theme.primary;

        for(let i = 0; i < barCount; i++) {
            const value = dataArray[i * step] || 0;
            const barHeight = (value / 255) * groundY * 0.95; 
            const x = startX + i * colWidth + colWidth/2;
            
            // 1. 主体粒子柱
            const particleCount = Math.floor(barHeight / 14); 
            for (let j = 0; j < particleCount; j++) {
                const y = groundY - (j * 14 + 10);
                const ratio = j / particleCount; 
                
                ctx.beginPath();
                const size = 3 + ratio * 3.5; 
                ctx.arc(x, y, size, 0, Math.PI * 2);
                
                if (j === particleCount - 1) {
                    ctx.fillStyle = '#ffffff';
                    ctx.shadowBlur = 8;
                    ctx.shadowColor = '#ffffff';
                } else {
                    ctx.fillStyle = i % 2 === 0 ? theme.primary : theme.secondary;
                    ctx.shadowBlur = 0;
                }
                
                ctx.globalAlpha = ratio * 0.7 + 0.3;
                ctx.fill();
            }
            ctx.shadowBlur = 0;

            // 2. 倒影
            const reflectCount = Math.floor(particleCount / 3);
            for (let j = 0; j < reflectCount; j++) {
                const y = groundY + (j * 14 + 10);
                if (y > h) break;
                const ratio = 1 - (j / reflectCount);
                ctx.beginPath();
                ctx.arc(x, y, 2.5, 0, Math.PI * 2);
                ctx.fillStyle = i % 2 === 0 ? theme.primary : theme.secondary;
                ctx.globalAlpha = ratio * 0.15;
                ctx.fill();
            }
            
            // 3. 掉落峰值
            if (barHeight > this.peaks[i]) this.peaks[i] = barHeight;
            else this.peaks[i] -= 2; 
            
            if (this.peaks[i] > 0) {
                const peakY = groundY - this.peaks[i] - 12;
                ctx.beginPath();
                ctx.arc(x, peakY, 3, 0, Math.PI * 2);
                ctx.fillStyle = theme.secondary;
                ctx.globalAlpha = 1.0;
                ctx.fill();
            }
        }
        
        // 地平线
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(w, groundY);
        ctx.strokeStyle = theme.primary;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.4;
        ctx.stroke();
        ctx.globalAlpha = 1.0;
    }
}

/** 2. 镜像模式渲染器 (MIRROR) - 优化：离屏Canvas缓存背景 */
export class MirrorRenderer extends BaseRenderer {
    constructor(ctx) {
        super(ctx);
        this.bgCanvas = document.createElement('canvas');
        this.bgCtx = this.bgCanvas.getContext('2d');
        this.bgCached = false;
    }

    resize(w, h) {
        super.resize(w, h);
        this.bgCanvas.width = w;
        this.bgCanvas.height = h;
        this.bgCached = false;
    }

    drawBackground() {
        if (this.bgCached) return;
        const { width: w, height: h } = this;
        const ctx = this.bgCtx;
        
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for(let i=0; i<=w; i+=40) { ctx.moveTo(i, 0); ctx.lineTo(i, h); }
        for(let i=0; i<=h; i+=40) { ctx.moveTo(0, i); ctx.lineTo(w, i); }
        ctx.stroke();
        this.bgCached = true;
    }

    draw(analyser, dataArray, bufferLength, theme) {
        analyser.getByteFrequencyData(dataArray);
        const { ctx, width: w, height: h } = this;
        const cx = w / 2;
        const cy = h / 2;

        this.drawBackground();
        ctx.drawImage(this.bgCanvas, 0, 0);

        const bars = 48;
        const step = Math.floor(bufferLength / bars);
        const barW = (w / 2) / bars;

        for(let i = 0; i < bars; i++) {
            const value = dataArray[i * step];
            const percent = value / 255;
            let barH = percent * (h * 0.7);
            if (i < 5) barH *= 1.2;

            ctx.fillStyle = i % 3 === 0 ? theme.secondary : theme.primary;
            
            if (percent > 0.6) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = ctx.fillStyle;
            } else {
                ctx.shadowBlur = 0;
            }

            const xOffset = i * barW;
            const blockHeight = 6;
            const gap = 2;
            const totalBlocks = Math.floor(barH / (blockHeight + gap));

            for (let b = 0; b < totalBlocks; b++) {
                ctx.globalAlpha = 1.0 - (b / totalBlocks) * 0.6;
                const yOffset = b * (blockHeight + gap);
                
                ctx.fillRect(cx + xOffset, cy - yOffset, barW - 2, blockHeight);
                ctx.fillRect(cx + xOffset, cy + yOffset, barW - 2, blockHeight);
                ctx.fillRect(cx - xOffset - barW, cy - yOffset, barW - 2, blockHeight);
                ctx.fillRect(cx - xOffset - barW, cy + yOffset, barW - 2, blockHeight);
            }
        }
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;

        const bass = dataArray[3] / 255;
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.5 + bass * 0.5;
        ctx.fillRect(cx - 1, cy - (h/2)*bass, 2, h*bass);
        ctx.globalAlpha = 1.0;
    }
}

/** 3. 波形模式渲染器 (WAVEFORM) */
export class WaveformRenderer extends BaseRenderer {
    draw(analyser, dataArray, bufferLength, theme) {
        analyser.getByteTimeDomainData(dataArray);
        const { ctx, width: w, height: h } = this;
        
        // 1. 电流光晕
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
    }
}

/** 4. 示波器渲染器 (OSCILLOSCOPE) */
export class OscilloscopeRenderer extends BaseRenderer {
    draw(analyser, dataArray, bufferLength, theme) {
        analyser.getByteTimeDomainData(dataArray);
        const { ctx, width: w, height: h } = this;

        // 1. 全息网格
        const time = Date.now() / 1000;
        const gridOffset = (time * 50) % 50;
        
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let gx = 0; gx < w; gx += 50) { ctx.moveTo(gx, 0); ctx.lineTo(gx, h); }
        for (let gy = gridOffset; gy < h; gy += 50) { ctx.moveTo(0, gy); ctx.lineTo(w, gy); }
        ctx.stroke();

        // 2. 高亮信号线
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

        // 3. 扫描线纹理
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        for(let i=0; i<h; i+=3) { ctx.fillRect(0, i, w, 1); }
    }
}

/** 5. 放射模式渲染器 (RADIAL) */
export class RadialRenderer extends BaseRenderer {
    draw(analyser, dataArray, bufferLength, theme, extra) {
        analyser.getByteFrequencyData(dataArray);
        const { ctx, width: w, height: h } = this;
        const cx = w / 2;
        const cy = h / 2;
        const radius = Math.min(w, h) / 4.5; 
        
        ctx.save();
        ctx.translate(cx, cy);
        
        // 1. 核心 (空心)
        const bass = dataArray[5] / 255.0;
        ctx.beginPath();
        const coreRadius = radius * (0.8 + bass * 0.3);
        ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
        ctx.strokeStyle = theme.primary;
        ctx.lineWidth = 2 + bass * 8; 
        ctx.globalAlpha = 0.6 + bass * 0.4;
        ctx.shadowBlur = 15;
        ctx.shadowColor = theme.primary;
        ctx.stroke();
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;

        // 1.1 显示呼号 (动态)
        if (extra && extra.callsign && extra.opacity > 0) {
            ctx.save();
            ctx.globalAlpha = extra.opacity;
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const baseSize = radius * 0.4;
            const dynamicSize = baseSize * (1 + bass * 0.2); 
            ctx.font = `bold ${Math.floor(dynamicSize)}px "Roboto Mono", monospace`;
            
            ctx.shadowBlur = 10 + bass * 20;
            ctx.shadowColor = theme.primary;
            
            ctx.fillText(extra.callsign, 0, 0);
            ctx.restore();
        }

        // 2. 旋转环
        ctx.rotate(Date.now() * 0.0005); 
        const bars = 64; 
        const step = Math.floor(bufferLength / bars);
        
        for(let i = 0; i < bars; i++) { 
            const value = dataArray[i * step];
            const percent = value / 255;
            const angle = (i / bars) * Math.PI * 2;
            const nextAngle = ((i + 0.8) / bars) * Math.PI * 2;
            
            const innerR = radius;
            const barH = percent * (radius * 0.8);
            
            ctx.beginPath();
            ctx.arc(0, 0, innerR + barH, angle, nextAngle);
            ctx.arc(0, 0, innerR, nextAngle, angle, true);
            ctx.fillStyle = i % 2 === 0 ? theme.primary : theme.secondary;
            ctx.fill();
            
            if (percent > 0.5) {
                const outerStart = radius * 2.0;
                const outerEnd = outerStart + (percent * radius * 0.5);
                ctx.beginPath();
                ctx.moveTo(Math.cos(angle)*outerStart, Math.sin(angle)*outerStart);
                ctx.lineTo(Math.cos(angle)*outerEnd, Math.sin(angle)*outerEnd);
                ctx.strokeStyle = theme.secondary;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
        ctx.restore();
    }
}

/** 6. 粒子模式渲染器 (PARTICLES) */
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

/** 7. 太阳系模拟渲染器 (SOLAR_SYSTEM) */
export class SolarSystemRenderer extends BaseRenderer {
    constructor(ctx) {
        super(ctx);
        
        // 艺术配色库 (用于行星云微粒)
        const palette = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD',
            '#D4A5A5', '#9B59B6', '#3498DB', '#E67E22', '#2ECC71',
            '#F1C40F', '#E74C3C', '#1ABC9C', '#8E44AD', '#FF9F43'
        ];
        const getRandomColor = () => palette[Math.floor(Math.random() * palette.length)];

        // 行星样式定义 (高饱和度艺术配色)
        const planetStyles = {
            'Mercury': { type: 'crater', color1: '#B0B0B0', color2: '#808080', highlight: '#E0E0E0' }, 
            'Venus': { type: 'cloud', color1: '#FFD700', color2: '#DAA520', highlight: '#FFFACD' }, 
            'Earth': { type: 'earth', color1: '#00BFFF', color2: '#0000CD', highlight: '#87CEFA' }, 
            'Mars': { type: 'rust', color1: '#FF4500', color2: '#8B0000', highlight: '#FF7F50' }, 
            'Jupiter': { type: 'banded', color1: '#FFA500', color2: '#D2691E', highlight: '#FFE4B5', bands: ['#FFA500', '#FFE4B5', '#D2691E', '#FFE4B5'] }, 
            'Saturn': { type: 'banded', color1: '#FFD700', color2: '#B8860B', highlight: '#FFF8DC', bands: ['#FFD700', '#FFF8DC', '#DAA520'] }, 
            'Uranus': { type: 'gas', color1: '#00FFFF', color2: '#008B8B', highlight: '#E0FFFF' }, 
            'Neptune': { type: 'gas', color1: '#1E90FF', color2: '#00008B', highlight: '#87CEFA' }, 
            'Pluto': { type: 'ice', color1: '#F5DEB3', color2: '#A0522D', highlight: '#FFF5EE' } 
        };

        // 卫星配置 (相对于行星的尺寸和距离)
        // 轨道速度符合开普勒定律 (T^2 ~ R^3, v ~ R^-0.5) 
        // 基础速度: Earth = 1.0 (120s Period)
        this.planets = [
            { name: 'Mercury', r: 0.8, dist: 1.5, speed: 4.15, style: planetStyles['Mercury'], moons: [] },
            { name: 'Venus', r: 1.8, dist: 2.5, speed: 1.62, style: planetStyles['Venus'], moons: [] },
            { name: 'Earth', r: 2.0, dist: 3.3, speed: 1.0, style: planetStyles['Earth'], moons: [
                { name: 'Moon', r: 0.27, dist: 0.3, speed: 2.5, color: '#D3D3D3' }
            ]},
            { name: 'Mars', r: 1.2, dist: 4.0, speed: 0.53, style: planetStyles['Mars'], moons: [
                { name: 'Phobos', r: 0.15, dist: 0.2, speed: 4.0, color: '#C0C0C0' },
                { name: 'Deimos', r: 0.12, dist: 0.3, speed: 2.0, color: '#A9A9A9' }
            ]},
            { name: 'Jupiter', r: 5.5, dist: 6.5, speed: 0.084, style: planetStyles['Jupiter'], moons: [
                { name: 'Io', r: 0.3, dist: 0.7, speed: 3.0, color: '#FFFFE0' },
                { name: 'Europa', r: 0.25, dist: 0.9, speed: 2.5, color: '#F0F8FF' },
                { name: 'Ganymede', r: 0.4, dist: 1.2, speed: 2.0, color: '#D3D3D3' },
                { name: 'Callisto', r: 0.35, dist: 1.5, speed: 1.5, color: '#708090' }
            ]},
            { name: 'Saturn', r: 4.8, dist: 8.0, speed: 0.034, style: planetStyles['Saturn'], moons: [
                { name: 'Titan', r: 0.4, dist: 0.8, speed: 2.0, color: '#F4A460' },
                { name: 'Rhea', r: 0.2, dist: 0.5, speed: 3.0, color: '#D3D3D3' }
            ]},
            { name: 'Uranus', r: 4.2, dist: 9.2, speed: 0.012, style: planetStyles['Uranus'], moons: [
                { name: 'Titania', r: 0.2, dist: 0.5, speed: 2.5, color: '#E0FFFF' },
                { name: 'Oberon', r: 0.2, dist: 0.6, speed: 2.0, color: '#E0FFFF' }
            ]},
            { name: 'Neptune', r: 4.0, dist: 10.2, speed: 0.006, style: planetStyles['Neptune'], moons: [
                { name: 'Triton', r: 0.3, dist: 0.5, speed: -2.0, color: '#FFC0CB' } // 逆行卫星
            ]},
            { name: 'Pluto', r: 2.5, dist: 11.0, speed: 0.004, style: planetStyles['Pluto'], moons: [
                { name: 'Charon', r: 1.2, dist: 0.3, speed: 1.0, color: '#808080' }
            ]}
        ];
        
        // 构建呼号分配目标列表 (行星 + 卫星)
        this.targets = [];
        this.planets.forEach((p, pIdx) => {
            this.targets.push({ type: 'planet', pIdx: pIdx, name: p.name });
            if (p.moons) {
                p.moons.forEach((m, mIdx) => {
                    this.targets.push({ type: 'moon', pIdx: pIdx, mIdx: mIdx, name: m.name });
                });
            }
        });
        
        // 预计算恒星背景 (动态旋转与闪烁)
        this.stars = [];
        for(let i=0; i<300; i++) {
            this.stars.push({
                r: Math.random() * 1.5, // 归一化极径
                angle: Math.random() * Math.PI * 2, // 初始角度
                size: Math.random() * 2.5 + 0.5, // 大小差异化 (0.5 - 3.0)
                blinkSpeed: Math.random() * 0.005 + 0.002, // 闪烁速度
                blinkPhase: Math.random() * Math.PI * 2, // 闪烁相位
                baseAlpha: Math.random() * 0.5 + 0.2 // 基础透明度
            });
        }
        this.starRotation = 0; // 整体旋转角度

        // 速度设置: 120s per Earth orbit
        // Logic: 60fps, angleOffset += speed * 0.02
        // 2*PI / (speed * 0.02 * 60) = 120  => speed = 0.0436
        this.baseSpeed = 0.0436; 
        this.currentSpeed = this.baseSpeed;
        this.angleOffset = 0;
        this.tilt = 0.6; // 视角倾斜 (0.6 约等于 37度，增加垂直空间)
        this.orbitSpeedScale = 0.5;
        
        // 行星云数据 (右上角)
        this.cloudAngle = 0;
        this.cloudParticles = Array.from({length: 40}, () => ({
            x: (Math.random() - 0.5) * 100,
            y: (Math.random() - 0.5) * 60,
            size: Math.random() * 2 + 1,
            color: getRandomColor(),
            alpha: Math.random() * 0.6 + 0.2
        }));

        this.activeTarget = null;
        this.lastCallsign = '';

        // 中继台星星系统
        this.repeaterStars = []; // 存储中继台星星数据
        this.repeaterStations = []; // 中继台列表
        this.repeaterSpawnTimer = 0; // 中继台浮现计时器
        this.repeaterSpawnInterval = 5000; // 每5秒尝试浮现1-3个中继台
        this.repeaterFadeTimer = 0; // 中继台消失计时器
        this.repeaterFadeInterval = 8000; // 8秒后开始消失
        this.repeaterFadeDuration = 2000; // 2秒完全消失

        // 太阳喷发系统配置
        this.eruptions = [];
        this.eruptionConfig = {
            sensitivity: 1.0,   // 音调敏感度
            randomness: 0.5,    // 随机性程度
            intensity: 1.0,     // 光芒强度缩放
            speed: 0.5          // 喷发速度缩放
        };
    }

    draw(analyser, dataArray, bufferLength, theme, extra) {
        analyser.getByteFrequencyData(dataArray);
        const { ctx, width: w, height: h } = this;
        const cx = w / 2;
        const cy = h / 2;
        const minDim = Math.min(w, h); // 用于自适应字体大小和显隐

        // 辅助函数: 计算对比色文本
        const getTextColor = (hex) => {
            if(!hex || hex[0]!=='#') return '#ffffff';
            const r = parseInt(hex.slice(1,3), 16);
            const g = parseInt(hex.slice(3,5), 16);
            const b = parseInt(hex.slice(5,7), 16);
            return (r*0.299 + g*0.587 + b*0.114) > 160 ? '#000000' : '#ffffff';
        };
        
        // 1. 计算音频能量与速度
        let energy = 0;
        let bass = 0;
        let mid = 0;
        let treble = 0;
        
        for(let i=0; i<bufferLength; i++) {
            const val = dataArray[i];
            energy += val;
            if(i < 20) bass += val;
            else if(i < 200) mid += val;
            else treble += val;
        }
        energy /= (bufferLength * 255);
        bass /= (20 * 255);
        mid /= (180 * 255);
        treble /= ((bufferLength - 200) * 255);

        // 加速逻辑: 通联时(有能量)显著加速
        const targetSpeed = this.baseSpeed + energy * 6.0;
        this.currentSpeed += (targetSpeed - this.currentSpeed) * 0.05;
        this.angleOffset += this.currentSpeed * 0.01;

        // 2. 呼号分配逻辑
        const callsign = (extra && extra.callsign && extra.opacity > 0) ? extra.callsign : null;
        const input = extra.input || { x: 0, y: 0, active: false };

        if (callsign && callsign !== this.lastCallsign) {
            this.lastCallsign = callsign;
            let hash = 0;
            for (let i = 0; i < callsign.length; i++) hash = callsign.charCodeAt(i) + ((hash << 5) - hash);
            this.activeTarget = this.targets[Math.abs(hash) % this.targets.length];
        }

        // 3. 绘制背景星空
        this.starRotation += 0.0001;
        const maxDim = Math.max(w, h);
        const nowTime = Date.now();

        // 处理中继台浮现/消失逻辑
        this.repeaterSpawnTimer += 16; // 假设60fps，每次约16ms
        this.repeaterFadeTimer += 16;

        // 定期浮现新的中继台星星
        if (this.repeaterSpawnTimer >= this.repeaterSpawnInterval && this.repeaterStations.length > 0) {
            this.repeaterSpawnTimer = 0;
            // 随机选择5-9个中继台
            const count = Math.floor(Math.random() * 5) + 5;
            const shuffled = [...this.repeaterStations].sort(() => Math.random() - 0.5);
            const selectedRepeater = shuffled.slice(0, count);

            selectedRepeater.forEach(station => {
                // 检查是否已存在
                const exists = this.repeaterStars.find(rs => rs.uid === station.uid);
                if (!exists) {
                    // 创建新的中继台星星
                    const starIndex = Math.floor(Math.random() * this.stars.length);
                    const baseStar = this.stars[starIndex];
                    this.repeaterStars.push({
                        ...station,
                        starIndex: starIndex,
                        spawnTime: nowTime,
                        alpha: 0,
                        targetAlpha: 1,
                        phase: 'spawning', // spawning -> visible -> fading
                        blinkOffset: Math.random() * Math.PI * 2
                    });
                }
            });
        }

        // 绘制中继台星星
        this.repeaterStars.forEach((rs, idx) => {
            const baseStar = this.stars[rs.starIndex];
            if (!baseStar) return;

            // 计算透明度（浮现/消失动画）
            if (rs.phase === 'spawning') {
                rs.alpha += 0.05;
                if (rs.alpha >= 1) {
                    rs.alpha = 1;
                    rs.phase = 'visible';
                    rs.visibleStartTime = nowTime;
                }
            } else if (rs.phase === 'visible') {
                // 8秒后开始消失
                if (nowTime - rs.visibleStartTime > this.repeaterFadeInterval) {
                    rs.phase = 'fading';
                }
            } else if (rs.phase === 'fading') {
                rs.alpha -= 0.02;
                if (rs.alpha <= 0) {
                    this.repeaterStars.splice(idx, 1);
                    return;
                }
            }

            const blink = Math.sin(nowTime * baseStar.blinkSpeed + baseStar.blinkPhase + rs.blinkOffset);
            const starAlpha = Math.max(0.1, Math.min(1, baseStar.baseAlpha + blink * 0.3 + energy * 0.5));
            const finalAlpha = starAlpha * rs.alpha;

            const currentAngle = baseStar.angle + this.starRotation;
            const x = cx + Math.cos(currentAngle) * baseStar.r * maxDim * 0.8;
            const y = cy + Math.sin(currentAngle) * baseStar.r * maxDim * 0.8;

            // 绘制发光效果
            ctx.save();
            ctx.shadowBlur = 15;
            ctx.shadowColor = theme.primary || '#ff9800';
            ctx.fillStyle = `rgba(255, 200, 100, ${finalAlpha * 0.6})`;
            ctx.beginPath();
            ctx.arc(x, y, baseStar.size * 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // 绘制星星本体
            ctx.fillStyle = `rgba(255, 220, 150, ${finalAlpha})`;
            ctx.beginPath();
            ctx.arc(x, y, baseStar.size, 0, Math.PI * 2);
            ctx.fill();

            // 绘制台站名称
            if (rs.alpha > 0.5 && rs.name) {
                ctx.save();
                ctx.font = 'bold 10px "Roboto Mono"';
                const text = rs.name;
                const textMetrics = ctx.measureText(text);
                const textW = textMetrics.width;
                const textH = 14;

                // 背景
                ctx.fillStyle = `rgba(255, 152, 0, ${finalAlpha * 0.7})`;
                ctx.globalAlpha = finalAlpha;
                ctx.beginPath();
                ctx.roundRect(x - textW / 2 - 4, y - textH - 8, textW + 8, textH, 4);
                ctx.fill();

                // 文字
                ctx.fillStyle = `rgba(255, 255, 255, ${finalAlpha})`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, x, y - 14);
                ctx.restore();
            }
        });

        this.stars.forEach(star => {
            // 跳过已被中继台占用的星星
            const isRepeaterStar = this.repeaterStars.some(rs => rs.starIndex === this.stars.indexOf(star));
            if (isRepeaterStar) return;

            const blink = Math.sin(nowTime * star.blinkSpeed + star.blinkPhase);
            const alpha = Math.max(0.1, Math.min(1, star.baseAlpha + blink * 0.3 + energy * 0.5));

            const currentAngle = star.angle + this.starRotation;
            const x = cx + Math.cos(currentAngle) * star.r * maxDim * 0.8;
            const y = cy + Math.sin(currentAngle) * star.r * maxDim * 0.8;

            ctx.fillStyle = `rgba(255,255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(x, y, star.size, 0, Math.PI*2);
            ctx.fill();
        });

        // 4. 绘制轨道 (动态计算缩放以铺满屏幕) - 已隐藏
        // 目标：让最外层行星(冥王星 dist=11.0)贴近屏幕边缘
        // 计算 X 轴和 Y 轴方向的最大允许缩放比例，取较小值以确保完整显示
        const maxDist = 11.0;
        const scaleX = w / 2 / maxDist;
        const scaleY = h / 2 / (maxDist * this.tilt);
        const scale = Math.min(scaleX, scaleY) * 0.95; // 0.95 留一点点边距

        ctx.lineWidth = 1;
        // 注释掉行星轨道绘制 - 隐藏所有轨道
        // this.planets.forEach(p => {
        //     ctx.beginPath();
        //     ctx.ellipse(cx, cy, p.dist * scale, p.dist * scale * this.tilt, 0, 0, Math.PI*2);
        //     ctx.strokeStyle = `rgba(255, 255, 255, ${0.05 + bass * 0.1})`;
        //     ctx.stroke();
        // });

        // 5. 准备渲染列表
        const renderList = [];
        let hoveredItem = null;

        // 太阳 (含光芒喷发系统)
        renderList.push({
            y: cy,
            draw: () => {
                const sunBaseSize = 25; 
                const sunSize = sunBaseSize + bass * 30;

                // --- 光芒喷发 ---
                const sensitivity = this.eruptionConfig.sensitivity;
                if (energy * sensitivity > 0.05) { 
                    const count = Math.floor(energy * 8 * sensitivity); 
                    let colorBase = '255, 69, 0'; 
                    let type = 'bass';
                    if (treble > mid && treble > bass) { colorBase = '200, 255, 255'; type = 'treble'; } 
                    else if (mid > bass) { colorBase = '255, 215, 0'; type = 'mid'; }

                    for(let k=0; k<count; k++) {
                        const angle = Math.random() * Math.PI * 2;
                        const speedVar = Math.random() * this.eruptionConfig.randomness;
                        this.eruptions.push({
                            x: cx, y: cy, angle: angle,
                            r: sunSize * 0.8,
                            speed: (2 + speedVar * 5 + energy * 10) * this.eruptionConfig.speed,
                            length: (10 + Math.random() * 20 + energy * 50) * this.eruptionConfig.intensity,
                            width: (type === 'treble' ? 1 : (type === 'mid' ? 2 : 3)) * (1 + Math.random()),
                            colorBase: colorBase, alpha: 0.8 + Math.random() * 0.2, decay: 0.02 + Math.random() * 0.05
                        });
                    }
                }

                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                for (let i = this.eruptions.length - 1; i >= 0; i--) {
                    const p = this.eruptions[i];
                    p.r += p.speed;
                    p.alpha -= p.decay;
                    if (p.alpha <= 0) { this.eruptions.splice(i, 1); continue; }
                    const sx = cx + Math.cos(p.angle) * p.r;
                    const sy = cy + Math.sin(p.angle) * p.r;
                    const ex = cx + Math.cos(p.angle) * (p.r + p.length);
                    const ey = cy + Math.sin(p.angle) * (p.r + p.length);
                    ctx.strokeStyle = `rgba(${p.colorBase}, ${p.alpha})`;
                    ctx.lineWidth = p.width;
                    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
                }
                ctx.restore();
                
                // 太阳本体 (明亮橙黄渐变 - 65%透明度)
                const sunGrad = ctx.createRadialGradient(cx, cy, sunSize*0.2, cx, cy, sunSize);
                sunGrad.addColorStop(0, 'rgba(255, 215, 0, 0.85)'); // 金黄
                sunGrad.addColorStop(1, 'rgba(255, 140, 0, 0.65)'); // 深橙
                
                ctx.fillStyle = sunGrad;
                ctx.beginPath();
                ctx.arc(cx, cy, sunSize, 0, Math.PI*2);
                ctx.fill();

                // 交互检测
                if (input.active && Math.hypot(input.x - cx, input.y - cy) < sunSize + 10) {
                    hoveredItem = { name: 'Sun', info: 'Star Type: G2V', x: cx, y: cy - sunSize - 10 };
                }
            }
        });

        // 行星与卫星
        this.planets.forEach((p, i) => {
            const angle = this.angleOffset * p.speed * this.orbitSpeedScale + i * 137.5; 
            const x = cx + Math.cos(angle) * p.dist * scale;
            const y = cy + Math.sin(angle) * p.dist * scale * this.tilt;
            
            renderList.push({
                y: y,
                draw: () => {
                    const size = Math.max(3, p.r * scale * 0.12);
                    const style = p.style;

                    // 绘制卫星 (先画卫星，如果在行星后面会被行星遮挡? 不，这里作为行星的一部分绘制，顺序可能需要细化，但简化起见一起画)
                    // 简单的卫星轨道绘制
                    if (p.moons && p.moons.length > 0) {
                        p.moons.forEach((m, idx) => {
                            // 卫星速度更快
                            const mAngle = this.angleOffset * m.speed * 4 * this.orbitSpeedScale + idx; 
                            // 卫星轨道半径需适当放大以可见
                            const mDist = (size + m.dist * scale * 2); 
                            const mx = x + Math.cos(mAngle) * mDist;
                            const my = y + Math.sin(mAngle) * mDist * this.tilt; // 卫星也受倾斜影响
                            // 增大卫星尺寸以提升可见度
                            const mSize = Math.max(2.0, m.r * scale * 0.15);

                                // 卫星轨道线 - 已隐藏
                            // ctx.beginPath();
                            // ctx.ellipse(x, y, mDist, mDist * this.tilt, 0, 0, Math.PI*2);
                            // ctx.strokeStyle = 'rgba(255,255,255,0.1)';
                            // ctx.stroke();

                            // 卫星本体
                            ctx.fillStyle = m.color;
                            ctx.beginPath();
                            ctx.arc(mx, my, mSize, 0, Math.PI*2);
                            ctx.fill();

                            // 卫星交互
                            if (input.active && Math.hypot(input.x - mx, input.y - my) < mSize + 5) {
                                hoveredItem = { name: m.name, info: `Moon of ${p.name}`, x: mx, y: my - 10 };
                            }

                            // 呼号显示 (卫星)
                            if (callsign && this.activeTarget && this.activeTarget.type === 'moon' && this.activeTarget.pIdx === i && this.activeTarget.mIdx === idx) {
                                // 连接线
                                ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(mx, my);
                                ctx.strokeStyle = theme.primary; ctx.globalAlpha = 0.3; ctx.stroke(); ctx.globalAlpha = 1.0;

                                // 呼号背景 (圆角矩形)
                                ctx.save();
                                ctx.translate(mx, my - mSize * 2.5 - 10);
                                
                                const text = callsign;
                                ctx.font = 'bold 12px "Roboto Mono"';
                                const textMetrics = ctx.measureText(text);
                                const bgW = textMetrics.width + 16;
                                const bgH = 20;
                                
                                // 使用卫星颜色作为背景
                                ctx.fillStyle = m.color; 
                                ctx.globalAlpha = 0.8;
                                ctx.shadowBlur = 10;
                                ctx.shadowColor = m.color;
                                
                                ctx.beginPath();
                                ctx.roundRect(-bgW/2, -bgH/2 - 5, bgW, bgH, 10);
                                ctx.fill();
                                
                                ctx.fillStyle = getTextColor(m.color); // 自适应对比色文字
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'middle';
                                ctx.shadowBlur = 0; 
                                ctx.fillText(text, 0, -5);
                                ctx.restore();
                            }
                        });
                    }

                    // 绘制行星
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(x, y, size, 0, Math.PI*2);
                    ctx.clip(); 

                    const grad = ctx.createRadialGradient(x - size*0.3, y - size*0.3, size*0.1, x, y, size);
                    grad.addColorStop(0, style.highlight || style.color1);
                    grad.addColorStop(0.5, style.color1);
                    grad.addColorStop(1, style.color2);
                    ctx.fillStyle = grad;
                    ctx.fill();

                    // 纹理细节
                    if (style.type === 'banded' && style.bands) {
                        ctx.globalCompositeOperation = 'overlay';
                        const bandHeight = size * 2 / style.bands.length;
                        style.bands.forEach((color, idx) => {
                            ctx.fillStyle = color;
                            ctx.fillRect(x - size, y - size + idx * bandHeight, size * 2, bandHeight);
                        });
                        ctx.globalCompositeOperation = 'source-over';
                    } else if (style.type === 'earth') {
                        ctx.globalCompositeOperation = 'source-atop';
                        ctx.fillStyle = '#4CAF50'; 
                        ctx.beginPath(); ctx.arc(x - size*0.4, y - size*0.2, size*0.6, 0, Math.PI*2); ctx.fill();
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'; 
                        ctx.beginPath(); ctx.arc(x + size*0.3, y + size*0.3, size*0.7, 0, Math.PI*2); ctx.fill();
                        ctx.globalCompositeOperation = 'source-over';
                    } else if (style.type === 'crater' || style.type === 'rust') {
                        ctx.globalCompositeOperation = 'multiply';
                        ctx.fillStyle = 'rgba(0,0,0,0.1)';
                        for(let k=0; k<3; k++) {
                            ctx.beginPath(); ctx.arc(x + (Math.random()-0.5)*size, y + (Math.random()-0.5)*size, size*0.2, 0, Math.PI*2); ctx.fill();
                        }
                        ctx.globalCompositeOperation = 'source-over';
                    }

                    // 阴影
                    const shadowGrad = ctx.createRadialGradient(x, y, size * 0.8, x, y, size);
                    shadowGrad.addColorStop(0, 'rgba(0,0,0,0)');
                    shadowGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
                    ctx.fillStyle = shadowGrad;
                    ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI*2); ctx.fill();
                    ctx.restore();
                    
                    // 行星名 (自适应显隐)
                    if (minDim > 320) {
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                        const nameSize = Math.max(10, Math.floor(minDim / 60));
                        ctx.font = `${nameSize}px "Roboto Mono"`;
                        ctx.textAlign = 'center';
                        ctx.fillText(p.name, x, y + size + nameSize + 4);
                    }

                    // 行星交互
                    if (input.active && Math.hypot(input.x - x, input.y - y) < size + 5) {
                        hoveredItem = { name: p.name, info: `Dist: ${p.dist} AU`, x: x, y: y - size - 10 };
                    }

                    // 呼号显示 (行星)
                    if (callsign && this.activeTarget && this.activeTarget.type === 'planet' && this.activeTarget.pIdx === i) {
                        // 连接线
                        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y);
                        ctx.strokeStyle = theme.primary; ctx.globalAlpha = 0.3; ctx.stroke(); ctx.globalAlpha = 1.0;

                        // 呼号背景 (圆角矩形)
                        ctx.save();
                        ctx.translate(x, y - size * 2.5);
                        
                        const text = callsign;
                        ctx.font = 'bold 14px "Roboto Mono"';
                        const textMetrics = ctx.measureText(text);
                        const bgW = textMetrics.width + 20;
                        const bgH = 24;
                        
                        // 使用行星主色作为背景，半透明
                        ctx.fillStyle = style.color1; 
                        ctx.globalAlpha = 0.8;
                        ctx.shadowBlur = 10;
                        ctx.shadowColor = style.color1;
                        
                        // 绘制圆角矩形
                        ctx.beginPath();
                        ctx.roundRect(-bgW/2, -bgH/2 - 5, bgW, bgH, 12);
                        ctx.fill();
                        
                        ctx.fillStyle = getTextColor(style.color1); // 自适应对比色文字
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.shadowBlur = 0; // 文字不加阴影以保持清晰
                        ctx.fillText(text, 0, -5);
                        ctx.restore();
                    }
                }
            });
        });

        // 排序并绘制
        renderList.sort((a, b) => a.y - b.y);
        renderList.forEach(item => item.draw());

        // 6. 右上角行星云 (不变)
        this.cloudAngle += 0.001;
        const cloudCx = w - 60; const cloudCy = 60;
        ctx.save(); ctx.translate(cloudCx, cloudCy); ctx.rotate(this.cloudAngle);
        this.cloudParticles.forEach(p => {
            ctx.fillStyle = p.color; ctx.globalAlpha = p.alpha;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
        });
        ctx.restore(); ctx.globalAlpha = 1.0;

        // 7. 时钟 (自适应)
        if (minDim > 280) { // 时钟保留优先级稍高
            const now = new Date();
            const offset = 8;
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
            const bjTime = new Date(utc + (3600000 * offset));
            const pad = (n) => n.toString().padStart(2, '0');
            const fullTimeStr = `${bjTime.getFullYear()}-${pad(bjTime.getMonth()+1)}-${pad(bjTime.getDate())} ${pad(bjTime.getHours())}:${pad(bjTime.getMinutes())}:${pad(bjTime.getSeconds())}`;
            
            const timeSize = Math.max(14, Math.floor(minDim / 40));

            ctx.save();
            ctx.fillStyle = theme.primary || '#00f3ff'; ctx.shadowColor = theme.primary || '#00f3ff'; ctx.shadowBlur = 10;
            ctx.font = `bold ${timeSize}px "Courier New", monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.fillText(fullTimeStr, cx, 30);
            ctx.restore();
        }

        // 8. 图例 (自适应)
        if (minDim > 350) { // 图例需要更多空间，阈值稍高
            const legendY = h - 60; // 移到60px上方，留出空间给UI元素
            const legendItems = [
                { color: '#FFD700', label: 'Sun' },
                { color: '#A9A9A9', label: 'Rocky' },
                { color: '#FFA500', label: 'Gas Giant' },
                { color: '#00FFFF', label: 'Ice Giant' },
                { color: '#A0522D', label: 'Dwarf' },
                { color: '#D3D3D3', label: 'Moon' }
            ];
            
            const legendSize = Math.max(10, Math.floor(minDim / 70));

            ctx.save();
            ctx.font = `${legendSize}px "Roboto Mono"`;
            ctx.textBaseline = 'middle';
        
        // Calculate total width for centering
        let totalWidth = 0;
        const itemGap = 20;
        const itemsWithWidth = legendItems.map(item => {
            const w = ctx.measureText(item.label).width + 15; // 8px circle + 7px gap
            totalWidth += w;
            return { ...item, w };
        });
        totalWidth += (legendItems.length - 1) * itemGap;
        
        let currentX = cx - totalWidth / 2;
        
        itemsWithWidth.forEach((item, idx) => {
            // Color dot
            ctx.fillStyle = item.color;
            ctx.beginPath();
            ctx.arc(currentX + 4, legendY, 4, 0, Math.PI*2);
            ctx.fill();
            
            // Text
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.textAlign = 'left';
            ctx.fillText(item.label, currentX + 12, legendY);
            
            currentX += item.w + itemGap;
        });
        ctx.restore();
        }

        // 9. 悬停提示
        if (hoveredItem) {
            ctx.save();
            ctx.translate(hoveredItem.x, hoveredItem.y);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.strokeStyle = theme.primary;
            ctx.lineWidth = 1;
            const infoW = ctx.measureText(hoveredItem.info).width + 20;
            ctx.beginPath();
            ctx.roundRect(-infoW/2, -40, infoW, 35, 5);
            ctx.fill();
            ctx.stroke();
            
            ctx.fillStyle = theme.primary;
            ctx.font = 'bold 12px "Roboto Mono"';
            ctx.textAlign = 'center';
            ctx.fillText(hoveredItem.name, 0, -25);
            ctx.fillStyle = '#ccc';
            ctx.font = '10px "Roboto Mono"';
            ctx.fillText(hoveredItem.info, 0, -12);
            ctx.restore();
        }
    }

    // 更新中继台列表
    updateRepeaterStations(stations) {
        this.repeaterStations = stations.filter(s => s.name && s.name.length > 0);
    }
}

/** 可视化引擎 (重构版) */
export class Visualizer {
    constructor(canvas, analyser) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.analyser = analyser;
        this.freqData = null;
        this.mode = 0; 
        this.modes = ['SOLAR', 'SPECTRUM', 'MIRROR', 'WAVEFORM', 'OSCILLOSCOPE', 'RADIAL', 'PARTICLES'];
        this.running = false;
        this.currentCallsign = '';
        this.callsignState = { text: '', opacity: 0, targetOpacity: 0 };
        this.lastLoopTime = 0;
        
        this.colorTheme = '#00f3ff';
        this.colorSecondary = '#ff00ff';
        this.updateThemeColors();

        this.renderers = [
            new SolarSystemRenderer(this.ctx),
            new SpectrumRenderer(this.ctx),
            new MirrorRenderer(this.ctx),
            new WaveformRenderer(this.ctx),
            new OscilloscopeRenderer(this.ctx),
            new RadialRenderer(this.ctx),
            new ParticlesRenderer(this.ctx)
        ];

        this.resize();
        
        // 交互状态追踪
        this.inputState = { x: 0, y: 0, active: false };
        
        // 监听鼠标/触摸移动
        const updateInput = (x, y) => {
            const rect = this.canvas.getBoundingClientRect();
            this.inputState.x = (x - rect.left) * window.devicePixelRatio;
            this.inputState.y = (y - rect.top) * window.devicePixelRatio;
            this.inputState.active = true;
        };

        this.canvas.addEventListener('mousemove', e => updateInput(e.clientX, e.clientY));
        this.canvas.addEventListener('touchmove', e => {
            if(e.touches.length > 0) updateInput(e.touches[0].clientX, e.touches[0].clientY);
        }, {passive: true});
        
        this.canvas.addEventListener('mouseleave', () => { this.inputState.active = false; });
        this.canvas.addEventListener('touchend', () => { this.inputState.active = false; });

        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.canvas);
    }

    updateThemeColors() {
        const styles = getComputedStyle(document.body);
        this.colorTheme = styles.getPropertyValue('--accent-cyan').trim() || '#00f3ff';
        this.colorSecondary = styles.getPropertyValue('--accent-magenta').trim() || '#ff00ff';
    }

    resize() {
        this.canvas.width = this.canvas.clientWidth * window.devicePixelRatio;
        this.canvas.height = this.canvas.clientHeight * window.devicePixelRatio;
        this.renderers.forEach(r => r.resize(this.canvas.width, this.canvas.height));
    }

    setAnalyser(analyser) { this.analyser = analyser; this.freqData = null; }

    setCallsign(callsign) { 
        if (callsign) {
            this.callsignState.text = callsign;
            this.callsignState.targetOpacity = 1;
            this.currentCallsign = callsign;
        } else {
            this.callsignState.targetOpacity = 0;
        }
    }

    switchMode() {
        this.mode = (this.mode + 1) % this.modes.length;
        return this.modes[this.mode];
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.loop();
    }

    loop() {
        if (!this.running) return;
        requestAnimationFrame(() => this.loop());
        
        const now = Date.now();
        const dt = (now - (this.lastLoopTime || now)) / 1000;
        this.lastLoopTime = now;
        
        const fadeSpeed = 3.0;
        if (this.callsignState.opacity < this.callsignState.targetOpacity) {
            this.callsignState.opacity = Math.min(1, this.callsignState.opacity + fadeSpeed * dt);
        } else if (this.callsignState.opacity > this.callsignState.targetOpacity) {
            this.callsignState.opacity = Math.max(0, this.callsignState.opacity - fadeSpeed * dt);
        }
        
        if (this.callsignState.opacity <= 0 && this.callsignState.targetOpacity === 0) {
            this.callsignState.text = '';
            this.currentCallsign = '';
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Use dummy analyser if real one is missing, to ensure rendering (especially callsigns) continues
        let effectiveAnalyser = this.analyser;
        if (!effectiveAnalyser) {
            effectiveAnalyser = {
                frequencyBinCount: 128,
                getByteFrequencyData: (arr) => arr.fill(0),
                getByteTimeDomainData: (arr) => arr.fill(128),
                fftSize: 256
            };
        }

        const bufferLength = effectiveAnalyser.frequencyBinCount;
        const dataArray = (this.freqData && this.freqData.length === bufferLength)
            ? this.freqData
            : (this.freqData = new Uint8Array(bufferLength));

        // Note: Renderers usually call getByteFrequencyData themselves, so we pass effectiveAnalyser
        this.renderers[this.mode].draw(effectiveAnalyser, dataArray, bufferLength, {
            primary: this.colorTheme,
            secondary: this.colorSecondary
        }, { 
            callsign: this.callsignState.text,
            opacity: this.callsignState.opacity,
            input: this.inputState
        });
    }

    getAudioEnergy() {
        if (!this.analyser) return 0;
        const bufferLength = this.analyser.frequencyBinCount;
        if (!this.freqData || this.freqData.length !== bufferLength) {
            this.freqData = new Uint8Array(bufferLength);
        }
        this.analyser.getByteFrequencyData(this.freqData);
        let sum = 0;
        const count = Math.floor(bufferLength / 2);
        for(let i = 0; i < count; i++) sum += this.freqData[i];
        return (sum / count) / 255.0;
    }

    destroy() {
        this.running = false;
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        // 清理渲染器
        this.renderers = null;
        // 清理引用
        this.canvas = null;
        this.ctx = null;
        this.analyser = null;
        this.freqData = null;
    }
}
