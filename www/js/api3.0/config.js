import { t } from './i18n.js'
import { getConfigService } from './configService.js';

class Config {
    constructor(configService) {
        if (Config.instance) {
            return Config.instance;
        }
        Config.instance = this;
        if (!configService) {
            throw new Error("configService is null");
        }
        this.configService = configService;

        this.elements = {
            title: document.getElementById('title'),
            deviceStatus: document.getElementById('device-status'),
            serverTitle: document.getElementById('server-title'),
            serverSubtitle: document.getElementById('server-subtitle'),
            // 线下物理可达性区块标题/副标题
            userPhySectionTitle: document.getElementById('user-phy-section-title'),
            userPhySectionSubtitle: document.getElementById('user-phy-section-subtitle'),
            serverItemTitle: document.getElementById('server-item-title'),
            serverItemHelp: document.getElementById('server-item-help'),
            serverItemInput: document.getElementById('server-item-input'),
            serverItemButton: document.getElementById('server-item-button'),
            portItemTitle: document.getElementById('port-item-title'),
            portItemHelp: document.getElementById('port-item-help'),
            portItemInput: document.getElementById('port-item-input'),
            portItemButton: document.getElementById('port-item-button'),
            serverNameItemTitle: document.getElementById('server-name-item-title'),
            serverNameItemHelp: document.getElementById('server-name-item-help'),
            serverNameItemInput: document.getElementById('server-name-item-input'),
            serverNameItemButton: document.getElementById('server-name-item-button'),
            passcodeItemTitle: document.getElementById('passcode-item-title'),
            passcodeItemHelp: document.getElementById('passcode-item-help'),
            passcodeItemInput: document.getElementById('passcode-item-input'),
            passcodeItemButton: document.getElementById('passcode-item-button'),
            aprsRemarkItemTitle: document.getElementById('aprs-remark-item-title'),
            aprsRemarkItemHelp: document.getElementById('aprs-remark-item-help'),
            aprsRemarkItemInput: document.getElementById('aprs-remark-item-input'),
            aprsRemarkItemButton: document.getElementById('aprs-remark-item-button'),
            blacklistItemTitle: document.getElementById('blacklist-item-title'),
            blacklistItemHelp: document.getElementById('blacklist-item-help'),
            blacklistItemInput: document.getElementById('blacklist-item-input'),
            blacklistItemButton: document.getElementById('blacklist-item-button'),

            serverLoginAnnouncementItemTitle: document.getElementById('server-login-announcement-item-title'),
            serverLoginAnnouncementItemHelp: document.getElementById('server-login-announcement-item-help'),
            serverLoginAnnouncementItemInput: document.getElementById('server-login-announcement-item-input'),
            serverLoginAnnouncementItemButton: document.getElementById('server-login-announcement-item-button'),

            serverFilterItemTitle: document.getElementById('server-filter-item-title'),
            serverFilterItemHelp: document.getElementById('server-filter-item-help'),
            serverFilterSelect: document.getElementById('server-filter-select'),
            serverFilterItemButton: document.getElementById('server-filter-item-button'),

            broadcastItemTitle: document.getElementById('broadcast-item-title'),
            broadcastItemHelp: document.getElementById('broadcast-item-help'),
            broadcastServerItemButton: document.getElementById('broadcast-server-item-button'),
            broadcastUserItemButton: document.getElementById('broadcast-user-item-button'),

            restartAprsItemTitle: document.getElementById('restart-aprs-item-title'),
            restartAprsItemHelp: document.getElementById('restart-aprs-item-help'),
            restartAprsItemButton: document.getElementById('restart-aprs-item-button'),

            // APRS网络设置
            aprsNetworkSectionTitle: document.getElementById('aprsNetworkSectionTitle'),
            aprsNetworkSectionSubtitle: document.getElementById('aprsNetworkSectionSubtitle'),

            // QSO 信息
            qsoSectionTitle: document.getElementById('qso-section-title'),
            qsoSectionSubtitle: document.getElementById('qso-section-subtitle'),
            qsoBlessItemTitle: document.getElementById('qso-bless-item-title'),
            qsoBlessItemHelp: document.getElementById('qso-bless-item-help'),
            qsoBlessItemInput: document.getElementById('qso-bless-item-input'),
            qsoBlessItemButton: document.getElementById('qso-bless-item-button'),

            // 坐标设置
            coordinateSectionTitle: document.getElementById('coordinate-section-title'),
            coordinateSectionSubtitle: document.getElementById('coordinate-section-subtitle'),
            coordinatePreciseItemTitle: document.getElementById('coordinate-precise-item-title'),
            coordinatePreciseItemHelp: document.getElementById('coordinate-precise-item-help'),
            coordinateLatItemInput: document.getElementById('coordinate-lat-item-input'),
            coordinateLonItemInput: document.getElementById('coordinate-lon-item-input'),
            coordinatePreciseItemButton: document.getElementById('coordinate-precise-item-button'),

            helpTitle1: document.getElementById('help-title-1'),
            helpContent1: document.getElementById('help-content-1'),
            helpTitle2: document.getElementById('help-title-2'),
            helpContent2: document.getElementById('help-content-2'),
            helpTitle3: document.getElementById('help-title-3'),
            helpContent3: document.getElementById('help-content-3'),
            helpTitle4: document.getElementById('help-title-4'),
            helpContent4: document.getElementById('help-content-4'),
            helpTitle5: document.getElementById('help-title-5'),
            helpContent5: document.getElementById('help-content-5'),
            helpTitle6: document.getElementById('help-title-6'),
            helpContent6: document.getElementById('help-content-6'),
            // 紧急模式
            emergencyModeItemTitle: document.getElementById('emergency-mode-item-title'),
            emergencyModeItemHelp: document.getElementById('emergency-mode-item-help'),
            emergencyModeItemButton: document.getElementById('emergency-mode-item-button'),

            aprsTypeItemTitle: document.getElementById('aprs-type-item-title'),
            aprsTypeItemHelp: document.getElementById('aprs-type-item-help'),
            aprsTypeSelect: document.getElementById('aprs-type-select'),
            aprsTypeItemButton: document.getElementById('aprs-type-item-button'),

            // 用户物理可达性
            userPhyDeviceNameItemTitle: document.getElementById('user-phy-device-name-item-title'),
            userPhyDeviceNameItemHelp: document.getElementById('user-phy-device-name-item-help'),
            userPhyDeviceNameItemInput: document.getElementById('user-phy-device-name-item-input'),
            userPhyDeviceNameItemButton: document.getElementById('user-phy-device-name-item-button'),

            userPhyFreqItemTitle: document.getElementById('user-phy-freq-item-title'),
            userPhyFreqItemHelp: document.getElementById('user-phy-freq-item-help'),
            userPhyFreqItemInput: document.getElementById('user-phy-freq-item-input'),
            userPhyFreqItemButton: document.getElementById('user-phy-freq-item-button'),

            userPhyAntItemTitle: document.getElementById('user-phy-ant-item-title'),
            userPhyAntItemHelp: document.getElementById('user-phy-ant-item-help'),
            userPhyAntItemInput: document.getElementById('user-phy-ant-item-input'),
            userPhyAntItemButton: document.getElementById('user-phy-ant-item-button'),

            userPhyAntHeightItemTitle: document.getElementById('user-phy-ant-height-item-title'),
            userPhyAntHeightItemHelp: document.getElementById('user-phy-ant-height-item-help'),
            userPhyAntHeightItemInput: document.getElementById('user-phy-ant-height-item-input'),
            userPhyAntHeightItemButton: document.getElementById('user-phy-ant-height-item-button'),
        };
        this._requeue = [];
        this._isProcess = false;
        // 加载紧急模式状态
        this._emergencyMode = this._loadEmergencyMode ? this._loadEmergencyMode() : false;
        this.setupText();
        this.initAprsTypeSelect();
        this.initServerFilterSelect();
        this.bindItemButton();
        this.bindReport();
        this._refreshEmergencyButtonUI();
    }

