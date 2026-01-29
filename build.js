const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SOURCE_FILE = 'fmo-mobile-controller.html';
const WWW_DIR = path.join(__dirname, 'www');
const CORDOVA_PROJECT_DIR = path.join(__dirname, 'cordova_app');
const OUTPUT_DIR = path.join(__dirname, 'release');
const API_DIR = path.join(__dirname, 'fmo-player/api2.0');

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
    console.log('--- FMO Build Workflow (Optimized) ---');
    
    // 1. Prepare WWW directory
    console.log(`[1/5] Processing ${SOURCE_FILE}...`);
    cleanDir(WWW_DIR);
    fs.mkdirSync(path.join(WWW_DIR, 'css'));
    fs.mkdirSync(path.join(WWW_DIR, 'js'));
    
    // Copy API 2.0 files if they exist
    if (fs.existsSync(API_DIR)) {
        const apiDest = path.join(WWW_DIR, 'js', 'api');
        fs.mkdirSync(apiDest, { recursive: true });
        copyDir(API_DIR, apiDest);
        console.log('  - Copied API 2.0 files to js/api/');

        // Copy map.html
        const mapSrc = path.join(__dirname, 'map.html');
        if (fs.existsSync(mapSrc)) {
            fs.copyFileSync(mapSrc, path.join(WWW_DIR, 'map.html'));
            console.log('  - Copied map.html');
        }

        // [Fix] Patch webSocketService.js to prevent auto-connect and export error
        const wsServicePath = path.join(apiDest, 'webSocketService.js');
        if (fs.existsSync(wsServicePath)) {
            let wsContent = fs.readFileSync(wsServicePath, 'utf8');
            // Disable auto connect
            wsContent = wsContent.replace(/this\._handleStateChange\(this\.STATE\.INIT\);/g, "// this._handleStateChange(this.STATE.INIT);");
            // Disable export to prevent syntax error in non-module environment
            wsContent = wsContent.replace(/export\s+const\s+wsService/g, "// export const wsService");
            // Initialize empty URL to avoid connecting to file://
            wsContent = wsContent.replace(/this\.url\s*=\s*"ws:\/\/"\s*\+\s*window\.location\.host\s*\+\s*"\/ws";/g, 'this.url = "";');
            fs.writeFileSync(wsServicePath, wsContent);
            console.log('  - [Fix] Patched webSocketService.js (disabled auto-connect & export)');
        }
    }

    if (!fs.existsSync(SOURCE_FILE)) {
        throw new Error(`Source file ${SOURCE_FILE} not found!`);
    }

    let htmlContent = fs.readFileSync(SOURCE_FILE, 'utf8');

    const versionAttrRegex = /data-version="(\d+(?:\.\d+)?)"/;
    const versionTextRegex = /(<div[^>]*id="credits-version"[^>]*>)([^<]*)(<\/div>)/;
    const versionMatch = htmlContent.match(versionAttrRegex);
    if (versionMatch) {
        const current = parseFloat(versionMatch[1]);
        if (!Number.isNaN(current)) {
            const next = (Math.round((current + 0.1) * 10) / 10).toFixed(1);
            htmlContent = htmlContent.replace(versionAttrRegex, `data-version="${next}"`);
            htmlContent = htmlContent.replace(versionTextRegex, `$1v${next}$3`);
            fs.writeFileSync(SOURCE_FILE, htmlContent);
        }
    }

    // Extract CSS
    const styleRegex = /<style>([\s\S]*?)<\/style>/i;
    const styleMatch = htmlContent.match(styleRegex);
    if (styleMatch) {
        fs.writeFileSync(path.join(WWW_DIR, 'css', 'style.css'), styleMatch[1].trim());
        htmlContent = htmlContent.replace(styleRegex, '');
        console.log('  - Extracted CSS');
    }

    // WebSocket Configuration to Inject
    const WS_CONFIG = {
        FETCH_PAGE_SIZE: 20,
        AUTO_REFRESH_INTERVAL: 30000,
        RECONNECT_DELAY: 3000,
        POST_SWITCH_DELAY: 3000,
        WS_PATH: '/ws'
    };

    // Extract JS
    const scriptRegex = /<script>([\s\S]*?)<\/script>/i;
    
    // [Fix] Inject CSP Meta Tag
    const headEndRegex = /<\/head>/i;
    if (headEndRegex.test(htmlContent)) {
        const cspMeta = '<meta http-equiv="Content-Security-Policy" content="default-src * \'unsafe-inline\' \'unsafe-eval\' data: blob:; connect-src * ws: wss:;">\n';
        htmlContent = htmlContent.replace(headEndRegex, cspMeta + '</head>');
        console.log('  - [Fix] Injected CSP Meta Tag');
    }

    const scriptMatch = htmlContent.match(scriptRegex);
    if (scriptMatch) {
        let jsContent = scriptMatch[1].trim();

        // --- OPTIMIZATIONS & FIXES ---
        
        // 1. Remove Alerts (Replace with console.log)
        jsContent = jsContent.replace(/alert\s*\(([^)]*)\)/g, "console.log('Alert suppressed:', $1)");
        
        // [Fix] Enhance WS Error Log
        jsContent = jsContent.replace(
            /console\.error\('WS Error:',\s*e\);/g, 
            `console.error('WS Error connecting to ' + (this.host || 'unknown') + ':', e);
             if (this.host && this.host.indexOf(':') === -1) {
                 console.warn('⚠️ No port specified in host (' + this.host + '). Defaulting to port 80. If your server is on another port (e.g. 8000), please add it like: ' + this.host + ':8000');
             }`
        );
        
        console.log('  - [Fix] Suppressed alert() calls & Enhanced WS logging');

        // 2. Disable Auto-connect to fmo.local
        const autoConnectRegex = /(\/\/\s*自动连接\s*setTimeout\(\(\)\s*=>\s*\{[\s\S]*?\}\s*,\s*\d+\s*\);)/;
        if (autoConnectRegex.test(jsContent)) {
             jsContent = jsContent.replace(autoConnectRegex, "/* Auto-connect disabled by build */ \n/* $1 */");
             console.log('  - [Fix] Disabled auto-connect logic');
        }

        // 3. Inject Debug Console (Repurpose Maximize Button)
        const debugInjection = `
// --- INJECTED DEBUG CONSOLE START ---
(function() {
    console.log("Initializing Debug Console...");
    
    // --- WebSocket Hook START ---
    if (window.WebSocket) {
        const OriginalWebSocket = window.WebSocket;
        window.WebSocket = function(url, protocols) {
            console.log('🔌 [WS-HOOK] Connecting to:', url);
            
            // Check for common errors in URL
            if (url.includes('undefined')) console.error('❌ [WS-HOOK] URL contains undefined!');
            if (!url.match(/:\d+/)) console.warn('⚠️ [WS-HOOK] No port specified in URL! Default is 80/443.');
            
            try {
                const ws = new OriginalWebSocket(url, protocols);
                
                ws.addEventListener('open', () => {
                    console.log('✅ [WS-HOOK] Connected to:', url);
                });
                
                ws.addEventListener('error', (e) => {
                    console.error('❌ [WS-HOOK] Error for:', url, e);
                    // Try to inspect properties (usually empty in secure context)
                    try {
                        console.error('   Details:', JSON.stringify(e));
                    } catch(err) {}
                });
                
                ws.addEventListener('close', (e) => {
                    console.log('🔒 [WS-HOOK] Closed:', url, 'Code:', e.code, 'Reason:', e.reason);
                });
                
                return ws;
            } catch (e) {
                console.error('❌ [WS-HOOK] Exception during creation:', e);
                throw e;
            }
        };
        window.WebSocket.prototype = OriginalWebSocket.prototype;
        Object.assign(window.WebSocket, OriginalWebSocket); // Copy constants like CONNECTING, OPEN etc.
        console.log('✅ [WS-HOOK] WebSocket intercepted for debugging');
    }
    // --- WebSocket Hook END ---

    // 1. Create Debug Window UI
    const debugDiv = document.createElement('div');
    debugDiv.id = 'debug-console';
    debugDiv.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);color:#0f0;font-family:monospace;font-size:12px;overflow:auto;z-index:9999;display:none;padding:10px;box-sizing:border-box;pointer-events:auto;white-space:pre-wrap;backdrop-filter:blur(5px);';
    
    // Controls container
    const controlsDiv = document.createElement('div');
    controlsDiv.style.cssText = 'position:fixed;top:10px;right:10px;z-index:10001;display:flex;gap:10px;';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '❌ Close';
    closeBtn.style.cssText = 'padding:8px 12px;background:#d32f2f;color:#fff;border:none;border-radius:4px;font-weight:bold;';
    closeBtn.onclick = () => debugDiv.style.display = 'none';
    
    const clearBtn = document.createElement('button');
    clearBtn.textContent = '🧹 Clear';
    clearBtn.style.cssText = 'padding:8px 12px;background:#444;color:#fff;border:1px solid #666;border-radius:4px;';
    clearBtn.onclick = () => { contentDiv.innerHTML = ''; appendLog('SYS', ['Console cleared']); };

    const copyBtn = document.createElement('button');
    copyBtn.textContent = '📋 Copy';
    copyBtn.style.cssText = 'padding:8px 12px;background:#1976d2;color:#fff;border:none;border-radius:4px;';
    copyBtn.onclick = () => {
        const text = contentDiv.innerText;
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            alert('Logs copied to clipboard');
        } catch(e) {
            console.error('Copy failed', e);
        }
        document.body.removeChild(textarea);
    };
    
    controlsDiv.appendChild(copyBtn);
    controlsDiv.appendChild(clearBtn);
    controlsDiv.appendChild(closeBtn);
    debugDiv.appendChild(controlsDiv);
    
    const contentDiv = document.createElement('div');
    contentDiv.style.marginTop = '50px';
    contentDiv.style.marginBottom = '20px';
    debugDiv.appendChild(contentDiv);
    
    document.body.appendChild(debugDiv);

    // 2. Hijack Console
    const oldLog = console.log;
    const oldWarn = console.warn;
    const oldError = console.error;

    function appendLog(type, args) {
        const msg = args.map(a => {
            if (typeof a === 'object') {
                try { return JSON.stringify(a); } catch(e) { return String(a); }
            }
            return String(a);
        }).join(' ');
        
        const line = document.createElement('div');
        line.style.borderBottom = '1px solid #333';
        line.style.padding = '4px 0';
        line.style.wordBreak = 'break-all';
        
        if (type === 'ERR') {
            line.style.color = '#ff5555';
            line.style.background = 'rgba(255,0,0,0.1)';
        } else if (type === 'WARN') {
            line.style.color = '#ffaa00';
        } else if (type === 'SYS') {
            line.style.color = '#aaa';
            line.style.fontStyle = 'italic';
        }
        
        const time = new Date().toLocaleTimeString();
        line.textContent = \`[\${time}] [\${type}] \${msg}\`;
        contentDiv.appendChild(line);
        
        // Auto scroll if near bottom or if new message
        if (debugDiv.style.display !== 'none') {
             debugDiv.scrollTop = debugDiv.scrollHeight;
        }
    }

    console.log = (...args) => { oldLog.apply(console, args); appendLog('LOG', args); };
    console.warn = (...args) => { oldWarn.apply(console, args); appendLog('WARN', args); };
    console.error = (...args) => { oldError.apply(console, args); appendLog('ERR', args); };

    window.onerror = (msg, url, lineNo, columnNo, error) => {
        appendLog('FATAL', [msg, '@', lineNo, error]);
        return false;
    };

    // 3. Repurpose Maximize Button
    setTimeout(() => {
        const btn = document.getElementById('btn-maximize');
        if (btn) {
            // Clone to strip listeners
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            // Change Icon/Appearance
            newBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M20 8h-2.81c-.45-.78-1.07-1.45-1.82-1.96L17 4.41 15.59 3l-2.17 2.17C12.96 5.06 12.49 5 12 5c-.49 0-.96.06-1.41.17L8.41 3 7 4.41l1.62 1.63C7.88 6.55 7.26 7.22 6.81 8H4v2h2.09c-.05.33-.09.66-.09 1v1H4v2h2v1c0 .34.04.67.09 1H4v2h2.81c1.04 1.79 2.97 3 5.19 3s4.15-1.21 5.19-3H20v-2h-2.09c.05-.33.09-.66.09-1v-1h2v-2h-2v-1c0-.34-.04-.67-.09-1H20V8zm-6 12H8v-1h8v1zm0-2H8v-1h8v1zm0-2H8v-1h8v1z"/></svg>'; 
            newBtn.style.color = '#00e676'; // Bright green
            newBtn.style.zIndex = '100';
            
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                debugDiv.style.display = debugDiv.style.display === 'none' ? 'block' : 'none';
                console.log('Debug console toggled');
            });
            
            // Add initial log
            console.log("Debug Mode Enabled. Click 🐞 to toggle.");
            console.log("App Version: " + (document.body.getAttribute('data-version') || 'Unknown'));
            console.log("Host: " + window.location.host);
        } else {
            console.error("btn-maximize not found");
        }
    }, 1000);
})();
// --- INJECTED DEBUG CONSOLE END ---
`;
        jsContent += debugInjection;
        console.log('  - [Feature] Injected Debug Console (replaced Maximize button)');

        // --- END OPTIMIZATIONS ---

        // Inject Configuration
        const configInjection = `
/** Injected Configuration */
window.APP_CONFIG = ${JSON.stringify(WS_CONFIG, null, 4)};
`;
        jsContent = configInjection + jsContent;

        // Replace hardcoded config in ControlClient
        const configPattern = /this\.CONFIG\s*=\s*\{[\s\S]*?\};/;
        if (configPattern.test(jsContent)) {
             jsContent = jsContent.replace(configPattern, `this.CONFIG = Object.assign({
                    FETCH_PAGE_SIZE: 20,
                    AUTO_REFRESH_INTERVAL: 30000,
                    RECONNECT_DELAY: 3000,
                    POST_SWITCH_DELAY: 3000,
                    WS_PATH: '/ws'
                }, window.APP_CONFIG || {});`);
             console.log('  - Injected WebSocket Configuration into ControlClient');
        }

        // Replace WebSocket instantiation to use dynamic path
        const wsCreationPattern = /this\.ws\s*=\s*new\s*WebSocket\(`ws:\/\/\${this\.host}\/ws`\);/;
        if (wsCreationPattern.test(jsContent)) {
             jsContent = jsContent.replace(wsCreationPattern, "this.ws = new WebSocket(`ws://${this.host}${this.CONFIG.WS_PATH || '/ws'}`);");
             console.log('  - Updated WebSocket connection URL to use injected path');
        }

        fs.writeFileSync(path.join(WWW_DIR, 'js', 'app.js'), jsContent);
        htmlContent = htmlContent.replace(scriptRegex, '');
        console.log('  - Extracted JS');
    }

    // Inject links
    // Find </head> and insert CSS link
    if (htmlContent.includes('</head>')) {
        htmlContent = htmlContent.replace('</head>', '    <link rel="stylesheet" href="css/style.css">\n</head>');
    }
    
    // Find </body> and insert JS links
    if (htmlContent.includes('</body>')) {
        let scripts = '';
        
        // Inject API 2.0 scripts if available
        if (fs.existsSync(API_DIR)) {
            const apiFiles = fs.readdirSync(API_DIR).filter(f => f.endsWith('.js'));
            // Optional: Sort files if order matters (e.g. base classes first)
            // For now, we include them. In a real scenario, we might need a loader or module system.
            apiFiles.forEach(f => {
                scripts += `    <script src="js/api/${f}"></script>\n`;
            });
        }
        
        scripts += '    <script src="cordova.js"></script>\n    <script src="js/app.js"></script>\n';
        htmlContent = htmlContent.replace('</body>', `${scripts}</body>`);
    }

    fs.writeFileSync(path.join(WWW_DIR, 'index.html'), htmlContent);
    console.log('  - Generated index.html');

    // 2. Setup Cordova Project (if needed)
    console.log('[2/5] Checking Cordova environment...');
    if (!fs.existsSync(CORDOVA_PROJECT_DIR)) {
        console.log('  - Creating new Cordova project...');
        // Using execSync for blocking execution
        try {
            execSync(`cordova create "${CORDOVA_PROJECT_DIR}" com.fmo.controller "FMO Controller"`, { stdio: 'inherit' });
            console.log('  - Adding Android platform (v11 for Java 11 compatibility)...');
            execSync(`cd "${CORDOVA_PROJECT_DIR}" && cordova platform add android@11`, { stdio: 'inherit' });
            
            // Auto-configure config.xml for new projects
            const configPath = path.join(CORDOVA_PROJECT_DIR, 'config.xml');
            let configContent = fs.readFileSync(configPath, 'utf8');
            
            // Add Android namespace
            if (!configContent.includes('xmlns:android')) {
                configContent = configContent.replace('<widget ', '<widget xmlns:android="http://schemas.android.com/apk/res/android" ');
            }
            
            // Add permissions and icon
            const platformTag = '<platform name="android">';
            const permissions = `
    <platform name="android">
        <config-file parent="/manifest" target="AndroidManifest.xml">
            <uses-permission android:name="android.permission.INTERNET" />
            <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
            <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
        </config-file>`;
            
            if (configContent.includes(platformTag)) {
                 // Simple replacement if tag exists (simplification)
                 // Better to use regex or just append if safe
            } else {
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
            console.warn('  ! Error:', e.message);
            throw e;
        }
    }

    // 2.1 Install Plugins (Idempotent)
    console.log('[2.5/5] Checking Plugins...');
    try {
        const requiredPlugins = [
            'cordova-plugin-zeroconf'
        ];
        
        // Helper to check if plugin is installed
        const isPluginInstalled = (pluginName) => {
            try {
                // Check plugins directory
                const pluginDir = path.join(CORDOVA_PROJECT_DIR, 'plugins', pluginName);
                return fs.existsSync(pluginDir);
            } catch (e) {
                return false;
            }
        };

        for (const plugin of requiredPlugins) {
            if (!isPluginInstalled(plugin)) {
                console.log(`  - Installing ${plugin}...`);
                execSync(`cd "${CORDOVA_PROJECT_DIR}" && cordova plugin add ${plugin}`, { stdio: 'inherit' });
            } else {
                console.log(`  - ${plugin} already installed.`);
            }
        }
    } catch (e) {
        console.warn('  ! Warning: Plugin installation failed.', e.message);
    }

    // 3. Sync WWW to Cordova
    console.log('[3/5] Syncing WWW to Cordova project...');
    const cordovaWwwDir = path.join(CORDOVA_PROJECT_DIR, 'www');
    
    // We remove the default cordova www content and replace it with ours
    cleanDir(cordovaWwwDir);
    copyDir(WWW_DIR, cordovaWwwDir);

    // 4. Build APK
    console.log('[4/5] Building Android APK...');
    try {
        // Update config.xml with Android SDK preferences to persist changes through 'cordova prepare'
        const configPath = path.join(CORDOVA_PROJECT_DIR, 'config.xml');
        if (fs.existsSync(configPath)) {
            let configContent = fs.readFileSync(configPath, 'utf8');
            const preferences = [
                '<preference name="android-targetSdkVersion" value="35" />',
                '<preference name="android-compileSdkVersion" value="35" />',
                '<preference name="android-buildToolsVersion" value="35.0.0" />',
                '<preference name="GradlePluginKotlinEnabled" value="true" />',
                '<preference name="AndroidXEnabled" value="true" />'
            ];
            
            // Remove existing preferences to avoid duplicates
             preferences.forEach(pref => {
                 const nameMatch = pref.match(/name="([^"]+)"/);
                 if (nameMatch) {
                     const regex = new RegExp(`<preference\\s+name="${nameMatch[1]}"[^>]*>`, 'g');
                     configContent = configContent.replace(regex, '');
                 }
             });

             // Remove SVG icon which causes build error in Android (requires PNG)
             configContent = configContent.replace(/<icon\s+src="res\/icon\.svg"\s*\/>/g, '');

             // Add new preferences before </widget>
            const widgetEndIndex = configContent.lastIndexOf('</widget>');
            if (widgetEndIndex !== -1) {
                configContent = configContent.slice(0, widgetEndIndex) + 
                                '\n    ' + preferences.join('\n    ') + '\n' + 
                                configContent.slice(widgetEndIndex);
                fs.writeFileSync(configPath, configContent);
                console.log('  - Updated config.xml with Android SDK preferences (Target 35)');
            }
        }

        // Generate Android Adaptive Icons (Vector Drawables) from SVG concept
        const appResDir = path.join(CORDOVA_PROJECT_DIR, 'res');
        const drawableDir = path.join(appResDir, 'drawable');
        if (!fs.existsSync(drawableDir)) fs.mkdirSync(drawableDir, { recursive: true });

        // 1. Background (Orange Rect)
        const bgXml = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="512"
    android:viewportHeight="512">
    <path
        android:fillColor="#FF8C00"
        android:pathData="M0,0h512v512h-512z"/>
</vector>`;
        fs.writeFileSync(path.join(drawableDir, 'ic_launcher_background.xml'), bgXml);

        // 2. Foreground (White 'F' shape)
        const fgXml = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="512"
    android:viewportHeight="512">
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M160 120 h200 v60 h-140 v80 h120 v60 h-120 v120 h-60 z"/>
</vector>`;
        fs.writeFileSync(path.join(drawableDir, 'ic_launcher_foreground.xml'), fgXml);

        // 3. Adaptive Icon (Reference to bg/fg)
        const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>`;
        fs.writeFileSync(path.join(drawableDir, 'ic_launcher.xml'), adaptiveXml);
        
        console.log('  - Generated Android Adaptive Icon XMLs in res/drawable/');

        // Clean before build
         console.log('  - Cleaning Android project...');
         execSync(`cd "${CORDOVA_PROJECT_DIR}" && cordova clean android`, { stdio: 'inherit' });

         // Manual cleanup of SVG icons from platform
         const androidPlatformDir = path.join(CORDOVA_PROJECT_DIR, 'platforms/android');
         const resDir = path.join(androidPlatformDir, 'app/src/main/res');
         if (fs.existsSync(resDir)) {
             console.log('  - Removing invalid SVG icons from platform...');
             const deleteSvg = (dir) => {
                 const files = fs.readdirSync(dir);
                 files.forEach(file => {
                     const filePath = path.join(dir, file);
                     if (fs.statSync(filePath).isDirectory()) {
                         deleteSvg(filePath);
                     } else if (file.endsWith('.svg')) {
                         fs.unlinkSync(filePath);
                     }
                 });
             };
             deleteSvg(resDir);
         }

         execSync(`cd "${CORDOVA_PROJECT_DIR}" && cordova build android`, { stdio: 'inherit' });
    } catch (e) {
        console.warn('  ! Cordova build failed. Check the logs above.');
        throw e;
    }

    // 5. Copy Artifacts
    console.log('[5/5] Copying artifacts...');
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    
    // Check possible output paths
    const possibleApkPaths = [
        path.join(CORDOVA_PROJECT_DIR, 'platforms/android/app/build/outputs/apk/debug/app-debug.apk'),
        path.join(CORDOVA_PROJECT_DIR, 'platforms/android/build/outputs/apk/debug/app-debug.apk')
    ];

    let found = false;
    for (const apkPath of possibleApkPaths) {
        if (fs.existsSync(apkPath)) {
            const destApk = path.join(OUTPUT_DIR, 'fmo-controller-debug.apk');
            fs.copyFileSync(apkPath, destApk);
            console.log(`\nSUCCESS! APK is ready at: ${destApk}`);
            found = true;
            break;
        }
    }

    if (!found) {
        console.warn('Warning: Build completed but could not find the output APK file automatically.');
        console.warn('Check inside: ' + path.join(CORDOVA_PROJECT_DIR, 'platforms/android'));
    }

} catch (err) {
    console.error('\nBUILD FAILED:', err.message);
    process.exit(1);
}
