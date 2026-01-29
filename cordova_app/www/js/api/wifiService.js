import { wsService } from './webSocketService.js';
export class WiFiService {
    constructor(webSocketService) {
        if (WiFiService.instance) {
            return WiFiService.instance;
        }
        WiFiService.instance = this;
        this.webSocketService = webSocketService;
        this.listeners = new Map();//key: event, value: callback

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
        this.wifiScanList = {};//WiFi扫描结果列表

        this.contextForConnectCb = null;//连接WiFi时的用户上下文
        this.contextForDisconnectCb = null;//断开WiFi时的用户上下文
        this.contextForForgetCb = null;//忘记WiFi时的用户上下文
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

    //触发扫描事件
    async scan() {
        try {
            if (this.isBusy()) return;
            this.webSocketService.send('wifi', 'scanWifi');
            this.currentStatus.scanning = true;
            setTimeout(() => {
                this.getScanResult();
                this.currentStatus.scanning = false;
            }, 9000);
        }
        catch (error) {
            this.currentStatus.scanning = false;
            this._notifyListeners('scanWifi', { status: 'error', error: error });
        }
    }

    //从设备获取扫描结果
    async getScanResult() {
        try {
            this.webSocketService.send('wifi', 'scanWifiResult');
        }
        catch (error) {
            this._notifyListeners('scanWifiResult', { status: 'error', error: error });
        }
    }

    //获取连接的WiFi
    async getConnected() {
        try {
            this.webSocketService.send('wifi', 'getWifi');
        }
        catch (error) {
            this._notifyListeners('getWifi', { status: 'error', error: error });
        }
    }

    //手动保存WiFi(不连接)
    async save(ssid, password) {
        try {
            this.webSocketService.send('wifi', 'saveWifi', { ssid: ssid, password: password });
        }
        catch (error) {
            this._notifyListeners('saveWifi', { status: 'error', error: error });
        }
    }

    //设置WiFi
    async connect(ssid, password, contextForConnectCb) {
        if (this.isBusy()) return;//如果正忙，直接返回
        
        try {
            this.contextForConnectCb = contextForConnectCb;//保存用户上下文
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

    //忘记指定SSID的密码
    async forget(ssid, contextForForgetCb) {
        if (this.isBusy()) return;//如果正忙，直接返回
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

    //断开连接
    async disconnect(contextForDisconnectCb) {
        if (this.isBusy()) return;//如果正在断开中，直接返回

        this.contextForDisconnectCb = contextForDisconnectCb;//保存用户上下文

        try {
            this.webSocketService.send('wifi', 'disconnectWifi', {});
            this.currentStatus.disconnecting = true;

            setTimeout(() => {//设置一个超时，如果5秒后还没有收到响应，则直接认为断开了
                if (this.currentStatus.disconnecting == false) return;
                this.currentStatus.disconnecting = false;
                this._notifyListeners('disconnectWifi', { status: 'error', error: "timeout", context: this.contextForDisconnectCb });
            }, 5000);

        }
        catch (error) {
            this._notifyListeners('disconnectWifi', { status: 'error', error: error, context: this.contextForDisconnectCb });
        }
    }
    //
    handleScanResponse() {
        console.log("[SCAN] success");
        this._notifyListeners('scanWifi', { status: 'success' });
    }
    handleScanResultResponse(message) {
        console.log("[SCAN_RESULT] received", message);
        
        // 检查message和data的有效性
        if (!message || !message.data) {
            console.error("[SCAN_RESULT] Invalid response format:", message);
            this._notifyListeners("scanWifiResult", { 
                status: 'error', 
                error: "Invalid response format" 
            });
            return;
        }
        
        this.wifiScanList = message.data;
        this._notifyListeners("scanWifiResult", { status: 'success', data: message.data });
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
        this.contextForConnectCb = null;//清空用户上下文
    }

    handleGetWiFiResponse(data) {
        console.log("[GET_WIFI] success," + data);
        // 兼容列表/单对象两种格式
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
        this.contextForDisconnectCb = null;//清空用户上下文
        this.currentStatus.disconnecting = false;//清空正在断开标志
    }

    handleForgetWiFiResponse() {
        this._notifyListeners('forgetWifi', { status: 'success', context: this.contextForForgetCb });
        this.contextForForgetCb = null;//清空用户上下文
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

    //当收到响应时的回复
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

        //当连接设备时，查询当前连接的WiFi状态及信息
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
