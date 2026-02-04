/**
 * @fileoverview Space Fighter Model Class
 * 太空战机模型类
 */

import { ExhaustSystem } from './exhaust.js';
import { WeaponSystem } from './weapon.js';
import { FIGHTER_PALETTES } from './constants.js';

/**
 * Procedurally generated Space Fighter
 * 程序化生成的太空战机
 */
export class SpaceFighter {
    /**
     * @param {number} seed Random seed (0-1) 随机种子 (0-1)
     * @param {Object} pos Initial position {x, y, z} 初始位置 {x, y, z}
     */
    constructor(seed = Math.random(), pos = {x:0, y:0, z:0}) {
        this.seed = seed;
        this.pos = pos;
        this.id = 'F-' + Math.floor(this.seed * 900 + 100);
        this.exhaust = new ExhaustSystem();
        this.weapons = new WeaponSystem();
        
        // Randomize Palette
        // 随机化调色板
        this.palette = this.generatePalette();
        
        // Generate Hull
        // 生成机身
        this.model = this.generateHull();
        
        // Setup Hardpoints
        // 设置挂载点
        this.setupHardpoints();
        
        // Randomize Loadout
        // 随机化挂载
        this.weapons.generateLoadout(this.seed);
    }

    /**
     * Generate color palette based on seed
     * 基于种子生成调色板
     * @returns {Object} Palette object 调色板对象
     */
    generatePalette() {
        const schemes = FIGHTER_PALETTES;
        const base = schemes[Math.floor(this.seed * schemes.length)];
        
        const adjustBrightness = (hex, factor) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            const nr = Math.min(255, Math.max(0, Math.floor(r * factor)));
            const ng = Math.min(255, Math.max(0, Math.floor(g * factor)));
            const nb = Math.min(255, Math.max(0, Math.floor(b * factor)));
            return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
        };
        
        const brightFactor = 0.8 + (this.seed * 0.4);
        const darkFactor = 0.6 + (this.seed * 0.3);
        const glowFactor = 1.0 + (this.seed * 0.5);
        
