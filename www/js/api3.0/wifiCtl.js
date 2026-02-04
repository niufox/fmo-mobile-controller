/**
 * @fileoverview WiFi Controller
 * WiFi 控制器
 */
import { t } from './i18n.js'
import { getWiFiService } from './wifiService.js';

/**
 * WiFi Controller Class
 * WiFi 控制器类
 * Manages the WiFi settings UI and interactions
 * 管理 WiFi 设置界面和交互
 */
class WiFiCtl {
    /**
     * Constructor
     * 构造函数
     * @param {WiFiService} wifiService
     */
    constructor(wifiService) {
        if (WiFiCtl.instance) {
            return WiFiCtl.instance;
        }

        WiFiCtl.instance = this;

        if (!wifiService) {
            throw new Error('wifiService is required');
        }
        this.BUTTON_MODE =
        {
            CONNECT: 'CONNECT',
            DISCONNECT: 'DISCONNECT',
            FORGET: 'FORGET',
            CANCEL: 'CANCEL',
        }
        this.BUTTON_MODE_MESSAGE_MAP = {
            [this.BUTTON_MODE.CONNECT]: 'connect',
            [this.BUTTON_MODE.DISCONNECT]: 'disconnect',
            [this.BUTTON_MODE.FORGET]: 'forget',
            [this.BUTTON_MODE.CANCEL]: 'cancel',
        }
        this.VISIABLELITY =
        {
            VISIBLE: 'VISIBLE',
            HIDDEN: 'HIDDEN',
        }
        this.RSSI_THRESHOLD =
        {
            LEVEL_0: -99,
            LEVEL_1: -95,
            LEVEL_2: -88,
            LEVEL_3: -77,
        };
        this.SSID_HELP =
        {
            SECURE: 'SECURE',
            OPEN: 'OPEN',
        };
        this.SSID_HELP_MESSAGE_MAP = {
            [this.SSID_HELP.SECURE]: 'secure',
            [this.SSID_HELP.OPEN]: 'open',
        };

        this.PASSWORD_HELP =
        {
            INPUT_PLEASE: 'PASSWOR_INPUT_PLEASE',
            ERROR_TOO_SHORT: 'PASSWORD_ERROR_TOO_SHORT',
            ERROR_EMPTY: 'PASSWORD_EMPTY',
            ERROR_CONN_FAILED: 'PASSWORD_CONN_FAILED',
            SUCC_CONN: 'PASSWORD_CONN_SUCC',
            TRYING_CONN: 'PASSWORD_TRYING_CONN',
            SAVED_NETWORK: 'PASSWORD_SAVED_NETWORK',
            CONNECTED: 'CONNECTED',
            DEIVCE_ERROR: 'DEVICE_ERROR',
        }
        this.PASSWORD_HELP_MESSAGE_MAP = {
            [this.PASSWORD_HELP.INPUT_PLEASE]: 'enterPassword',
            [this.PASSWORD_HELP.ERROR_TOO_SHORT]: 'passwordTooShort',
            [this.PASSWORD_HELP.ERROR_EMPTY]: 'notInputPassword',
            [this.PASSWORD_HELP.ERROR_CONN_FAILED]: 'connectionFailed',
            [this.PASSWORD_HELP.SUCC_CONN]: 'connectionSuccess',
            [this.PASSWORD_HELP.TRYING_CONN]: 'connecting',
            [this.PASSWORD_HELP.SAVED_NETWORK]: 'savedNetwork',
            [this.PASSWORD_HELP.CONNECTED]: 'connected',
            [this.PASSWORD_HELP.DEIVCE_ERROR]: 'deviceMessageError',
        };

        this.wifiService = wifiService;
        this.model = {
            wifiList: [],
            helpContent: null,
            buttonContent: null,
            count: 0,
            selectIndex: -1,
        };
        this.element = {
            title: document.getElementById('wifi-title'),
            template: document.getElementById('wifi-item-template'),
            list: document.getElementById('wifi-list'),
            button: document.getElementById('wifi_button'),
            notify: document.getElementById('wifi_notify'),
            manualBox: document.getElementById('wifi_manual'),
            manualTitle: document.getElementById('wifi_manual_title'),
            manualSSID: document.getElementById('wifi_manual_ssid'),
            manualPassword: document.getElementById('wifi_manual_password'),
            manualButton: document.getElementById('wifi_manual_save'),
            manualNotify: document.getElementById('wifi_manual_notify'),
        };
        this.bindEvent();
        this.bindWiFiService();
        this.wifiService.getConnected();
        this.init();
    }

