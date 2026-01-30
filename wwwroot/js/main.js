import { ControlClient } from './network/ControlClient.js';
import { EventsClient } from './network/EventsClient.js';
import { DiscoveryManager } from './network/DiscoveryManager.js';
import { DeviceManager } from './network/DeviceManager.js';
import { AudioPlayer } from './audio/AudioPlayer.js';
import { VolumeSlider } from './audio/VolumeSlider.js';
import { Visualizer } from './audio/Visualizer.js';
import { QsoManager } from './QsoManager.js';
import { SpeechTranscriber } from './SpeechTranscriber.js';
import { CallsignTicker } from './CallsignTicker.js';
import { Utils } from './core/utils.js';

const ctrl = new ControlClient();
const player = new AudioPlayer();
const events = new EventsClient();
const viz = new Visualizer(document.getElementById('viz-canvas'), null);
const transcriber = new SpeechTranscriber();
const qsoMgr = new QsoManager(ctrl);
const ticker = new CallsignTicker('callsign-ticker', viz, qsoMgr);

window.ticker = ticker;
window.transcriber = transcriber;

player.on('pcm', (buffer) => {
    transcriber.addPCMChunk(buffer);
});

events.onCallsignReceived((callsign) => {
    ticker.addCallsign(callsign);
    transcriber.onCallsignDetected(callsign);
});

events.onSpeakingStateChanged((callsign, isSpeaking, isHost) => {
    if (isSpeaking) {
        viz.setCallsign(callsign);
        player.setLocalTransmission(isHost);
    } else {
        player.setLocalTransmission(false);
        if (viz.currentCallsign === callsign) {
            viz.setCallsign('');
        }
        transcriber.onSpeakingEnd();
    }
});

const deviceMgr = new DeviceManager();
const discoveryMgr = new DiscoveryManager();

const ui = {
    ledWs: document.getElementById('led-ws'),
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

const inpApiKey = document.getElementById('inp-apikey');
const btnSaveKey = document.getElementById('btn-save-key');

if (transcriber.apiKey) {
    inpApiKey.value = transcriber.apiKey;
} else {
    inpApiKey.value = '';
    inpApiKey.placeholder = '请输入 SiliconFlow API Key';
}

btnSaveKey.addEventListener('click', () => {
    const key = inpApiKey.value.trim();
    if (key === '') {
        localStorage.removeItem('transcriber_apiKey');
        transcriber.apiKey = null;
        alert('API Key 已清除');
        if (ui.settingsArea.classList.contains('active')) {
            ui.settingsArea.classList.remove('active');
        }
    } else if (transcriber.setAPIKey(key)) {
        alert('API Key 已保存');
        if (ui.settingsArea.classList.contains('active')) {
            ui.settingsArea.classList.remove('active');
        }
    } else {
        alert('API Key 格式无效，请检查');
    }
});

let currentStationId = null;

const checkDevice = () => {
    if (window.innerWidth >= 768) {
        document.documentElement.classList.add('device-desktop');
    } else {
        document.documentElement.classList.remove('device-desktop');
    }
};
checkDevice();
window.addEventListener('resize', Utils.debounce(checkDevice, 200));

const themes = ['', 'matrix', 'ocean', 'sunset', 'light', 'pink', 'purple', 'red', 'black'];
let currentThemeIndex = 0;

const savedTheme = localStorage.getItem('fmo_theme');
if (savedTheme && themes.includes(savedTheme)) {
    currentThemeIndex = themes.indexOf(savedTheme);
    if (savedTheme) {
        document.body.dataset.theme = savedTheme;
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
        localStorage.setItem('fmo_theme', newTheme);
    }
    viz.updateThemeColors();
});

ui.btnSettingsToggle.addEventListener('click', () => {
    ui.settingsArea.classList.toggle('open');
});

ui.btnConnect.addEventListener('click', () => {
    const host = ui.inpHost.value.trim();
    if (!host) return;
    ctrl.connect(host);
    player.connect(host);
    events.connect(host);
    viz.start();
    deviceMgr.add(host);
});

