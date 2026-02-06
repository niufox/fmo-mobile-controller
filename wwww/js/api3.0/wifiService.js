import { wsService } from './webSocketService.js';
export class WiFiService {
    constructor(webSocketService) {
        if (WiFiService.instance) {
            return WiFiService.instance;
        }
        WiFiService.instance = this;
        this.webSocketService = webSocketService;
        this.listeners = new Map();

        this.currentStatus = {
            scanning: false,
            connecting: false,
            disconnecting: false,
            forgeting: false,
            connected: false,
            currentSSID: null,
            currentIP: null,
            currentRSSI: null,
        };
        this.wifiScanList = {};
        this._scanPollTimerId = null;
        this._scanPollRetryCount = 0;
        this._scanPollIntervalMs = 1000;
        this._scanMaxRetries = 8;

        this.contextForConnectCb = null;
        this.contextForDisconnectCb = null;
        this.contextForForgetCb = null;
        this.setupMessageHandler();
    }
    _notifyListeners(event, data) {
        if (!this.listeners.has(event)) return;
        this.listeners.get(event).forEach((callback) => {
            callback(data);
        });
    }
    subscribe(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
    }
    unsubscribe(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
        }
    }
    isBusy() {
        return this.currentStatus.scanning || this.currentStatus.connecting || this.currentStatus.disconnecting || this.currentStatus.forgeting;
    }

    _clearScanPollTimer() {
        if (this._scanPollTimerId) {
            clearTimeout(this._scanPollTimerId);
            this._scanPollTimerId = null;
        }
    }
    _scheduleNextScanPoll() {
        this._clearScanPollTimer();
        if (!this.currentStatus.scanning) return;
        if (this._scanPollRetryCount >= this._scanMaxRetries) {
            this.currentStatus.scanning = false;
            this._notifyListeners('scanWifiResult', { status: 'error', error: 'timeout', code: -100 });
            return;
        }
        this._scanPollTimerId = setTimeout(() => {
            if (!this.currentStatus.scanning) return;
            this._scanPollRetryCount++;
            this.getScanResult();
        }, this._scanPollIntervalMs);
    }

    async scan(options = {}) {
        try {
            if (this.isBusy()) return;

            if (typeof options.intervalMs === 'number' && options.intervalMs > 0) {
                this._scanPollIntervalMs = options.intervalMs;
            }
            if (typeof options.maxRetries === 'number' && options.maxRetries > 0) {
                this._scanMaxRetries = options.maxRetries;
            }
            this._scanPollRetryCount = 0;
            this._clearScanPollTimer();
            this.webSocketService.send('wifi', 'scanWifi');
            this.currentStatus.scanning = true;

            this._scheduleNextScanPoll();
        }
        catch (error) {
            this.currentStatus.scanning = false;
            this._clearScanPollTimer();
            this._notifyListeners('scanWifi', { status: 'error', error: error });
        }
    }
    async getScanResult() {
        try {
            this.webSocketService.send('wifi', 'scanWifiResult');
        }
        catch (error) {
            this._notifyListeners('scanWifiResult', { status: 'error', error: error });
        }
    }
    async getConnected() {
        try {
            this.webSocketService.send('wifi', 'getWifi');
        }
        catch (error) {
            this._notifyListeners('getWifi', { status: 'error', error: error });
        }
    }
    async save(ssid, password) {
        try {
            this.webSocketService.send('wifi', 'saveWifi', { ssid: ssid, password: password });
        }
        catch (error) {
            this._notifyListeners('saveWifi', { status: 'error', error: error });
        }
    }
    async connect(ssid, password, contextForConnectCb) {
        if (this.isBusy()) return;

        try {
            this.contextForConnectCb = contextForConnectCb;
            this.webSocketService.send('wifi', 'setWifi', { ssid: ssid, password: password });
        }
        catch (error) {
            this._notifyListeners('setWifi', { status: 'error', error: error, context: this.contextForConnectCb });
        }
    }
    async getConnectResult() {
        try {
            this.webSocketService.send('wifi', 'setWifiResult');
        }
        catch (error) {
            this._notifyListeners('setWifiResult', { status: 'error', error: error });
        }
    }
    async forget(ssid, contextForForgetCb) {
        if (this.isBusy()) return;
        try {
            this.webSocketService.send('wifi', 'forgetWifi', { ssid: ssid });
            this.contextForForgetCb = contextForForgetCb;
            this.currentStatus.forgeting = true;
            setTimeout(() => {
                if (this.currentStatus.forgeting == false) return;
                this.currentStatus.forgeting = false;
                this._notifyListeners('forgetWifi', { status: 'error', error: "timeout", context: this.contextForForgetCb });
            }, 5000);
        }
        catch (error) {
            this._notifyListeners('forgetWifi', { status: 'error', error: error, context: this.contextForForgetCb });
        }
    }
    async disconnect(contextForDisconnectCb) {
        if (this.isBusy()) return;
        this.contextForDisconnectCb = contextForDisconnectCb;
        try {
            this.webSocketService.send('wifi', 'disconnectWifi', {});
            this.currentStatus.disconnecting = true;
            setTimeout(() => {
                if (this.currentStatus.disconnecting == false) return;
                this.currentStatus.disconnecting = false;
                this._notifyListeners('disconnectWifi', { status: 'error', error: "timeout", context: this.contextForDisconnectCb });
            }, 5000);
        }
        catch (error) {
            this._notifyListeners('disconnectWifi', { status: 'error', error: error, context: this.contextForDisconnectCb });
        }
    }
    handleScanResponse() {
        console.log("[SCAN] success");
        this._notifyListeners('scanWifi', { status: 'success' });
    }
    handleScanResultResponse(message) {
        console.log("[SCAN_RESULT] received", message);
        if (!message || typeof message.code !== 'number' || !message.data) {
            console.error("[SCAN_RESULT] Invalid response format:", message);
            this.currentStatus.scanning = false;
            this._clearScanPollTimer();
            this._notifyListeners("scanWifiResult", {
                status: 'error',
                error: "Invalid response format"
            });
            return;
        }

        const code = message.code;
        if (code === -5 || code === -1) {
            this._scheduleNextScanPoll();
            return;
        }
        if (code === 0) {
            this.wifiScanList = message.data;
            this.currentStatus.scanning = false;
            this._clearScanPollTimer();
            this._notifyListeners("scanWifiResult", { status: 'success', data: message.data });
            return;
        }
        this.currentStatus.scanning = false;
        this._clearScanPollTimer();
        this._notifyListeners("scanWifiResult", {
            status: 'error',
            error: "scan failed",
            code: code,
            data: message.data
        });
    }
    handleSetWiFiResponse(data) {
        this.currentStatus.connecting = true;
        console.log("[SET_WIFI] success," + data);
        this._notifyListeners('setWifi', { status: 'success', data: data, context: this.contextForConnectCb });
        setTimeout(() => {
            this.getConnectResult();
            this.currentStatus.connecting = false;
        }, 7000);
    }
    handleSetWiFiResultResponse(data) {
        console.log("[SET_WIFI_RESULT]" + data);
        this._notifyListeners('setWifiResult', { status: 'success', data: data, context: this.contextForConnectCb });
        this.contextForConnectCb = null;
    }

    handleGetWiFiResponse(data) {
        console.log("[GET_WIFI] success," + data);
        if (data && data.list && Array.isArray(data.list)) {
            this.currentStatus.connected = false;
            this.currentStatus.currentSSID = null;
            this.currentStatus.currentIP = null;
            this.currentStatus.currentRSSI = null;
        } else {
            this.currentStatus.currentSSID = data.ssid;
            this.currentStatus.currentIP = data.ip;
            this.currentStatus.connected = data.connected;
            this.currentStatus.currentRSSI = data.rssi;
        }
        this._notifyListeners('getWifi', { status: 'success', data: data });
    }

    handleDisconnectWiFiResponse() {
        this.currentStatus.currentSSID = null;
        this.currentStatus.currentIP = null;
        this.currentStatus.connected = false;
        this.currentStatus.currentRSSI = null;
        this._notifyListeners('disconnectWifi', { status: 'success', context: this.contextForDisconnectCb });
        this.contextForDisconnectCb = null;
        this.currentStatus.disconnecting = false;
    }

    handleForgetWiFiResponse() {
        this._notifyListeners('forgetWifi', { status: 'success', context: this.contextForForgetCb });
        this.contextForForgetCb = null;
        this.currentStatus.forgeting = false;
    }

    handleOnWebSocketOpen() {
        console.log("[WS] success");
        this._notifyListeners('deviceConnected', { status: 'success' });
    }
    handleOnWebSocketCloseOrError() {
        console.log("[WS] close or error");
        this._notifyListeners('deviceDisconnect', { status: 'error' });
    }

    setupMessageHandler() {
        this.webSocketService.subscribe('message', (message) => {
            if (message.type != 'wifi') return;
            switch (message.subType) {
                case "scanWifiResponse":
                    this.handleScanResponse();
                    break;
                case "scanWifiResultResponse":
                    this.handleScanResultResponse(message);
                    break;
                case "setWifiResponse":
                    this.handleSetWiFiResponse(message.data);
                    break;
                case "setWifiResultResponse":
                    console.log("[SET_WIFI_RESULT]" + JSON.stringify(message));
                    this.handleSetWiFiResultResponse(message.data);
                    break
                case "getWifiResponse":
                    this.handleGetWiFiResponse(message.data);
                    break;
                case "disconnectWifiResponse":
                    this.handleDisconnectWiFiResponse();
                    break;
                case "forgetWifiResponse":
                    this.handleForgetWiFiResponse();
                    break;
                case "saveWifiResponse":
                    this._notifyListeners('saveWifi', { status: 'success' });
                    break;
                default:
                    break;
            }
        });
        this.webSocketService.subscribe('open', () => {
            this.webSocketService.send('wifi', 'getWifi');
            this.handleOnWebSocketOpen();
        });
        this.webSocketService.subscribe('close', () => {
            this.handleOnWebSocketCloseOrError();
        });
        this.webSocketService.subscribe('error', () => {
            this.handleOnWebSocketCloseOrError();
        });
    }
}
let instance = null;
export function getWiFiService() {
    if (!instance) {
        instance = new WiFiService(wsService);
    }
    return instance;
}