    init() {
        this.updateHelpMessage(t('tryConnToDevice')).updateButtonText(t('wait'));
    }

    updateHelpMessage(content) {
        this.model.helpContent = content;
        this.renderExtra();
        return this;
    }

    /**
     * Update Button Text
     * 更新按钮文本
     * @param {string} content
     */
    updateButtonText(content) {
        this.model.buttonContent = content;
        this.renderExtra();
        return this;
    }

    /**
     * Render Extra UI Elements
     * 渲染额外 UI 元素
     */
    renderExtra() {
        this.element.title.innerHTML = t('wifiTitle');
        this.element.notify.innerText = this.model.helpContent;
        this.element.button.innerText = this.model.buttonContent;
        if (this.element.manualTitle) {
            this.element.manualTitle.innerText = t('wifiManualAddTitle');
            this.element.manualSSID.placeholder = t('wifiManualSsidPlaceholder');
            this.element.manualPassword.placeholder = t('wifiManualPasswordPlaceholder');
            this.element.manualButton.innerText = t('wifiManualSave');
        }
    }

    elementRssiIconDivGenerate(rssi) {
        let elementRssiIcon = document.createElement('div');
        let rssiIconClass = "";
        if (rssi < this.RSSI_THRESHOLD.LEVEL_0) {
            rssiIconClass = "wifi-rssi-0";
        }
        else if (rssi < this.RSSI_THRESHOLD.LEVEL_1) {
            rssiIconClass = "wifi-rssi-1";
        }
        else if (rssi < this.RSSI_THRESHOLD.LEVEL_2) {
            rssiIconClass = "wifi-rssi-2";
        }
        else if (rssi < this.RSSI_THRESHOLD.LEVEL_3) {
            rssiIconClass = "wifi-rssi-3";
        }
        else {
            rssiIconClass = "wifi-rssi-4";
        }
        elementRssiIcon.className = rssiIconClass;
        elementRssiIcon.classList.add('wifi-item-rssi-icon-hidden-ctl');
        return elementRssiIcon;
    }

    elementConnIconDivGenerate() {
        const elementConnectedIcon = document.createElement("div");
        elementConnectedIcon.className = "wifi-connected";
        return elementConnectedIcon;
    }

