/**
 * Solar System Visualizer Constants and Data
 * 太阳系可视化常量与数据
 */

export const PALETTE = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD',
    '#D4A5A5', '#9B59B6', '#3498DB', '#E67E22', '#2ECC71',
    '#F1C40F', '#E74C3C', '#1ABC9C', '#8E44AD', '#FF9F43'
];

/**
 * Get a random color from the palette
 * 从调色板获取随机颜色
 */
export const getRandomColor = () => PALETTE[Math.floor(Math.random() * PALETTE.length)];

/**
 * Planet visualization styles
 * 行星可视化样式
 */
export const PLANET_STYLES = {
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

/**
 * Solar System Data (Planets and Moons)
 * 太阳系数据（行星与卫星）
 */
export const PLANETS_DATA = [
    { name: 'Mercury', r: 0.8, dist: 1.5, speed: 4.15, style: PLANET_STYLES['Mercury'], moons: [] },
    { name: 'Venus', r: 1.8, dist: 2.5, speed: 1.62, style: PLANET_STYLES['Venus'], moons: [] },
    { name: 'Earth', r: 2.0, dist: 3.3, speed: 1.0, style: PLANET_STYLES['Earth'], moons: [
        { name: 'Moon', r: 0.27, dist: 0.3, speed: 2.5, color: '#D3D3D3' }
    ]},
    { name: 'Mars', r: 1.2, dist: 4.0, speed: 0.53, style: PLANET_STYLES['Mars'], moons: [
        { name: 'Phobos', r: 0.15, dist: 0.2, speed: 4.0, color: '#C0C0C0' },
        { name: 'Deimos', r: 0.12, dist: 0.3, speed: 2.0, color: '#A9A9A9' }
    ]},
    { name: 'Jupiter', r: 5.5, dist: 6.5, speed: 0.084, style: PLANET_STYLES['Jupiter'], moons: [
        { name: 'Io', r: 0.3, dist: 0.7, speed: 3.0, color: '#FFFFE0' },
        { name: 'Europa', r: 0.25, dist: 0.9, speed: 2.5, color: '#F0F8FF' },
        { name: 'Ganymede', r: 0.4, dist: 1.2, speed: 2.0, color: '#D3D3D3' },
        { name: 'Callisto', r: 0.35, dist: 1.5, speed: 1.5, color: '#708090' }
    ]},
    { name: 'Saturn', r: 4.8, dist: 8.0, speed: 0.034, style: PLANET_STYLES['Saturn'], moons: [
        { name: 'Titan', r: 0.4, dist: 0.8, speed: 2.0, color: '#F4A460' },
        { name: 'Rhea', r: 0.2, dist: 0.5, speed: 3.0, color: '#D3D3D3' }
    ]},
    { name: 'Uranus', r: 4.2, dist: 9.2, speed: 0.012, style: PLANET_STYLES['Uranus'], moons: [
        { name: 'Titania', r: 0.2, dist: 0.5, speed: 2.5, color: '#E0FFFF' },
        { name: 'Oberon', r: 0.2, dist: 0.6, speed: 2.0, color: '#E0FFFF' }
    ]},
    { name: 'Neptune', r: 4.0, dist: 10.2, speed: 0.006, style: PLANET_STYLES['Neptune'], moons: [
        { name: 'Triton', r: 0.3, dist: 0.5, speed: -2.0, color: '#FFC0CB' } 
    ]},
    { name: 'Pluto', r: 2.5, dist: 11.0, speed: 0.004, style: PLANET_STYLES['Pluto'], moons: [
        { name: 'Charon', r: 1.2, dist: 0.3, speed: 1.0, color: '#808080' }
    ]}
];

/**
 * Legend items for the UI
 * UI 图例项
 */
export const LEGEND_ITEMS = [
    { color: '#FFD700', label: 'Sun' },
    { color: '#A9A9A9', label: 'Rocky' },
    { color: '#FFA500', label: 'Gas Giant' },
    { color: '#00FFFF', label: 'Ice Giant' },
    { color: '#A0522D', label: 'Dwarf' },
    { color: '#D3D3D3', label: 'Moon' }
];