        return {
            ...base,
            WING_EDGE: adjustBrightness(base.HULL_LIGHT, brightFactor + 0.2),
            COCKPIT: '#0A0A12',
            ENGINE_IN: adjustBrightness(base.GLOW, glowFactor),
            HULL_DARK: adjustBrightness(base.HULL_DARK, darkFactor),
            HULL_MID: adjustBrightness(base.HULL_MID, darkFactor + 0.1),
            HULL_LIGHT: adjustBrightness(base.HULL_LIGHT, brightFactor),
            GLOW: adjustBrightness(base.GLOW, glowFactor)
        };
    }

    /**
     * Generate procedural hull geometry
     * 生成程序化机身几何体
     * @returns {Object} {vertices, faces} {顶点, 面}
     */
    generateHull() {
        const v = [];
        const faces = [];
        const p = this.palette;
        const s = this.seed;
        
        const wingSpan = 2.2 + (s * 1.8);
        const noseLen = 2.5 + (s * 1.2);
        const fuselageLen = 4.0 + (s * 1.0);
        
        const wingType = Math.floor(s * 4);
        const tailType = Math.floor((s * 10) % 4);
        const engineCount = Math.floor((s * 100) % 3) + 1;
        const hasCanards = (s * 100) % 2 > 0.5;
        const bodyShape = Math.floor((s * 1000) % 3);
        
        let noseShape, cockpitPos;
        switch(bodyShape) {
            case 0:
                noseShape = { tipY: 0.08, midY: 0.06, baseY: -0.12 };
                cockpitPos = { frontZ: -0.7, topY: -0.55, rearZ: 0.15 };
                break;
            case 1:
                noseShape = { tipY: 0.1, midY: 0.08, baseY: -0.08 };
                cockpitPos = { frontZ: -0.6, topY: -0.5, rearZ: 0.25 };
                break;
            case 2:
                noseShape = { tipY: 0.05, midY: 0.04, baseY: -0.15 };
                cockpitPos = { frontZ: -0.8, topY: -0.6, rearZ: 0.1 };
                break;
        }
        
        const wingSweepAngle = 45 + (s * 25);
        const wingChordRatio = 0.6 + (s * 0.3);
        
        const engineOffsetY = 0.2 + (s * 0.3);
        const engineAngle = (s * 30 - 15);
        
        let vIdx = 0;
        const addVert = (x, y, z) => { v.push({x, y, z}); return vIdx++; };
        const addFace = (i1, i2, i3, color) => faces.push({ idx: [i1, i2, i3], color });
        const addFace4 = (i1, i2, i3, i4, color) => {
            addFace(i1, i2, i3, color);
            addFace(i1, i3, i4, color);
        };
        
        const noseTip = addVert(0, noseShape.tipY, -noseLen);
        const noseMid = addVert(0, noseShape.midY, -noseLen + 0.4);
        const noseBase = addVert(0, noseShape.baseY, -noseLen + 0.7);
        
        const cockpitFront = addVert(0, -0.3, cockpitPos.frontZ);
        const cockpitTop = addVert(0, cockpitPos.topY, -0.25);
        const cockpitRear = addVert(0, cockpitPos.topY + 0.05, cockpitPos.rearZ);
        
        const spineMid = addVert(0, -0.2, 0.8);
        const spineRear = addVert(0, 0.1, 1.1);
        const tailBase = addVert(0, 0.2, fuselageLen - 0.5);
        
        addFace(noseTip, noseBase, noseMid, p.HULL_LIGHT);
        addFace(noseMid, noseBase, cockpitFront, p.HULL_MID);
        addFace(cockpitFront, cockpitTop, cockpitRear, p.COCKPIT);
        addFace(cockpitRear, cockpitTop, spineMid, p.HULL_MID);
        addFace(spineMid, spineRear, tailBase, p.HULL_DARK);
        
        const wingRootZ = -0.3;
        const wingMidZ = 0.4;
        const wingTipZ = 1.3;
        
        let wingRootY, wingMidY, wingTipY, wingTipOffset;
        switch(wingType) {
            case 0:
                wingRootY = 0.03;
                wingMidY = 0.06;
                wingTipY = 0.08;
                wingTipOffset = 0;
                break;
            case 1:
                wingRootY = 0.04;
                wingMidY = 0.09;
                wingTipY = 0.12;
                wingTipOffset = 0.1;
                break;
            case 2:
                wingRootY = 0.02;
                wingMidY = 0.05;
                wingTipY = 0.06;
                wingTipOffset = -0.05;
                break;
            case 3:
                wingRootY = 0.05;
                wingMidY = 0.12;
                wingTipY = 0.15;
                wingTipOffset = 0.2;
                break;
        }
        
        const leftWingRoot = addVert(-wingSpan * 0.12, wingRootY, wingRootZ);
        const leftWingMid = addVert(-wingSpan * 0.45, wingMidY, wingMidZ);
        const leftWingTip = addVert(-wingSpan, wingTipY + wingTipOffset, wingTipZ);
        const leftWingRear = addVert(-wingSpan * 0.9, wingTipY + wingTipOffset - 0.05, wingTipZ - 0.25);
        
        const rightWingRoot = addVert(wingSpan * 0.12, wingRootY, wingRootZ);
        const rightWingMid = addVert(wingSpan * 0.45, wingMidY, wingMidZ);
        const rightWingTip = addVert(wingSpan, wingTipY + wingTipOffset, wingTipZ);
        const rightWingRear = addVert(wingSpan * 0.9, wingTipY + wingTipOffset - 0.05, wingTipZ - 0.25);
        
        addFace4(cockpitRear, spineMid, leftWingRoot, leftWingMid, p.HULL_LIGHT);
        addFace4(spineMid, leftWingMid, leftWingTip, leftWingRear, p.HULL_MID);
        
        addFace4(cockpitRear, spineMid, rightWingRoot, rightWingMid, p.HULL_LIGHT);
        addFace4(spineMid, rightWingMid, rightWingTip, rightWingRear, p.HULL_MID);
        
        if (hasCanards) {
            const leftCanardRoot = addVert(-0.4, -0.08, -0.85);
            const leftCanardTip = addVert(-0.85, -0.02, -0.65);
            const rightCanardRoot = addVert(0.4, -0.08, -0.85);
            const rightCanardTip = addVert(0.85, -0.02, -0.65);
            
            addFace(cockpitFront, leftCanardRoot, leftCanardTip, p.HULL_LIGHT);
            addFace(cockpitFront, rightCanardRoot, rightCanardTip, p.HULL_LIGHT);
        }
        
        let engineIndices = [];
        if (engineCount === 1) {
            const engineLeft = addVert(-0.5, engineOffsetY, fuselageLen);
            const engineRight = addVert(0.5, engineOffsetY, fuselageLen);
            const engineUpL = addVert(-0.4, engineOffsetY + 0.25, fuselageLen + 0.2);
            const engineUpR = addVert(0.4, engineOffsetY + 0.25, fuselageLen + 0.2);
            
            addFace4(tailBase, spineRear, engineLeft, engineRight, p.HULL_MID);
            addFace(engineLeft, engineRight, engineUpR, p.ENGINE_IN);
            addFace(engineLeft, engineUpR, engineUpL, p.ENGINE_IN);
            
            engineIndices.push(engineUpL, engineUpR);
        } else if (engineCount === 2) {
            const engineLeft = addVert(-0.7, engineOffsetY, fuselageLen);
            const engineRight = addVert(0.7, engineOffsetY, fuselageLen);
            const engineUpL = addVert(-0.6, engineOffsetY + 0.3, fuselageLen + 0.25);
            const engineUpR = addVert(0.6, engineOffsetY + 0.3, fuselageLen + 0.25);
            const engineOutL = addVert(-0.85, engineOffsetY + 0.2, fuselageLen + 0.15);
            const engineOutR = addVert(0.85, engineOffsetY + 0.2, fuselageLen + 0.15);
            
            addFace4(tailBase, spineRear, engineLeft, engineRight, p.HULL_MID);
            addFace(engineLeft, engineOutL, engineUpL, p.ENGINE_IN);
            addFace(engineRight, engineOutR, engineUpR, p.ENGINE_IN);
            
            engineIndices.push(engineUpL, engineUpR);
        } else {
            const centerEngine = addVert(0, engineOffsetY, fuselageLen);
            const centerEngineUp = addVert(0, engineOffsetY + 0.35, fuselageLen + 0.3);
            const leftEngine = addVert(-0.6, engineOffsetY - 0.1, fuselageLen - 0.2);
            const rightEngine = addVert(0.6, engineOffsetY - 0.1, fuselageLen - 0.2);
            const leftEngineUp = addVert(-0.5, engineOffsetY + 0.2, fuselageLen + 0.2);
            const rightEngineUp = addVert(0.5, engineOffsetY + 0.2, fuselageLen + 0.2);
            
            addFace(tailBase, spineRear, centerEngine, p.HULL_MID);
            addFace4(spineRear, leftEngine, centerEngine, rightEngine, p.HULL_MID);
            addFace(centerEngine, leftEngine, leftEngineUp, p.ENGINE_IN);
            addFace(centerEngine, rightEngine, rightEngineUp, p.ENGINE_IN);
            
            engineIndices.push(centerEngineUp, leftEngineUp, rightEngineUp);
        }
        
        if (tailType === 0) {
            const tailTipTop = addVert(0, 0.3, fuselageLen - 0.8);
            const tailTipBottom = addVert(0, -0.9, fuselageLen - 0.6);
            const tailTipRear = addVert(0, -1.0, fuselageLen - 0.3);
            
            addFace4(spineRear, tailBase, tailTipTop, tailTipBottom, p.HULL_MID);
            addFace(tailTipBottom, tailTipTop, tailTipRear, p.HULL_DARK);
        } else if (tailType === 1) {
            const leftTailTop = addVert(-0.6, 0.25, fuselageLen - 0.7);
            const leftTailBottom = addVert(-0.6, -0.7, fuselageLen - 0.5);
            const leftTailRear = addVert(-0.6, -0.75, fuselageLen - 0.2);
            const rightTailTop = addVert(0.6, 0.25, fuselageLen - 0.7);
            const rightTailBottom = addVert(0.6, -0.7, fuselageLen - 0.5);
            const rightTailRear = addVert(0.6, -0.75, fuselageLen - 0.2);
            
            addFace4(spineRear, tailBase, leftTailTop, leftTailBottom, p.HULL_MID);
            addFace(leftTailBottom, leftTailTop, leftTailRear, p.HULL_DARK);
            addFace4(spineRear, tailBase, rightTailTop, rightTailBottom, p.HULL_MID);
            addFace(rightTailBottom, rightTailTop, rightTailRear, p.HULL_DARK);
        } else if (tailType === 2) {
            const vTailTopL = addVert(-0.4, 0.3, fuselageLen - 0.8);
            const vTailBotL = addVert(-0.5, -0.8, fuselageLen - 0.6);
            const vTailTopR = addVert(0.4, 0.3, fuselageLen - 0.8);
            const vTailBotR = addVert(0.5, -0.8, fuselageLen - 0.6);
            
            addFace4(spineRear, tailBase, vTailTopL, vTailBotL, p.HULL_MID);
            addFace4(spineRear, tailBase, vTailTopR, vTailBotR, p.HULL_MID);
            addFace(vTailBotL, vTailTopL, vTailBotR, p.HULL_DARK);
        } else {
            const tailSpan = 0.8;
            const tailForwardL = addVert(-tailSpan * 0.4, 0.2, fuselageLen - 1.2);
            const tailTipL = addVert(-tailSpan, 0.35, fuselageLen - 0.8);
            const tailRearL = addVert(-tailSpan * 0.6, 0.15, fuselageLen - 0.4);
            const tailForwardR = addVert(tailSpan * 0.4, 0.2, fuselageLen - 1.2);
            const tailTipR = addVert(tailSpan, 0.35, fuselageLen - 0.8);
            const tailRearR = addVert(tailSpan * 0.6, 0.15, fuselageLen - 0.4);
            
            addFace4(spineRear, tailBase, tailForwardL, tailRearL, p.HULL_MID);
            addFace4(spineRear, tailBase, tailForwardR, tailRearR, p.HULL_MID);
            addFace4(tailForwardL, tailTipL, tailRearL, tailBase, p.HULL_LIGHT);
            addFace4(tailForwardR, tailTipR, tailRearR, tailBase, p.HULL_LIGHT);
        }
        
        addFace(leftWingTip, leftWingRear, engineIndices[0] || leftWingRear, p.WING_EDGE);
        addFace(rightWingTip, rightWingRear, engineIndices[1] || rightWingRear, p.WING_EDGE);
        
        const bellyMid = addVert(0, 0.25, 0.5);
        const bellyRear = addVert(0, 0.3, 1.0);
        
        addFace(noseBase, bellyMid, spineMid, p.HULL_DARK);
        addFace(bellyMid, bellyRear, spineMid, p.HULL_DARK);
        
        this.modelMetadata = {
            wingSpan,
            fuselageLen,
            noseLen,
            wingType,
            tailType,
            engineCount,
            hasCanards,
            engineIndices
        };
        
        return { vertices: v, faces: faces };
    }

    /**
     * Setup weapon hardpoints on the hull
     * 在机身上设置武器挂载点
     */
    setupHardpoints() {
        const meta = this.modelMetadata;
        const wingSpan = meta.wingSpan;
        const fuselageLen = meta.fuselageLen;
        
        const wingTipZ = 1.3;
        const wingMidZ = 0.4;
        
        this.weapons.addHardpoint(-wingSpan, 0.15, wingTipZ, 'TIP', 'L');
        this.weapons.addHardpoint(wingSpan, 0.15, wingTipZ, 'TIP', 'R');
        
        this.weapons.addHardpoint(-wingSpan * 0.45, 0.2, wingMidZ, 'WING', 'L');
        this.weapons.addHardpoint(wingSpan * 0.45, 0.2, wingMidZ, 'WING', 'R');
        
        const underFuseZ = fuselageLen - 1.2;
        this.weapons.addHardpoint(0, 0.5, underFuseZ, 'FUSE', 'C');
    }

    /**
     * Update fighter state
     * 更新战机状态
     * @param {number} dt Delta time 时间增量
     * @param {number} bass Audio bass 音频低音
     */
    update(dt, bass) {
        const engineIndices = this.modelMetadata.engineIndices;
        const nozzles = engineIndices.map(idx => {
            const v = this.model.vertices[idx];
            return {
                x: v.x + this.pos.x,
                y: v.y + this.pos.y,
                z: v.z + this.pos.z
            };
        });
        this.exhaust.update(dt, nozzles, bass);
    }

    /**
     * Render the fighter
     * 渲染战机
     * @param {CanvasRenderingContext2D} ctx 
     * @param {Function} transformFn Coordinate transform function 坐标变换函数
     * @param {number} bass Audio bass 音频低音
     */
    render(ctx, transformFn, bass) {
        // Helper to apply World Position to Local Vertices
        // 将世界位置应用到局部顶点的辅助函数
        const getTransformedVertex = (v) => {
             const wx = v.x + this.pos.x;
             const wy = v.y + this.pos.y;
             const wz = v.z + this.pos.z;
             return transformFn(wx, wy, wz);
        };

        // Gather All Faces (Hull + Weapons)
        // 收集所有面（机身 + 武器）
        let allFaces = [];
        
        // 1. Hull Faces
        // 1. 机身面
        const hullVerts = this.model.vertices.map(v => getTransformedVertex(v));
        this.model.faces.forEach(f => {
            allFaces.push({
                face: f,
                vs: f.idx.map(i => hullVerts[i]),
                type: 'HULL'
            });
        });

        // 2. Weapon Faces
        // 2. 武器面
        this.weapons.hardpoints.forEach(hp => {
            if (!hp.weapon) return;
            const wMesh = hp.weapon;
            // Transform weapon vertices: Local -> Hardpoint World -> View
            // 变换武器顶点：局部 -> 挂载点世界 -> 视图
            const wVerts = wMesh.vertices.map(v => {
                // Weapon Local -> Hardpoint Offset -> Fighter World -> View
                // 武器局部 -> 挂载点偏移 -> 战机世界 -> 视图
                return getTransformedVertex({
                    x: hp.x + v.x, 
                    y: hp.y + v.y, 
                    z: hp.z + v.z
                });
            });
            wMesh.faces.forEach(f => {
                allFaces.push({
                    face: f,
                    vs: f.idx.map(i => wVerts[i]),
                    type: 'WEAPON'
                });
            });
        });

        // Sort Faces
        // 排序面
        allFaces.forEach(item => {
            item.avgZ = item.vs.reduce((acc, v) => acc + v.z, 0) / item.vs.length;
        });
        allFaces.sort((a, b) => a.avgZ - b.avgZ);

        // Draw Solid Geometry
        // 绘制实体几何体
        ctx.save();
        
        // Glow
        // 发光
        ctx.shadowBlur = 15 + bass * 15;
        ctx.shadowColor = this.palette.GLOW;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = 2;

        allFaces.forEach(item => {
            const { face, vs } = item;
            
            // Backface Culling
            // 背面剔除
            if (vs.length < 3) return;
            const v0 = vs[0], v1 = vs[1], v2 = vs[2];
            const ax = v1.x - v0.x, ay = v1.y - v0.y;
            const bx = v2.x - v0.x, by = v2.y - v0.y;
            if (ax * by - ay * bx < 0) return;

            ctx.beginPath();
            ctx.moveTo(vs[0].x, vs[0].y);
            for(let i=1; i<vs.length; i++) ctx.lineTo(vs[i].x, vs[i].y);
            ctx.closePath();
            
            ctx.fillStyle = face.color;
            ctx.strokeStyle = face.color;
            ctx.fill();
            ctx.stroke();
        });

        // Markings (ID)
        // 标记 (ID)
        const labelPos = getTransformedVertex({x: -0.5, y: -0.3, z: -0.5});
        if (labelPos && labelPos.p > 0.5) {
             ctx.fillStyle = this.palette.GLOW;
             ctx.shadowBlur = 0;
             ctx.font = `bold ${Math.max(8, Math.floor(12 * labelPos.p))}px monospace`;
             ctx.fillText(this.id, labelPos.x, labelPos.y);
        }

        ctx.restore();

        // Draw Exhaust (Particles are already in World Space)
        // 绘制排气（粒子已经在世界空间中）
        this.exhaust.render(ctx, transformFn);
    }
}
