export const Utils = {
    debounce(fn, delay) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    },

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

    showError(message, error = null) {
        console.error('[Error]', message, error);
        alert(`${message}${error ? `\n\n详细信息: ${error.message}` : ''}`);
    },

    safeJSONParse(str, fallback = null) {
        try {
            return JSON.parse(str);
        } catch (e) {
            console.warn('JSON parse failed:', e);
            return fallback;
        }
    },

    isOnline() {
        return navigator.onLine;
    }
};

window.addEventListener('error', (e) => {
    console.error('[Global Error]', e.message, e.filename, e.lineno, e.error);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('[Unhandled Promise Rejection]', e.reason);
    e.preventDefault();
});

window.addEventListener('online', () => {
    console.log('[Network] Online');
});

window.addEventListener('offline', () => {
    console.log('[Network] Offline');
    Utils.showError('网络连接已断开，请检查网络设置');
});

window.__DEBUG_LOGS__ = [];
(function(){
    const MAX_LOGS = 100;
    const capture = (type, args) => {
        try {
            const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
            window.__DEBUG_LOGS__.push(`[${new Date().toLocaleTimeString()}] [${type}] ${msg}`);
            if (window.__DEBUG_LOGS__.length > MAX_LOGS) {
                window.__DEBUG_LOGS__.shift();
            }
        } catch(e) {}
    };
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    console.log = (...args) => { capture('LOG', args); originalLog.apply(console, args); };
    console.warn = (...args) => { capture('WARN', args); originalWarn.apply(console, args); };
    console.error = (...args) => { capture('ERR', args); originalError.apply(console, args); };
})();
