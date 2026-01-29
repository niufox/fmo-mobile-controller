import { wsService } from './webSocketService.js';
export class ConfigService {
    constructor(wsService) {
        if (ConfigService.instance) {
            return ConfigService.instance;
        }
        ConfigService.instance = this;
        this.webSocketService = wsService;
        this.listeners = new Map();
        this.currentStatus = {
            busy: false,
        };
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
        return this.currentStatus.busy;
    }


    urlValid(url) {
        // 注意：底层XNet缓冲区 char url[32]，需要预留'\0'，前端应限制为最多31个字符
        if (typeof url !== 'string') return false;
        if (url === '') return true; // 允许清空
        const noSpace = !/\s/.test(url);
        const noSlash = !(/[\/\\]/.test(url));
        const hasDot = url.split('.').length > 1;
        const notEdgeDot = url[0] !== '.' && url[url.length - 1] !== '.';
        const maxLenOk = url.length <= 31; // 与XNet的char[32]一致
        return noSpace && noSlash && hasDot && notEdgeDot && maxLenOk;
    }

    async setServiceUrl(url) {
        try {
            if (!this.urlValid(url)) {
                console.error('Invalid url');
                this._notifyListeners('setUrl', { status: 'error' });
                return;
            }
            if (this.isBusy()) return;
            console.log('setServiceUrl', url);
            this.webSocketService.send('config', 'setUrl', { url: url });
            this.currentStatus.busy = true;
            setTimeout(() => {
                if (this.currentStatus.busy == false) return;
                this.currentStatus.busy = false;
                this._notifyListeners('setUrl', { status: 'timeout' });
            }, 5000);
        }
        catch (error) {
            this.currentStatus.busy = false;
            this._notifyListeners('setUrl', { status: 'error' });
        }
    }
    async getServiceUrl() {
        try {
            if (this.isBusy()) return;
            this.webSocketService.send('config', 'getUrl');
            this.currentStatus.busy = true;
            setTimeout(() => {
                if (this.currentStatus.busy == false) return;
                this.currentStatus.busy = false;
                this._notifyListeners('getUrl', { status: 'timeout' });
            }, 5000);

        }
        catch (error) {
            this._notifyListeners('getUrl', { status: 'error', error: error });
        }
    }
    validPort(port) {
        //port 为0-65535的整数
        const portNumber = parseInt(port, 10);
        return !isNaN(portNumber) && portNumber > 0 && portNumber <= 65535;
    }

    async setServicePort(port) {
        try {
            if (!this.validPort(port)) {
                console.error('Invalid port');
                this._notifyListeners('setPort', { status: 'error' });
                return;
            }
            if (this.isBusy()) return;
            const portNumber = parseInt(port, 10);
            this.webSocketService.send('config', 'setPort', { port: portNumber });
            this.currentStatus.busy = true;
            setTimeout(() => {
                if (this.currentStatus.busy == false) return;
                this.currentStatus.busy = false;
                this._notifyListeners('setPort', { status: 'timeout' });
            }, 5000);
        }
        catch (error) {
            this.currentStatus.busy = false;
            this._notifyListeners('setPort', { status: 'error' });
        }
    }
    async getServicePort() {
        try {
            if (this.isBusy()) return;
            this.webSocketService.send('config', 'getPort');
            this.currentStatus.busy = true;
            setTimeout(() => {
                if (this.currentStatus.busy == false) return;
                this.currentStatus.busy = false;
                this._notifyListeners('getPort', { status: 'timeout' });
            }, 5000);

        }
        catch (error) {
            this._notifyListeners('getPort', { status: 'error', error: error });
        }
    }
    passcodeValid(passcode) {
        //passcode 为5个数字,或-1,不能含有其他字符
        return /^\d{5}$/.test(passcode) || passcode == '-1';
    }
    async setPasscode(passcode) {
        try {
            if (!this.passcodeValid(passcode)) {
                console.error('Invalid passcode');
                this._notifyListeners('setPasscode', { status: 'error' });
                return;
            }
            if (this.isBusy()) return;
            this.webSocketService.send('config', 'setPasscode', { passcode: passcode });
            this.currentStatus.busy = true;
            setTimeout(() => {
                if (this.currentStatus.busy == false) return;
                this.currentStatus.busy = false;
                this._notifyListeners('setPasscode', { status: 'timeout' });
            }, 5000);
        }
        catch (error) {
            this.currentStatus.busy = false;
            this._notifyListeners('setPasscode', { status: 'error' });
        }
    }
    async getPasscode() {
        try {
            if (this.isBusy()) return;
            this.webSocketService.send('config', 'getPasscode');
            this.currentStatus.busy = true;
            setTimeout(() => {
                if (this.currentStatus.busy == false) return;
                this.currentStatus.busy = false;
                this._notifyListeners('getPasscode', { status: 'timeout' });
            }, 5000);

        }
        catch (error) {
            this._notifyListeners('getPasscode', { status: 'error', error: error });
        }
    }

