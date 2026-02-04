/**
 * @fileoverview Weapon System for Space Fighters
 */

/**
 * Manages weapons and hardpoints
 * 管理武器和挂载点
 */
export class WeaponSystem {
    constructor() {
        this.hardpoints = []; // {x, y, z, type, weapon}
        this.weapons = []; // Meshes // 武器网格模型
    }

    /**
     * Add a hardpoint to the system
     * 向系统添加挂载点
     * @param {number} x X coordinate X坐标
     * @param {number} y Y coordinate Y坐标
     * @param {number} z Z coordinate Z坐标
     * @param {string} type Hardpoint type (TIP, WING, BODY) 挂载点类型
     * @param {string} side Side 'L' or 'R' 侧别（左/右）
     */
    addHardpoint(x, y, z, type, side) {
        this.hardpoints.push({x, y, z, type, side, weapon: null});
    }

    /**
     * Procedurally generate a weapon loadout
     * 程序化生成武器挂载配置
     * @param {number} seed Random seed 随机种子
     */
    generateLoadout(seed) {
        // Symmetric Loadout
        // 对称挂载
        // Filter hardpoints by side 'L'
        // 筛选左侧挂载点
        const leftPoints = this.hardpoints.filter(h => h.side === 'L');
        
        leftPoints.forEach(hp => {
            let weaponType = null;
            // Random chance to mount weapon
            // 随机挂载武器
            if (Math.random() > 0.2) { 
                if (hp.type === 'TIP') weaponType = 'AAM-S'; // Short range AAM // 短距空空导弹
                else if (hp.type === 'WING') weaponType = Math.random() > 0.5 ? 'AAM-M' : 'AGM'; 
                else if (hp.type === 'BODY') weaponType = 'TANK'; // Fuel Tank // 副油箱
            }

            if (weaponType) {
                // Mount on Left
                // 挂载在左侧
                this.mountWeapon(hp, weaponType);
                
                // Mount on Right (Symmetry)
                // 挂载在右侧（保持对称）
                const rightHp = this.hardpoints.find(h => h.side === 'R' && Math.abs(h.x + hp.x) < 0.01 && h.type === hp.type);
                if (rightHp) this.mountWeapon(rightHp, weaponType);
            }
        });
    }

    /**
     * Mount a specific weapon to a hardpoint
     * 将特定武器挂载到挂载点
     * @param {Object} hp Hardpoint object 挂载点对象
     * @param {string} type Weapon type 武器类型
     */
    mountWeapon(hp, type) {
        // Generate simple mesh for weapon
        // 生成简单的武器网格
        let mesh = { vertices: [], faces: [], color: '#FFF' };
        
        if (type === 'AAM-S') {
            // Sidewinder style: Thin, long
            // 响尾蛇风格：细长
            mesh = this.createMissileMesh(0.1, 1.2, '#DDDDDD', '#FF0000');
        } else if (type === 'AAM-M') {
            // AMRAAM style: Medium
            // AMRAAM风格：中等
            mesh = this.createMissileMesh(0.15, 1.5, '#CCCCCC', '#FFFFFF');
        } else if (type === 'AGM') {
            // Maverick style: Thick
            // 小牛风格：粗壮
            mesh = this.createMissileMesh(0.25, 1.2, '#555555', '#FFFF00');
        } else if (type === 'TANK') {
            // Fuel Tank
            // 副油箱
            mesh = this.createTankMesh(0.3, 2.0, '#AAAAAA');
        }

        hp.weapon = mesh;
    }

    /**
     * Create missile geometry
     * 创建导弹几何体
     */
    createMissileMesh(radius, len, bodyColor, finColor) {
        // Simple diamond shape to save perf
        // 简单的菱形形状以节省性能
        return {
            vertices: [
                {x:0, y:0, z:-len/2}, // Nose // 弹头
                {x:0, y:-radius, z:0}, // Top // 顶部
                {x:-radius, y:radius, z:0}, // Left // 左侧
                {x:radius, y:radius, z:0}, // Right // 右侧
                {x:0, y:0, z:len/2} // Tail // 弹尾
            ],
            faces: [
                {idx:[0,1,2], color:bodyColor}, {idx:[0,2,3], color:bodyColor}, {idx:[0,3,1], color:bodyColor},
                {idx:[4,2,1], color:bodyColor}, {idx:[4,3,2], color:bodyColor}, {idx:[4,1,3], color:bodyColor}
            ]
        };
    }

    /**
     * Create fuel tank geometry
     * 创建副油箱几何体
     */
    createTankMesh(radius, len, color) {
        // Elongated diamond
        // 拉长的菱形
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