    createItem(itemModel) {
        const item = document.createElement('div');
        item.className = 'wifi-item-box';
        item.id = itemModel.index;
        item.innerHTML = this.element.template.innerHTML;
        const itemElements = {
            ssidLabel: item.getElementsByClassName('wifi-item-ssid')[0],
            rssiBox: item.getElementsByClassName('wifi-item-rssi-box')[0],
            info: item.getElementsByClassName('wifi-item-ssid-info')[0],
            passwordNotify: item.getElementsByClassName('wifi-item-password-notify')[0],
            passwordInput: item.getElementsByClassName('wifi-item-password')[0],
            buttonBox: item.getElementsByClassName('wifi-item-password-button-box')[0],
            connectButton: item.getElementsByClassName('wifi-item-password-button')[0],
            cancelButton: item.getElementsByClassName('wifi-item-password-button')[1],
        };
        let isItemExpanded = itemModel.isExpanded ? this.VISIABLELITY.VISIBLE : this.VISIABLELITY.HIDDEN;
        let isRssiIconVisible = ((!itemModel.isExpanded && itemModel.isConnected) ? this.VISIABLELITY.HIDDEN : this.VISIABLELITY.VISIBLE);
        let isPasswordInputVisible = (itemModel.encryption && !(itemModel.isConnected || itemModel.isSaved)) ? this.VISIABLELITY.VISIBLE : this.VISIABLELITY.HIDDEN;
        let rssiIcon = this.elementRssiIconDivGenerate(itemModel.rssi);
        let connIcon = itemModel.isConnected ? this.elementConnIconDivGenerate() : null;
        let ssidHelp = (itemModel.encryption ? this.SSID_HELP.SECURE : this.SSID_HELP.OPEN);
        let comfirmButtonMode = (itemModel.isConnected ? this.BUTTON_MODE.DISCONNECT : this.BUTTON_MODE.CONNECT);
        let cancelButtonMode = (itemModel.isConnected ? this.BUTTON_MODE.FORGET : (itemModel.isSaved ? this.BUTTON_MODE.FORGET : this.BUTTON_MODE.CANCEL));
        let passwordHelp = (itemModel.isConnected ? this.PASSWORD_HELP.CONNECTED : (itemModel.isSaved ? this.PASSWORD_HELP.SAVED_NETWORK : this.PASSWORD_HELP.INPUT_PLEASE));
        itemElements.ssidLabel.innerText = itemModel.ssid;
        if (connIcon != null) {
            itemElements.rssiBox.appendChild(connIcon);
        }
        itemElements.rssiBox.appendChild(rssiIcon);
        itemElements.info.innerText = t(this.SSID_HELP_MESSAGE_MAP[ssidHelp] || '') + (itemModel.ip == null ? "" : (" " + itemModel.ip));
        let passwordNotifyText = '';
        if (itemModel.errorMessage) {
            passwordNotifyText = itemModel.errorMessage;
        } else if (itemModel.isConnected) {
            passwordNotifyText = t(this.PASSWORD_HELP_MESSAGE_MAP[this.PASSWORD_HELP.CONNECTED] || '');
        } else if (itemModel.isSaved) {
            passwordNotifyText = t(this.PASSWORD_HELP_MESSAGE_MAP[this.PASSWORD_HELP.SAVED_NETWORK] || '');
        } else if (!itemModel.encryption) {
            passwordNotifyText = t('openNoPassword');
        } else {
            passwordNotifyText = t(this.PASSWORD_HELP_MESSAGE_MAP[this.PASSWORD_HELP.INPUT_PLEASE] || '');
        }
        itemElements.passwordNotify.innerText = passwordNotifyText;
        itemElements.connectButton.innerText = t(this.BUTTON_MODE_MESSAGE_MAP[comfirmButtonMode] || '');
        itemElements.cancelButton.innerText = t(this.BUTTON_MODE_MESSAGE_MAP[cancelButtonMode] || '');
        itemElements.passwordInput.value = itemModel.password ? itemModel.password : '';
        item.setAttribute('data-password-input-visiable', isPasswordInputVisible);
        item.setAttribute('data-expanded', isItemExpanded);
        item.setAttribute('data-rssi-icon-visible', isRssiIconVisible);
        const handleButtonClick = (action) => (e) => {
            const context =
            {
                itemId: itemModel.index,
                element: item,
                model: itemModel,
                passwordInput: itemElements.passwordInput.value,
            }; console.log("button click:" + action);
            switch (action) {
                case this.BUTTON_MODE.CONNECT:
                    itemModel?.onConnectClick(context);
                    break;
                case this.BUTTON_MODE.DISCONNECT:
                    itemModel?.onDisconnectClick(context);
                    break;
                case this.BUTTON_MODE.FORGET:
                    itemModel?.onForgetClick(context);
                    break;
                case this.BUTTON_MODE.CANCEL:
                    itemModel?.onCancelClick(context);
                    break;
            }
        }
        const handleItemClickOperator = (e) => {
            const context =
            {
                itemId: itemModel.index,
                element: item,
                model: itemModel,
                passwordInput: itemElements.passwordInput.value,
            }
            itemModel?.onItemFocus?.(context);
        }

        itemElements.connectButton.addEventListener('click', handleButtonClick(comfirmButtonMode));
        itemElements.cancelButton.addEventListener('click', handleButtonClick(cancelButtonMode));
        item.addEventListener('click', handleItemClickOperator);
        return item;
    }

    /**
     * Render WiFi List
     * 渲染 WiFi 列表
     */
    renderList() {
        const list = this.element.list;
        Array.from(list.querySelectorAll('.wifi-item-box')).forEach(n => {
            if (n.id !== 'wifi_manual') {
                n.remove();
            }
        });
        for (let i = 0; i < this.model.count; i++) {
            const itemModel = this.model.wifiList[i];
            const item = this.createItem(itemModel);
            list.appendChild(item);
        }
        if (this.element.manualBox && this.element.manualBox.parentElement === list) {
            list.appendChild(this.element.manualBox);
        }
    }