    async setAprsRemark(remark) {
        try {
            // 个性化消息最大 63 字节（XNet: char aprsRemark[64]，尾部留给 \0）
            if (!this.aprsRemarkValid(remark)) {
                console.error('APRS remark invalid or exceeds UTF-8 byte limit (63 bytes)');
                this._notifyListeners('setAprsRemark', { status: 'error', reason: 'too-long-or-invalid-utf8' });
                return;
            }
            if (this.isBusy()) return;
            this.webSocketService.send('config', 'setAprsRemark', { remark: remark });
            this.currentStatus.busy = true;
            setTimeout(() => {
                if (this.currentStatus.busy == false) return;
                this.currentStatus.busy = false;
                this._notifyListeners('setAprsRemark', { status: 'timeout' });
            }, 5000);
        }
        catch (error) {
            this.currentStatus.busy = false;
            this._notifyListeners('setAprsRemark', { status: 'error' });
        }
    }
    async getAprsRemark() {
        try {
            if (this.isBusy()) return;
            this.webSocketService.send('config', 'getAprsRemark');
            this.currentStatus.busy = true;
            setTimeout(() => {
                if (this.currentStatus.busy == false) return;
                this.currentStatus.busy = false;
                this._notifyListeners('getAprsRemark', { status: 'timeout' });
            }
                , 5000);
        }
        catch (error) {
            this._notifyListeners('getAprsRemark', { status: 'error', error: error });
        }
    }

    _serverNameValid(name) { return typeof name === 'string' && name.length <= 31; } // XNet: char serverName[32]

    async setServerName(name) {
        try {
            if (!this._serverNameValid(name)) {
                console.error('Invalid server name (max 31)');
                this._notifyListeners('setServerName', { status: 'error' });
                return;
            }
            if (this.isBusy()) return;
            this.webSocketService.send('config', 'setServerName', { serverName: name });
            this.currentStatus.busy = true;
            setTimeout(() => {
                if (this.currentStatus.busy == false) return;
                this.currentStatus.busy = false;
                this._notifyListeners('setServerName', { status: 'timeout' });
            }, 5000);
        }
        catch (error) {
            this.currentStatus.busy = false;
            this._notifyListeners('setServerName', { status: 'error' });
        }
    }
    async getServerName() {
        try {
            if (this.isBusy()) return;
            this.webSocketService.send('config', 'getServerName');
            this.currentStatus.busy = true;
            setTimeout(() => {
                if (this.currentStatus.busy == false) return;
                this.currentStatus.busy = false;
                this._notifyListeners('getServerName', { status: 'timeout' });
            }, 5000);
        }
        catch (error) {
            this._notifyListeners('getServerName', { status: 'error', error: error });
        }
    }

    async setBlacklist(blacklist) {
        try {
            if (!this.blacklistValid(blacklist)) {
                console.error('Invalid blacklist');
                this._notifyListeners('setBlacklist', { status: 'error' });
                return;
            }
            if (this.isBusy()) return;
            this.webSocketService.send('config', 'setBlacklist', { blacklist: blacklist });
            this.currentStatus.busy = true;
            setTimeout(() => {
                if (this.currentStatus.busy == false) return;
                this.currentStatus.busy = false;
                this._notifyListeners('setBlacklist', { status: 'timeout' });
            }, 5000);
        }
        catch (error) {
            this.currentStatus.busy = false;
            this._notifyListeners('setBlacklist', { status: 'error' });
        }
    }
    async getBlacklist() {
        try {
            if (this.isBusy()) return;
            this.webSocketService.send('config', 'getBlacklist');
            this.currentStatus.busy = true;
            setTimeout(() => {
                if (this.currentStatus.busy == false) return;
                this.currentStatus.busy = false;
                this._notifyListeners('getBlacklist', { status: 'timeout' });
            }
                , 5000);
        }
        catch (error) {
            this._notifyListeners('getBlacklist', { status: 'error', error: error });
        }
    }

