import { t } from './i18n.js'

/**
 * 主页面类
 * Main Page Class
 */
class MainPage{
    constructor() {
        if (MainPage.instance) {
            return MainPage.instance;
        }
        MainPage.instance = this;
        this.elements = {
            title: document.getElementById('main-page-title'),
            wifi: document.getElementById('main-page-wifi'),
            config: document.getElementById('main-page-config'),
            remote: document.getElementById('main-page-remote'),
            qso: document.getElementById('main-page-qso'),
        };
        this.setupText();
    }
    /**
     * Setup Text Content
     * 设置文本内容
     */
    setupText()
    {
        this.elements.title.innerHTML = t('mainPageTitle');
        this.elements.wifi.innerHTML = t('mainPageWiFi');
        this.elements.config.innerHTML = t('mainPageConfig');
        if (this.elements.remote) this.elements.remote.innerHTML = t('mainPageRemote');
        if (this.elements.qso) this.elements.qso.innerHTML = t('mainPageQsoLog');
    }

};

let instance = null;
export function getMainPage() {
    if (!instance) {
        instance = new MainPage();
    }
    return instance;
}