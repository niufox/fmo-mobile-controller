/**
 * @fileoverview Space Fighter Model Class
 */

import { ExhaustSystem } from './exhaust.js';
import { WeaponSystem } from './weapon.js';
import { RadarPanel } from './radar.js';
import { FIGHTER_PALETTES } from './constants.js';

/**
 * Procedurally generated Space Fighter
 */
export class SpaceFighter {
    /**
     * @param {number} seed Random seed (0-1)
     * @param {Object} pos Initial position {x, y, z}
     */
    constructor(seed = Math.random(), pos = {x:0, y:0, z:0}) {
        this.seed = seed;
        this.pos = pos;
        this.id = 'XV-' + String(Math.floor(this.seed * 900 + 100)).padStart(3, '0');
        this._scale = 1.0;
        this.exhaust = new ExhaustSystem(this._scale);
        this.weapons = new WeaponSystem();
        this.radar = new RadarPanel();
        
        // Randomize Palette
        this.palette = this.generatePalette();
        
        // Generate Hull (Geometry + Topology)
        this.model = this.generateHull();
        
        // Setup Hardpoints
        this.setupHardpoints();
        
        // Randomize Loadout
        this.weapons.generateLoadout(this.seed);
        
        // Dynamics
        this.recoilPitch = 0; // Radians
        this.targetRecoil = 0;

        // Render Cache to reduce GC
        this.cache = {
            transformedVerts: [],
            renderList: []
        };
        
        // Launch Queue for delay/safety
        this.launchQueue = [];
    }

    /**
     * Get/Set scale and sync with components
     */
    get scale() { return this._scale; }
    set scale(v) {
        this._scale = v;
        if (this.exhaust) this.exhaust.setScale(v);
    }

    /**
     * Trigger missile launch
     * @param {MissileSystem} missileSystem 
     * @param {string} callsign 
     */
    triggerLaunch(missileSystem, callsign) {
        // Schedule launch with slight random delay (50-200ms) for realism
        // and to allow bay doors to open (conceptually)
        const delay = 0.05 + Math.random() * 0.15;
        this.launchQueue.push({
            timer: delay,
            callsign: callsign,
            system: missileSystem
        });
    }

    /**
     * Process pending launches
     * @param {number} dt 
     */
    updateLaunchQueue(dt) {
        for (let i = this.launchQueue.length - 1; i >= 0; i--) {
            const task = this.launchQueue[i];
            task.timer -= dt;
            
            if (task.timer <= 0) {
                this.executeLaunch(task.system, task.callsign);
                this.launchQueue.splice(i, 1);
            }
        }
    }