    async setBroadcastServer()
    {
        try {
            if (this.isBusy()) return;
            // 添加空对象作为data参数，确保C++端不会收到NULL
            this.webSocketService.send('config', 'setBroadcastServer', {});
            this.currentStatus.busy = true;
            setTimeout(() => {
                if (this.currentStatus.busy == false) return;
                this.currentStatus.busy = false;
                this._notifyListeners('setBroadcastServer', { status: 'timeout' });
            }, 5000);
        }
        catch (error) {
            this.currentStatus.busy = false;
            this._notifyListeners('setBroadcastServer', { status: 'error' });
        }
    }

    async setBroadcastUser()
    {
        try {
            if (this.isBusy()) return;
            // 添加空对象作为data参数，确保C++端不会收到NULL
            this.webSocketService.send('config', 'setBroadcastUser', {});
            this.currentStatus.busy = true;
            setTimeout(() => {
                if (this.currentStatus.busy == false) return;
                this.currentStatus.busy = false;
                this._notifyListeners('setBroadcastUser', { status: 'timeout' });
            }, 5000);
        }
        catch (error) {
            this.currentStatus.busy = false;
            this._notifyListeners('setBroadcastUser', { status: 'error' });
        }
    }

    aprsTypeValid(type) {
        // 检查是否为1-15的整数
        const typeNumber = parseInt(type, 10);
        return !isNaN(typeNumber) && typeNumber >= 1 && typeNumber <= 15;
    }

    async setAprsType(type) {
        try {
            if (!this.aprsTypeValid(type)) {
                console.error('Invalid APRS type');
                this._notifyListeners('setAprsType', { status: 'error' });
                return;
            }
            if (this.isBusy()) return;
            
            const aprsType = parseInt(type, 10);
            this.webSocketService.send('config', 'setAprsType', { aprsType: aprsType });
            this.currentStatus.busy = true;
            setTimeout(() => {
                if (this.currentStatus.busy == false) return;
                this.currentStatus.busy = false;
                this._notifyListeners('setAprsType', { status: 'timeout' });
            }, 5000);
        }
        catch (error) {
            this.currentStatus.busy = false;
            this._notifyListeners('setAprsType', { status: 'error' });
        }
    }

    async getAprsType() {
        try {
            if (this.isBusy()) return;
            this.webSocketService.send('config', 'getAprsType');
            this.currentStatus.busy = true;
            setTimeout(() => {
                if (this.currentStatus.busy == false) return;
                this.currentStatus.busy = false;
                this._notifyListeners('getAprsType', { status: 'timeout' });
            }, 5000);
        }
        catch (error) {
            this._notifyListeners('getAprsType', { status: 'error', error: error });
        }
    }

    async restartAprsService() {
        try {
            if (this.isBusy()) return;
            // 添加空对象作为data参数，确保C++端不会收到NULL
            this.webSocketService.send('config', 'restartAprsService', {});
            this.currentStatus.busy = true;
            setTimeout(() => {
                if (this.currentStatus.busy == false) return;
                this.currentStatus.busy = false;
                this._notifyListeners('restartAprsService', { status: 'timeout' });
            }, 5000);
        }
        catch (error) {
            this.currentStatus.busy = false;
            this._notifyListeners('restartAprsService', { status: 'error' });
        }
    }

    // ---- 用户物理可达性 ----
    // XNet: userPhyDeviceName/userPhyAnt 为 char[16]，前端限制最多15字符
    _validDeviceName(name) { return typeof name === 'string' && name.length <= 15; }
    _validAnt(name) { return typeof name === 'string' && name.length <= 15; }
    _validFreq(freq) { const f = parseFloat(freq); return !isNaN(f) && f >= 0 && f <= 1000; }
    _validHeight(h) { const v = parseInt(h, 10); return !isNaN(v) && v >= 0 && v <= 100000; }

