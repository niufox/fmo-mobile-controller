/**
 * FMO Audio Controller - Main Application
 */

import './debug-capture.js'; // 优先加载日志捕获
import { Utils } from './utils.js';
import { ControlClient, EventsClient, DiscoveryManager } from './network.js';
import { AudioPlayer } from './audio.js';
import { Visualizer } from './visualizer.js';
import { VolumeSlider, CallsignTicker, DeviceManager, QsoManager } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- 应用逻辑 ---
    const ctrl = new ControlClient();
    const player = new AudioPlayer();
    const events = new EventsClient(); // 实例化
    const viz = new Visualizer(document.getElementById('viz-canvas'), null);
    const qsoMgr = new QsoManager(ctrl); // 初始化 QSO 管理器 (供 Ticker 使用)

    // 实例化呼号显示组件
    const ticker = new CallsignTicker('callsign-ticker', viz, qsoMgr);
    // Expose to window for Python injection
    window.ticker = ticker;

    // Start Visualizer immediately (renders idle state until connected)
    viz.start();

    // 连接事件
    events.onCallsignReceived((callsign) => {
        ticker.addCallsign(callsign);
    });

    events.onSpeakingStateChanged((callsign, isSpeaking, isHost) => {
        if (isSpeaking) {
            viz.setCallsign(callsign);
            player.setLocalTransmission(isHost);
            
            // Trigger UFO Easter Egg if isHost
            if (isHost) {
                viz.triggerUFO();
            }
        } else {
            player.setLocalTransmission(false);
            // 如果当前显示的正是停止说话的人，则清除
            if (viz.currentCallsign === callsign) {
                viz.setCallsign('');
            }
        }
    });

    const deviceMgr = new DeviceManager();
    const discoveryMgr = new DiscoveryManager();
    // qsoMgr 已提前初始化
    
    const ui = {
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
    const checkDevice = () => {
        // 简单判断：屏幕宽度大于 768px 视为桌面端/平板
        if (window.innerWidth >= 768) {
            document.documentElement.classList.add('device-desktop');
        } else {
            document.documentElement.classList.remove('device-desktop');
        }
    };
    // 初始化检测
    checkDevice();
    // 监听窗口大小变化 - 使用防抖优化性能
    window.addEventListener('resize', Utils.debounce(checkDevice, 200));

    // 0. 主题切换
    // 扩展主题列表：包含新增的4款主题
    const themes = ['', 'matrix', 'ocean', 'sunset', 'light', 'pink', 'purple', 'red', 'black'];
    let currentThemeIndex = 0;

    // 初始化主题 - 从localStorage加载
    const savedTheme = localStorage.getItem('fmo_theme');
    if (savedTheme !== null && themes.includes(savedTheme)) {
        currentThemeIndex = themes.indexOf(savedTheme);
        if (savedTheme) {
            document.body.dataset.theme = savedTheme;
        } else {
            document.body.removeAttribute('data-theme');
        }
    }

    ui.btnTheme.addEventListener('click', () => {
        const currentTheme = themes[currentThemeIndex];
        if (currentTheme) {
            document.body.removeAttribute('data-theme');
        }
        currentThemeIndex = (currentThemeIndex + 1) % themes.length;
        const newTheme = themes[currentThemeIndex];
        if (newTheme) {
            document.body.dataset.theme = newTheme;
        } else {
            document.body.removeAttribute('data-theme');
        }
        // 保存主题设置
        localStorage.setItem('fmo_theme', newTheme);
        // Update visualizer colors
        viz.updateThemeColors();
    });

    // 0.1 设置开关
    ui.btnSettingsToggle.addEventListener('click', () => {
        ui.settingsArea.classList.toggle('open');
    });



    // 1. 连接逻辑
    ui.btnConnect.addEventListener('click', async () => {
        // [Autoplay Policy Fix] Must resume AudioContext immediately on user click
        // before any async/await operations
        player.ensureAudio();

        const host = ui.inpHost.value.trim();
        if (!host) return;

        // Disconnect all first to ensure clean state and free slots for strict ESP32 limit (2)
        if (ctrl.connected) ctrl.disconnect();
        if (player.connected) player.disconnect();
        if (events.connected) events.disconnect();

        // Wait for sockets to close and slots to release
        await new Promise(r => setTimeout(r, 300));

        try {
            // Step 1: Connect Control (Control Channel)
            console.log('[App] Connecting Control...');
            await ctrl.connect(host);
            console.log('[App] Control connected');
            
            // Step 2: On Success, Fetch Data & Update UI
            // Fetch Station List (handled by ctrl internally on connect)
            // Fetch QSO Log for "Stars" (handled by qsoMgr via 'status' event)
            
            // Step 3: Connect Audio
            console.log('[App] Connecting Audio...');
            await player.connect(host);
            console.log('[App] Audio connected');
            
            // Step 4: Connect Events (for callsign updates)
            // This can happen after audio, or in parallel with audio if we wanted, 
            // but user requested "Then listen events"
            console.log('[App] Connecting Events...');
            events.connect(host).catch(e => console.warn('[App] Events connect failed', e));

            // Save to history
            deviceMgr.add(host);

        } catch (e) {
            console.error('[App] Connection Sequence Failed:', e);
            alert('Connection failed: ' + e.message);
            // Optional: Disconnect partial connections?
            // ctrl.disconnect(); 
            // player.disconnect();
        }
    });

    ctrl.on('status', (connected) => {
        if (connected) {
            ui.btnConnect.textContent = '已连接';
            ui.btnConnect.style.color = 'var(--accent-green)';
        } else {
            ui.btnConnect.textContent = 'CONNECT';
            ui.btnConnect.style.color = 'var(--accent-cyan)';
        }
    });

    player.on('status', (connected) => {
        ui.ledAudio.className = `status-dot ${connected ? 'connected' : 'error'}`;
        // 音频连接后，将分析节点交给可视化引擎
        if (connected && player.analyser) {
            viz.setAnalyser(player.analyser);
        }
    });

    // 2. 播放控制
    ui.btnPlay.addEventListener('click', () => {
        const host = ui.inpHost.value.trim();
        if (!player.connected) {
            player.connect(host);
        } else {
            // 仅作为重连或断开开关
            player.disconnect();
        }
    });
    
    // 监听音频连接状态改变按钮样式
    player.on('status', (connected) => {
        if (connected) {
            ui.btnPlay.classList.add('active');
            ui.btnPlay.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
        } else {
            ui.btnPlay.classList.remove('active');
            ui.btnPlay.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
        }
    });

    // 音量条初始化
    const volContainer = document.getElementById('vol-container');
    const volSlider = new VolumeSlider(volContainer, player);

    // 3. 可视化切换
    // 改为仅点击文字切换，避免误触
    ui.vizModeText.addEventListener('click', (e) => {
        e.stopPropagation(); // 阻止冒泡
        const modeName = viz.switchMode();
        ui.vizModeText.textContent = modeName;
    });

    // 最大化按钮逻辑
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
    ui.btnRecord.addEventListener('click', () => {
        if (!player.recording) {
            // 开始录音（需要音频已连接）
            if (!player.connected) {
                alert('请先连接音频！');
                return;
            }
            player.startRecording();
            ui.btnRecord.classList.add('recording');
        } else {
            // 停止录音并下载（文件名带时间戳）
            ui.btnRecord.classList.remove('recording');
            const blob = player.stopRecording();
            if (blob) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                // 文件名：fmo_rec_时间戳.wav
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                a.download = `fmo_rec_${timestamp}.wav`;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                }, 100);
            } else {
                alert('录音时长太短或无数据');
            }
        }
    });

     // 4. 台站列表逻辑 - 性能优化版本
     let stListRenderId = 0;
     ctrl.on('stationList', (list) => {
         const myRenderId = ++stListRenderId;
         ui.stCount.textContent = list.length;

         // 将台站列表传递给太阳系可视化器的中继台系统
         if (viz && viz.renderers && viz.renderers[0]) {
             const solarRenderer = viz.renderers[0]; // SolarSystemRenderer是第一个
             if (solarRenderer && solarRenderer.updateRepeaterStations) {
                 solarRenderer.updateRepeaterStations(list);
             }
         }
         if (ui.stCountModal) {
             ui.stCountModal.textContent = list.length;
         }

         // 使用requestAnimationFrame进行批量DOM更新
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
                     el.addEventListener('click', () => {
                         ctrl.setStation(st.uid);
                         // 乐观更新 UI
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
                         if (ui.stationModal && ui.stationModal.classList.contains('show')) {
                             ui.stationModal.classList.remove('show');
                         }
                     });
                     fragment.appendChild(el);
                 });
                 
                 ui.stList.appendChild(fragment);
                 renderedCount += chunk.length;

                 // 如果当前选中项刚刚被渲染出来，确保高亮
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
        if (ui.currentStationText) {
            if (data && data.name) {
                ui.currentStationText.textContent = data.name;
                ui.currentStationText.style.display = 'block';
            } else {
                ui.currentStationText.style.display = 'none';
            }
        }

        // 高亮当前 - 优化性能
        if (ui.stList) {
            const prevActive = ui.stList.querySelector('.station-item.active');
            if (prevActive) prevActive.classList.remove('active');

            const newActive = ui.stList.querySelector(`.station-item[data-uid="${currentStationId}"]`);
            if (newActive) {
                newActive.classList.add('active');
                // 自动滚动到可见区域
                if (ui.stationModal && ui.stationModal.classList.contains('show')) {
                    newActive.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        }
    });

    ui.btnPrev.addEventListener('click', () => ctrl.prevStation());
    ui.btnNext.addEventListener('click', () => ctrl.nextStation());

    // 6. 台站弹出框逻辑
    if (ui.btnOpenStations && ui.stationModal) {
        // 打开弹出框
        ui.btnOpenStations.addEventListener('click', () => {
            ui.stationModal.classList.add('show');
        });

        // 点击遮罩层关闭弹出框
        ui.stationModal.addEventListener('click', (e) => {
            if (e.target === ui.stationModal) {
                ui.stationModal.classList.remove('show');
            }
        });

        // 点击标题栏关闭弹出框
        const modalHeader = ui.stationModal.querySelector('.station-modal-header');
        modalHeader.addEventListener('click', (e) => {
            ui.stationModal.classList.remove('show');
        });
    }

    // 7. 全局点击唤醒音频上下文（解决自动连接时的 AudioContext 策略限制）
    const unlockAudio = () => {
        if (player) player.unlock();
    };
    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);
    document.addEventListener('keydown', unlockAudio);

    // 6. 启动
    // 初始化设备历史列表
    deviceMgr.render();

    // 自动填充上次连接的主机，但不自动连接
    const lastHost = deviceMgr.devices.length > 0 ? deviceMgr.devices[0] : 'fmo.local';
    if (ui.inpHost) {
        ui.inpHost.value = lastHost;
    }

    // 6.1 Geolocation Logic
    const cbGeoSingle = document.getElementById('cb-geo-single-allow');
    const cbGeoPeriodic = document.getElementById('cb-geo-periodic-allow');

    // Load Geo Settings
    if (cbGeoSingle) {
        cbGeoSingle.checked = localStorage.getItem('fmo_geo_single') === 'true';
        cbGeoSingle.addEventListener('change', () => {
            localStorage.setItem('fmo_geo_single', cbGeoSingle.checked);
            // If checked, trigger immediate single sync
            if (cbGeoSingle.checked) {
                sendGeolocation(true);
            }
        });
    }
    if (cbGeoPeriodic) {
        cbGeoPeriodic.checked = localStorage.getItem('fmo_geo_periodic') === 'true';
        cbGeoPeriodic.addEventListener('change', () => {
            localStorage.setItem('fmo_geo_periodic', cbGeoPeriodic.checked);
        });
    }

    const sendGeolocation = (isSingleOneTime = false) => {
        if (!ctrl.connected) return;
        
        // Permission Check
        if (isSingleOneTime) {
            // If it's the one-time trigger, check the single-allow checkbox
            if (!cbGeoSingle || !cbGeoSingle.checked) return;
        } else {
            // If it's the periodic trigger, check the periodic-allow checkbox
            if (!cbGeoPeriodic || !cbGeoPeriodic.checked) return;
        }

        if (!navigator.geolocation) return;

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                // Round to 6 decimal places
                const latFixed = parseFloat(latitude.toFixed(6));
                const lonFixed = parseFloat(longitude.toFixed(6));
                
                // Format: {"type":"config","subType":"setCordinate","data":{"latitude":x,"longitude":y}}
                ctrl.send('config', 'setCordinate', { latitude: latFixed, longitude: lonFixed });
                console.log(`[Geo] Sent (${isSingleOneTime ? 'Single' : 'Periodic'}): ${latFixed}, ${lonFixed}`);
            },
            (err) => {
                console.warn('[Geo] Error:', err.message);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    // Interval: 30 minute (30min) for Real-time
    setInterval(() => sendGeolocation(false), 300000*6);

    // Trigger single update shortly after connection
    ctrl.on('status', (connected) => {
        if (connected) {
            // Wait a bit for connection stability, then try single sync
            setTimeout(() => sendGeolocation(true), 3000);
        }
    });

    // 6.5 Debug Info Logic
    const btnShowDebug = document.getElementById('btn-show-debug');
    const debugContainer = document.getElementById('debug-container');
    const debugContent = document.getElementById('debug-content');
    const btnCopyDebug = document.getElementById('btn-copy-debug');

    // Periodic Status Logger (10s)
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
    }, 10000);

    if (btnShowDebug && debugContainer && debugContent) {
        btnShowDebug.addEventListener('click', () => {
            if (debugContainer.style.display === 'none') {
                // Gather Info
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
                        .catch(err => alert('Copy failed: ' + err));
                } else {
                    // Fallback for older WebViews
                    const range = document.createRange();
                    range.selectNode(debugContent);
                    window.getSelection().removeAllRanges();
                    window.getSelection().addRange(range);
                    document.execCommand('copy');
                    window.getSelection().removeAllRanges();
                    alert('Copied to clipboard');
                }
            });
        }
    }

    // 7. 彩蛋逻辑
    let eggClicks = 0;
    let eggTimer = null;
    const statusIndicators = document.querySelector('.status-indicators');
    const creditsModal = document.getElementById('credits-modal');
    const btnCreditsClose = document.getElementById('btn-credits-close');

    if (statusIndicators && creditsModal && btnCreditsClose) {
        statusIndicators.addEventListener('click', (e) => {
            if (eggClicks === 0) {
                // 第一次点击，启动计时器
                eggTimer = setTimeout(() => {
                    eggClicks = 0;
                    // console.log('Easter egg reset');
                }, 10000); // 10秒内
            }

            eggClicks++;

            if (eggClicks >= 10) {
                // 触发彩蛋
                if (eggTimer) clearTimeout(eggTimer);
                eggClicks = 0;
                creditsModal.classList.add('show');
            }
        });

        btnCreditsClose.addEventListener('click', () => {
            creditsModal.classList.remove('show');
        });

        // 点击遮罩关闭
        creditsModal.addEventListener('click', (e) => {
            if (e.target === creditsModal) {
                creditsModal.classList.remove('show');
            }
        });
    }

    // 8. 资源清理 - 页面关闭时清理所有资源
    const cleanupResources = () => {
        // 清理WebSocket连接
        if (ctrl) ctrl.disconnect();
        if (player) player.disconnect();
        if (events) events.disconnect();

        // 清理可视化器
        if (viz) viz.destroy();

        // 清理音量滑块
        if (volSlider) volSlider.destroy();

        // 清理定时器
        if (eggTimer) clearTimeout(eggTimer);

        // 清理事件监听器
        if (window.addEventListener) {
            window.removeEventListener('resize', checkDevice);
            window.removeEventListener('click', unlockAudio);
            window.removeEventListener('touchstart', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
        }

        console.log('[Cleanup] All resources cleaned up');
    };

    // 监听页面卸载事件
    window.addEventListener('beforeunload', cleanupResources);
    // window.addEventListener('unload', cleanupResources); // Removed to fix Permissions policy violation

    // 暴露清理函数到全局（供调试使用）
    window.cleanupResources = cleanupResources;
});
