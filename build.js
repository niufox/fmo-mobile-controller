const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SOURCE_DIR = path.join(__dirname, 'www');
const CORDOVA_PROJECT_DIR = path.join(__dirname, 'cordova_app');
const DEST_DIR = path.join(CORDOVA_PROJECT_DIR, 'www');

// Helper to copy directory recursively
function copyDir(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// Helper to clean directory
function cleanDir(dir) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    fs.mkdirSync(dir, { recursive: true });
}

// Main logic
try {
    console.log('--- FMO Build Workflow (Adapted for WWW) ---');
    
    // 1. Setup Cordova Project (if needed)
    console.log('[1/4] Checking Cordova environment...');
    if (!fs.existsSync(CORDOVA_PROJECT_DIR)) {
        console.log('  - Creating new Cordova project...');
        try {
            execSync(`cordova create "${CORDOVA_PROJECT_DIR}" com.fmo.controller "FMO Controller"`, { stdio: 'inherit' });
            console.log('  - Adding Android platform (v11 for Java 11 compatibility)...');
            execSync(`cd "${CORDOVA_PROJECT_DIR}" && cordova platform add android@11`, { stdio: 'inherit' });
            
            // Auto-configure config.xml
            const configPath = path.join(CORDOVA_PROJECT_DIR, 'config.xml');
            let configContent = fs.readFileSync(configPath, 'utf8');
            
            if (!configContent.includes('xmlns:android')) {
                configContent = configContent.replace('<widget ', '<widget xmlns:android="http://schemas.android.com/apk/res/android" ');
            }
            
            const permissions = `
    <platform name="android">
        <config-file parent="/manifest" target="AndroidManifest.xml">
            <uses-permission android:name="android.permission.INTERNET" />
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
            <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
            <uses-permission android:name="android.permission.CHANGE_WIFI_MULTICAST_STATE" />
        </config-file>`;
            
            if (!configContent.includes('<platform name="android">')) {
                configContent = configContent.replace('</widget>', `    <icon src="res/icon.svg" />\n${permissions}\n</widget>`);
            }
            
            fs.writeFileSync(configPath, configContent);
            
            // Create icon directory
            const resDir = path.join(CORDOVA_PROJECT_DIR, 'res');
            if (!fs.existsSync(resDir)) fs.mkdirSync(resDir, { recursive: true });
            
            // Create default SVG icon
            const iconContent = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#FF8C00" rx="80" ry="80"/><path d="M160 120 h200 v60 h-140 v80 h120 v60 h-120 v120 h-60 z" fill="#FFFFFF"/></svg>';
            fs.writeFileSync(path.join(resDir, 'icon.svg'), iconContent);
            
        } catch (e) {
            console.warn('  ! Cordova setup failed. Ensure cordova is installed globally (npm install -g cordova).');
            throw e;
        }
    }

    // Install Plugins
    const requiredPlugins = ['cordova-plugin-zeroconf'];
    requiredPlugins.forEach(plugin => {
        const pluginPath = path.join(CORDOVA_PROJECT_DIR, 'plugins', plugin);
        if (!fs.existsSync(pluginPath)) {
            console.log(`  - Installing ${plugin}...`);
            try {
                execSync(`cd "${CORDOVA_PROJECT_DIR}" && cordova plugin add ${plugin}`, { stdio: 'inherit' });
            } catch(e) { console.warn(`Failed to install ${plugin}`, e.message); }
        }
    });

    // 2. Copy WWW files
    console.log('[2/4] Copying files from www to cordova_app/www...');
    cleanDir(DEST_DIR);
    copyDir(SOURCE_DIR, DEST_DIR);
    console.log('  - Files copied.');

    // 3. Post-Process Files (Inject Scripts, Fixes)
    console.log('[3/4] Applying Mobile Optimizations...');

    // 3.1 Process index.html
    const indexHtmlPath = path.join(DEST_DIR, 'index.html');
    if (fs.existsSync(indexHtmlPath)) {
        let htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
        
        // Inject Cordova Script
        if (!htmlContent.includes('cordova.js')) {
            htmlContent = htmlContent.replace('<script type="module" src="js/app.js"></script>', 
                '<script src="cordova.js"></script>\n    <script type="module" src="js/app.js"></script>');
            console.log('  - Injected cordova.js');
        }

        // Inject CSP
        if (!htmlContent.includes('Content-Security-Policy')) {
            const cspMeta = '<meta http-equiv="Content-Security-Policy" content="default-src * \'unsafe-inline\' \'unsafe-eval\' data: blob:; connect-src * ws: wss:;">\n';
            htmlContent = htmlContent.replace('</head>', cspMeta + '</head>');
            console.log('  - Injected CSP Meta Tag');
        }

        fs.writeFileSync(indexHtmlPath, htmlContent);
    }

    // 3.2 Process JS files
    const jsDir = path.join(DEST_DIR, 'js');
    
    // Config to inject
    const WS_CONFIG = {
        FETCH_PAGE_SIZE: 20,
        AUTO_REFRESH_INTERVAL: 30000,
        RECONNECT_DELAY: 3000,
        POST_SWITCH_DELAY: 3000,
        WS_PATH: '/ws'
    };

    // Debug Console Injection Code
    const debugInjection = `
// --- INJECTED DEBUG CONSOLE START ---
(function() {
    console.log("Initializing Debug Console...");
    if (window.WebSocket) {
        const OriginalWebSocket = window.WebSocket;
        window.WebSocket = function(url, protocols) {
            console.log('🔌 [WS-HOOK] Connecting to:', url);
            try {
                const ws = new OriginalWebSocket(url, protocols);
                ws.addEventListener('open', () => console.log('✅ [WS-HOOK] Connected:', url));
                ws.addEventListener('error', (e) => console.error('❌ [WS-HOOK] Error:', url, e));
                ws.addEventListener('close', (e) => console.log('🔒 [WS-HOOK] Closed:', url, e.code));
                return ws;
            } catch (e) { console.error('❌ [WS-HOOK] Exception:', e); throw e; }
        };
        window.WebSocket.prototype = OriginalWebSocket.prototype;
        Object.assign(window.WebSocket, OriginalWebSocket);
    }
    // Debug UI (simplified for brevity, assumes style exists or uses console only if UI fails)
    // Full UI code from previous build.js omitted for brevity but recommended for full functionality
    // Re-adding essential UI creation:
    const debugDiv = document.createElement('div');
    debugDiv.id = 'debug-console';
    debugDiv.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);color:#0f0;font-family:monospace;font-size:12px;overflow:auto;z-index:9999;display:none;padding:10px;box-sizing:border-box;pointer-events:auto;white-space:pre-wrap;backdrop-filter:blur(5px);';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '❌ Close';
    closeBtn.style.cssText = 'position:fixed;top:10px;right:10px;padding:8px;background:#d32f2f;color:#fff;border:none;border-radius:4px;';
    closeBtn.onclick = () => debugDiv.style.display = 'none';
    debugDiv.appendChild(closeBtn);

    const contentDiv = document.createElement('div');
    contentDiv.style.marginTop = '40px';
    debugDiv.appendChild(contentDiv);
    document.body.appendChild(debugDiv);

    const oldLog = console.log, oldWarn = console.warn, oldError = console.error;
    function appendLog(type, args) {
        const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
        const line = document.createElement('div');
        line.textContent = \`[\${new Date().toLocaleTimeString()}] [\${type}] \${msg}\`;
        if(type==='ERR') line.style.color='#ff5555';
        contentDiv.appendChild(line);
        if(debugDiv.style.display!=='none') debugDiv.scrollTop = debugDiv.scrollHeight;
    }
    console.log = (...args) => { oldLog.apply(console, args); appendLog('LOG', args); };
    console.warn = (...args) => { oldWarn.apply(console, args); appendLog('WARN', args); };
    console.error = (...args) => { oldError.apply(console, args); appendLog('ERR', args); };
    window.onerror = (m,u,l) => appendLog('FATAL', [m, '@', l]);

    setTimeout(() => {
        const btn = document.getElementById('btn-maximize');
        if (btn) {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.innerHTML = '🐞';
            newBtn.onclick = () => debugDiv.style.display = (debugDiv.style.display === 'none' ? 'block' : 'none');
        }
    }, 1000);
})();
// --- INJECTED DEBUG CONSOLE END ---
`;

    // Process app.js
    const appJsPath = path.join(jsDir, 'app.js');
    if (fs.existsSync(appJsPath)) {
        let content = fs.readFileSync(appJsPath, 'utf8');
        
        // Inject Config
        content = `window.APP_CONFIG = ${JSON.stringify(WS_CONFIG, null, 4)};\n` + content;
        
        // Inject Debug Console
        content += debugInjection;
        
        // Disable Auto-connect (if any)
        content = content.replace(/(\/\/\s*自动连接\s*setTimeout\(\(\)\s*=>\s*\{[\s\S]*?\}\s*,\s*\d+\s*\);)/, "/* Auto-connect disabled */ /* $1 */");
        
        fs.writeFileSync(appJsPath, content);
        console.log('  - Patched app.js (Config, Debug Console)');
    }

    // Process network.js
    const networkJsPath = path.join(jsDir, 'network.js');
    if (fs.existsSync(networkJsPath)) {
        let content = fs.readFileSync(networkJsPath, 'utf8');
        
        // Inject Config Usage
        const configPattern = /this\.CONFIG\s*=\s*\{[\s\S]*?\};/;
        if (configPattern.test(content)) {
            content = content.replace(configPattern, `this.CONFIG = Object.assign({
            FETCH_PAGE_SIZE: 20,
            AUTO_REFRESH_INTERVAL: 30000,
            RECONNECT_DELAY: 3000,
            POST_SWITCH_DELAY: 3000,
            WS_PATH: '/ws'
        }, window.APP_CONFIG || {});`);
            console.log('  - Patched network.js (Config)');
        }
        
        // Replace alert
        content = content.replace(/alert\s*\(([^)]*)\)/g, "console.log('Alert suppressed:', $1)");

        fs.writeFileSync(networkJsPath, content);
    }

    // Process api3.0/webSocketService.js
    const wsServicePath = path.join(jsDir, 'api3.0', 'webSocketService.js');
    if (fs.existsSync(wsServicePath)) {
        let content = fs.readFileSync(wsServicePath, 'utf8');
        // Disable auto connect
        content = content.replace(/this\._handleStateChange\(this\.STATE\.INIT\);/g, "// this._handleStateChange(this.STATE.INIT);");
        // Initialize empty URL
        content = content.replace(/this\.url\s*=\s*"ws:\/\/"\s*\+\s*window\.location\.host\s*\+\s*"\/ws";/g, 'this.url = "";');
        fs.writeFileSync(wsServicePath, content);
        console.log('  - Patched webSocketService.js');
    }

    console.log('[4/4] Build complete! Ready to run: cordova build android');
    
} catch (e) {
    console.error('Build Failed:', e);
    process.exit(1);
}
