/**
 * FMO Audio Controller - Main Application
 * FMO 音频控制器 - 主应用程序
 */

import './debug-capture.js'; // 优先加载日志捕获 // Load debug capture first
import { Utils } from './utils.js';
import { ControlClient, EventsClient, DiscoveryManager } from './network.js';
import { AudioPlayer } from './audio.js';
import { Visualizer } from './visualizer.js';
import { VolumeSlider, CallsignTicker, DeviceManager, QsoManager } from './ui.js';
import {
    TIME_CONSTANTS,
    UI_CONSTANTS,
    GEO_CONSTANTS,
    EASTER_EGG_CONSTANTS,
    THEME_NAMES,
    STORAGE_KEYS,
    WS_CONSTANTS,
} from './constants.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- 应用逻辑 ---
    // --- Application Logic ---
    const ctrl = new ControlClient();
    const player = new AudioPlayer();
    const events = new EventsClient(); // 实例化 // Instantiate
    const viz = new Visualizer(document.getElementById('viz-canvas'), null);
    const qsoMgr = new QsoManager(ctrl); // 初始化 QSO 管理器 (供 Ticker 使用) // Init QSO Manager (for Ticker)

    // 实例化呼号显示组件
    // Instantiate callsign ticker component
    const ticker = new CallsignTicker('callsign-ticker', viz, qsoMgr);
    // Expose to window for Python injection
    // 暴露给 window 以供 Python 注入
    window.ticker = ticker;

    // Start Visualizer immediately (renders idle state until connected)
    // 立即启动可视化器（在连接前渲染空闲状态）
    viz.start();

    // 连接事件
    // Connection events
    events.onCallsignReceived((callsign) => {
        ticker.addCallsign(callsign);
    });

    events.onSpeakingStateChanged((callsign, isSpeaking, isHost) => {
        // Debug Log for Speaking State
        // 说话状态调试日志
        console.log('[App] Speaking State Changed:', { callsign, isSpeaking, isHost });

        if (isSpeaking) {
            viz.setCallsign(callsign);
            player.setLocalTransmission(isHost);
            
            // Trigger UFO Easter Egg if isHost
            // Added DEBUG trigger for testing
            // 如果是房主则触发 UFO 彩蛋
            // 添加 DEBUG 触发器用于测试
            if (isHost || callsign === 'DEBUG') {
                console.log(`[App] Triggering UFO (isHost=${isHost}, callsign=${callsign})`);
                viz.triggerUFO();
            } else {
                console.log('[App] UFO skipped (isHost=false)');
            }
        } else {
            player.setLocalTransmission(false);
            // 如果当前显示的正是停止说话的人，则清除
            // If the person stopping speaking is currently displayed, clear it
            if (viz.currentCallsign === callsign) {
                viz.setCallsign('');
            }
        }
    });

    const deviceMgr = new DeviceManager();
    const discoveryMgr = new DiscoveryManager();
    // qsoMgr 已提前初始化
    // qsoMgr already initialized
    
    const ui = {
        ledControl: document.getElementById('led-control'),
        ledEvents: document.getElementById('led-events'),
        ledAudio: document.getElementById('led-audio'),
        btnTheme: document.getElementById('btn-theme'),
        btnSettingsToggle: document.getElementById('btn-settings-toggle'),
        settingsArea: document.getElementById('settings-area'),
        btnPlay: document.getElementById('btn-play'),
        btnRecord: document.getElementById('btn-record'),
        vizArea: document.getElementById('viz-area'),
        vizModeText: document.getElementById('viz-mode-text'),
        currentStationText: document.getElementById('current-station-text'),
        stCount: document.getElementById('st-count'),
        stList: document.getElementById('st-list'),
        btnPrev: document.getElementById('btn-prev'),
        btnNext: document.getElementById('btn-next'),
        inpHost: document.getElementById('inp-host'),
        btnConnect: document.getElementById('btn-connect'),
        btnOpenStations: document.getElementById('btn-open-stations'),
        stationModal: document.getElementById('station-modal'),
        stCountModal: document.getElementById('st-count-modal'),
    };

    let currentStationId = null;

    // 设备检测与适配
    // Device detection and adaptation
    const checkDevice = () => {
        // 简单判断：屏幕宽度大于阈值视为桌面端/平板
        // Simple check: screen width > threshold is considered desktop/tablet
        if (window.innerWidth >= UI_CONSTANTS.DEVICE_DESKTOP_BREAKPOINT) {
            document.documentElement.classList.add('device-desktop');
        } else {
            document.documentElement.classList.remove('device-desktop');
        }
    };
    // 初始化检测
    // Initial check
    checkDevice();
    // 监听窗口大小变化 - 使用防抖优化性能
    // Listen for window resize - use debounce for performance
    window.addEventListener('resize', Utils.debounce(checkDevice, TIME_CONSTANTS.DEBOUNCE_DELAY));

    // 0. 主题切换
    // 0. Theme Switching
    let currentThemeIndex = 0;

    // 初始化主题 - 从localStorage加载
    // Init theme - load from localStorage
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
    if (savedTheme !== null && THEME_NAMES.includes(savedTheme)) {
        currentThemeIndex = THEME_NAMES.indexOf(savedTheme);
        if (savedTheme) {
            document.body.dataset.theme = savedTheme;
        } else {
            document.body.removeAttribute('data-theme');
        }
    }

    ui.btnTheme.addEventListener('click', () => {
        const currentTheme = THEME_NAMES[currentThemeIndex];
        if (currentTheme) {
            document.body.removeAttribute('data-theme');
        }
        currentThemeIndex = (currentThemeIndex + 1) % THEME_NAMES.length;
        const newTheme = THEME_NAMES[currentThemeIndex];
        if (newTheme) {
            document.body.dataset.theme = newTheme;
        } else {
            document.body.removeAttribute('data-theme');
        }
        // 保存主题设置
        // Save theme settings
        localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
        // Update visualizer colors
        // 更新可视化器颜色
        viz.updateThemeColors();
    });

    // 0.1 设置开关
    // 0.1 Settings Toggle
    ui.btnSettingsToggle.addEventListener('click', () => {
        const isOpen = ui.settingsArea.classList.toggle('open');
        ui.btnSettingsToggle.setAttribute('aria-expanded', isOpen);
    });



    // 1. 连接逻辑
    // 1. Connection Logic
    ui.btnConnect.addEventListener('click', async () => {
        // [Autoplay Policy Fix] Must resume AudioContext immediately on user click
        // before any async/await operations
        // [自动播放策略修复] 必须在用户点击时立即恢复 AudioContext
        // 在任何 async/await 操作之前
        player.ensureAudio();

        const host = ui.inpHost.value.trim();
        if (!host) return;

        // Disconnect all first to ensure clean state and free slots for strict ESP32 limit
        // 先断开所有连接以确保干净的状态并释放 ESP32 的严格连接槽位限制
        if (ctrl.connected) ctrl.disconnect();
        if (player.connected) player.disconnect();
        if (events.connected) events.disconnect();

        // Wait for sockets to close and slots to release
        // 等待套接字关闭和槽位释放
        await new Promise(r => setTimeout(r, WS_CONSTANTS.RECONNECT_DELAY));

        try {
            // Step 1: Connect Control (Control Channel)
            // 步骤 1: 连接控制 (控制通道)
            console.log('[App] Connecting Control...');
            await ctrl.connect(host);
            console.log('[App] Control connected');
            
            // Step 2: On Success, Fetch Data & Update UI
            // Fetch Station List (handled by ctrl internally on connect)
            // Fetch QSO Log for "Stars" (handled by qsoMgr via 'status' event)
            // 步骤 2: 成功后，获取数据并更新 UI
            // 获取台站列表 (由 ctrl 在连接时内部处理)
            // 获取 "星星" 的 QSO 日志 (由 qsoMgr 通过 'status' 事件处理)
            
            // Step 3: Connect Audio
            // 步骤 3: 连接音频
            console.log('[App] Connecting Audio...');
            await player.connect(host);
            console.log('[App] Audio connected');
            
            // Step 4: Connect Events (for callsign updates)
            // This can happen after audio, or in parallel with audio if we wanted, 
            // but user requested "Then listen events"
            // 步骤 4: 连接事件 (用于呼号更新)
            // 这可以在音频之后发生，或者如果我们想的话可以与音频并行，
            // 但用户要求 "然后监听事件"
            console.log('[App] Connecting Events...');
            events.connect(host).catch(e => console.warn('[App] Events connect failed', e));

            // Save to history
            // 保存到历史记录
            deviceMgr.add(host);

        } catch (e) {
            console.error('[App] Connection Sequence Failed:', e);
            // alert('Connection failed: ' + e.message);
            // Optional: Disconnect partial connections?
            // 可选: 断开部分连接?
            // ctrl.disconnect(); 
            // player.disconnect();
        }
    });

    // LED 更新辅助函数
    // LED update helper function
    function updateLed(el, connected) {
        if (!el) return;
        if (connected) {
            el.classList.add('connected');
            el.classList.remove('error');
        } else {
            el.classList.remove('connected');
            // 暂时不显示 error 红色，除非明确是错误断开？
            // 目前需求只是 "判断通联"，断开即灰，连接即绿
            // 如果需要红色，可以在 onerror 中处理，这里简化为灰/绿
            // 但为了提示异常，如果之前是连接状态突然断开，可以变红？
            // 简单起见：连接=绿，未连接=灰。
            // 之前的CSS定义了 .error，这里暂不使用，保持简洁
            // Temporarily not showing error red, unless explicitly disconnected by error?
            // Current requirement is just "connection status", disconnected is grey, connected is green
            // If red is needed, handle in onerror, simplified to grey/green here
            // But to indicate exception, if previously connected and suddenly disconnected, turn red?
            // For simplicity: Connected=Green, Disconnected=Grey.
            // CSS defined .error, not used here for now to keep it simple
        }
    }

    // 播放按钮图标更新函数
    // Play button icon update function
    function setPlayButtonIcon(isPlaying) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '24');
        svg.setAttribute('height', '24');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'currentColor');

        if (isPlaying) {
            const rect1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect1.setAttribute('x', '6');
            rect1.setAttribute('y', '4');
            rect1.setAttribute('width', '4');
            rect1.setAttribute('height', '16');

            const rect2 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect2.setAttribute('x', '14');
            rect2.setAttribute('y', '4');
            rect2.setAttribute('width', '4');
            rect2.setAttribute('height', '16');

            svg.appendChild(rect1);
            svg.appendChild(rect2);
        } else {
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M8 5v14l11-7z');
            svg.appendChild(path);
        }

        ui.btnPlay.innerHTML = '';
        ui.btnPlay.appendChild(svg);
    }

    // 统一LED更新函数
    // Unified LED update function
    function updateConnectionStatus(source, connected) {
        switch (source) {
            case 'ctrl':
                updateLed(ui.ledControl, connected);
                // 更新连接按钮状态
                // Update connect button status
                if (connected) {
                    ui.btnConnect.textContent = '已连接';
                    ui.btnConnect.style.color = 'var(--accent-green)';
                } else {
                    ui.btnConnect.textContent = 'CONNECT';
                    ui.btnConnect.style.color = 'var(--accent-cyan)';
                }
                break;
            case 'events':
                updateLed(ui.ledEvents, connected);
                break;
            case 'player':
                updateLed(ui.ledAudio, connected);
                // 音频连接后，将分析节点交给可视化引擎
                // After audio connected, pass analyser node to visualizer engine
                if (connected && player.analyser) {
                    viz.setAnalyser(player.analyser);
                }
                // 更新播放按钮状态
                // Update play button status
                if (connected) {
                    ui.btnPlay.classList.add('active');
                    setPlayButtonIcon(true);
                } else {
                    ui.btnPlay.classList.remove('active');
                    setPlayButtonIcon(false);
                }
                break;
        }
    }

    // 统一监听连接状态
    // Unified listener for connection status
    ctrl.on('status', (connected) => updateConnectionStatus('ctrl', connected));
    events.on('status', (connected) => updateConnectionStatus('events', connected));
    player.on('status', (connected) => updateConnectionStatus('player', connected));

    // 2. 播放控制
    // 2. Playback Control
    ui.btnPlay.addEventListener('click', () => {
        const host = ui.inpHost.value.trim();
        if (!player.connected) {
            player.connect(host);
        } else {
            // 仅作为重连或断开开关
            // Only as a toggle for reconnect or disconnect
            player.disconnect();
        }
    });

    // 音量条初始化
    // Volume slider initialization
    const volContainer = document.getElementById('vol-container');
    const volSlider = new VolumeSlider(volContainer, player);

    // 3. 可视化切换
    // 3. Visualizer Switching
    // 改为仅点击文字切换，避免误触
    // Changed to click text only to avoid accidental touches
    ui.vizModeText.addEventListener('click', (e) => {
        e.stopPropagation(); // 阻止冒泡 // Prevent bubbling
        const modeName = viz.switchMode();
        ui.vizModeText.textContent = modeName;
    });

    // 最大化按钮逻辑
    // Maximize button logic
    const btnMaximize = document.getElementById('btn-maximize');
    if (btnMaximize) {
        btnMaximize.addEventListener('click', () => {
            const elem = document.documentElement;
            if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
                if (elem.requestFullscreen) {
                    elem.requestFullscreen();
                } else if (elem.webkitRequestFullscreen) { /* Safari */
                    elem.webkitRequestFullscreen();
                } else if (elem.msRequestFullscreen) { /* IE11 */
                    elem.msRequestFullscreen();
                }
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) { /* Safari */
                    document.webkitExitFullscreen();
                } else if (document.msExitFullscreen) { /* IE11 */
                    document.msExitFullscreen();
                }
            }
        });
    }

    // 5. 录音控制：开始/停止录音，导出为 WAV
    // 5. Recording Control: Start/Stop recording, export as WAV
    ui.btnRecord.addEventListener('click', () => {
        if (!player.recording) {
            // 开始录音（需要音频已连接）
            // Start recording (requires audio connected)
            if (!player.connected) {
                // alert('请先连接音频！');
                console.warn('[Record] Skipped: Audio not connected');
                return;
            }
            player.startRecording();
            ui.btnRecord.classList.add('recording');
        } else {
            // 停止录音并下载（文件名带时间戳）
            // Stop recording and download (filename with timestamp)
            ui.btnRecord.classList.remove('recording');
            const blob = player.stopRecording();
            if (blob) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                // 文件名：fmo_rec_时间戳.wav
                // Filename: fmo_rec_timestamp.wav
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                a.download = `fmo_rec_${timestamp}.wav`;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                }, 100);
            } else {
                // alert('录音时长太短或无数据');
                console.warn('[Record] Save failed: Duration too short or no data');
            }
        }
    });

     // 4. 台站列表逻辑 - 性能优化版本
     // 4. Station List Logic - Performance Optimized Version
     let stListRenderId = 0;
     ctrl.on('stationList', (list) => {
         const myRenderId = ++stListRenderId;
         ui.stCount.textContent = list.length;

         // 将台站列表传递给太阳系可视化器的中继台系统
         // Pass station list to solar system visualizer's repeater system
         if (viz && viz.renderers && viz.renderers[0]) {
             const solarRenderer = viz.renderers[0]; // SolarSystemRenderer是第一个 // SolarSystemRenderer is the first one
             if (solarRenderer && solarRenderer.updateRepeaterStations) {
                 solarRenderer.updateRepeaterStations(list);
             }
         }
         if (ui.stCountModal) {
             ui.stCountModal.textContent = list.length;
         }

         // 使用requestAnimationFrame进行批量DOM更新
         // Use requestAnimationFrame for batched DOM updates
         requestAnimationFrame(() => {
             if (stListRenderId !== myRenderId) return;
             ui.stList.innerHTML = '';

             if (list.length === 0) {
                 const emptyMsg = document.createElement('div');
                 emptyMsg.className = 'station-item';
                 emptyMsg.style.gridColumn = '1 / -1';
                 emptyMsg.style.justifyContent = 'center';
                 emptyMsg.style.alignItems = 'center';
                 emptyMsg.style.color = '#666';
                 emptyMsg.textContent = '暂无台站';
                 ui.stList.appendChild(emptyMsg);
                 return;
             }

             // 分批渲染逻辑 (Chunked Rendering)
             // Chunked Rendering Logic
             const CHUNK_SIZE = 50;
             let renderedCount = 0;

             const renderChunk = () => {
                 if (stListRenderId !== myRenderId) return;
                 const chunk = list.slice(renderedCount, renderedCount + CHUNK_SIZE);
                 if (chunk.length === 0) return;

                 const fragment = document.createDocumentFragment();

                 chunk.forEach(st => {
                     const el = document.createElement('div');
                     el.className = 'station-item';
                     el.dataset.uid = st.uid;
                     if (st.uid == currentStationId) el.classList.add('active');

                     // Security Fix: Use textContent
                     const nameEl = document.createElement('div');
                     nameEl.className = 'st-name';
                     nameEl.textContent = st.name || 'Station ' + st.uid;
                     el.appendChild(nameEl);

                     // 优化点击处理
                     // Optimized click handling
                     el.addEventListener('click', () => {
                         ctrl.setStation(st.uid);
                         // 乐观更新 UI
                         // Optimistic UI update
                         const prevActive = ui.stList.querySelector('.station-item.active');
                         if (prevActive) prevActive.classList.remove('active');
                         
                         el.classList.add('active');
                         currentStationId = st.uid;

                         // Update viz text immediately
                         if (ui.currentStationText) {
                             ui.currentStationText.textContent = st.name || 'Station ' + st.uid;
                             ui.currentStationText.style.display = 'block';
                         }

                         // 关闭弹出框
                         // Close modal
                         if (ui.stationModal && ui.stationModal.classList.contains('show')) {
                             ui.stationModal.classList.remove('show');
                         }
                     });
                     fragment.appendChild(el);
                 });
                 
                 ui.stList.appendChild(fragment);
                 renderedCount += chunk.length;

                 // 如果当前选中项刚刚被渲染出来，确保高亮
                 // If the currently selected item was just rendered, ensure it is highlighted
                 if (currentStationId) {
                     const activeItem = ui.stList.querySelector(`.station-item[data-uid="${currentStationId}"]`);
                     if (activeItem && !activeItem.classList.contains('active')) {
                         activeItem.classList.add('active');
                     }
                 }

                 if (renderedCount < list.length) {
                     requestAnimationFrame(renderChunk);
                 }
             };

             renderChunk();
         });
     });

    ctrl.on('stationCurrent', (data) => {
        currentStationId = data.uid;

        // Update current station text in viz area
        // 更新可视化区域的当前台站文本
        if (ui.currentStationText) {
            if (data && data.name) {
                ui.currentStationText.textContent = data.name;
                ui.currentStationText.style.display = 'block';
            } else {
                ui.currentStationText.style.display = 'none';
            }
        }

        // 高亮当前 - 优化性能
        // Highlight current - optimize performance
        if (ui.stList) {
            const prevActive = ui.stList.querySelector('.station-item.active');
            if (prevActive) prevActive.classList.remove('active');

            const newActive = ui.stList.querySelector(`.station-item[data-uid="${currentStationId}"]`);
            if (newActive) {
                newActive.classList.add('active');
                // 自动滚动到可见区域
                // Auto scroll to visible area
                if (ui.stationModal && ui.stationModal.classList.contains('show')) {
                    newActive.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        }
    });

    ui.btnPrev.addEventListener('click', () => ctrl.prevStation());
    ui.btnNext.addEventListener('click', () => ctrl.nextStation());

    // 6. 台站弹出框逻辑
    // 6. Station Modal Logic
    if (ui.btnOpenStations && ui.stationModal) {
        // 打开弹出框
        // Open modal
        ui.btnOpenStations.addEventListener('click', () => {
            ui.stationModal.classList.add('show');
        });

        // 点击遮罩层关闭弹出框
        // Click overlay to close modal
        ui.stationModal.addEventListener('click', (e) => {
            if (e.target === ui.stationModal) {
                ui.stationModal.classList.remove('show');
            }
        });

        // 点击标题栏关闭弹出框
        // Click header to close modal
        const modalHeader = ui.stationModal.querySelector('.station-modal-header');
        modalHeader.addEventListener('click', (e) => {
            ui.stationModal.classList.remove('show');
        });
    }

    // 7. 全局点击唤醒音频上下文（解决自动连接时的 AudioContext 策略限制）
    // 7. Global click to unlock AudioContext (Fix Auto-play policy limitation during auto-connect)
    const unlockAudio = () => {
        if (player) player.unlock();
    };
    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);
    document.addEventListener('keydown', unlockAudio);

    // 6. 启动
    // 6. Startup
    // 初始化设备历史列表
    // Init device history list
    deviceMgr.render();

    // 自动填充上次连接的主机，但不自动连接
    // Auto-fill last connected host, but do not auto-connect
    const lastHost = deviceMgr.devices.length > 0 ? deviceMgr.devices[0] : 'fmo.local';
    if (ui.inpHost) {
        ui.inpHost.value = lastHost;
    }

    // 6.1 Geolocation Logic
    // 6.1 地理位置逻辑
    const cbGeoSingle = document.getElementById('cb-geo-single-allow');
    const cbGeoPeriodic = document.getElementById('cb-geo-periodic-allow');

    // Load Geo Settings
    // 加载地理位置设置
    if (cbGeoSingle) {
        cbGeoSingle.checked = localStorage.getItem(STORAGE_KEYS.GEO_SINGLE) === 'true';
        cbGeoSingle.addEventListener('change', () => {
            localStorage.setItem(STORAGE_KEYS.GEO_SINGLE, cbGeoSingle.checked);
            // If checked, trigger immediate single sync
            // 如果选中，触发立即单次同步
            if (cbGeoSingle.checked) {
                sendGeolocation(true);
            }
        });
    }
    if (cbGeoPeriodic) {
        cbGeoPeriodic.checked = localStorage.getItem(STORAGE_KEYS.GEO_PERIODIC) === 'true';
        cbGeoPeriodic.addEventListener('change', () => {
            localStorage.setItem(STORAGE_KEYS.GEO_PERIODIC, cbGeoPeriodic.checked);
        });
    }

    const sendGeolocation = (isSingleOneTime = false, delayMs = 0) => {
        if (!ctrl.connected) return;

        // Permission Check
        // 权限检查
        if (isSingleOneTime) {
            // If it's the one-time trigger, check the single-allow checkbox
            // 如果是单次触发，检查单次允许复选框
            if (!cbGeoSingle || !cbGeoSingle.checked) return;
        } else {
            // If it's the periodic trigger, check the periodic-allow checkbox
            // 如果是周期性触发，检查周期性允许复选框
            if (!cbGeoPeriodic || !cbGeoPeriodic.checked) return;
        }

        if (!navigator.geolocation) return;

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                // Round to specified precision
                // 四舍五入到指定精度
                const latFixed = parseFloat(latitude.toFixed(GEO_CONSTANTS.COORD_PRECISION));
                const lonFixed = parseFloat(longitude.toFixed(GEO_CONSTANTS.COORD_PRECISION));

                const doSend = () => {
                    if (!ctrl.connected) return;
                    // Format: {"type":"config","subType":"setCordinate","data":{"latitude":x,"longitude":y}}
                    ctrl.send('config', 'setCordinate', { latitude: latFixed, longitude: lonFixed });
                    console.log(`[Geo] Sent (${isSingleOneTime ? 'Single' : 'Periodic'}): ${latFixed}, ${lonFixed}`);
                };

                if (delayMs > 0) {
                     console.log(`[Geo] Coordinates obtained. Waiting ${delayMs}ms before sending to FMO...`);
                      setTimeout(doSend, delayMs);
                } else {
                    doSend();
                }
            },
            (err) => {
                console.warn('[Geo] Error:', err.message);
            },
            {
                enableHighAccuracy: GEO_CONSTANTS.ENABLE_HIGH_ACCURACY,
                timeout: GEO_CONSTANTS.GEO_TIMEOUT,
                maximumAge: GEO_CONSTANTS.MAXIMUM_AGE
            }
        );
    };

    // Interval for Real-time sync
    // 实时同步间隔
    setInterval(() => sendGeolocation(false), TIME_CONSTANTS.GEO_PERIODIC_INTERVAL);

    // Trigger single update shortly after connection
    // 连接后不久触发单次更新
    ctrl.on('status', (connected) => {
        if (connected) {
            // User request: Immediately request position, then write after delay
            // 用户请求：立即请求位置，然后延迟写入
            sendGeolocation(true, TIME_CONSTANTS.GEO_SYNC_DELAY);
        }
    });

    // 6.5 Debug Info Logic
    // 6.5 调试信息逻辑
    const btnShowDebug = document.getElementById('btn-show-debug');
    const debugContainer = document.getElementById('debug-container');
    const debugContent = document.getElementById('debug-content');
    const btnCopyDebug = document.getElementById('btn-copy-debug');

    // Periodic Status Logger
    // 周期性状态记录器
    setInterval(() => {
        try {
            const status = [
                `Ctrl:${ctrl.connected?'ON':'OFF'}`,
                `Audio:${player.connected?'ON':'OFF'}`,
                `WS:${events.connected?'ON':'OFF'}`,
                `St:${currentStationId||'-'}`,
                `Viz:${viz.modes[viz.mode]}`
            ].join('|');
            console.log('[STATUS] ' + status);
        } catch(e) {}
    }, TIME_CONSTANTS.STATUS_LOG_INTERVAL);

    if (btnShowDebug && debugContainer && debugContent) {
        btnShowDebug.addEventListener('click', () => {
            if (debugContainer.style.display === 'none') {
                // Gather Info
                // 收集信息
                const info = {
                    fmo: {
                        control: {
                            connected: ctrl.connected,
                            host: ctrl.host,
                            stationCount: ctrl.stationList.length,
                            currentStationId: currentStationId
                        },
                        audio: {
                            connected: player.connected,
                            state: player.audioCtx ? player.audioCtx.state : 'no-ctx',
                            recording: player.recording,
                            sampleRate: player.audioCtx ? player.audioCtx.sampleRate : 0
                        },
                        events: {
                            connected: events.connected
                        },
                        visualizer: {
                            mode: viz.modes[viz.mode],
                            running: viz.running,
                            resolution: `${viz.canvas.width}x${viz.canvas.height}`
                        },
                        device: {
                            isDesktop: document.documentElement.classList.contains('device-desktop'),
                            historyCount: deviceMgr.devices.length
                        },
                        version: document.getElementById('credits-version')?.dataset?.version || 'unknown'
                    },
                    browser: {
                        userAgent: navigator.userAgent,
                        platform: navigator.platform,
                        screen: `${window.innerWidth}x${window.innerHeight} (dpr:${window.devicePixelRatio})`,
                        location: window.location.href,
                        secure: window.isSecureContext,
                        webSocket: 'WebSocket' in window,
                        webAudio: 'AudioContext' in window || 'webkitAudioContext' in window,
                        cordova: !!window.cordova
                    }
                };

                const logs = window.__DEBUG_LOGS__ ? window.__DEBUG_LOGS__.join('\n') : 'No logs captured';
                
                const report = `=== FMO SYSTEM INFO ===\n${JSON.stringify(info.fmo, null, 2)}\n\n=== BROWSER RUNTIME INFO ===\n${JSON.stringify(info.browser, null, 2)}\n\n=== RECENT LOGS (Last 100) ===\n${logs}`;
                
                debugContent.textContent = report;
                debugContainer.style.display = 'block';
                btnShowDebug.textContent = 'Hide Debug Info';
            } else {
                debugContainer.style.display = 'none';
                btnShowDebug.textContent = 'Show Debug Info';
            }
        });

        if (btnCopyDebug) {
            btnCopyDebug.addEventListener('click', () => {
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(debugContent.textContent)
                        .then(() => {
                            const originalText = btnCopyDebug.textContent;
                            btnCopyDebug.textContent = 'Copied!';
                            setTimeout(() => btnCopyDebug.textContent = originalText, 2000);
                        })
                        .catch(err => console.error('[Debug] Copy failed:', err)); // alert('Copy failed: ' + err));
                } else {
                    // Fallback for older WebViews
                    // 旧版 WebView 的回退方案
                    const range = document.createRange();
                    range.selectNode(debugContent);
                    window.getSelection().removeAllRanges();
                    window.getSelection().addRange(range);
                    document.execCommand('copy');
                    window.getSelection().removeAllRanges();
                    // alert('Copied to clipboard');
                    console.log('[Debug] Copied to clipboard via execCommand');
                }
            });
        }
    }

    // 7. Easter Egg Logic
    // 7. 彩蛋逻辑
    let eggClicks = 0;
    let eggTimer = null;
    const statusIndicators = document.querySelector('.status-indicators');
    const creditsModal = document.getElementById('credits-modal');
    const btnCreditsClose = document.getElementById('btn-credits-close');

    if (statusIndicators && creditsModal && btnCreditsClose) {
        statusIndicators.addEventListener('click', (e) => {
            if (eggClicks === 0) {
                // First click, start timer
                // 第一次点击，启动计时器
                eggTimer = setTimeout(() => {
                    eggClicks = 0;
                    // console.log('Easter egg reset');
                }, EASTER_EGG_CONSTANTS.RESET_TIMEOUT);
            }

            eggClicks++;

            if (eggClicks >= EASTER_EGG_CONSTANTS.REQUIRED_CLICKS) {
                // Trigger Easter Egg
                // 触发彩蛋
                if (eggTimer) clearTimeout(eggTimer);
                eggClicks = 0;
                creditsModal.classList.add('show');
            }
        });

        btnCreditsClose.addEventListener('click', () => {
            creditsModal.classList.remove('show');
        });

        // Click mask to close
        // 点击遮罩关闭
        creditsModal.addEventListener('click', (e) => {
            if (e.target === creditsModal) {
                creditsModal.classList.remove('show');
            }
        });
    }

    // 8. Resource Cleanup - Clean up all resources when page closes
    // 8. 资源清理 - 页面关闭时清理所有资源
    const cleanupResources = () => {
        // Clean up WebSocket connections
        // 清理WebSocket连接
        if (ctrl) ctrl.disconnect();
        if (player) player.disconnect();
        if (events) events.disconnect();

        // Clean up visualizer
        // 清理可视化器
        if (viz) viz.destroy();

        // Clean up volume slider
        // 清理音量滑块
        if (volSlider) volSlider.destroy();

        // Clean up timers
        // 清理定时器
        if (eggTimer) clearTimeout(eggTimer);

        // Clean up event listeners
        // 清理事件监听器
        if (window.addEventListener) {
            window.removeEventListener('resize', checkDevice);
            window.removeEventListener('click', unlockAudio);
            window.removeEventListener('touchstart', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
        }

        console.log('[Cleanup] All resources cleaned up');
    };

    // Listen for page unload events
    // 监听页面卸载事件
    window.addEventListener('beforeunload', cleanupResources);
    // window.addEventListener('unload', cleanupResources); // Removed to fix Permissions policy violation

    // Expose cleanup function to global (for debugging)
    // 暴露清理函数到全局（供调试使用）
    window.cleanupResources = cleanupResources;
});
