import { t } from './i18n.js'
import { getWiFiService } from './wifiService.js';

/**
 * @author BG5ESN
 * @version 1.1.0
 * @description WiFi网络配置工具
 * @comment 这是一套网络配置工具，通过ws和ESP32进行通讯然后设置网络等配置参数
 * @typedef {Object} WiFiItemModel - WiFi项的模型定义
 * @property {string} index - 索引
 * @property {string} ssid - SSID
 * @property {string} password - 密码
 * @property {number} rssi - 信号强度的图标等级
 * @property {boolean} isConnected - 是否已连接
 * @property {boolean} encryption - 是否加密
 * @property {string} ip - IP地址
 * @property {string} errorMessage - 是否已保存
 * @property {string} comfirmButtonMode - BUTTON_MODE
 * @property {string} cancelButtonMode - BUTTON_MODE
 * @property {string} ssidHelp - SSID_HELP
 * @property {string} passwordHelp - PASSWORD_HELP
 * @property {boolean} isPasswordInputVisible - 密码输入框是否可见
 * @property {boolean} isExpanded - 是否展开
 * @property {Function} onConnectClick - 连接回调
 * @property {Function} onDisconnectClick - 断开回调
 * @property {Function} onForgetClick - 忘记回调
 * @property {Function} onCancelClick - 取消回调
 * @property {Function} onItemFocus - 聚焦到某个Item时的回调
 * @property {Object} [extra] - 额外数据
 * @property {string} [button] - 连接按钮
 * @property {string} [helpText] - 帮助文本
 */

class WiFiCtl {
    constructor(wifiService) {
        if (WiFiCtl.instance) {
            return WiFiCtl.instance;
        }
        //变量
        WiFiCtl.instance = this;

        if (!wifiService) {
            throw new Error('wifiService is required');
        }
        //定义
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
            wifiList: [],//wifi列表
            helpContent: null,
            buttonContent: null,
            count: 0,//wifi列表的数量
            selectIndex: -1,
        };
        //元素列表
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

    updateButtonText(content) {
        this.model.buttonContent = content;
        this.renderExtra();
        return this;
    }

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
        //创建基础模板
        const item = document.createElement('div');
        item.className = 'wifi-item-box';
        item.id = itemModel.index;
        item.innerHTML = this.element.template.innerHTML;
        //从模板中获取元素
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

