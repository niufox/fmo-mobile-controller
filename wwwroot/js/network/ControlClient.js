import { EventEmitter } from '../core/EventEmitter.js';

export class ControlClient extends EventEmitter {
    constructor() {
        super();
        this.CONFIG = {
            FETCH_PAGE_SIZE: 20,
            AUTO_REFRESH_INTERVAL: 30000,
            RECONNECT_DELAY: 3000,
            POST_SWITCH_DELAY: 3000
        };

        this.ws = null;
        this.connected = false;
        this.reconnectTimer = null;
        this.autoUpdateTimer = null;
        this.host = '';
        this.stationList = [];
        this.currentStationId = null;
        
        this.fetchingAll = false;
        this.tempStationList = [];
        this.fetchStart = 0;
        this.fetchPageSize = this.CONFIG.FETCH_PAGE_SIZE;
    }

    connect(host) {
        this.fetchingAll = false;
        this.tempStationList = [];
        this.fetchStart = 0;

        this.host = host;
        if (this.ws) {
            this.stopAutoRefresh();
            this.ws.close();
            this.ws = null;
        }

        try {
            this.ws = new WebSocket(`${(window.location && window.location.protocol === 'https:' ? 'wss' : 'ws')}://${this.host}/ws`);
            
            this.ws.onopen = () => {
                this.connected = true;
                this.emit('status', true);
                this.stationList = [];
                this.fetchList();
                this.send('station', 'getCurrent');

                this.startAutoRefresh();
            };

            this.ws.onclose = () => {
                this.connected = false;
                this.emit('status', false);
                
                this.stopAutoRefresh();

                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = setTimeout(() => this.connect(this.host), this.CONFIG.RECONNECT_DELAY);
            };

            this.ws.onerror = (e) => {
                console.error('WS Error:', e);
                this.connected = false;
                this.emit('status', false);
                if (window.cordova) {
                     alert(`WebSocket Error connecting to ${this.host}\nPlease check:\n1. Server is running\n2. Phone is on same Wi-Fi\n3. Use IP address instead of 'fmo.local'`);
                }
            };

            this.ws.onmessage = (e) => {
                try {
                    const msg = JSON.parse(e.data);
                    this.handleMessage(msg);
                } catch (err) {
                    console.error('Parse Error:', err);
                }
            };

        } catch (e) {
            console.error('Connection Failed:', e);
            this.emit('status', false);
            if (window.cordova) {
                alert(`Connection Exception: ${e.message}\nHost: ${host}`);
            }
        }
    }

    send(type, subType, data = {}) {
        if (!this.connected || !this.ws) return;
        this.ws.send(JSON.stringify({ type, subType, data }));
    }

    handleMessage(msg) {
        if (msg.type === 'station') {
            switch (msg.subType) {
                case 'getListResponse':
                    const newList = msg.data.list || [];
                    const start = msg.data.start;

                    if (this.fetchingAll) {
                        if (start !== undefined && start !== this.fetchStart) {
                            console.warn(`Fetch order mismatch: expected ${this.fetchStart}, got ${start}`);
                            this.fetchingAll = false;
                            return;
                        }

                        this.tempStationList = this.tempStationList.concat(newList);
                        
                        if (newList.length < this.fetchPageSize) {
                            console.log(`Fetch complete. Total: ${this.tempStationList.length}`);
                            this.stationList = this.tempStationList;
                            this.fetchingAll = false;
                            this.tempStationList = [];
                            
                            this.stationList = this.stationList.filter(i => i);
                            this.emit('stationList', this.stationList);
                        } else {
                            this.fetchStart += this.fetchPageSize;
                            this.send('station', 'getListRange', { start: this.fetchStart, count: this.fetchPageSize });
                        }
                    } else {
                        if ((start === 0 || start === undefined) && newList.length > 0) {
                            this.stationList = newList;
                            this.emit('stationList', this.stationList);
                        }
                    }
                    break;
                case 'getCurrentResponse':
                    if (msg.data && msg.data.uid) {
                        this.currentStationId = msg.data.uid;
                    }
                    this.emit('stationCurrent', msg.data);
                    break;
                case 'setCurrentResponse':
                    break;
            }
        } else if (msg.type === 'qso') {
            this.emit('qsoMessage', msg);
        }
    }

    setStation(uid) { 
        this.currentStationId = uid;
        this.send('station', 'setCurrent', { uid }); 
        setTimeout(() => this.send('station', 'getCurrent'), this.CONFIG.POST_SWITCH_DELAY);
    }

    nextStation() { 
        this.send('station', 'next');
        setTimeout(() => this.send('station', 'getCurrent'), this.CONFIG.POST_SWITCH_DELAY);
    }

    prevStation() { 
        this.send('station', 'prev');
        setTimeout(() => this.send('station', 'getCurrent'), this.CONFIG.POST_SWITCH_DELAY);
    }
    
    fetchList() {
        if (this.fetchingAll) return; 
        
        this.fetchingAll = true;
        this.tempStationList = [];
        this.fetchStart = 0;
        
        this.send('station', 'getListRange', { start: 0, count: this.fetchPageSize });
    }

    startAutoRefresh() {
        this.stopAutoRefresh();
        this.autoUpdateTimer = setInterval(() => {
            if (this.connected) {
                this.fetchList();
            }
        }, this.CONFIG.AUTO_REFRESH_INTERVAL);
    }

    stopAutoRefresh() {
        if (this.autoUpdateTimer) {
            clearInterval(this.autoUpdateTimer);
            this.autoUpdateTimer = null;
        }
    }
    
    getQsoList(page = 0, pageSize = 20) {
        this.send('qso', 'getList', { page, pageSize });
    }
}