    async setUserPhyDeviceName(name) {
        try {
            if (!this._validDeviceName(name) || this.isBusy()) { this._notifyListeners('setUserPhyDeviceName', { status: 'error' }); return; }
            this.webSocketService.send('config', 'setUserPhyDeviceName', { deviceName: name });
            this.currentStatus.busy = true;
            setTimeout(() => { if (!this.currentStatus.busy) return; this.currentStatus.busy = false; this._notifyListeners('setUserPhyDeviceName', { status: 'timeout' }); }, 5000);
        } catch (e) { this.currentStatus.busy = false; this._notifyListeners('setUserPhyDeviceName', { status: 'error' }); }
    }
    async getUserPhyDeviceName() {
        try {
            if (this.isBusy()) return;
            this.webSocketService.send('config', 'getUserPhyDeviceName');
            this.currentStatus.busy = true;
            setTimeout(() => { if (!this.currentStatus.busy) return; this.currentStatus.busy = false; this._notifyListeners('getUserPhyDeviceName', { status: 'timeout' }); }, 5000);
        } catch (e) { this._notifyListeners('getUserPhyDeviceName', { status: 'error', error: e }); }
    }

    async setUserPhyFreq(freq) {
        try {
            if (!this._validFreq(freq) || this.isBusy()) { this._notifyListeners('setUserPhyFreq', { status: 'error' }); return; }
            const f = parseFloat(freq);
            this.webSocketService.send('config', 'setUserPhyFreq', { freq: f });
            this.currentStatus.busy = true;
            setTimeout(() => { if (!this.currentStatus.busy) return; this.currentStatus.busy = false; this._notifyListeners('setUserPhyFreq', { status: 'timeout' }); }, 5000);
        } catch (e) { this.currentStatus.busy = false; this._notifyListeners('setUserPhyFreq', { status: 'error' }); }
    }
    async getUserPhyFreq() {
        try {
            if (this.isBusy()) return;
            this.webSocketService.send('config', 'getUserPhyFreq');
            this.currentStatus.busy = true;
            setTimeout(() => { if (!this.currentStatus.busy) return; this.currentStatus.busy = false; this._notifyListeners('getUserPhyFreq', { status: 'timeout' }); }, 5000);
        } catch (e) { this._notifyListeners('getUserPhyFreq', { status: 'error', error: e }); }
    }

    async setUserPhyAnt(ant) {
        try { 
            if (!this._validAnt(ant) || this.isBusy()) { this._notifyListeners('setUserPhyAnt', { status: 'error' }); return; }
            this.webSocketService.send('config', 'setUserPhyAnt', { ant: ant });
            this.currentStatus.busy = true;
            setTimeout(() => { if (!this.currentStatus.busy) return; this.currentStatus.busy = false; this._notifyListeners('setUserPhyAnt', { status: 'timeout' }); }, 5000);
        } catch (e) { this.currentStatus.busy = false; this._notifyListeners('setUserPhyAnt', { status: 'error' }); }
    }
    async getUserPhyAnt() {
        try {
            if (this.isBusy()) return;
            this.webSocketService.send('config', 'getUserPhyAnt');
            this.currentStatus.busy = true;
            setTimeout(() => { if (!this.currentStatus.busy) return; this.currentStatus.busy = false; this._notifyListeners('getUserPhyAnt', { status: 'timeout' }); }, 5000);
        } catch (e) { this._notifyListeners('getUserPhyAnt', { status: 'error', error: e }); }
    }

    async setUserPhyAntHeight(height) {
        try { 
            if (!this._validHeight(height) || this.isBusy()) { this._notifyListeners('setUserPhyAntHeight', { status: 'error' }); return; }
            const h = parseInt(height, 10);
            this.webSocketService.send('config', 'setUserPhyAntHeight', { height: h });
            this.currentStatus.busy = true;
            setTimeout(() => { if (!this.currentStatus.busy) return; this.currentStatus.busy = false; this._notifyListeners('setUserPhyAntHeight', { status: 'timeout' }); }, 5000);
        } catch (e) { this.currentStatus.busy = false; this._notifyListeners('setUserPhyAntHeight', { status: 'error' }); }
    }
    async getUserPhyAntHeight() {
        try {
            if (this.isBusy()) return;
            this.webSocketService.send('config', 'getUserPhyAntHeight');
            this.currentStatus.busy = true;
            setTimeout(() => { if (!this.currentStatus.busy) return; this.currentStatus.busy = false; this._notifyListeners('getUserPhyAntHeight', { status: 'timeout' }); }, 5000);
        } catch (e) { this._notifyListeners('getUserPhyAntHeight', { status: 'error', error: e }); }
    }

