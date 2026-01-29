class WebSocketService {
    constructor() {
        if (WebSocketService.instance) {
            return WebSocketService.instance;
        }
        WebSocketService.instance = this;

        this.ws = null;
        this.url = "";
        this.isConnected = false;
        this.listeners = new Map();
        this.STATE =
        {
            INIT: 'INIT',
            CONNECTED: 'CONNECTED',
            ERROR: 'ERROR',
            CLOSE: 'CLOSE',
        };
        // this._handleStateChange(this.STATE.INIT);//启动状态管理器
    }

    connect() {
        if (this.ws && this.isConnected) return;
        this.ws = new WebSocket(this.url);
        this._bindEvents();
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

    send(type, subType, data = {}) {
        if (!this.isConnected) {
            console.warn('WebSocket not connected');
            return;
        }
        const message = {
            type: type,
            subType: subType,
            data: data
        };
        this.ws.send(JSON.stringify(message));
    }

    _handleStateChange(newState) {
        const oldState = this.currentState;
        this.currentState = newState;
        switch (newState) {
            case this.STATE.INIT:
                console.log('WebSocket connecting...');
                this.connect();
                break;
            case this.STATE.CONNECTED:
                // Do notihing
                break;
            case this.STATE.ERROR:
                console.log('WebSocket error, reconnecting...');
                setTimeout(() => this.connect(), 3000);
                break;
            case this.STATE.CLOSE:
                console.log('WebSocket closed, reconnecting...');
                setTimeout(() => this.connect(), 3000);
                break;
        }
    }

    _bindEvents() {
        this.ws.onopen = () => {
            this.isConnected = true;
            this._notifyListeners('open');
            this._handleStateChange(this.STATE.CONNECTED);
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this._notifyListeners('message', data);
        };

        this.ws.onerror = (error) => {
            this._notifyListeners('error', error);
            this._handleStateChange(this.STATE.ERROR);
        };

        this.ws.onclose = () => {
            this.isConnected = false;
            this._notifyListeners('close');
            this._handleStateChange(this.STATE.CLOSE);
        };
    }

    _notifyListeners(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => callback(data));
        }
    }
}

// 导出单例
// export const wsService = new WebSocketService();