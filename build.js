const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SOURCE_FILE = 'fmo-mobile-controller.html';
const WWW_DIR = path.join(__dirname, 'www');
const CORDOVA_PROJECT_DIR = path.join(__dirname, 'cordova_app');
const OUTPUT_DIR = path.join(__dirname, 'release');

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
    console.log('--- FMO Build Workflow ---');
    
    // 1. Prepare WWW directory
    console.log(`[1/5] Processing ${SOURCE_FILE}...`);
    cleanDir(WWW_DIR);
    fs.mkdirSync(path.join(WWW_DIR, 'css'));
    fs.mkdirSync(path.join(WWW_DIR, 'js'));

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
    const scriptMatch = htmlContent.match(scriptRegex);
    if (scriptMatch) {
        let jsContent = scriptMatch[1].trim();

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
        htmlContent = htmlContent.replace('</body>', '    <script src="cordova.js"></script>\n    <script src="js/app.js"></script>\n</body>');
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

        // Patching logic removed as Cordova 14+ handles SDK 35 correctly
        const androidPlatformDir = path.join(CORDOVA_PROJECT_DIR, 'platforms/android');

        // Generate Android Adaptive Icons (Vector Drawables) from SVG concept
        // We cannot easily convert SVG to PNG here, so we use Android Vector Drawables.
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
        // We place this in 'drawable' initially, but config.xml will copy it to mipmap-anydpi-v26
        const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>`;
        fs.writeFileSync(path.join(drawableDir, 'ic_launcher.xml'), adaptiveXml);
        
        console.log('  - Generated Android Adaptive Icon XMLs in res/drawable/');

        // Clean before build to remove any invalid resources (like previous SVG icons)
         console.log('  - Cleaning Android project...');
         execSync(`cd "${CORDOVA_PROJECT_DIR}" && cordova clean android`, { stdio: 'inherit' });

         // Manual cleanup of SVG icons from platform
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
                         console.log(`    - Deleted: ${filePath}`);
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
    
    // Check possible output paths (depends on cordova version and gradle)
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