    serverFilterValid(filter) {
        // 允许0..8 对应 FILTER_NONE..FILTER_MAX
        const n = parseInt(filter, 10);
        return !isNaN(n) && n >= 0 && n <= 8;
    }

    async setServerFilter(filter) {
        try {
            if (!this.serverFilterValid(filter)) {
                console.error('Invalid server filter');
                this._notifyListeners('setServerFilter', { status: 'error' });
                return;
            }
            if (this.isBusy()) return;
            const v = parseInt(filter, 10);
            this.webSocketService.send('config', 'setServerFilter', { serverFilter: v });
            this.currentStatus.busy = true;
            setTimeout(() => {
                if (this.currentStatus.busy == false) return;
                this.currentStatus.busy = false;
                this._notifyListeners('setServerFilter', { status: 'timeout' });
            }, 5000);
        }
        catch (error) {
            this.currentStatus.busy = false;
            this._notifyListeners('setServerFilter', { status: 'error' });
        }
    }

    async getServerFilter() {
        try {
            if (this.isBusy()) return;
            this.webSocketService.send('config', 'getServerFilter');
            this.currentStatus.busy = true;
            setTimeout(() => {
                if (this.currentStatus.busy == false) return;
                this.currentStatus.busy = false;
                this._notifyListeners('getServerFilter', { status: 'timeout' });
            }, 5000);
        }
        catch (error) {
            this._notifyListeners('getServerFilter', { status: 'error', error: error });
        }
    }

    serverLoginAnnouncementValid(text) {
        // 允许中英文字符、英文标点、数字、空格（排除中文标点）
        const regex = /^[\u4e00-\u9fa5a-zA-Z0-9\s!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]*$/;
        if (typeof text !== 'string' || !regex.test(text)) return false;
        // 以 UTF-8 字节长度限制，最大 127 字节，避免后端按字节截断破坏多字节字符
        return this._utf8WithinLimit(text, 127, 42);
    }

    qsoBestWishValid(text) {
        // 允许中英文、英文标点、数字、空格；最大 64 字节（SPIFFS_CONFIG_QSO_BEST_WISH_MAX_LEN）
        const regex = /^[\u4e00-\u9fa5a-zA-Z0-9\s!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]*$/;
        if (typeof text !== 'string' || !regex.test(text)) return false;
        return this._utf8WithinLimit(text, 64, 21);
    }

    aprsRemarkValid(remark) {
        if (typeof remark !== 'string') return false;
        // 输入框本身有 maxlength=63，这里再以 UTF-8 字节数兜底，防止多字节字符被后端截断
        return this._utf8WithinLimit(remark, 63, 21);
    }

    async setServerLoginAnnouncement(text) {
        try {
            if (!this.serverLoginAnnouncementValid(text)) {
                console.error('Invalid server login announcement');
                this._notifyListeners('setServerLoginAnnouncement', { status: 'error', reason: 'too-long-or-invalid-utf8' });
                return;
            }
            if (this.isBusy()) return;
            this.webSocketService.send('config', 'setServerLoginAnnouncement', { serverLoginAnnouncement: text });
            this.currentStatus.busy = true;
            setTimeout(() => {
                if (this.currentStatus.busy == false) return;
                this.currentStatus.busy = false;
                this._notifyListeners('setServerLoginAnnouncement', { status: 'timeout' });
            }, 5000);
        }
        catch (error) {
            this.currentStatus.busy = false;
            this._notifyListeners('setServerLoginAnnouncement', { status: 'error' });
        }
    }

    async getServerLoginAnnouncement() {
        try {
            if (this.isBusy()) return;
            this.webSocketService.send('config', 'getServerLoginAnnouncement');
            this.currentStatus.busy = true;
            setTimeout(() => {
                if (this.currentStatus.busy == false) return;
                this.currentStatus.busy = false;
                this._notifyListeners('getServerLoginAnnouncement', { status: 'timeout' });
            }, 5000);
        }
        catch (error) {
            this._notifyListeners('getServerLoginAnnouncement', { status: 'error', error: error });
        }
    }