    bindEvent() {
        this.element.button.addEventListener('click', () => {
            if (this.wifiService.isBusy()) {
                return;
            }
            this.model.wifiList = [];
            this.model.count = 0;
            this.model.selectIndex = -1;
            this.wifiService.scan();
            this.renderList();
        });
        this.element.manualButton?.addEventListener('click', () => {
            if (this.wifiService.isBusy()) return;
            const ssid = (this.element.manualSSID.value || '').trim();
            const password = this.element.manualPassword.value || '';
            if (!ssid) {
                this.setManualNotify('wifiManualErrSsidEmpty', true);
                return;
            }
            if (ssid.length > 32) {
                this.setManualNotify('wifiManualErrSsidTooLong', true);
                return;
            }
            if (password && (password.length < 8 || password.length > 63)) {
                this.setManualNotify(password.length < 8 ? 'passwordTooShort' : 'wifiManualErrPasswordTooLong', true);
                return;
            }
            const exists = this.model.wifiList.some(item => item.ssid === ssid);
            if (exists) {
                this.setManualNotify('wifiManualWarnDuplicate', false);
            } else {
                this.setManualNotify('', false);
            }
            this.wifiService.save(ssid, password);
        });
    }

    setManualNotify(key, isError) {
        if (!this.element.manualNotify) return;
        this.element.manualNotify.classList.toggle('error', !!isError);
        this.element.manualNotify.innerText = key ? t(key) : '';
    }

    bindWiFiService() {
        this.wifiService.subscribe('scanWifi', (result) => {
            this.onScan();
        });
        this.wifiService.subscribe('scanWifiResult', (result) => {
            this.onScanResult(result);
        });
        this.wifiService.subscribe('setWifi', (result) => {
            this.onConnectWiFi(result);
        });
        this.wifiService.subscribe('setWifiResult', (result) => {
            this.onConnectWiFiResult(result);
        });
        this.wifiService.subscribe('getWifi', (result) => {
            this.onGetWiFi(result);
        });
        this.wifiService.subscribe('disconnectWifi', (result) => {
            this.onDisconnectWiFi(result);
        });
        this.wifiService.subscribe('forgetWifi', (result) => {
            this.onForgetWiFi(result);
        });
        this.wifiService.subscribe('deviceConnected', () => {
            this.onDeviceConnected();
        });
        this.wifiService.subscribe('deviceDisconnect', () => {
            this.onDeviceDisconnect();
        });
        this.wifiService.subscribe('saveWifi', (result) => {
            this.onSaveWiFi(result);
        });
    }
    /**
     * Handle Connect Button Click
     * 处理连接按钮点击
     * @param {object} context
     */
    buttonOnConnectClick(context) {
        if (this.wifiService.isBusy()) {
            return;
        }
        let { itemId, element, model, passwordInput } = context;
        console.log("connect click" + itemId);
        if (model.isSaved === false) {
            if (model.encryption) {
                if (passwordInput.length < 8) {
                    model.errorMessage = t(this.PASSWORD_HELP_MESSAGE_MAP[this.PASSWORD_HELP.ERROR_TOO_SHORT] || '');
                    model.password = passwordInput;
                    this.renderList();
                    return;
                }
            }
        }
        model.password = model.isSaved ? '' : (model.encryption ? passwordInput : '');
        model.errorMessage = null;
        this.wifiService.connect(model.ssid, model.password, context);
    }

    /**
     * Handle Disconnect Button Click
     * 处理断开按钮点击
     * @param {object} context
     */
    buttonOnDisconnectClick(context) {
        if (this.wifiService.isBusy()) {
            return;
        }
        let { itemId, element, model } = context;
        console.log("disconnect click" + itemId);
        this.wifiService.disconnect(context);
    }

    /**
     * Handle Forget Button Click
     * 处理忘记按钮点击
     * @param {object} context
     */
    buttonOnForgetClick(context) {
        if (this.wifiService.isBusy()) {
            return;
        }
        let { itemId, element, model, passwordInput } = context;
        console.log("forget click" + itemId);
        this.wifiService.forget(model.ssid, context);
    }