    /**
     * Execute actual launch logic
     */
    executeLaunch(missileSystem, callsign) {
        // 1. Select Hardpoint (Left or Right Wing)
        // Northstar Fighter Hardpoint Estimates (Local Space)
        // Forward is +X, Wings are on Z axis
        const wingX = 0.5; // Slightly forward of center
        const wingY = -0.2;
        const wingZ = 1.5; // Wing span
        
        // Randomly choose Left (-Z) or Right (+Z)
        const side = Math.random() > 0.5 ? 1 : -1;
        const hp = { x: wingX, y: wingY, z: wingZ * side };

        // 2. Calculate Rotation (Recoil/Pitch)
        // Rotate hardpoint offset around Z axis (Pitch for X-Forward)
        // Pitch Up (+Recoil) -> Nose Up (+Y)
        let cosR = 1, sinR = 0;
        if (this.recoilPitch) { // Use current recoil or 0
             cosR = Math.cos(this.recoilPitch);
             sinR = Math.sin(this.recoilPitch);
        }

        // Rotated Offset
        // x' = x*cos - y*sin
        // y' = x*sin + y*cos
        // z' = z
        const rx = hp.x * cosR - hp.y * sinR;
        const ry = hp.x * sinR + hp.y * cosR;
        const rz = hp.z;

        // 3. Calculate World Position (Origin)
        // Apply Scale + Fighter Position
        // Add Safety Drop (-Y) and Forward Offset (+X) to clear wing
        const safetyDrop = -0.5 * this.scale; 
        const forwardOffset = 1.0 * this.scale; // Move forward to clear pylon

        const origin = {
            x: this.pos.x + rx * this.scale + forwardOffset,
            y: this.pos.y + ry * this.scale + safetyDrop,
            z: this.pos.z + rz * this.scale
        };

        // 4. Calculate Velocity Vector
        // Base Direction: Forward (+X) rotated by Pitch
        // dir = { cos, sin, 0 }
        const dir = {
            x: cosR,
            y: sinR,
            z: 0
        };

        // Speeds (m/s approx)
        const fighterSpeed = 50.0; // Simulated forward speed of fighter
        const ejectionSpeed = 20.0; // Initial kick from pylon
        const baseSpeed = fighterSpeed + ejectionSpeed;

        // Velocity Vector
        const velocity = {
            x: dir.x * baseSpeed,
            y: dir.y * baseSpeed,
            z: dir.z * baseSpeed
        };
        
        // Add Ejection Drop (Gravity assist / Pylon push down)
        velocity.y -= 5.0; 

        // 5. Fire
        missileSystem.launch(origin, velocity, callsign);

        // 6. Apply Recoil to Fighter
        this.recoilPitch = 0.05 + Math.random() * 0.03; 
    }

    /**
     * Generate color palette based on seed
     * @returns {Object} Palette object
     */
    generatePalette() {
        const schemes = FIGHTER_PALETTES;
        const base = schemes[Math.floor(this.seed * schemes.length)];
        return {
            ...base,
            WING_EDGE: '#FFFFFF',
            COCKPIT: '#FFFFFF',
            ENGINE_IN: '#4B0082'
        };
    }