    async setQsoBestWish(text) {
        try {
            if (!this.qsoBestWishValid(text)) {
                console.error('Invalid QSO best wish');
                this._notifyListeners('setQsoBestWish', { status: 'error', reason: 'too-long-or-invalid-utf8' });
                return;
            }
            if (this.isBusy()) return;
            this.webSocketService.send('config', 'setQsoBestWish', { qsoBestWish: text });
            this.currentStatus.busy = true;
            setTimeout(() => {
                if (this.currentStatus.busy == false) return;
                this.currentStatus.busy = false;
                this._notifyListeners('setQsoBestWish', { status: 'timeout' });
            }, 5000);
        }
        catch (error) {
            this.currentStatus.busy = false;
            this._notifyListeners('setQsoBestWish', { status: 'error' });
        }
    }

    async getQsoBestWish() {
        try {
            if (this.isBusy()) return;
            this.webSocketService.send('config', 'getQsoBestWish');
            this.currentStatus.busy = true;
            setTimeout(() => {
                if (this.currentStatus.busy == false) return;
                this.currentStatus.busy = false;
                this._notifyListeners('getQsoBestWish', { status: 'timeout' });
            }, 5000);
        }
        catch (error) {
            this._notifyListeners('getQsoBestWish', { status: 'error', error: error });
        }
    }

    _cordinateValid(lat, lon) {
        if (typeof lat !== 'number' || typeof lon !== 'number') return false;
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
        return lat >= -90.0 && lat <= 90.0 && lon >= -180.0 && lon <= 180.0;
    }

    async setCordinate(latitude, longitude) {
        try {
            if (!this._cordinateValid(latitude, longitude)) {
                this._notifyListeners('setCordinate', { status: 'error' });
                return;
            }
            if (this.isBusy()) return;
            this.webSocketService.send('config', 'setCordinate', { latitude, longitude });
            this.currentStatus.busy = true;
            setTimeout(() => {
                if (this.currentStatus.busy == false) return;
                this.currentStatus.busy = false;
                this._notifyListeners('setCordinate', { status: 'timeout' });
            }, 5000);
        } catch (error) {
            this.currentStatus.busy = false;
            this._notifyListeners('setCordinate', { status: 'error', error });
        }
    }

    async getCordinate() {
        try {
            if (this.isBusy()) return;
            this.webSocketService.send('config', 'getCordinate');
            this.currentStatus.busy = true;
            setTimeout(() => {
                if (this.currentStatus.busy == false) return;
                this.currentStatus.busy = false;
                this._notifyListeners('getCordinate', { status: 'timeout' });
            }, 5000);
        } catch (error) {
            this._notifyListeners('getCordinate', { status: 'error', error });
        }
    }

    blacklistValid(blacklist) {
        // 黑名单必须为大写字母、数字和逗号或空格组成，且长度不超过511（XNet: char blacklist[512]）
        const regex = /^[A-Z0-9, ]*$/;
        return typeof blacklist === 'string' && regex.test(blacklist) && blacklist.length <= 511;
    }

    _utf8WithinLimit(text, byteLimit, fallbackCharLimit) {
        if (typeof text !== 'string') return false;
        try {
            const bytes = new TextEncoder().encode(text);
            return bytes.length <= byteLimit;
        } catch (e) {
            const fallback = typeof fallbackCharLimit === 'number' ? fallbackCharLimit : Math.floor(byteLimit / 3);
            return text.length <= fallback;
        }
    }

    handleSetUrlResponse(message) {
        this._notifyListeners('setUrl', { status: 'success', result: message.data.result });
    }

    handleGetUrlResponse(message) {
        console.log('handleGetUrlResponse', message);
        this._notifyListeners('getUrl', { status: 'success', url: message.data.url });
    }

    handleSetPortResponse(message) {
        this._notifyListeners('setPort', { status: 'success', result: message.data.result });
    }

    handleGetPortResponse(message) {
        this._notifyListeners('getPort', { status: 'success', port: message.data.port });
    }

    handleSetPasscodeResponse(message) {
        this._notifyListeners('setPasscode', { status: 'success', result: message.data.result });
    }

