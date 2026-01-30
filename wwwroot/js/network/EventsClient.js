export class EventsClient {
    constructor() {
        this.ws = null;
        this.host = '';
        this.connected = false;
        this.reconnectTimer = null;
        this.retryMs = 1000;
        this.listeners = new Set();
        this.subtitleEl = document.getElementById('subtitle-overlay');
        this.subtitleText = document.getElementById('subtitle-text');
        this.speakingTimeout = null;
    }

    connect(host) {
        this.host = host;
        if (this.ws) return; 

        try {
            this.ws = new WebSocket(`${(window.location && window.location.protocol === 'https:' ? 'wss' : 'ws')}://${this.host}/events`);
            
            this.ws.onopen = () => {
                this.connected = true;
                this.retryMs = 1000;
                console.log('Events connected');
            };

            this.ws.onmessage = (e) => {
                try {
                    const msg = JSON.parse(e.data);
                    this.handleMessage(msg);
                } catch (err) {
                    console.error('Events parse error:', err);
                }
            };

            this.ws.onclose = () => {
                this.connected = false;
                this.ws = null;
                this.scheduleReconnect();
            };

            this.ws.onerror = () => {
                this.ws = null; 
            };

        } catch (e) {
            console.error('Events connect failed:', e);
            this.scheduleReconnect();
        }
    }

    disconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        if (this.ws) {
            this.ws.onclose = null; 
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
    }

    scheduleReconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            this.retryMs = 1000; 
            this.connect(this.host);
        }, this.retryMs);
    }

    handleMessage(msg) {
        if (msg.type === 'qso' && msg.subType === 'callsign' && msg.data) {
            const { callsign, isSpeaking, isHost } = msg.data;
            
            if (isSpeaking) {
                if (this.onCallsign) this.onCallsign(callsign);
                if (this.onSpeakingState) this.onSpeakingState(callsign, true, isHost);
            } else {
                if (this.onSpeakingState) this.onSpeakingState(callsign, false, isHost);
            }
        }
    }

    onCallsignReceived(callback) {
        this.onCallsign = callback;
    }

    onSpeakingStateChanged(callback) {
        this.onSpeakingState = callback;
    }
}