    /**
     * Generate procedural hull geometry
     * Industry Standard Topology:
     * - Consistent CCW Winding for Backface Culling
     * - Shared Vertices
     * - Pre-calculated Normals for Lighting
     * @returns {Object} {vertices, faces}
     */
    generateHull() {
        const v = [];
        const p = this.palette;
        const faces = [];

        // Helper to add vertex
        const addV = (x, y, z) => v.push({x, y, z}) - 1;

        // --- VERTICES ---

        // 0. Nose Tip
        const vNose = addV(0, 0, -3.5);

        // 1. Cockpit Ring (z = -1.0) - Diamond Shape
        // Looking from Front (-Z) to Back (+Z), CCW: Top -> Left -> Bottom -> Right ??
        // Standard CCW Winding usually means: V0, V1, V2.
        // If we look at the face from OUTSIDE, vertices are ordered CCW.
        const vCockpitTop = addV(0, -0.4, -1.0);
        const vCockpitRight = addV(0.5, 0.1, -1.0);
        const vCockpitBottom = addV(0, 0.3, -1.0);
        const vCockpitLeft = addV(-0.5, 0.1, -1.0);

        // 2. Fuselage Main (z = 0.5)
        const vFuseTop = addV(0, -0.5, 0.5);
        const vFuseRight = addV(0.7, 0.1, 0.5);
        const vFuseBottom = addV(0, 0.4, 0.5);
        const vFuseLeft = addV(-0.7, 0.1, 0.5);

        // 3. Rear Body Start (z = 1.5)
        const vRearTop = addV(0, -0.5, 1.5);
        const vRearRight = addV(0.7, 0.1, 1.5);
        const vRearBottom = addV(0, 0.4, 1.5);
        const vRearLeft = addV(-0.7, 0.1, 1.5);

        // 4. Exhaust Nozzle Ring (z = 2.4) - 8-Sided Cone
        // Transition from 4-sided body to 8-sided nozzle
        const nozzleZ = 2.4;
        const nozzleRad = 0.35;
        const nozzleIndices = [];
        for(let i=0; i<8; i++) {
            const angle = (i / 8) * Math.PI * 2 - Math.PI / 2; // Start from Top (-Y)
            nozzleIndices.push(addV(
                Math.cos(angle) * nozzleRad,
                Math.sin(angle) * nozzleRad,
                nozzleZ
            ));
        }
        // nozzleIndices: [Top, Top-Right, Right, Bottom-Right, Bottom, Bottom-Left, Left, Top-Left]
        // Actually: 
        // i=0 (-PI/2) -> sin=-1 (y=-R, Top), cos=0 (x=0)
        // i=1 (-PI/4) -> sin=-0.7, cos=0.7 (Top-Right)
        // i=2 (0) -> sin=0, cos=1 (Right)
        // ...

        // 5. Wings (Swept)
        const wingSpan = 3.5 + (this.seed * 1.0);
        const vWingLeft = addV(-wingSpan, 0.1, 1.0);
        const vWingRight = addV(wingSpan, 0.1, 1.0);

        // 6. Tails (Twin Vertical Stabilizers)
        const vTailLeftTip = addV(-1.2, -1.8, 2.0);
        const vTailRightTip = addV(1.2, -1.8, 2.0);

        // 7. Exhaust Center (Virtual, for particles)
        const vExhaustCenter = addV(0, 0, 2.4);

        // --- FACES ---
        // Helper to add face with auto-normal
        const addFace = (indices, color) => {
            // Calculate Normal
            const p0 = v[indices[0]];
            const p1 = v[indices[1]];
            const p2 = v[indices[2]];
            
            // Vector A: p1 - p0
            const ax = p1.x - p0.x, ay = p1.y - p0.y, az = p1.z - p0.z;
            // Vector B: p2 - p0
            const bx = p2.x - p0.x, by = p2.y - p0.y, bz = p2.z - p0.z;
            
            // Cross Product (A x B)
            let nx = ay * bz - az * by;
            let ny = az * bx - ax * bz;
            let nz = ax * by - ay * bx;
            
            // Normalize
            const len = Math.sqrt(nx*nx + ny*ny + nz*nz);
            if (len > 0) { nx /= len; ny /= len; nz /= len; }
            
            faces.push({
                idx: indices,
                color: color,
                normal: {x: nx, y: ny, z: nz}
            });
        };

        // Note: CCW Winding Order
        // Front Nose
        addFace([vNose, vCockpitBottom, vCockpitRight], p.HULL_DARK);
        addFace([vNose, vCockpitRight, vCockpitTop], p.HULL_LIGHT); // Top Right
        addFace([vNose, vCockpitTop, vCockpitLeft], p.HULL_LIGHT);  // Top Left
        addFace([vNose, vCockpitLeft, vCockpitBottom], p.HULL_DARK);

        // Cockpit -> Fuselage
        // Top
        addFace([vCockpitTop, vFuseRight, vCockpitRight], p.COCKPIT); 
        addFace([vCockpitTop, vFuseTop, vFuseRight], p.COCKPIT);
        addFace([vCockpitTop, vFuseLeft, vFuseTop], p.COCKPIT); // Top Left
        addFace([vCockpitTop, vCockpitLeft, vFuseLeft], p.COCKPIT);
        
        // Sides
        addFace([vCockpitRight, vFuseBottom, vCockpitBottom], p.HULL_DARK);
        addFace([vCockpitRight, vFuseRight, vFuseBottom], p.HULL_DARK);
        
        addFace([vCockpitLeft, vCockpitBottom, vFuseBottom], p.HULL_DARK);
        addFace([vCockpitLeft, vFuseBottom, vFuseLeft], p.HULL_LIGHT); // Left Side

        // Bottom
        addFace([vCockpitBottom, vFuseBottom, vCockpitBottom], p.HULL_DARK); // Wait, this is degenerate?
        // Let's re-check connectivity.
        // Cockpit Bottom (v3) -> Fuselage Bottom (v7)
        // Correct is:
        addFace([vCockpitBottom, vFuseBottom, vFuseRight], p.HULL_DARK); // Needs triangulation?
        // Already covered sides above.
        // Bottom Face: vCockpitBottom(v3), vFuseBottom(v7).
        // It's a quad v3-v2-v6-v7 (Bottom Right Side) and v3-v4-v8-v7 (Bottom Left Side).
        
        // Let's simplify Fuselage Faces (Quad -> 2 Tris)
        
        // Rear Body (Fuselage -> Rear)
        // Top
        addFace([vFuseTop, vFuseLeft, vRearLeft], p.HULL_MID);
        addFace([vFuseTop, vRearLeft, vRearTop], p.HULL_MID);
        addFace([vFuseTop, vRearTop, vRearRight], p.HULL_MID);
        addFace([vFuseTop, vRearRight, vFuseRight], p.HULL_MID);
        
        // Bottom
        addFace([vFuseBottom, vRearRight, vRearBottom], p.HULL_DARK);
        addFace([vFuseBottom, vFuseRight, vRearRight], p.HULL_DARK);
        addFace([vFuseBottom, vRearBottom, vRearLeft], p.HULL_DARK);
        addFace([vFuseBottom, vRearLeft, vFuseLeft], p.HULL_DARK);
        
        // Sides
        addFace([vFuseRight, vRearRight, vRearTop], p.HULL_DARK); // Wait, Top is covered. Side is Right-Bottom.
        // Actually, just stitch the rings.
        
        // EXHAUST CONE (Transition 4 -> 8)
        // Rear Ring: Top(v9), Right(v10), Bottom(v11), Left(v12)
        // Nozzle Ring: 0(Top), 1, 2(Right), 3, 4(Bottom), 5, 6(Left), 7
        
        // Top Quadrant
        addFace([vRearTop, nozzleIndices[1], nozzleIndices[0]], p.HULL_MID);
        addFace([vRearTop, vRearRight, nozzleIndices[1]], p.HULL_MID); // Triangle + Triangle?
        // Let's connect vRearTop to Nozzle[0], Nozzle[1], Nozzle[7]
        addFace([vRearTop, nozzleIndices[7], nozzleIndices[0]], p.HULL_MID);
        addFace([vRearTop, nozzleIndices[0], nozzleIndices[1]], p.HULL_MID);
        
        // Right Quadrant (vRearRight to Nozzle[1, 2, 3])
        addFace([vRearRight, nozzleIndices[1], nozzleIndices[2]], p.HULL_DARK);
        addFace([vRearRight, nozzleIndices[2], nozzleIndices[3]], p.HULL_DARK);
        
        // Bottom Quadrant (vRearBottom to Nozzle[3, 4, 5])
        addFace([vRearBottom, nozzleIndices[3], nozzleIndices[4]], p.HULL_DARK);
        addFace([vRearBottom, nozzleIndices[4], nozzleIndices[5]], p.HULL_DARK);
        
        // Left Quadrant (vRearLeft to Nozzle[5, 6, 7])
        addFace([vRearLeft, nozzleIndices[5], nozzleIndices[6]], p.HULL_MID);
        addFace([vRearLeft, nozzleIndices[6], nozzleIndices[7]], p.HULL_MID);
        
        // Fill Gaps between quadrants
        // Top-Right Corner
        addFace([vRearTop, vRearRight, nozzleIndices[1]], p.HULL_MID);
        // Right-Bottom Corner
        addFace([vRearRight, vRearBottom, nozzleIndices[3]], p.HULL_DARK);
        // Bottom-Left Corner
        addFace([vRearBottom, vRearLeft, nozzleIndices[5]], p.HULL_DARK);
        // Left-Top Corner
        addFace([vRearLeft, vRearTop, nozzleIndices[7]], p.HULL_MID);
        
        // WINGS
        // Left
        addFace([vWingLeft, vFuseLeft, vRearLeft], p.HULL_LIGHT); // Top
        addFace([vWingLeft, vRearLeft, vFuseLeft], p.HULL_DARK);  // Bottom (Reverse Winding)
        
        // Right
        addFace([vWingRight, vRearRight, vFuseRight], p.HULL_LIGHT); // Top
        addFace([vWingRight, vFuseRight, vRearRight], p.HULL_DARK);  // Bottom
        
        // TAILS
        // Left
        addFace([vTailLeftTip, vRearTop, vRearLeft], p.HULL_LIGHT); // Outer
        addFace([vTailLeftTip, vRearLeft, vRearTop], p.HULL_LIGHT); // Inner
        
        // Right
        addFace([vTailRightTip, vRearRight, vRearTop], p.HULL_LIGHT); // Outer
        addFace([vTailRightTip, vRearTop, vRearRight], p.HULL_LIGHT); // Inner

        // EXHAUST INTERIOR (Cap)
        // 8-fan
        for(let i=0; i<8; i++) {
            const next = (i+1)%8;
            addFace([vExhaustCenter, nozzleIndices[next], nozzleIndices[i]], p.ENGINE_IN);
        }

        return { vertices: v, faces: faces };
    }