    //判断展开和收拢
    let isItemExpanded = itemModel.isExpanded ? this.VISIABLELITY.VISIBLE : this.VISIABLELITY.HIDDEN;
    let isRssiIconVisible = ((!itemModel.isExpanded && itemModel.isConnected) ? this.VISIABLELITY.HIDDEN : this.VISIABLELITY.VISIBLE);
    // 仅在加密网络且未连接/未保存时显示密码输入；开放网络隐藏密码输入
    let isPasswordInputVisible = (itemModel.encryption && !(itemModel.isConnected || itemModel.isSaved)) ? this.VISIABLELITY.VISIBLE : this.VISIABLELITY.HIDDEN;
        let rssiIcon = this.elementRssiIconDivGenerate(itemModel.rssi);
        let connIcon = itemModel.isConnected ? this.elementConnIconDivGenerate() : null;
        let ssidHelp = (itemModel.encryption ? this.SSID_HELP.SECURE : this.SSID_HELP.OPEN);
        let comfirmButtonMode = (itemModel.isConnected ? this.BUTTON_MODE.DISCONNECT : this.BUTTON_MODE.CONNECT);
        let cancelButtonMode = (itemModel.isConnected ? this.BUTTON_MODE.FORGET : (itemModel.isSaved ? this.BUTTON_MODE.FORGET : this.BUTTON_MODE.CANCEL));
    let passwordHelp = (itemModel.isConnected ? this.PASSWORD_HELP.CONNECTED : (itemModel.isSaved ? this.PASSWORD_HELP.SAVED_NETWORK : this.PASSWORD_HELP.INPUT_PLEASE));
        // 填充各个基础元素
        itemElements.ssidLabel.innerText = itemModel.ssid;
        if (connIcon != null) {
            itemElements.rssiBox.appendChild(connIcon);
        }
        itemElements.rssiBox.appendChild(rssiIcon);
        itemElements.info.innerText = t(this.SSID_HELP_MESSAGE_MAP[ssidHelp] || '') + (itemModel.ip == null ? "" : (" " + itemModel.ip));
        // 优化密码提示：开放网络显示“无需密码，直接连接”
        let passwordNotifyText = '';
        if (itemModel.errorMessage) {
            passwordNotifyText = itemModel.errorMessage;
        } else if (itemModel.isConnected) {
            passwordNotifyText = t(this.PASSWORD_HELP_MESSAGE_MAP[this.PASSWORD_HELP.CONNECTED] || '');
        } else if (itemModel.isSaved) {
            passwordNotifyText = t(this.PASSWORD_HELP_MESSAGE_MAP[this.PASSWORD_HELP.SAVED_NETWORK] || '');
        } else if (!itemModel.encryption) {
            // 开放网络
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
        //回调工厂
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

    renderList() {
        // 仅清空已有的WiFi条目，保留手动添加区域
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
        // 将手动添加区域移动到列表底部
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

        // 手动保存事件
        this.element.manualButton?.addEventListener('click', () => {
            if (this.wifiService.isBusy()) return;
            const ssid = (this.element.manualSSID.value || '').trim();
            const password = this.element.manualPassword.value || '';
            // 校验
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
            // 重名提醒(不阻断)
            const exists = this.model.wifiList.some(item => item.ssid === ssid);
            if (exists) {
                this.setManualNotify('wifiManualWarnDuplicate', false);
            } else {
                this.setManualNotify('', false);
            }
            // 发送保存
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
    buttonOnConnectClick(context) {
        if (this.wifiService.isBusy()) {
            return;
        }
        let { itemId, element, model, passwordInput } = context;
        console.log("connect click" + itemId);
        // 仅在“加密网络”时校验密码长度；开放网络允许空密码直接连接
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
        // 开放网络传空串；加密网络传用户输入；已保存网络传空串让设备侧决定
        model.password = model.isSaved ? '' : (model.encryption ? passwordInput : '');
        model.errorMessage = null;
        this.wifiService.connect(model.ssid, model.password, context);
    }

    buttonOnDisconnectClick(context) {
        if (this.wifiService.isBusy()) {
            return;
        }
        let { itemId, element, model } = context;
        console.log("disconnect click" + itemId);
        this.wifiService.disconnect(context);
    }

    buttonOnForgetClick(context) {
        if (this.wifiService.isBusy()) {
            return;
        }
        let { itemId, element, model, passwordInput } = context;
        console.log("forget click" + itemId);
        this.wifiService.forget(model.ssid, context);
    }

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
        // 扫描时隐藏手动输入
        if (this.element.manualBox) this.element.manualBox.style.display = 'none';
    }

    onScanResult(result) {
        this.updateHelpMessage(t('scanComplete')).updateButtonText(t('scan'));
        console.log("scan result:" + JSON.stringify(result));
        
        // 添加防御性检查：确保result和result.data有效
        if (!result || !result.data) {
            console.error("Invalid scan result format:", result);
            this.model.wifiList = [];
            this.model.count = 0;
            this.updateHelpMessage(t('scanFailed')).updateButtonText(t('scan'));
            if (this.element.manualBox) this.element.manualBox.style.display = 'block';
            this.renderList();
            return;
        }
        
    // 扫描结果展示默认隐藏手动输入，若无结果再显示
    if (this.element.manualBox) this.element.manualBox.style.display = 'none';
        //将扫描结果转换为itemModel
        let obj = result.data;
        let cnt = obj.count || 0;  // 使用 || 0 作为默认值
        this.model.wifiList = [];
        for (let ii = 0; ii < cnt; ii++) {
            let tmp = obj.list[ii];
            if (!tmp) {
                console.warn("Invalid wifi item at index:", ii);
                continue;  // 跳过无效项
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
                onConnectClick: this.buttonOnConnectClick.bind(this),//陷阱，这些函数的this指向的是itemModel,而不是WiFiCtl所以需要bind
                onDisconnectClick: this.buttonOnDisconnectClick.bind(this),
                onForgetClick: this.buttonOnForgetClick.bind(this),
                onCancelClick: this.buttonOnCancelClick.bind(this),
                onItemFocus: this.ItemOnClick.bind(this),
            };
            console.log("wifi item:" + JSON.stringify(itemModel));
            this.model.wifiList.push(itemModel);
        }
        this.model.count = cnt;
        // 若扫描结果为空，则显示手动添加并给出统一的多语言提示
        if (cnt === 0) {
            if (this.element.manualBox) this.element.manualBox.style.display = 'block';
            this.updateHelpMessage(t('noWifiFoundTip')).updateButtonText(t('scan'));
        }
        this.renderList();
    }

    onGetWiFi(result) {
        console.log("get connected:" + JSON.stringify(result));
        if (result.status == 'success') {
            if (this.model.count == 0) {
                let obj = result.data;
                
                // 检查是否是WiFi列表格式（未连接时的所有已保存WiFi）
                if (obj.count !== undefined && obj.list !== undefined) {
                    // 未连接：展示手动添加区域（独立块级元素）
                    this.element.manualBox && (this.element.manualBox.style.display = 'block');
                    // 处理WiFi列表格式（类似扫描结果）
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
                    // 服务器返回的是单个 WiFi 对象（通常是已连接的WiFi信息）
                    // 但是在没有已保存 WiFi 的情况下，固件会返回一个空对象（ssid==""）以保持兼容性。
                    // 对此情况我们不应该生成一个空的 UI 条目，而是显示手动添加区域。
                    if (!obj.ssid || obj.ssid === "") {
                        // 没有已保存的WiFi：展示手动添加区域，并在提示栏显示统一的多语言提示
                        this.element.manualBox && (this.element.manualBox.style.display = 'block');
                        this.model.wifiList = [];
                        this.model.count = 0;
                        this.updateHelpMessage(t('noWifiFoundTip')).updateButtonText(t('scan'));
                    } else {
                        // 已连接：隐藏手动添加区域
                        this.element.manualBox && (this.element.manualBox.style.display = 'none');
                        // 处理单个WiFi对象格式（已连接时的当前WiFi）
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
                            onConnectClick: this.buttonOnConnectClick.bind(this),//陷阱，这些函数的this指向的是itemModel,而不是WiFiCtl所以需要bind
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
            // 清理输入并刷新列表
            if (this.element.manualSSID) this.element.manualSSID.value = '';
            if (this.element.manualPassword) this.element.manualPassword.value = '';
            this.setManualNotify('wifiManualSaved', false);
            // 重新获取一次，刷新已保存列表
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
            //遍历列表，设置所有wifi为断开
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
            //更新上下文
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
