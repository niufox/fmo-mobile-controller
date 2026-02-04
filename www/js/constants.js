/**
 * FMO Audio Controller - Application Constants
 * FMO 音频控制器 - 应用程序常量
 */

// Time constants (milliseconds)
// 时间常量 (毫秒)
export const TIME_CONSTANTS = {
    DEBOUNCE_DELAY: 200,           // Window resize debounce
    CONNECTION_DELAY: 300,         // Delay between disconnect and reconnect
    GEO_SYNC_DELAY: 1000,          // Delay after connection before geo sync
    EASTER_EGG_TIMEOUT: 10000,     // Timeout for easter egg reset
    GEO_PERIODIC_INTERVAL: 1800000, // 30 minutes = 30 * 60 * 1000 (was 300000*6)
    QSO_REFRESH_INTERVAL: 15000,   // 15 seconds
    STATUS_LOG_INTERVAL: 10000,    // 10 seconds
    ANIMATION_TRANSITION: 300,     // General animation duration
};

// UI constants
// UI 常量
export const UI_CONSTANTS = {
    DEVICE_DESKTOP_BREAKPOINT: 768,     // Desktop minimum width
    DEVICE_SMALL_BREAKPOINT: 380,       // Small screen breakpoint
    DEVICE_MEDIUM_BREAKPOINT: 480,       // Medium screen breakpoint
    STATION_MODAL_MAX_ITEMS: 5,         // Max saved devices in history
    STATION_LIST_CHUNK_SIZE: 50,        // Render stations in chunks
    CALLSIGN_TICKER_MIN_ITEMS: 8,       // Minimum items in ticker
    CALLSIGN_TICKER_MAX_ITEMS: 30,      // Maximum items in ticker
    CALLSIGN_ITEM_HEIGHT: 50,           // Estimated height per item
    STATION_GRID_COLUMNS_DESKTOP: 3,    // Desktop grid columns
    STATION_GRID_COLUMNS_MOBILE: 2,     // Mobile grid columns
};

// Volume constants
// 音量常量
export const VOLUME_CONSTANTS = {
    MIN_VOLUME: 0.0,
    MAX_VOLUME: 2.0,
    DEFAULT_VOLUME: 1.0,
    VOLUME_MULTIPLIER: 2.0,            // Maps 0-100% to 0-2.0
    MUTE_THRESHOLD: 0.0,
};

// Geolocation constants
// 地理位置常量
export const GEO_CONSTANTS = {
    COORD_PRECISION: 6,                // Decimal places for coordinates
    ENABLE_HIGH_ACCURACY: true,
    GEO_TIMEOUT: 10000,
    MAXIMUM_AGE: 0,
};

// Easter egg constants
// 彩蛋常量
export const EASTER_EGG_CONSTANTS = {
    REQUIRED_CLICKS: 10,                // Clicks to trigger easter egg
    RESET_TIMEOUT: 10000,               // Time before reset
};

// Theme names
// 主题名称
export const THEME_NAMES = [
    '',        // Default (Orange)
    'matrix',
    'ocean',
    'sunset',
    'light',
    'pink',
    'purple',
    'red',
    'black',
];

// Storage keys
// 存储键
export const STORAGE_KEYS = {
    THEME: 'fmo_theme',
    GEO_SINGLE: 'fmo_geo_single',
    GEO_PERIODIC: 'fmo_geo_periodic',
    SAVED_DEVICES: 'fmo_saved_devices',
};

// Audio constants
// 音频常量
export const AUDIO_CONSTANTS = {
    MIN_SAMPLE_RATE: 22050,
    DEFAULT_SAMPLE_RATE: 44100,
    RECORDING_FILENAME_PREFIX: 'fmo_rec_',
    AUDIO_UNLOCK_TYPES: ['click', 'touchstart', 'keydown'],
};

// Message types for postMessage
// postMessage 的消息类型
export const MESSAGE_TYPES = {
    LOCATE_GRID: 'LOCATE_GRID',
    DISPLAY_ALL_QSOS: 'DISPLAY_ALL_QSOS',
    HIGHLIGHT_QSO: 'HIGHLIGHT_QSO',
};

// Visualizer modes
// 可视化器模式
export const VISUALIZER_MODES = {
    SOLAR: 'SOLAR',
    SPECTRUM: 'SPECTRUM',
    OSCILLOSCOPE: 'OSCILLOSCOPE',
    WAVEFORM: 'WAVEFORM',
    MIRROR: 'MIRROR',
    RADIAL: 'RADIAL',
};

// Canvas dimensions
// 画布尺寸
export const CANVAS_CONSTANTS = {
    DEFAULT_WIDTH: 800,
    DEFAULT_HEIGHT: 600,
};

// WebSocket connection limits
// WebSocket 连接限制
export const WS_CONSTANTS = {
    MAX_CONNECTIONS: 2,                 // ESP32 connection limit
    RECONNECT_DELAY: 300,              // ms before reconnect attempt
};
