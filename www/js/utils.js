/**
 * 通用工具类与事件发射器
 * 包含防抖、节流、错误处理及基础事件发布订阅功能
 */

export const Utils = {
    // 防抖函数
    debounce(fn, delay) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    },

    // 节流函数
    throttle(fn, limit) {
        let inThrottle;
        return (...args) => {
            if (!inThrottle) {
                fn(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    // 显示用户友好的错误提示
    showError(message, error = null) {
        console.error('[Error]', message, error);
        alert(`${message}${error ? `\n\n详细信息: ${error.message}` : ''}`);
    },

    // 安全的JSON解析
    safeJSONParse(str, fallback = null) {
        try {
            return JSON.parse(str);
        } catch (e) {
            console.warn('JSON parse failed:', e);
            return fallback;
        }
    },

    // 检查网络连接状态
    isOnline() {
        return navigator.onLine;
    }
};

/** 基础事件发射器 */
export class EventEmitter {
    constructor() { this.events = {}; }
    on(event, listener) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(listener);
    }
    emit(event, ...args) {
        if (this.events[event]) this.events[event].forEach(fn => fn(...args));
    }
    // 注册回调 (别名，为了兼容部分旧代码习惯)
    addEventListener(event, listener) {
        this.on(event, listener);
    }
    removeEventListener(event, listener) {
        if (this.events[event]) {
            this.events[event] = this.events[event].filter(fn => fn !== listener);
        }
    }
}