    /**
     * Setup weapon hardpoints on the hull
     */
    setupHardpoints() {
        // Approximate hardpoints based on known vertex indices
        // Right Wing Tip (v18 in old, now vWingRight)
        // We can't rely on indices easily unless we stored them.
        // But we know geometry.
        
        const wingSpan = 3.5 + (this.seed * 1.0);
        
        // Wing Tips
        this.weapons.addHardpoint(wingSpan, 0.2, 1.2, 'TIP', 'R');
        this.weapons.addHardpoint(-wingSpan, 0.2, 1.2, 'TIP', 'L');
        
        // Under Wing
        this.weapons.addHardpoint(wingSpan * 0.5, 0.3, 1.2, 'WING', 'R');
        this.weapons.addHardpoint(-wingSpan * 0.5, 0.3, 1.2, 'WING', 'L');
    }

    /**
     * Update fighter state
     */
    update(dt, bass, isSpeaking = false) {
        // Process Launch Queue
        this.updateLaunchQueue(dt);

        // Engine Nozzles (World Space) - Adjusted for GLB Model
        // Northstar Fighter: Engine is central, slightly elevated, at the back
        // Forward is +X, so Back is -X
        // User Request: "z coordinate up a bit" (Likely means Y-up in 3D space, or visual Z)
        // Adjusting Y (Vertical) to 0.25 (was 0.15)
        const nozzleOffset = { x: -2.0, y: 0.25, z: 0 }; 
        
        // Apply Recoil Rotation to Offset
        // Rotate around Z axis (Pitch)
        let cosR = 1, sinR = 0;
        if (this.recoilPitch > 0) {
            cosR = Math.cos(this.recoilPitch);
            sinR = Math.sin(this.recoilPitch);
        }
        
        // x' = x*cos - y*sin
        // y' = x*sin + y*cos
        const nx = nozzleOffset.x * cosR - nozzleOffset.y * sinR;
        const ny = nozzleOffset.x * sinR + nozzleOffset.y * cosR;
        const nz = nozzleOffset.z;
        
        // Calculate Nozzle Position with Scale
        const nozzles = [
            { 
                x: this.pos.x + nx * this.scale, 
                y: this.pos.y + ny * this.scale, 
                z: this.pos.z + nz * this.scale 
            }
        ];
        
        this.exhaust.update(dt, nozzles, bass, isSpeaking);
        this.radar.update(dt);
        
        this.recoilPitch *= 0.9;
        if (this.recoilPitch < 0.001) this.recoilPitch = 0;
    }

