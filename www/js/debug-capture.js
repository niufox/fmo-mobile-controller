/**
 * Debug Log Capture
 * 捕获控制台日志用于调试面板显示
 */
window.__DEBUG_LOGS__ = [];

(function(){
    const MAX_LOGS = 100;
    const capture = (type, args) => {
        try {
            const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
            window.__DEBUG_LOGS__.push(`[${new Date().toLocaleTimeString()}] [${type}] ${msg}`);
            if (window.__DEBUG_LOGS__.length > MAX_LOGS) window.__DEBUG_LOGS__.shift();
        } catch(e) {}
    };
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    console.log = (...args) => { capture('LOG', args); originalLog.apply(console, args); };
    console.warn = (...args) => { capture('WARN', args); originalWarn.apply(console, args); };
    console.error = (...args) => { capture('ERR', args); originalError.apply(console, args); };
})();
