import { BaseRenderer } from './BaseRenderer.js';

export class SolarSystemRenderer extends BaseRenderer {
    constructor(ctx) {
        super(ctx);
        
        const palette = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD',
            '#D4A5A5', '#9B59B6', '#3498DB', '#E67E22', '#2ECC71',
            '#F1C40F', '#E74C3C', '#1ABC9C', '#8E44AD', '#FF9F43'
        ];
        const getRandomColor = () => palette[Math.floor(Math.random() * palette.length)];

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
                { name: 'Triton', r: 0.3, dist: 0.5, speed: -2.0, color: '#FFC0CB' }
            ]},
            { name: 'Pluto', r: 2.5, dist: 11.0, speed: 0.004, style: planetStyles['Pluto'], moons: [
                { name: 'Charon', r: 1.2, dist: 0.3, speed: 1.0, color: '#808080' }
            ]}
        ];
        
        this.targets = [];
        this.planets.forEach((p, pIdx) => {
            this.targets.push({ type: 'planet', pIdx: pIdx, name: p.name });
            if (p.moons) {
                p.moons.forEach((m, mIdx) => {
                    this.targets.push({ type: 'moon', pIdx: pIdx, mIdx: mIdx, name: m.name });
                });
            }
        });
        
        this.stars = [];
        for(let i=0; i<300; i++) {
            this.stars.push({
                r: Math.random() * 1.5,
                angle: Math.random() * Math.PI * 2,
                size: Math.random() * 2.5 + 0.5,
                blinkSpeed: Math.random() * 0.005 + 0.002,
                blinkPhase: Math.random() * Math.PI * 2,
                baseAlpha: Math.random() * 0.5 + 0.2
            });
        }
        this.starRotation = 0; 

        this.baseSpeed = 0.0436; 
        this.currentSpeed = this.baseSpeed;
        this.angleOffset = 0;
        this.tilt = 0.6; 
        this.orbitSpeedScale = 0.5;
        
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

        this.eruptions = [];
        this.eruptionConfig = {
            sensitivity: 1.0,
            randomness: 0.5,
            intensity: 1.0,
            speed: 0.5
        };
    }

    draw(analyser, dataArray, bufferLength, theme, extra) {
        analyser.getByteFrequencyData(dataArray);
        const { ctx, width: w, height: h } = this;
        const cx = w / 2;
        const cy = h / 2;
        const minDim = Math.min(w, h); 

        const getTextColor = (hex) => {
            if(!hex || hex[0]!=='#') return '#ffffff';
            const r = parseInt(hex.slice(1,3), 16);
            const g = parseInt(hex.slice(3,5), 16);
            const b = parseInt(hex.slice(5,7), 16);
            return (r*0.299 + g*0.587 + b*0.114) > 160 ? '#000000' : '#ffffff';
        };
        
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

        const targetSpeed = this.baseSpeed + energy * 6.0;
        this.currentSpeed += (targetSpeed - this.currentSpeed) * 0.05;
        this.angleOffset += this.currentSpeed * 0.01;

        const callsign = (extra && extra.callsign && extra.opacity > 0) ? extra.callsign : null;
        const input = extra.input || { x: 0, y: 0, active: false };
        
        if (callsign && callsign !== this.lastCallsign) {
            this.lastCallsign = callsign;
            let hash = 0;
            for (let i = 0; i < callsign.length; i++) hash = callsign.charCodeAt(i) + ((hash << 5) - hash);
            this.activeTarget = this.targets[Math.abs(hash) % this.targets.length];
        }

        this.starRotation += 0.0001; 
        const maxDim = Math.max(w, h);
        const nowTime = Date.now();

        this.stars.forEach(star => {
            const blink = Math.sin(nowTime * star.blinkSpeed + star.blinkPhase);
            const alpha = Math.max(0.1, Math.min(1, star.baseAlpha + blink * 0.3 + energy * 0.5));
            
            const currentAngle = star.angle + this.starRotation;
            const x = cx + Math.cos(currentAngle) * star.r * maxDim * 0.8;
            const y = cy + Math.sin(currentAngle) * star.r * maxDim * 0.8;

            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(x, y, star.size, 0, Math.PI*2);
            ctx.fill();
        });

        const maxDist = 11.0; 
        const scaleX = w / 2 / maxDist;
        const scaleY = h / 2 / (maxDist * this.tilt);
        const scale = Math.min(scaleX, scaleY) * 0.95; 

        ctx.lineWidth = 1;
        this.planets.forEach(p => {
            ctx.beginPath();
            ctx.ellipse(cx, cy, p.dist * scale, p.dist * scale * this.tilt, 0, 0, Math.PI*2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.05 + bass * 0.1})`;
            ctx.stroke();
        });

        const renderList = [];
        let hoveredItem = null;

        renderList.push({
            y: cy,
            draw: () => {
                const sunBaseSize = 25; 
                const sunSize = sunBaseSize + bass * 30;

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
                
                const sunGrad = ctx.createRadialGradient(cx, cy, sunSize*0.2, cx, cy, sunSize);
                sunGrad.addColorStop(0, 'rgba(255, 215, 0, 0.85)');
                sunGrad.addColorStop(1, 'rgba(255, 140, 0, 0.65)');
                
                ctx.fillStyle = sunGrad;
                ctx.beginPath();
                ctx.arc(cx, cy, sunSize, 0, Math.PI*2);
                ctx.fill();

                if (input.active && Math.hypot(input.x - cx, input.y - cy) < sunSize + 10) {
                    hoveredItem = { name: 'Sun', info: 'Star Type: G2V', x: cx, y: cy - sunSize - 10 };
                }
            }
        });

        this.planets.forEach((p, i) => {
            const angle = this.angleOffset * p.speed * this.orbitSpeedScale + i * 137.5; 
            const x = cx + Math.cos(angle) * p.dist * scale;
            const y = cy + Math.sin(angle) * p.dist * scale * this.tilt;
            
            renderList.push({
                y: y,
                draw: () => {
                    const size = Math.max(3, p.r * scale * 0.12);
                    const style = p.style;

                    if (p.moons && p.moons.length > 0) {
                        p.moons.forEach((m, idx) => {
                            const mAngle = this.angleOffset * m.speed * 4 * this.orbitSpeedScale + idx; 
                            const mDist = (size + m.dist * scale * 2); 
                            const mx = x + Math.cos(mAngle) * mDist;
                            const my = y + Math.sin(mAngle) * mDist * this.tilt;
                            const mSize = Math.max(2.0, m.r * scale * 0.15);

                            ctx.beginPath();
                            ctx.ellipse(x, y, mDist, mDist * this.tilt, 0, 0, Math.PI*2);
                            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
                            ctx.stroke();

                            ctx.fillStyle = m.color;
                            ctx.beginPath();
                            ctx.arc(mx, my, mSize, 0, Math.PI*2);
                            ctx.fill();

                            if (input.active && Math.hypot(input.x - mx, input.y - my) < mSize + 5) {
                                hoveredItem = { name: m.name, info: `Moon of ${p.name}`, x: mx, y: my - 10 };
                            }

                            if (callsign && this.activeTarget && this.activeTarget.type === 'moon' && this.activeTarget.pIdx === i && this.activeTarget.mIdx === idx) {
                                ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(mx, my);
                                ctx.strokeStyle = theme.primary; ctx.globalAlpha = 0.3; ctx.stroke(); ctx.globalAlpha = 1.0;

                                ctx.save();
                                ctx.translate(mx, my - mSize * 2.5 - 10);
                                
                                const text = callsign;
                                ctx.font = 'bold 12px "Roboto Mono"';
                                const textMetrics = ctx.measureText(text);
                                const bgW = textMetrics.width + 16;
                                const bgH = 20;
                                
                                ctx.fillStyle = m.color; 
                                ctx.globalAlpha = 0.8;
                                ctx.shadowBlur = 10;
                                ctx.shadowColor = m.color;
                                
                                ctx.beginPath();
                                ctx.roundRect(-bgW/2, -bgH/2 - 5, bgW, bgH, 10);
                                ctx.fill();
                                
                                ctx.fillStyle = getTextColor(m.color);
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'middle';
                                ctx.shadowBlur = 0; 
                                ctx.fillText(text, 0, -5);
                                ctx.restore();
                            }
                        });
                    }

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

                    const shadowGrad = ctx.createRadialGradient(x, y, size * 0.8, x, y, size);
                    shadowGrad.addColorStop(0, 'rgba(0,0,0,0)');
                    shadowGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
                    ctx.fillStyle = shadowGrad;
                    ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI*2); ctx.fill();
                    ctx.restore();
                    
                    if (minDim > 320) {
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                        const nameSize = Math.max(10, Math.floor(minDim / 60));
                        ctx.font = `${nameSize}px "Roboto Mono"`;
                        ctx.textAlign = 'center';
                        ctx.fillText(p.name, x, y + size + nameSize + 4);
                    }

                    if (input.active && Math.hypot(input.x - x, input.y - y) < size + 5) {
                        hoveredItem = { name: p.name, info: `Dist: ${p.dist} AU`, x: x, y: y - size - 10 };
                    }

                    if (callsign && this.activeTarget && this.activeTarget.type === 'planet' && this.activeTarget.pIdx === i) {
                        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y);
                        ctx.strokeStyle = theme.primary; ctx.globalAlpha = 0.3; ctx.stroke(); ctx.globalAlpha = 1.0;

                        ctx.save();
                        ctx.translate(x, y - size * 2.5);
                        
                        const text = callsign;
                        ctx.font = 'bold 14px "Roboto Mono"';
                        const textMetrics = ctx.measureText(text);
                        const bgW = textMetrics.width + 20;
                        const bgH = 24;
                        
                        ctx.fillStyle = style.color1; 
                        ctx.globalAlpha = 0.8;
                        ctx.shadowBlur = 10;
                        ctx.shadowColor = style.color1;
                        
                        ctx.beginPath();
                        ctx.roundRect(-bgW/2, -bgH/2 - 5, bgW, bgH, 12);
                        ctx.fill();
                        
                        ctx.fillStyle = getTextColor(style.color1);
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.shadowBlur = 0; 
                        ctx.fillText(text, 0, -5);
                        ctx.restore();
                    }
                }
            });
        });

        renderList.sort((a, b) => a.y - b.y);
        renderList.forEach(item => item.draw());

        this.cloudAngle += 0.001;
        const cloudCx = w - 60; const cloudCy = 60;
        ctx.save(); ctx.translate(cloudCx, cloudCy); ctx.rotate(this.cloudAngle);
        this.cloudParticles.forEach(p => {
            ctx.fillStyle = p.color; ctx.globalAlpha = p.alpha;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
        });
        ctx.restore(); ctx.globalAlpha = 1.0;

        if (minDim > 280) {
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

        if (minDim > 350) {
            const legendY = h - 25;
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

            let totalWidth = 0;
            const itemGap = 20;
            const itemsWithWidth = legendItems.map(item => {
                const w = ctx.measureText(item.label).width + 15;
                totalWidth += w;
                return { ...item, w };
            });
            totalWidth += (legendItems.length - 1) * itemGap;
            
            let currentX = cx - totalWidth / 2;
            
            itemsWithWidth.forEach((item, idx) => {
                ctx.fillStyle = item.color;
                ctx.beginPath();
                ctx.arc(currentX + 4, legendY, 4, 0, Math.PI*2);
                ctx.fill();
                
                ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.textAlign = 'left';
                ctx.fillText(item.label, currentX + 12, legendY);
                
                currentX += item.w + itemGap;
            });
            ctx.restore();
        }

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
}