ctrl.on('status', (connected) => {
    ui.ledWs.className = `status-dot ${connected ? 'connected' : 'error'}`;
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
    if (connected && player.analyser) {
        viz.setAnalyser(player.analyser);
    }
});

ui.btnPlay.addEventListener('click', () => {
    const host = ui.inpHost.value.trim();
    if (!player.connected) {
        player.connect(host);
    } else {
        player.disconnect();
    }
});

player.on('status', (connected) => {
    if (connected) {
        ui.btnPlay.classList.add('active');
        ui.btnPlay.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
    } else {
        ui.btnPlay.classList.remove('active');
        ui.btnPlay.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    }
});

const volContainer = document.getElementById('vol-container');
const volSlider = new VolumeSlider(volContainer, player);

ui.vizModeText.addEventListener('click', (e) => {
    e.stopPropagation();
    const modeName = viz.switchMode();
    ui.vizModeText.textContent = modeName;
});

const btnMaximize = document.getElementById('btn-maximize');
if (btnMaximize) {
    btnMaximize.addEventListener('click', () => {
        const elem = document.documentElement;
        if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
            if (elem.requestFullscreen) {
                elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) {
                elem.webkitRequestFullscreen();
            } else if (elem.msRequestFullscreen) {
                elem.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    });
}

ui.btnRecord.addEventListener('click', () => {
    if (!player.recording) {
        if (!player.connected) {
            alert('请先连接音频！');
            return;
        }
        player.startRecording();
        ui.btnRecord.classList.add('recording');
    } else {
        ui.btnRecord.classList.remove('recording');
        const blob = player.stopRecording();
        if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
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

ctrl.on('stationList', (list) => {
    ui.stCount.textContent = `${list.length} STATIONS`;
    if (ui.stCountModal) {
        ui.stCountModal.textContent = list.length;
    }

    requestAnimationFrame(() => {
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

        const RENDER_LIMIT = 50;
        const renderList = list.slice(0, RENDER_LIMIT);
        
        const fragment = document.createDocumentFragment(); 

        renderList.forEach(st => {
            const el = document.createElement('div');
            el.className = 'station-item';
            el.dataset.uid = st.uid;
            if (st.uid == currentStationId) el.classList.add('active'); 

            const nameEl = document.createElement('div');
            nameEl.className = 'st-name';
            nameEl.textContent = st.name || 'Station ' + st.uid;
            el.appendChild(nameEl);

            el.addEventListener('click', () => {
                ctrl.setStation(st.uid);
                const allItems = ui.stList.querySelectorAll('.station-item');
                for (let i = 0; i < allItems.length; i++) {
                    allItems[i].classList.remove('active');
                }
                el.classList.add('active');
                currentStationId = st.uid;

                if (ui.currentStationText) {
                    ui.currentStationText.textContent = st.name || 'Station ' + st.uid;
                    ui.currentStationText.style.display = 'block';
                }

                if (ui.stationModal && ui.stationModal.classList.contains('show')) {
                    ui.stationModal.classList.remove('show');
                }
            });
            fragment.appendChild(el);
        });
        ui.stList.appendChild(fragment);

        if (list.length > RENDER_LIMIT) {
            const loadMore = document.createElement('div');
            loadMore.className = 'station-item';
            loadMore.style.gridColumn = '1 / -1';
            loadMore.style.justifyContent = 'center';
            loadMore.style.alignItems = 'center';
            loadMore.style.color = 'var(--text-muted)';
            loadMore.style.fontSize = '0.8rem';
            loadMore.textContent = `已显示 ${RENDER_LIMIT} / ${list.length} 个台站`;
            ui.stList.appendChild(loadMore);
        }
    });
});

ctrl.on('stationCurrent', (data) => {
    currentStationId = data.uid;

    if (ui.currentStationText) {
        if (data && data.name) {
            ui.currentStationText.textContent = data.name;
            ui.currentStationText.style.display = 'block';
        } else {
            ui.currentStationText.style.display = 'none';
        }
    }

    if (ui.stList) {
        const items = ui.stList.querySelectorAll('.station-item');
        items.forEach(el => {
            if (el.dataset.uid == currentStationId) el.classList.add('active');
            else el.classList.remove('active');
        });
    }
});

ui.btnPrev.addEventListener('click', () => ctrl.prevStation());
ui.btnNext.addEventListener('click', () => ctrl.nextStation());

if (ui.btnOpenStations && ui.stationModal) {
    ui.btnOpenStations.addEventListener('click', () => {
        ui.stationModal.classList.add('show');
    });

    ui.stationModal.addEventListener('click', (e) => {
        if (e.target === ui.stationModal) {
            ui.stationModal.classList.remove('show');
        }
    });

    let startY = 0;
    let isDragging = false;
    const modalContent = ui.stationModal.querySelector('.station-modal-content');

    modalContent.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
        isDragging = true;
    }, { passive: true });

    modalContent.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const currentY = e.touches[0].clientY;
        const diff = currentY - startY;
        
        if (diff > 0) {
            e.preventDefault();
            modalContent.style.transform = `translateY(${diff}px)`;
        }
    }, { passive: false });

    modalContent.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        isDragging = false;
        const currentY = e.changedTouches[0].clientY;
        const diff = currentY - startY;

        if (diff > 100) {
            modalContent.style.transform = 'translateY(100%)';
            setTimeout(() => {
                ui.stationModal.classList.remove('show');
                modalContent.style.transform = '';
            }, 100);
        } else {
            modalContent.style.transform = '';
        }
    }, { passive: true });
}