    initServerFilterSelect() {
        // 清空
        this.elements.serverFilterSelect.innerHTML = '';
        // 选项: 枚举序列化为 number -> 文案
        const options = [
            { value: 0, label: t('filterNone') },
            { value: 1, label: t('filter50km') },
            { value: 2, label: t('filter100km') },
            { value: 3, label: t('filter200km') },
            { value: 4, label: t('filter500km') },
            { value: 5, label: t('filter1000km') },
            { value: 6, label: t('filter2000km') },
            { value: 7, label: t('filter5000km') }
        ];
        for (const op of options) {
            const option = document.createElement('option');
            option.value = op.value;
            option.textContent = op.label;
            this.elements.serverFilterSelect.appendChild(option);
        }
    }

    initAprsTypeSelect() {
        // 清空现有选项
        this.elements.aprsTypeSelect.innerHTML = '';

        // 添加1-15的选项
        for (let i = 1; i <= 15; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${i}`;
            this.elements.aprsTypeSelect.appendChild(option);
        }
    }

    setupText() {
        this.elements.title.innerHTML = t('configTitle');
        this.elements.deviceStatus.innerHTML = t('tryConnToDevice');
        this.elements.serverTitle.innerHTML = t('configServerTitle');
        this.elements.serverSubtitle.innerHTML = t('configServerSubtitle');
        this.elements.serverItemTitle.innerHTML = t('configServerItemTitle');
        this.elements.serverItemHelp.innerHTML = t('configServerItemHelp');
        this.elements.serverItemButton.innerHTML = t('configServerItemButton');
        this.elements.serverNameItemTitle.innerHTML = t('configServerNameItemTitle');
        this.elements.serverNameItemHelp.innerHTML = t('configServerNameItemHelp');
        this.elements.serverNameItemButton.innerHTML = t('configServerNameItemButton');
        this.elements.portItemTitle.innerHTML = t('configPortItemTitle');
        this.elements.portItemHelp.innerHTML = t('configPortItemHelp');
        this.elements.portItemButton.innerHTML = t('configPortItemButton');
        this.elements.passcodeItemTitle.innerHTML = t('configPasscodeItemTitle');
        this.elements.passcodeItemHelp.innerHTML = t('configPasscodeItemHelp');
        this.elements.passcodeItemButton.innerHTML = t('configPasscodeItemButton');
        this.elements.aprsRemarkItemTitle.innerHTML = t('configAprsRemarkItemTitle');
        this.elements.aprsRemarkItemHelp.innerHTML = t('configAprsRemarkItemHelp');
        this.elements.aprsRemarkItemButton.innerHTML = t('configAprsRemarkItemButton');
        this.elements.blacklistItemTitle.innerHTML = t('configBlacklistItemTitle');
        this.elements.blacklistItemHelp.innerHTML = t('configBlacklistItemHelp');
        this.elements.blacklistItemButton.innerHTML = t('configBlacklistItemButton');

        this.elements.serverLoginAnnouncementItemTitle.innerHTML = t('configServerLoginAnnouncementItemTitle');
        this.elements.serverLoginAnnouncementItemHelp.innerHTML = t('configServerLoginAnnouncementItemHelp');
        this.elements.serverLoginAnnouncementItemButton.innerHTML = t('configServerLoginAnnouncementItemButton');

        this.elements.serverFilterItemTitle.innerHTML = t('configServerFilterItemTitle');
        this.elements.serverFilterItemHelp.innerHTML = t('configServerFilterItemHelp');
        this.elements.serverFilterItemButton.innerHTML = t('configServerFilterItemButton');
        this.elements.broadcastItemTitle.innerHTML = t('configBroadcastItemTitle');
        this.elements.broadcastItemHelp.innerHTML = t('configBroadcastItemHelp');
        this.elements.broadcastServerItemButton.innerHTML = t('configBroadcastServerItemButton');
        this.elements.broadcastUserItemButton.innerHTML = t('configBroadcastUserItemButton');

        this.elements.restartAprsItemTitle.innerHTML = t('configRestartAprsItemTitle');
        this.elements.restartAprsItemHelp.innerHTML = t('configRestartAprsItemHelp');
        this.elements.restartAprsItemButton.innerHTML = t('configRestartAprsItemButton');

        // APRS网络设置
        if (this.elements.aprsNetworkSectionTitle) {
            this.elements.aprsNetworkSectionTitle.innerHTML = t('aprsNetworkSectionTitle');
        }
        if (this.elements.aprsNetworkSectionSubtitle) {
            this.elements.aprsNetworkSectionSubtitle.innerHTML = t('aprsNetworkSectionSubtitle');
        }

        this.elements.helpTitle1.innerHTML = t('configHelpTitle1');
        this.elements.helpContent1.innerHTML = t('configHelpContent1');
        this.elements.helpTitle2.innerHTML = t('configHelpTitle2');
        this.elements.helpContent2.innerHTML = t('configHelpContent2');
        this.elements.helpTitle3.innerHTML = t('configHelpTitle3');
        this.elements.helpContent3.innerHTML = t('configHelpContent3');
        this.elements.helpTitle4.innerHTML = t('configHelpTitle4');
        this.elements.helpContent4.innerHTML = t('configHelpContent4');
        this.elements.helpTitle5.innerHTML = t('configHelpTitle5');
        this.elements.helpContent5.innerHTML = t('configHelpContent5');
        this.elements.helpTitle6.innerHTML = t('configHelpTitle6');
        this.elements.helpContent6.innerHTML = t('configHelpContent6');
        // 紧急模式
        if (this.elements.emergencyModeItemTitle) {
            this.elements.emergencyModeItemTitle.innerHTML = t('emergencyModeItemTitle');
        }
        if (this.elements.emergencyModeItemHelp) {
            this.elements.emergencyModeItemHelp.innerHTML = t('emergencyModeItemHelp');
        }

        this.elements.aprsTypeItemTitle.innerHTML = t('configAprsTypeItemTitle');
        this.elements.aprsTypeItemHelp.innerHTML = t('configAprsTypeItemHelp');
        this.elements.aprsTypeItemButton.innerHTML = t('configAprsTypeItemButton');

        // 线下物理可达性：标题/副标题
        if (this.elements.userPhySectionTitle) {
            this.elements.userPhySectionTitle.innerHTML = t('userPhySectionTitle');
        }
        if (this.elements.userPhySectionSubtitle) {
            this.elements.userPhySectionSubtitle.innerHTML = t('userPhySectionSubtitle');
        }

        // 用户物理可达性
        this.elements.userPhyDeviceNameItemTitle.innerHTML = t('userPhyDeviceNameItemTitle');
        this.elements.userPhyDeviceNameItemHelp.innerHTML = t('userPhyDeviceNameItemHelp');
        this.elements.userPhyDeviceNameItemButton.innerHTML = t('userPhyDeviceNameItemButton');

        this.elements.userPhyFreqItemTitle.innerHTML = t('userPhyFreqItemTitle');
        this.elements.userPhyFreqItemHelp.innerHTML = t('userPhyFreqItemHelp');
        this.elements.userPhyFreqItemButton.innerHTML = t('userPhyFreqItemButton');

        this.elements.userPhyAntItemTitle.innerHTML = t('userPhyAntItemTitle');
        this.elements.userPhyAntItemHelp.innerHTML = t('userPhyAntItemHelp');
        this.elements.userPhyAntItemButton.innerHTML = t('userPhyAntItemButton');

        this.elements.userPhyAntHeightItemTitle.innerHTML = t('userPhyAntHeightItemTitle');
        this.elements.userPhyAntHeightItemHelp.innerHTML = t('userPhyAntHeightItemHelp');
        this.elements.userPhyAntHeightItemButton.innerHTML = t('userPhyAntHeightItemButton');

        // QSO 信息区块文案
        if (this.elements.qsoSectionTitle) {
            this.elements.qsoSectionTitle.innerHTML = t('qsoSectionTitle');
        }
        if (this.elements.qsoSectionSubtitle) {
            this.elements.qsoSectionSubtitle.innerHTML = t('qsoSectionSubtitle');
        }
        if (this.elements.qsoBlessItemTitle) {
            this.elements.qsoBlessItemTitle.innerHTML = t('qsoBlessItemTitle');
        }
        if (this.elements.qsoBlessItemHelp) {
            this.elements.qsoBlessItemHelp.innerHTML = t('qsoBlessItemHelp');
        }
        if (this.elements.qsoBlessItemButton) {
            this.elements.qsoBlessItemButton.innerHTML = t('qsoBlessItemButton');
        }

        // 坐标设置区块文案
        if (this.elements.coordinateSectionTitle) {
            this.elements.coordinateSectionTitle.innerHTML = t('coordinateSectionTitle');
        }
        if (this.elements.coordinateSectionSubtitle) {
            this.elements.coordinateSectionSubtitle.innerHTML = t('coordinateSectionSubtitle');
        }
        if (this.elements.coordinatePreciseItemTitle) {
            this.elements.coordinatePreciseItemTitle.innerHTML = t('coordinatePreciseItemTitle');
        }
        if (this.elements.coordinatePreciseItemHelp) {
            this.elements.coordinatePreciseItemHelp.innerHTML = t('coordinatePreciseItemHelp');
        }
        if (this.elements.coordinateLatItemInput) {
            this.elements.coordinateLatItemInput.placeholder = t('coordinateLatPlaceholder');
        }
        if (this.elements.coordinateLonItemInput) {
            this.elements.coordinateLonItemInput.placeholder = t('coordinateLonPlaceholder');
        }
        if (this.elements.coordinatePreciseItemButton) {
            this.elements.coordinatePreciseItemButton.innerHTML = t('coordinatePreciseItemButton');
        }
    }

    bindItemButton() {
        this.elements.serverItemButton.addEventListener('click', () => {
            this.configService.setServiceUrl((this.elements.serverItemInput.value || '').trim());
        });
        this.elements.portItemButton.addEventListener('click', () => {
            this.configService.setServicePort(this.elements.portItemInput.value);
        });
        this.elements.passcodeItemButton.addEventListener('click', () => {
            this.configService.setPasscode((this.elements.passcodeItemInput.value || '').trim());
        });
        this.elements.aprsRemarkItemButton.addEventListener('click', () => {
            this.configService.setAprsRemark((this.elements.aprsRemarkItemInput.value || '').trim());
        });
        this.elements.aprsRemarkItemButton.addEventListener('click', () => {
            this.configService.setAprsRemark((this.elements.aprsRemarkItemInput.value || '').trim());
        });

        this.elements.serverNameItemButton.addEventListener('click', () => {
            const v = (this.elements.serverNameItemInput.value || '').trim();
            this.configService.setServerName(v);
            console.log('setServerName', v);
        });
        this.elements.blacklistItemButton.addEventListener('click', () => {
            const v = (this.elements.blacklistItemInput.value || '').trim();
            this.configService.setBlacklist(v);
            console.log('setBlacklist', v);
        });

        this.elements.serverLoginAnnouncementItemButton.addEventListener('click', () => {
            const v = (this.elements.serverLoginAnnouncementItemInput.value || '').trim();
            this.configService.setServerLoginAnnouncement(v);
            console.log('setServerLoginAnnouncement', v);
        });
        this.elements.serverFilterItemButton.addEventListener('click', () => {
            const v = parseInt(this.elements.serverFilterSelect.value, 10);
            this.configService.setServerFilter(v);
            console.log('setServerFilter', v);
        });
        this.elements.broadcastServerItemButton.addEventListener('click', () => {
            this.configService.setBroadcastServer();
            console.log('Trigger BroadcastServer');
        });
        this.elements.broadcastUserItemButton.addEventListener('click', () => {
            this.configService.setBroadcastUser();
            console.log('Trigger BroadcastUser');
        });
        this.elements.aprsTypeItemButton.addEventListener('click', () => {
            const selectedAprsType = this.elements.aprsTypeSelect.value;
            this.configService.setAprsType(selectedAprsType);
        });

        this.elements.restartAprsItemButton.addEventListener('click', () => {
            this.configService.restartAprsService();
            console.log('Trigger Restart APRS Service');
        });
        // 紧急模式按钮
        if (this.elements.emergencyModeItemButton) {
            this.elements.emergencyModeItemButton.addEventListener('click', () => {
                this._toggleEmergencyMode();
            });
        }

        // QSO 祝福设置按钮（第一阶段仅更新UI占位，不调用后端）
        if (this.elements.qsoBlessItemButton) {
            this.elements.qsoBlessItemButton.addEventListener('click', () => {
                const v = (this.elements.qsoBlessItemInput.value || '').trim();
                // 输入校验与忙碌状态提示
                if (typeof this.configService.qsoBestWishValid === 'function' && !this.configService.qsoBestWishValid(v)) {
                    console.warn('QSO祝福输入无效或超长:', v);
                    this.elements.qsoBlessItemButton.innerHTML = t('qsoBlessItemButtonFail');
                    setTimeout(() => { this.elements.qsoBlessItemButton.innerHTML = t('qsoBlessItemButton'); }, 2000);
                    return;
                }
                if (typeof this.configService.isBusy === 'function' && this.configService.isBusy()) {
                    console.warn('设备繁忙，稍后重试');
                    this.elements.qsoBlessItemButton.innerHTML = t('qsoBlessItemButton');
                    return;
                }
                console.log('setQsoBestWish click:', v);
                this.configService.setQsoBestWish(v);
            });
        }

        // 精确坐标输入
        if (this.elements.coordinatePreciseItemButton) {
            this.elements.coordinatePreciseItemButton.addEventListener('click', () => {
                const latRaw = (this.elements.coordinateLatItemInput?.value || '').trim();
                const lonRaw = (this.elements.coordinateLonItemInput?.value || '').trim();

                // 必须是合法数字（允许小数），且不能为空
                const validNumPattern = /^-?\d+(?:\.\d+)?$/;
                if (!validNumPattern.test(latRaw) || !validNumPattern.test(lonRaw)) {
                    this.elements.coordinatePreciseItemButton.innerHTML = t('coordinatePreciseItemButtonFail');
                    setTimeout(() => { this.elements.coordinatePreciseItemButton.innerHTML = t('coordinatePreciseItemButton'); }, 2000);
                    return;
                }

                const lat = parseFloat(latRaw);
                const lon = parseFloat(lonRaw);
                if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                    this.elements.coordinatePreciseItemButton.innerHTML = t('coordinatePreciseItemButtonFail');
                    setTimeout(() => { this.elements.coordinatePreciseItemButton.innerHTML = t('coordinatePreciseItemButton'); }, 2000);
                    return;
                }
                if (typeof this.configService.isBusy === 'function' && this.configService.isBusy()) {
                    return;
                }
                this.configService.setCordinate(lat, lon);
            });
        }

        // 用户物理可达性按钮
        this.elements.userPhyDeviceNameItemButton.addEventListener('click', () => {
            this.configService.setUserPhyDeviceName((this.elements.userPhyDeviceNameItemInput.value || '').trim());
        });
        this.elements.userPhyFreqItemButton.addEventListener('click', () => {
            const raw = (this.elements.userPhyFreqItemInput.value || '').trim();
            // 仅允许完整的数字或小数（可含前导0），不允许多个数值或非法字符
            const validNumPattern = /^\d+(?:\.\d{1,4})?$/;
            if (!validNumPattern.test(raw)) {
                console.warn('Invalid frequency input:', raw);
                this.elements.userPhyFreqItemButton.innerHTML = t('userPhyFreqItemButtonFail');
                setTimeout(() => { this.elements.userPhyFreqItemButton.innerHTML = t('userPhyFreqItemButton'); }, 2000);
                return;
            }
            const v = parseFloat(raw);
            this.configService.setUserPhyFreq(v);
        });
        this.elements.userPhyAntItemButton.addEventListener('click', () => {
            this.configService.setUserPhyAnt((this.elements.userPhyAntItemInput.value || '').trim());
        });
        this.elements.userPhyAntHeightItemButton.addEventListener('click', () => {
            const raw = (this.elements.userPhyAntHeightItemInput.value || '').trim();
            // 必须是非负整数，禁止带符号和小数
            const validIntPattern = /^\d+$/;
            if (!validIntPattern.test(raw)) {
                console.warn('Invalid antenna height input:', raw);
                this.elements.userPhyAntHeightItemButton.innerHTML = t('userPhyAntHeightItemButtonFail');
                setTimeout(() => { this.elements.userPhyAntHeightItemButton.innerHTML = t('userPhyAntHeightItemButton'); }, 2000);
                return;
            }
            const v = parseInt(raw, 10);
            this.configService.setUserPhyAntHeight(v);
        });
    }

    bindReport() {
        this.configService.subscribe('onDeviceStatusChange', (data) => { this.onDeviceStatusChange(data) });
        this.configService.subscribe('setUrl', (data) => { this.onSetServiceUrl(data) });
        this.configService.subscribe('getUrl', (data) => { this.onGetServiceUrl(data.url) });
        this.configService.subscribe('setPort', (data) => { this.onSetPort(data) });
        this.configService.subscribe('getPort', (data) => { this.onGetPort(data.port) });
        this.configService.subscribe('setPasscode', (data) => { this.onSetPasscode(data) });
        this.configService.subscribe('getPasscode', (data) => { this.onGetPasscode(data.passcode) });
        this.configService.subscribe('setAprsRemark', (data) => { this.onSetAprsRemark(data) });
        this.configService.subscribe('getAprsRemark', (data) => { this.onGetAprsRemark(data.remark) });
        this.configService.subscribe('setServerName', (data) => { this.onSetServerName(data) });
        this.configService.subscribe('getServerName', (data) => { this.onGetServerName(data.serverName) });
        this.configService.subscribe('setBlacklist', (data) => { this.onSetBlacklist(data) });
        this.configService.subscribe('getBlacklist', (data) => { this.onGetBlacklist(data.blacklist) });
        this.configService.subscribe('setServerLoginAnnouncement', (data) => { this.onSetServerLoginAnnouncement(data) });
        this.configService.subscribe('getServerLoginAnnouncement', (data) => { this.onGetServerLoginAnnouncement(data.serverLoginAnnouncement) });
        this.configService.subscribe('setBroadcastServer', (data) => { this.onSetBroadcastServer(data) });
        this.configService.subscribe('setBroadcastUser', (data) => { this.onSetBroadcastUser(data) });
        this.configService.subscribe('setAprsType', (data) => { this.onSetAprsType(data) });
        this.configService.subscribe('getAprsType', (data) => { this.onGetAprsType(data.aprsType) });
        this.configService.subscribe('restartAprsService', (data) => { this.onRestartAprsService(data) });
        this.configService.subscribe('setServerFilter', (data) => { this.onSetServerFilter(data) });
        this.configService.subscribe('getServerFilter', (data) => { this.onGetServerFilter(data.serverFilter) });

        // QSO 祝福订阅
        this.configService.subscribe('setQsoBestWish', (data) => { this.onSetQsoBestWish(data) });
        this.configService.subscribe('getQsoBestWish', (data) => { this.onGetQsoBestWish(data.qsoBestWish) });

        // 用户物理可达性事件订阅
        this.configService.subscribe('setUserPhyDeviceName', (data) => { this.onSetUserPhyDeviceName(data) });
        this.configService.subscribe('getUserPhyDeviceName', (data) => { this.onGetUserPhyDeviceName(data.deviceName) });
        this.configService.subscribe('setUserPhyFreq', (data) => { this.onSetUserPhyFreq(data) });
        this.configService.subscribe('getUserPhyFreq', (data) => { this.onGetUserPhyFreq(data.freq) });
        this.configService.subscribe('setUserPhyAnt', (data) => { this.onSetUserPhyAnt(data) });
        this.configService.subscribe('getUserPhyAnt', (data) => { this.onGetUserPhyAnt(data.ant) });
        this.configService.subscribe('setUserPhyAntHeight', (data) => { this.onSetUserPhyAntHeight(data) });
        this.configService.subscribe('getUserPhyAntHeight', (data) => { this.onGetUserPhyAntHeight(data.height) });

        // 坐标设置订阅
        this.configService.subscribe('setCordinate', (data) => { this.onSetCordinate(data) });
        this.configService.subscribe('getCordinate', (data) => { this.onGetCordinate(data.latitude, data.longitude) });
    }

    onDeviceStatusChange(data) {
        if (data.status == 'connected') {
            this.elements.deviceStatus.innerHTML = t('deviceConnected');
            // 紧急模式：连接/重连时不发起参数链请求
            if (!this._isEmergencyMode()) {
                this.queueRequest(
                    this.queryServiceUrl,
                    this.queryPort,
                    this.queryPasscode,
                    this.queryAprsRemark,
                    this.queryServerName,
                    this.queryBlacklist,
                    this.queryServerLoginAnnouncement,
                    this.queryAprsType,
                    this.queryServerFilter,
                    this.queryQsoBestWish,
                    this.queryCordinate,
                    this.queryUserPhyDeviceName,
                    this.queryUserPhyFreq,
                    this.queryUserPhyAnt,
                    this.queryUserPhyAntHeight
                );
            }
        }
        else if (data.status == 'disconnected' || data.status == 'error') {

        }
    }

    queryQsoBestWish() { this.configService.getQsoBestWish(); }

    queryCordinate() { this.configService.getCordinate(); }

    queryUserPhyDeviceName() { this.configService.getUserPhyDeviceName(); }
    queryUserPhyFreq() { this.configService.getUserPhyFreq(); }
    queryUserPhyAnt() { this.configService.getUserPhyAnt(); }
    queryUserPhyAntHeight() { this.configService.getUserPhyAntHeight(); }

    queryServiceUrl() {
        console.log('queryServiceUrl');
        this.configService.getServiceUrl();
    }

    queryPort() {
        this.configService.getServicePort();
    }

    queryPasscode() {
        this.configService.getPasscode();
    }

    queryAprsRemark() {
        this.configService.getAprsRemark();
    }
    queryServerName() {
        this.configService.getServerName();
    }
    queryBlacklist() {
        this.configService.getBlacklist();
    }
    queryAprsType() {
        this.configService.getAprsType();
    }

    queryServerLoginAnnouncement() {
        this.configService.getServerLoginAnnouncement();
    }
    queryServerFilter() {
        this.configService.getServerFilter();
    }

    queueRequest(...requests) {
        this._requeue.push(...requests);
        if (!this._isProcess) {
            this._processQueue();
        }
    }



    _processQueue() {
        if (this._requeue.length == 0) {
            this._isProcess = false;
            return;
        }
        console.log('processQueue');
        this._isProcess = true;
        let request = this._requeue.shift();
        request.call(this);
    }
    //设置服务器地址
    buttonOnSetServer() {
        this.configService.setServiceUrl(this.elements.serverItemInput.value);
    }

    //设置端口
    buttonOnSetPort() {
        this.configService.setServicePort(this.elements.portItemInput.value);
    }

    //设置passcode
    buttonOnSetPasscode() {
        this.configService.setPasscode(this.elements.passcodeItemInput.value);
    }
    //回调
    onSetServiceUrl(obj) {
        if (obj.status == 'success') {
            this.elements.serverItemButton.innerHTML = t('configServerItemButtonOK');
        }
        else {
            this.elements.serverItemButton.innerHTML = t('configServerItemButtonFail');
        }
        setTimeout(() => {
            this.queryServiceUrl();
            this.elements.serverItemButton.innerHTML = t('configServerItemButton');
        }, 2000);

    }

    onGetServiceUrl(url) {
        console.log('onGetServiceUrl', url);
        this.elements.serverItemInput.value = url;
        this._processQueue();
    }

    // 用户物理可达性回调
    onSetUserPhyDeviceName(obj) {
        this.elements.userPhyDeviceNameItemButton.innerHTML = (obj.status === 'success') ? t('userPhyDeviceNameItemButtonOK') : t('userPhyDeviceNameItemButtonFail');
        setTimeout(() => {
            this.queryUserPhyDeviceName();
            this.elements.userPhyDeviceNameItemButton.innerHTML = t('userPhyDeviceNameItemButton');
        }, 2000);
    }
    onGetUserPhyDeviceName(deviceName) {
        this.elements.userPhyDeviceNameItemInput.value = deviceName;
        this._processQueue();
    }
    onSetUserPhyFreq(obj) {
        this.elements.userPhyFreqItemButton.innerHTML = (obj.status === 'success') ? t('userPhyFreqItemButtonOK') : t('userPhyFreqItemButtonFail');
        setTimeout(() => {
            this.queryUserPhyFreq();
            this.elements.userPhyFreqItemButton.innerHTML = t('userPhyFreqItemButton');
        }, 2000);
    }
    onGetUserPhyFreq(freq) {
        const val = (typeof freq === 'number') ? freq.toFixed(4) : freq;
        this.elements.userPhyFreqItemInput.value = val;
        this._processQueue();
    }
    onSetUserPhyAnt(obj) {
        this.elements.userPhyAntItemButton.innerHTML = (obj.status === 'success') ? t('userPhyAntItemButtonOK') : t('userPhyAntItemButtonFail');
        setTimeout(() => {
            this.queryUserPhyAnt();
            this.elements.userPhyAntItemButton.innerHTML = t('userPhyAntItemButton');
        }, 2000);
    }
    onGetUserPhyAnt(ant) {
        this.elements.userPhyAntItemInput.value = ant;
        this._processQueue();
    }
    onSetUserPhyAntHeight(obj) {
        this.elements.userPhyAntHeightItemButton.innerHTML = (obj.status === 'success') ? t('userPhyAntHeightItemButtonOK') : t('userPhyAntHeightItemButtonFail');
        setTimeout(() => {
            this.queryUserPhyAntHeight();
            this.elements.userPhyAntHeightItemButton.innerHTML = t('userPhyAntHeightItemButton');
        }, 2000);
    }
    onGetUserPhyAntHeight(height) {
        this.elements.userPhyAntHeightItemInput.value = height;
        this._processQueue();
    }

    // 坐标设置回调
    onSetCordinate(obj) {
        if (!this.elements.coordinatePreciseItemButton) return;
        this.elements.coordinatePreciseItemButton.innerHTML = (obj.status === 'success') ? t('coordinatePreciseItemButtonOK') : t('coordinatePreciseItemButtonFail');
        setTimeout(() => {
            this.queryCordinate();
            this.elements.coordinatePreciseItemButton.innerHTML = t('coordinatePreciseItemButton');
        }, 2000);
    }

    onGetCordinate(latitude, longitude) {
        if (this.elements.coordinateLatItemInput) {
            this.elements.coordinateLatItemInput.value = (typeof latitude === 'number') ? latitude.toFixed(6) : (latitude ?? '');
        }
        if (this.elements.coordinateLonItemInput) {
            this.elements.coordinateLonItemInput.value = (typeof longitude === 'number') ? longitude.toFixed(6) : (longitude ?? '');
        }
        this._processQueue();
    }

    onSetPort(obj) {
        if (obj.status == 'success') {
            this.elements.portItemButton.innerHTML = t('configPortItemButtonOK');
        }
        else {
            this.elements.portItemButton.innerHTML = t('configPortItemButtonFail');
        }
        setTimeout(() => {
            this.queryPort();
            this.elements.portItemButton.innerHTML = t('configPortItemButton');
        }, 2000);
    }
    onGetPort(port) {
        this.elements.portItemInput.value = port;
        this._processQueue();
    }
    onSetPasscode(obj) {
        if (obj.status == 'success') {
            this.elements.passcodeItemButton.innerHTML = t('configPasscodeItemButtonOK');
        }
        else {
            this.elements.passcodeItemButton.innerHTML = t('configPasscodeItemButtonFail');
        }
        setTimeout(() => {
            this.queryPasscode();
            this.elements.passcodeItemButton.innerHTML = t('configPasscodeItemButton');
        }, 2000);
    }
    onGetPasscode(passcode) {
        this.elements.passcodeItemInput.value = passcode;
        this._processQueue();
    }

    onSetAprsRemark(obj) {
        if (obj.status == 'success') {
            this.elements.aprsRemarkItemButton.innerHTML = t('configAprsRemarkItemButtonOK');
        }
        else {
            this.elements.aprsRemarkItemButton.innerHTML = t('configAprsRemarkItemButtonFail');
        }
        setTimeout(() => {
            this.queryAprsRemark();
            this.elements.aprsRemarkItemButton.innerHTML = t('configAprsRemarkItemButton');
        }, 2000);
    }
    onGetAprsRemark(remark) {
        console.log("onGetAprsRemark", remark);
        this.elements.aprsRemarkItemInput.value = remark;
        this._processQueue();
    }
    onSetServerName(obj) {
        if (obj.status == 'success') {
            this.elements.serverNameItemButton.innerHTML = t('configServerNameItemButtonOK');
        }
        else {
            this.elements.serverNameItemButton.innerHTML = t('configServerNameItemButtonFail');
        }
        setTimeout(() => {
            this.queryServerName();
            this.elements.serverNameItemButton.innerHTML = t('configServerNameItemButton');
        }, 2000);
    }
    onGetServerName(serverName) {
        this.elements.serverNameItemInput.value = serverName;
        this._processQueue();
    }
    onSetBlacklist(obj) {
        if (obj.status == 'success') {
            this.elements.blacklistItemButton.innerHTML = t('configBlacklistItemButtonOK');
        }
        else {
            this.elements.blacklistItemButton.innerHTML = t('configBlacklistItemButtonFail');
        }
        setTimeout(() => {
            this.queryBlacklist();
            this.elements.blacklistItemButton.innerHTML = t('configBlacklistItemButton');
        }, 2000);
    }
    onGetBlacklist(blacklist) {
        this.elements.blacklistItemInput.value = blacklist;
        this._processQueue();
    }

    onSetBroadcastServer(obj) {
        if (obj && obj.status === 'success') {
            this.elements.broadcastServerItemButton.innerHTML = t('configBroadcastServerItemButtonOK');
        } else {
            this.elements.broadcastServerItemButton.innerHTML = t('configBroadcastServerItemButtonFail');
            console.error('广播服务器错误:', obj);
        }
        setTimeout(() => {
            this.elements.broadcastServerItemButton.innerHTML = t('configBroadcastServerItemButton');
        }, 2000);
    }

    onSetBroadcastUser(obj) {
        if (obj && obj.status === 'success') {
            this.elements.broadcastUserItemButton.innerHTML = t('configBroadcastUserItemButtonOK');
        } else {
            this.elements.broadcastUserItemButton.innerHTML = t('configBroadcastUserItemButtonFail');
            console.error('广播用户错误:', obj);
        }
        setTimeout(() => {
            this.elements.broadcastUserItemButton.innerHTML = t('configBroadcastUserItemButton');
        }, 2000);
    }

    onSetAprsType(obj) {
        if (obj.status == 'success') {
            this.elements.aprsTypeItemButton.innerHTML = t('configAprsTypeItemButtonOK');
        }
        else {
            this.elements.aprsTypeItemButton.innerHTML = t('configAprsTypeItemButtonFail');
        }
        setTimeout(() => {
            this.elements.aprsTypeItemButton.innerHTML = t('configAprsTypeItemButton');
        }, 2000);
    }

    onGetAprsType(aprsType) {
        // 设置下拉选择框值
        const type = parseInt(aprsType, 10) || 1;
        this.elements.aprsTypeSelect.value = type;
        this._processQueue();
    }

    onSetServerFilter(obj) {
        if (obj.status == 'success') {
            this.elements.serverFilterItemButton.innerHTML = t('configServerFilterItemButtonOK');
        }
        else {
            this.elements.serverFilterItemButton.innerHTML = t('configServerFilterItemButtonFail');
        }
        setTimeout(() => {
            this.elements.serverFilterItemButton.innerHTML = t('configServerFilterItemButton');
        }, 2000);
    }
    onGetServerFilter(serverFilter) {
        const v = parseInt(serverFilter, 10);
        if (!isNaN(v)) {
            this.elements.serverFilterSelect.value = v;
        }
        this._processQueue();
    }

    onRestartAprsService(obj) {
        if (obj && obj.status === 'success') {
            this.elements.restartAprsItemButton.innerHTML = t('configRestartAprsItemButtonOK');
        } else {
            this.elements.restartAprsItemButton.innerHTML = t('configRestartAprsItemButtonFail');
            console.error('重启APRS服务错误:', obj);
        }
        setTimeout(() => {
            this.elements.restartAprsItemButton.innerHTML = t('configRestartAprsItemButton');
        }, 2000);
    }

    onSetQsoBestWish(obj) {
        if (obj.status === 'success') {
            this.elements.qsoBlessItemButton.innerHTML = t('qsoBlessItemButtonOK');
        } else if (obj.status === 'timeout') {
            this.elements.qsoBlessItemButton.innerHTML = t('qsoBlessItemButtonFail');
        } else {
            this.elements.qsoBlessItemButton.innerHTML = t('qsoBlessItemButtonFail');
        }
        setTimeout(() => {
            this.queryQsoBestWish();
            this.elements.qsoBlessItemButton.innerHTML = t('qsoBlessItemButton');
        }, 2000);
    }
    onGetQsoBestWish(text) {
        this.elements.qsoBlessItemInput.value = text || '';
        this._processQueue();
    }

    onSetServerLoginAnnouncement(obj) {
        if (obj.status == 'success') {
            this.elements.serverLoginAnnouncementItemButton.innerHTML = t('configServerLoginAnnouncementItemButtonOK');
        }
        else {
            this.elements.serverLoginAnnouncementItemButton.innerHTML = t('configServerLoginAnnouncementItemButtonFail');
        }
        setTimeout(() => {
            this.queryServerLoginAnnouncement();
            this.elements.serverLoginAnnouncementItemButton.innerHTML = t('configServerLoginAnnouncementItemButton');
        }, 2000);
    }

    onGetServerLoginAnnouncement(serverLoginAnnouncement) {
        console.log("onGetServerLoginAnnouncement", serverLoginAnnouncement);
        this.elements.serverLoginAnnouncementItemInput.value = serverLoginAnnouncement;
        this._processQueue();
    }
};

// --- 紧急模式：状态存取与UI ---
Config.prototype._loadEmergencyMode = function () {
    try {
        const v = localStorage.getItem('emergencyMode');
        return v === '1';
    } catch (e) { return false; }
};
Config.prototype._saveEmergencyMode = function (on) {
    try { localStorage.setItem('emergencyMode', on ? '1' : '0'); } catch (e) { }
};
Config.prototype._isEmergencyMode = function () { return !!this._emergencyMode; };
Config.prototype._toggleEmergencyMode = function () {
    const prev = this._emergencyMode;
    this._emergencyMode = !this._emergencyMode;
    this._saveEmergencyMode(this._emergencyMode);
    this._refreshEmergencyButtonUI(true);
    // 启用紧急模式时刷新页面，以便快速应用并清理潜在的排队请求状态。
    // 仅在从关闭 -> 开启时执行，避免用户关闭时丢失当前编辑内容。
    if (!prev && this._emergencyMode) {
        // 给 UI toast 一点时间显示，再刷新。
        setTimeout(() => {
            try { window.location.reload(); } catch (e) { console.warn('页面刷新失败:', e); }
        }, 600);
    }
};
Config.prototype._refreshEmergencyButtonUI = function (toast) {
    const btn = this.elements.emergencyModeItemButton;
    if (!btn) return;
    if (this._isEmergencyMode()) {
        btn.classList.add('danger');
        btn.innerHTML = t('emergencyModeDisable');
        if (toast) {
            btn.innerHTML = t('emergencyModeEnabledToast');
            setTimeout(() => { btn.innerHTML = t('emergencyModeDisable'); }, 1500);
        }
    } else {
        btn.classList.remove('danger');
        btn.innerHTML = t('emergencyModeEnable');
        if (toast) {
            btn.innerHTML = t('emergencyModeDisabledToast');
            setTimeout(() => { btn.innerHTML = t('emergencyModeEnable'); }, 1500);
        }
    }
};


let instance = null;

export function getConfig() {
    if (!instance) {
        const configService = getConfigService();
        instance = new Config(configService);
    }
    return instance;
}