    handleGetPasscodeResponse(message) {
        this._notifyListeners('getPasscode', { status: 'success', passcode: message.data.passcode });
    }

    hanleSetAprsRemarkResponse(message) {
        this._notifyListeners('setAprsRemark', { status: 'success', result: message.data.result });
    }
    handleGetAprsRemarkResponse(message) {
        this._notifyListeners('getAprsRemark', { status: 'success', remark: message.data.remark });
    }
    handleSetServerNameResponse(message) {
        this._notifyListeners('setServerName', { status: 'success', result: message.data.result });
    }
    handleGetServerNameResponse(message) {
        this._notifyListeners('getServerName', { status: 'success', serverName: message.data.serverName });
    }
    handleSetBlacklistResponse(message) {
        this._notifyListeners('setBlacklist', { status: 'success', result: message.data.result });
    }
    handleGetBlacklistResponse(message) {
        this._notifyListeners('getBlacklist', { status: 'success', blacklist: message.data.blacklist });
    }

    handleSetBroadcastServerResponse(message) {
        this._notifyListeners('setBroadcastServer', { status: 'success', result: message.data.result });
    }
    
    handleSetBroadcastUserResponse(message) {
        this._notifyListeners('setBroadcastUser', { status: 'success', result: message.data.result });
    }

    handleSetAprsTypeResponse(message) {
        this._notifyListeners('setAprsType', { status: 'success', result: message.data.result });
    }

    handleGetAprsTypeResponse(message) {
        this._notifyListeners('getAprsType', { status: 'success', aprsType: message.data.aprsType });
    }

    handleRestartAprsServiceResponse(message) {
        this._notifyListeners('restartAprsService', { status: 'success', result: message.data.result });
    }

    handleSetServerLoginAnnouncementResponse(message) {
        this._notifyListeners('setServerLoginAnnouncement', { status: 'success', result: message.data.result });
    }

    handleGetServerLoginAnnouncementResponse(message) {
        this._notifyListeners('getServerLoginAnnouncement', { status: 'success', serverLoginAnnouncement: message.data.serverLoginAnnouncement });
    }

    handleSetQsoBestWishResponse(message) {
        this._notifyListeners('setQsoBestWish', { status: 'success', result: message.data.result });
    }

    handleGetQsoBestWishResponse(message) {
        this._notifyListeners('getQsoBestWish', { status: 'success', qsoBestWish: message.data.qsoBestWish });
    }

    handleSetServerFilterResponse(message) {
        this._notifyListeners('setServerFilter', { status: 'success', result: message.data.result });
    }

    handleGetServerFilterResponse(message) {
        this._notifyListeners('getServerFilter', { status: 'success', serverFilter: message.data.serverFilter });
    }

    handleSetCordinateResponse(message) {
        this._notifyListeners('setCordinate', { status: 'success', result: message.data.result });
    }

    handleGetCordinateResponse(message) {
        this._notifyListeners('getCordinate', { status: 'success', latitude: message.data.latitude, longitude: message.data.longitude });
    }

    handleSetUserPhyDeviceNameResponse(message) { this._notifyListeners('setUserPhyDeviceName', { status: 'success' }); }
    handleGetUserPhyDeviceNameResponse(message) { this._notifyListeners('getUserPhyDeviceName', { status: 'success', deviceName: message.data.deviceName }); }
    handleSetUserPhyFreqResponse(message) { this._notifyListeners('setUserPhyFreq', { status: 'success' }); }
    handleGetUserPhyFreqResponse(message) { this._notifyListeners('getUserPhyFreq', { status: 'success', freq: message.data.freq }); }
    handleSetUserPhyAntResponse(message) { this._notifyListeners('setUserPhyAnt', { status: 'success' }); }
    handleGetUserPhyAntResponse(message) { this._notifyListeners('getUserPhyAnt', { status: 'success', ant: message.data.ant }); }
    handleSetUserPhyAntHeightResponse(message) { this._notifyListeners('setUserPhyAntHeight', { status: 'success' }); }
    handleGetUserPhyAntHeightResponse(message) { this._notifyListeners('getUserPhyAntHeight', { status: 'success', height: message.data.height }); }