    /**
     * Handle Cancel Button Click
     * 处理取消按钮点击
     * @param {object} context
     */
    buttonOnCancelClick(context) {
        if (this.wifiService.isBusy()) {
            return;
        }
        let { itemId, element, model, passwordInput } = context;
        console.log("cancel click" + itemId);
        model.password = '';
        model.isExpanded = false;
        this.renderList();
    }

    ItemOnClick(context) {
        let { itemId, element, model, passwordInput } = context;
        if (this.wifiService.isBusy()) {
            return;
        }
        if (this.model.selectIndex == itemId) {
            return;
        }

        this.model.selectIndex = itemId;
        for (let i = 0; i < this.model.count; i++) {
            if (i == itemId) {
                this.model.wifiList[i].isExpanded = true;
            }
            else {
                this.model.wifiList[i].isExpanded = false;
            }
        }
        console.log("item click:" + itemId);
        this.renderList();
    }

    onScan() {
        this.updateHelpMessage(t('scanning')).updateButtonText(t('wait'));
        if (this.element.manualBox) this.element.manualBox.style.display = 'none';
    }

    onScanResult(result) {
        this.updateHelpMessage(t('scanComplete')).updateButtonText(t('scan'));
        console.log("scan result:" + JSON.stringify(result));
        if (!result || !result.data) {
            console.error("Invalid scan result format:", result);
            this.model.wifiList = [];
            this.model.count = 0;
            this.updateHelpMessage(t('scanFailed')).updateButtonText(t('scan'));
            if (this.element.manualBox) this.element.manualBox.style.display = 'block';
            this.renderList();
            return;
        }
        if (this.element.manualBox) this.element.manualBox.style.display = 'none';
        let obj = result.data;
        let cnt = obj.count || 0;
        this.model.wifiList = [];
        for (let ii = 0; ii < cnt; ii++) {
            let tmp = obj.list[ii];
            if (!tmp) {
                console.warn("Invalid wifi item at index:", ii);
                continue;
            }
            let itemModel = {
                index: ii,
                ssid: tmp.ssid,
                password: '',
                rssi: tmp.rssi,
                isConnected: tmp.isConnected,
                encryption: tmp.encryption,
                isSaved: tmp.isSaved,
                ip: tmp.ip,
                isExpanded: false,
                onConnectClick: this.buttonOnConnectClick.bind(this),
                onDisconnectClick: this.buttonOnDisconnectClick.bind(this),
                onForgetClick: this.buttonOnForgetClick.bind(this),
                onCancelClick: this.buttonOnCancelClick.bind(this),
                onItemFocus: this.ItemOnClick.bind(this),
            };
            console.log("wifi item:" + JSON.stringify(itemModel));
            this.model.wifiList.push(itemModel);
        }
        this.model.count = cnt;
        if (cnt === 0) {
            if (this.element.manualBox) this.element.manualBox.style.display = 'block';
            this.updateHelpMessage(t('noWifiFoundTip')).updateButtonText(t('scan'));
        }
        this.renderList();
    }

    /**
     * Handle Get WiFi Info
     * 处理获取 WiFi 信息
     * @param {object} result
     */
    onGetWiFi(result) {
        console.log("get connected:" + JSON.stringify(result));
        if (result.status == 'success') {
            if (this.model.count == 0) {
                let obj = result.data;
                if (obj.count !== undefined && obj.list !== undefined) {
                    this.element.manualBox && (this.element.manualBox.style.display = 'block');
                    let cnt = obj.count;
                    for (let ii = 0; ii < cnt; ii++) {
                        let tmp = obj.list[ii];
                        let itemModel = {
                            index: ii,
                            ssid: tmp.ssid,
                            password: '',
                            rssi: tmp.rssi,
                            isConnected: tmp.isConnected,
                            encryption: tmp.encryption,
                            isSaved: tmp.isSaved,
                            ip: tmp.ip,
                            isExpanded: false,
                            onConnectClick: this.buttonOnConnectClick.bind(this),
                            onDisconnectClick: this.buttonOnDisconnectClick.bind(this),
                            onForgetClick: this.buttonOnForgetClick.bind(this),
                            onCancelClick: this.buttonOnCancelClick.bind(this),
                            onItemFocus: this.ItemOnClick.bind(this),
                        };
                        this.model.wifiList.push(itemModel);
                    }
                    this.model.count = cnt;
                } else {
                    if (!obj.ssid || obj.ssid === "") {
                        this.element.manualBox && (this.element.manualBox.style.display = 'block');
                        this.model.wifiList = [];
                        this.model.count = 0;
                        this.updateHelpMessage(t('noWifiFoundTip')).updateButtonText(t('scan'));
                    } else {
                        this.element.manualBox && (this.element.manualBox.style.display = 'none');
                        let itemModel = {
                            index: 0,
                            ssid: obj.ssid,
                            password: '',
                            rssi: obj.rssi,
                            isConnected: obj.isConnected,
                            isSaved: obj.isSaved,
                            encryption: obj.encryption,
                            ip: obj.ip,
                            isExpanded: false,
                            onConnectClick: this.buttonOnConnectClick.bind(this),
                            onDisconnectClick: this.buttonOnDisconnectClick.bind(this),
                            onForgetClick: this.buttonOnForgetClick.bind(this),
                            onCancelClick: this.buttonOnCancelClick.bind(this),
                            onItemFocus: this.ItemOnClick.bind(this),
                        };
                        this.model.wifiList.push(itemModel);
                        this.model.count++;
                    }
                }
                this.renderList();
            }
        }
        else {
            this.updateHelpMessage(t('deviceMessageError')).updateButtonText(t('wait'));
        }
    }