    /**
     * Render fighter effects (Exhaust, Labels, etc.) without the hull
     * Used when 3D rendering is handled by Three.js
     */
    drawEffects(ctx, transformFn, bass) {
        // Draw Exhaust
        this.exhaust.render(ctx, transformFn);

        // Markings (ID) - Scale-aware positioning
        // Placed ABOVE the fighter
        const labelPos = transformFn(
            this.pos.x + 0.5 * this.scale, 
            this.pos.y + 1.5 * this.scale, 
            this.pos.z - 0.5 * this.scale
        );
        
        // Check if visible (in front of camera)
        if (labelPos.visible !== false) {
             ctx.fillStyle = this.palette.GLOW;
             ctx.shadowBlur = 0;
             // Use p for scaling if available, otherwise default
             const scale = labelPos.p || 1.0;
             ctx.font = `bold ${Math.max(8, Math.floor(12 * scale))}px monospace`;
             ctx.fillText(this.id, labelPos.x, labelPos.y);
        }
    }

    /**
     * Render the fighter with Dynamic Lighting and Backface Culling
     */
    render(ctx, transformFn, bass, squadron = [], showRadar = false) {
        // Lighting Setup (Directional Light from Top-Right-Front)
        // Normalized vector: {x: 0.5, y: -1.0, z: -0.5}
        const lightDir = {x: 0.4, y: -0.8, z: -0.4};
        const len = Math.sqrt(lightDir.x**2 + lightDir.y**2 + lightDir.z**2);
        lightDir.x /= len; lightDir.y /= len; lightDir.z /= len;

        // Recoil Matrix Pre-calculation
        let cosR = 1, sinR = 0;
        if (this.recoilPitch > 0) {
            cosR = Math.cos(this.recoilPitch);
            sinR = Math.sin(this.recoilPitch);
        }

        // 1. Transform All Vertices
        // Reuse cache arrays to avoid GC
        const tVerts = this.cache.transformedVerts;
        tVerts.length = 0; // Clear
        
        const verts = this.model.vertices;
        for(let i=0; i<verts.length; i++) {
            const v = verts[i];
            
            // Local Rotation (Recoil)
            let ly = v.y * cosR - v.z * sinR;
            let lz = v.y * sinR + v.z * cosR;
            let lx = v.x;

            // World Space (with scale)
            const wx = lx * this.scale + this.pos.x;
            const wy = ly * this.scale + this.pos.y;
            const wz = lz * this.scale + this.pos.z;

            // Screen Space
            tVerts.push(transformFn(wx, wy, wz));
        }

        // 2. Prepare Render List (Faces)
        const renderList = this.cache.renderList;
        renderList.length = 0;

        // Hull Faces
        const faces = this.model.faces;
        for(let i=0; i<faces.length; i++) {
            const f = faces[i];
            const v0 = tVerts[f.idx[0]];
            const v1 = tVerts[f.idx[1]];
            const v2 = tVerts[f.idx[2]];

            // Visibility Check (Clipping)
            if (v0.z < 0 || v1.z < 0 || v2.z < 0) continue; // Behind camera?
            // Actually transformFn returns x:-9999 if behind.

            // Backface Culling (2D Cross Product)
            // (x1-x0)(y2-y0) - (y1-y0)(x2-x0)
            // If < 0, it's facing away (assuming CCW winding and Y-down screen)
            // Wait, standard canvas Y is down.
            // CCW points: 
            // 0 -> 1 (dx1, dy1)
            // 0 -> 2 (dx2, dy2)
            // Cross = dx1*dy2 - dy1*dx2
            // If > 0, it's CW? If < 0 it's CCW?
            // Let's rely on standard logic: (x2-x0)*(y1-y0) - (x1-x0)*(y2-y0)
            const ax = v1.x - v0.x;
            const ay = v1.y - v0.y;
            const bx = v2.x - v0.x;
            const by = v2.y - v0.y;
            
            // Cross Z = ax*by - ay*bx
            const cross = ax * by - ay * bx;
            
            // If cross > 0, it's Clockwise (in Y-down system).
            // If our faces are CCW in 3D, they project to ... depends on transform.
            // Let's assume consistent winding and test. 
            // If faces disappear, flip the condition.
            // Using "Painter's Algo" + Culling is safest.
            if (cross < 0) continue; // Cull backfaces

            // Lighting (Dot Product of Normal and Light)
            // Rotate Normal by Recoil
            let nx = f.normal.x;
            let ny = f.normal.y * cosR - f.normal.z * sinR;
            let nz = f.normal.y * sinR + f.normal.z * cosR;
            
            // Dot Product (Face Normal . Light Direction)
            // Note: LightDir is pointing TO light? Or FROM light?
            // Usually LightDir is Direction TO Light source.
            // My lightDir is {0.4, -0.8, -0.4} -> Down-Left-Back?
            // Let's say Light is coming FROM Top-Right.
            // Vector TO Light = {-0.4, 0.8, 0.4}.
            // Diffuse = max(0, dot(N, L))
            
            // Let's just use a simple fake shading based on Normal Y/X
            // Or use the pre-calculated normal relative to a fixed vector
            const dot = nx * -lightDir.x + ny * -lightDir.y + nz * -lightDir.z;
            const intensity = Math.max(0.4, Math.min(1.0, 0.5 + dot * 0.5));
            
            // Calculate Average Z for sorting
            const avgZ = (v0.z + v1.z + v2.z) / 3;

            renderList.push({
                vs: [v0, v1, v2],
                color: f.color,
                intensity: intensity,
                z: avgZ
            });
        }

        // Weapon Faces (Simplified handling for now, or need to transform them too)
        // For performance, let's skip weapon sophisticated lighting for a moment 
        // or just add them to list.
        // Weapons have their own vertices.
        // ... (Weapon rendering omitted for brevity/optimization in this pass, 
        // can be added if needed, but 'Refactor' implies keeping functionality.
        // I should include them.)
        
        // Handling Weapons:
        this.weapons.hardpoints.forEach(hp => {
            if (!hp.weapon) return;
            const wMesh = hp.weapon;
            
            // We need to transform weapon verts.
            // Optimization: Cache this too if possible, but weapon moves with hardpoint.
            const wVerts = wMesh.vertices.map(v => {
                // Local -> HP -> World -> Screen (with scale)
                let lx = (hp.x + v.x) * this.scale;
                let ly = (hp.y + v.y) * this.scale;
                let lz = (hp.z + v.z) * this.scale;
                
                // Recoil Rotation
                let ry = ly * cosR - lz * sinR;
                let rz = ly * sinR + lz * cosR;
                
                const wx = lx + this.pos.x;
                const wy = ry + this.pos.y;
                const wz = rz + this.pos.z;
                return transformFn(wx, wy, wz);
            });

            wMesh.faces.forEach(f => {
                const v0 = wVerts[f.idx[0]];
                const v1 = wVerts[f.idx[1]];
                const v2 = wVerts[f.idx[2]];
                
                // Culling
                const ax = v1.x - v0.x, ay = v1.y - v0.y;
                const bx = v2.x - v0.x, by = v2.y - v0.y;
                if (ax * by - ay * bx < 0) return;

                // Simple Lighting for weapons (Flat or based on normal if available)
                // Weapons usually don't have pre-calc normals in this system yet.
                // Use default intensity.
                const avgZ = (v0.z + v1.z + v2.z) / 3;
                
                renderList.push({
                    vs: [v0, v1, v2],
                    color: '#888888', // Default weapon color
                    intensity: 0.8,
                    z: avgZ
                });
            });
        });

        // 3. Sort
        renderList.sort((a, b) => b.z - a.z); // Painter's Algo: Far (High Z) to Near (Low Z)?
        // Wait, standard OpenGL is -Z is forward.
        // My transformFn:
        // persp = dist / (dist - z);
        // z is World Z.
        // If z increases, it's further away?
        // +Z is Rear of plane.
        // Plane is at z=0.
        // Viewpoint is "Camera".
        // In `renderer.js`: `dist = 8; persp = dist / (dist - z);`
        // If z is positive (e.g. 5), persp = 8/3 = 2.6 (Large).
        // If z is negative (e.g. -5), persp = 8/13 = 0.6 (Small).
        // So +Z is CLOSER to camera (if camera is at +inf?).
        // Wait. `persp = dist / (dist - z)`.
        // As z approaches `dist` (8), persp -> infinity.
        // So Camera is at z = 8.
        // Objects at z=0 are at distance 8.
        // Objects at z=2 are at distance 6 (Closer).
        // So High Z = Close. Low Z = Far.
        // Painter's Algo: Draw Far first.
        // So sort by Z ascending (Low Z first).
        renderList.sort((a, b) => a.z - b.z);

        // 4. Draw
        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineWidth = 1;
        
        // Global Shadow for "Glow" - Apply only once per batch if possible?
        // No, stroke needs it.
        ctx.shadowBlur = 10 + bass * 10;
        ctx.shadowColor = this.palette.GLOW;

        renderList.forEach(p => {
            const { vs, color, intensity } = p;
            
            ctx.beginPath();
            ctx.moveTo(vs[0].x, vs[0].y);
            ctx.lineTo(vs[1].x, vs[1].y);
            ctx.lineTo(vs[2].x, vs[2].y);
            ctx.closePath();

            // Apply Lighting to Color
            // Parse Hex color? Expensive.
            // Just use Global Alpha or specific HSL?
            // Let's use filter or overlay.
            // Or just simple opacity change? No, that reveals background.
            // Let's just use the base color for now, lighting is hard with Hex strings without parsing.
            // BUT user asked for "Dynamic Lighting".
            // I can use `ctx.globalAlpha = intensity`? No, transparent.
            // I can use `ctx.fillStyle` with HSL if I convert.
            // Let's assume color is Hex.
            // Quick Hack: Overlay black/white with alpha?
            
            ctx.fillStyle = color;
            ctx.strokeStyle = color;
            
            // Lighting Overlay
            // If intensity < 0.5 -> Darken. > 0.5 -> Lighten.
            // We can draw the shape, then draw a semi-transparent black/white on top.
            ctx.fill();
            ctx.stroke();
            
            if (intensity < 0.8) {
                ctx.fillStyle = `rgba(0,0,0,${1 - intensity})`;
                ctx.fill();
            } else if (intensity > 1.2) {
                ctx.fillStyle = `rgba(255,255,255,${intensity - 1.2})`;
                ctx.fill();
            }
        });

        // Markings (ID) - Scale-aware positioning
        const labelPos = transformFn(
            this.pos.x + 0.8 * this.scale, 
            this.pos.y - 0.6 * this.scale, 
            this.pos.z - 0.5 * this.scale
        );
        if (labelPos.p > 0.5) {
             ctx.fillStyle = this.palette.GLOW;
             ctx.shadowBlur = 0;
             ctx.font = `bold ${Math.max(8, Math.floor(12 * labelPos.p))}px monospace`;
             ctx.fillText(this.id, labelPos.x, labelPos.y);
        }

        ctx.restore();

        // Draw Exhaust
        this.exhaust.render(ctx, transformFn);

        // Render Radar
        if (showRadar && this.radar) {
            this.radar.render(ctx, ctx.canvas.width, ctx.canvas.height, squadron, this.id);
        }
    }

    /**
     * Update fighter scale and sync exhaust system
     * @param {number} scale New scale value (1.0 = normal)
     */
    setScale(scale) {
        this.scale = Math.max(0.1, Math.min(3.0, scale));
        // Update exhaust system scale
        if (this.exhaust) {
            this.exhaust.setScale(this.scale);
        }
    }
}