    setupMessageHandler() {
        this.webSocketService.subscribe('message', (message) => {
            if (message.type != 'config') return;
            this.currentStatus.busy = false;
            switch (message.subType) {
                case 'setUrlResponse':
                    this.handleSetUrlResponse(message);
                    break;
                case 'getUrlResponse':
                    this.handleGetUrlResponse(message);
                    break;
                case 'setPortResponse':
                    this.handleSetPortResponse(message);
                    break;
                case 'getPortResponse':
                    this.handleGetPortResponse(message);
                    break;
                case 'setPasscodeResponse':
                    this.handleSetPasscodeResponse(message);
                    break;
                case 'getPasscodeResponse':
                    this.handleGetPasscodeResponse(message);
                    break;
                case 'setAprsRemarkResponse':
                    this.hanleSetAprsRemarkResponse(message);
                    break;
                case 'getAprsRemarkResponse':
                    this.handleGetAprsRemarkResponse(message);
                    break;
                case 'setServerNameResponse':
                    this.handleSetServerNameResponse(message);
                    break;
                case 'getServerNameResponse':
                    this.handleGetServerNameResponse(message);
                    break;
                case 'setBlacklistResponse':
                    this.handleSetBlacklistResponse(message);
                    break;
                case 'getBlacklistResponse':
                    this.handleGetBlacklistResponse(message);
                    break;
                case 'setBroadcastServerResponse':
                    this.handleSetBroadcastServerResponse(message);
                    break;
                case 'setBroadcastUserResponse':
                    this.handleSetBroadcastUserResponse(message);
                    break;
                case 'setAprsTypeResponse':
                    this.handleSetAprsTypeResponse(message);
                    break;
                case 'getAprsTypeResponse':
                    this.handleGetAprsTypeResponse(message);
                    break;
                case 'restartAprsServiceResponse':
                    this.handleRestartAprsServiceResponse(message);
                    break;
                case 'setServerLoginAnnouncementResponse':
                    this.handleSetServerLoginAnnouncementResponse(message);
                    break;
                case 'getServerLoginAnnouncementResponse':
                    this.handleGetServerLoginAnnouncementResponse(message);
                    break;
                case 'setQsoBestWishResponse':
                    this.handleSetQsoBestWishResponse(message);
                    break;
                case 'getQsoBestWishResponse':
                    this.handleGetQsoBestWishResponse(message);
                    break;
                case 'setServerFilterResponse':
                    this.handleSetServerFilterResponse(message);
                    break;
                case 'getServerFilterResponse':
                    this.handleGetServerFilterResponse(message);
                    break;
                case 'setUserPhyDeviceNameResponse':
                    this.handleSetUserPhyDeviceNameResponse(message);
                    break;
                case 'getUserPhyDeviceNameResponse':
                    this.handleGetUserPhyDeviceNameResponse(message);
                    break;
                case 'setUserPhyFreqResponse':
                    this.handleSetUserPhyFreqResponse(message);
                    break;
                case 'getUserPhyFreqResponse':
                    this.handleGetUserPhyFreqResponse(message);
                    break;
                case 'setUserPhyAntResponse':
                    this.handleSetUserPhyAntResponse(message);
                    break;
                case 'getUserPhyAntResponse':
                    this.handleGetUserPhyAntResponse(message);
                    break;
                case 'setUserPhyAntHeightResponse':
                    this.handleSetUserPhyAntHeightResponse(message);
                    break;
                case 'getUserPhyAntHeightResponse':
                    this.handleGetUserPhyAntHeightResponse(message);
                    break;
                case 'setCordinateResponse':
                    this.handleSetCordinateResponse(message);
                    break;
                case 'getCordinateResponse':
                    this.handleGetCordinateResponse(message);
                    break;
                default:
                    console.error('Unknown message type', message);
                    break;
            }

        });
        this.webSocketService.subscribe('open', () => {
            this._notifyListeners('onDeviceStatusChange', { status: 'connected' });
        });
        this.webSocketService.subscribe('close', () => {
            this._notifyListeners('onDeviceStatusChange', { status: 'disconnected' });
        });
        this.webSocketService.subscribe('error', () => {
            this._notifyListeners('onDeviceStatusChange', { status: 'error' });
        });
    }
};

let instance = null;

export function getConfigService() {
    if (!instance) {
        instance = new ConfigService(wsService);
    }
    return instance;
}