    onSaveWiFi(result) {
        if (result.status === 'success') {
            if (this.element.manualSSID) this.element.manualSSID.value = '';
            if (this.element.manualPassword) this.element.manualPassword.value = '';
            this.setManualNotify('wifiManualSaved', false);
            this.model.wifiList = [];
            this.model.count = 0;
            this.model.selectIndex = -1;
            this.wifiService.getConnected();
        } else {
            this.setManualNotify('deviceMessageError', true);
        }
    }

    onConnectWiFi(result) {
        let { status, data, context } = result;
        let { itemID, element, model, passwordInput } = context;

        if (status == 'success') {
            for (let i = 0; i < this.model.count; i++) {
                this.model.wifiList[i].isConnected = false;
            }
            model.errorMessage = t(this.PASSWORD_HELP_MESSAGE_MAP[this.PASSWORD_HELP.TRYING_CONN] || '');
            this.renderList();
        }
        else {
            model.errorMessage = t(this.PASSWORD_HELP_MESSAGE_MAP[this.PASSWORD_HELP.DEIVCE_ERROR] || '');
            this.renderList();
        }
    }

    onConnectWiFiResult(result) {
        let { status, data, context } = result;
        let { itemID, element, model, passwordInput } = context;
        if (status == 'success') {
            console.log("connect success:" + JSON.stringify(data));
            let code = data.code;
            let result = data.result;
            if (code == 0) {
                model.errorMessage = null;
                model.rssi = result.rssi;
                model.ip = result.ip;
                model.isConnected = result.isConnected;
                model.isSaved = result.isSaved;
                model.encryption = result.encryption;
                this.renderList();
            }
            else {
                model.errorMessage = t(this.PASSWORD_HELP_MESSAGE_MAP[this.PASSWORD_HELP.ERROR_CONN_FAILED] || '');
                this.renderList();
            }

        }
        else {
            model.errorMessage = t(this.PASSWORD_HELP_MESSAGE_MAP[this.PASSWORD_HELP.DEIVCE_ERROR] || '');
            this.renderList();
        }
    }

    onDisconnectWiFi(result) {
        let { status, context } = result;
        let { itemID, element, model, passwordInput } = context;
        if (status == 'success') {
            model.isConnected = false;
            model.errorMessage = null;
            this.renderList();
        }
    }

    onForgetWiFi(result) {
        let { status, context } = result;
        let { itemID, element, model, passwordInput } = context;
        if (status == 'success') {
            model.isConnected = false;
            model.isSaved = false;
            model.password = '';
            model.errorMessage = null;
            this.renderList();
        }
    }

    onDeviceConnected() {
        this.updateHelpMessage(t('clickToStartWifiScan')).updateButtonText(t('scan'));
    }

    onDeviceDisconnect() {
        this.updateHelpMessage(t('tryConnToDevice')).updateButtonText(t('wait'));
    }
}

let instance = null;
export function getWiFiCtl() {
    if (!instance) {
        const wifiService = getWiFiService();
        instance = new WiFiCtl(wifiService);
    }
    return instance;
}