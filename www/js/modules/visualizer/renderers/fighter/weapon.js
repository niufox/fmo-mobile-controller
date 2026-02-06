/**
 * @fileoverview Weapon System for Space Fighters
 */

/**
 * Manages weapons and hardpoints
 */
export class WeaponSystem {
    constructor() {
        this.hardpoints = []; // {x, y, z, type, weapon}
        this.weapons = []; // Meshes
    }

    /**
     * Add a hardpoint to the system
     * @param {number} x 
     * @param {number} y 
     * @param {number} z 
     * @param {string} type 
     * @param {string} side 'L' or 'R'
     */
    addHardpoint(x, y, z, type, side) {
        this.hardpoints.push({x, y, z, type, side, weapon: null});
    }

    /**
     * Procedurally generate a weapon loadout
     * @param {number} seed 
     */
    generateLoadout(seed) {
        // Symmetric Loadout
        // Filter hardpoints by side 'L'
        const leftPoints = this.hardpoints.filter(h => h.side === 'L');
        
        leftPoints.forEach(hp => {
            let weaponType = null;
            // Random chance to mount weapon
            if (Math.random() > 0.2) { 
                if (hp.type === 'TIP') weaponType = 'AAM-S'; // Short range AAM
                else if (hp.type === 'WING') weaponType = Math.random() > 0.5 ? 'AAM-M' : 'AGM'; 
                else if (hp.type === 'BODY') weaponType = 'TANK';
            }

            if (weaponType) {
                // Mount on Left
                this.mountWeapon(hp, weaponType);
                
                // Mount on Right (Symmetry)
                const rightHp = this.hardpoints.find(h => h.side === 'R' && Math.abs(h.x + hp.x) < 0.01 && h.type === hp.type);
                if (rightHp) this.mountWeapon(rightHp, weaponType);
            }
        });
    }

    /**
     * Mount a specific weapon to a hardpoint
     * @param {Object} hp Hardpoint object
     * @param {string} type Weapon type
     */
    mountWeapon(hp, type) {
        // Generate simple mesh for weapon
        let mesh = { vertices: [], faces: [], color: '#FFF' };
        
        if (type === 'AAM-S') {
            // Sidewinder style: Thin, long
            mesh = this.createMissileMesh(0.1, 1.2, '#DDDDDD', '#FF0000');
        } else if (type === 'AAM-M') {
            // AMRAAM style: Medium
            mesh = this.createMissileMesh(0.15, 1.5, '#CCCCCC', '#FFFFFF');
        } else if (type === 'AGM') {
            // Maverick style: Thick
            mesh = this.createMissileMesh(0.25, 1.2, '#555555', '#FFFF00');
        } else if (type === 'TANK') {
            // Fuel Tank
            mesh = this.createTankMesh(0.3, 2.0, '#AAAAAA');
        }

        hp.weapon = mesh;
    }

    createMissileMesh(radius, len, bodyColor, finColor) {
        // Simple diamond shape to save perf
        return {
            vertices: [
                {x:0, y:0, z:-len/2}, // Nose
                {x:0, y:-radius, z:0}, // Top
                {x:-radius, y:radius, z:0}, // Left
                {x:radius, y:radius, z:0}, // Right
                {x:0, y:0, z:len/2} // Tail
            ],
            faces: [
                {idx:[0,1,2], color:bodyColor}, {idx:[0,2,3], color:bodyColor}, {idx:[0,3,1], color:bodyColor},
                {idx:[4,2,1], color:bodyColor}, {idx:[4,3,2], color:bodyColor}, {idx:[4,1,3], color:bodyColor}
            ]
        };
    }

    createTankMesh(radius, len, color) {
        // Elongated diamond
         return {
            vertices: [
                {x:0, y:0, z:-len/2}, 
                {x:0, y:-radius, z:0}, 
                {x:-radius, y:0, z:0}, 
                {x:radius, y:0, z:0}, 
                {x:0, y:radius, z:0},
                {x:0, y:0, z:len/2}
            ],
            faces: [
                {idx:[0,1,2], color}, {idx:[0,2,3], color}, {idx:[0,3,4], color}, {idx:[0,4,1], color},
                {idx:[5,2,1], color}, {idx:[5,3,2], color}, {idx:[5,4,3], color}, {idx:[5,1,4], color}
            ]
        };
    }
}