const unlockAudio = () => {
    if (player) player.unlock();
};
document.addEventListener('click', unlockAudio);
document.addEventListener('touchstart', unlockAudio);
document.addEventListener('keydown', unlockAudio);

deviceMgr.render();

setTimeout(() => {
    const lastHost = deviceMgr.devices.length > 0 ? deviceMgr.devices[0] : 'fmo.local';
    if (ui.inpHost) {
        ui.inpHost.value = lastHost;
        if (ui.btnConnect) {
            ui.btnConnect.click();
        }
    }
}, 1000);

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

const btnShowDebug = document.getElementById('btn-show-debug');
const debugContainer = document.getElementById('debug-container');
const debugContent = document.getElementById('debug-content');
const btnCopyDebug = document.getElementById('btn-copy-debug');

if (btnShowDebug && debugContainer && debugContent) {
    btnShowDebug.addEventListener('click', () => {
        if (debugContainer.style.display === 'none') {
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

let eggClicks = 0;
let eggTimer = null;
const statusIndicators = document.querySelector('.status-indicators');
const creditsModal = document.getElementById('credits-modal');
const btnCreditsClose = document.getElementById('btn-credits-close');

if (statusIndicators && creditsModal && btnCreditsClose) {
    statusIndicators.addEventListener('click', (e) => {
        if (eggClicks === 0) {
            eggTimer = setTimeout(() => {
                eggClicks = 0;
            }, 10000);
        } 

        eggClicks++;

        if (eggClicks >= 10) {
            if (eggTimer) clearTimeout(eggTimer);
            eggClicks = 0;
            creditsModal.classList.add('show');
        }
    });

    btnCreditsClose.addEventListener('click', () => {
        creditsModal.classList.remove('show');
    });

    creditsModal.addEventListener('click', (e) => {
        if (e.target === creditsModal) {
            creditsModal.classList.remove('show');
        }
    });
}

const cleanupResources = () => {
    if (ctrl) ctrl.disconnect();
    if (player) player.disconnect();
    if (events) events.disconnect();

    if (viz) viz.destroy();

    if (volSlider) volSlider.destroy();

    if (eggTimer) clearTimeout(eggTimer);

    window.removeEventListener('resize', checkDevice);
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);

    console.log('[Cleanup] All resources cleaned up');
};

window.addEventListener('beforeunload', cleanupResources);
window.addEventListener('unload', cleanupResources);

window.cleanupResources = cleanupResources;
