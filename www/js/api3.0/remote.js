/**
 * @fileoverview Remote Page Logic
 * 远程控制页面逻辑
 */
import { t } from './i18n.js';
import { getRemoteService } from './remoteService.js';
import { AudioStreamPlayer } from './audioPlayer.js';
import { eventsService } from './eventsService.js';

/**
 * Remote Page Class
 * 远程控制页面类
 * Manages the UI for remote station control
 * 管理远程站点控制的 UI
 */
class RemotePage {
    /**
     * Constructor
     * 构造函数
     * @param {RemoteService} service
     */
    constructor(service) {
    if (RemotePage.instance) return RemotePage.instance;
    this.service = service;
    this.elements = {
      title: document.getElementById('remote-title'),
      hint: document.getElementById('remote-hint'),
      list: document.getElementById('remote-list'),
      current: document.getElementById('remote-current'),
      prevBtn: document.getElementById('remote-prev'),
      nextBtn: document.getElementById('remote-next'),
      moreBtn: document.getElementById('remote-more'),
      audioTitle: document.getElementById('audio-title'),
      audioConnect: document.getElementById('audio-connect'),
      audioDisconnect: document.getElementById('audio-disconnect'),
      audioVolumeLabel: document.getElementById('audio-volume-label'),
      audioStatus: document.getElementById('audio-status'),
      audioVolume: document.getElementById('audio-volume'),
      audioFFT: document.getElementById('audio-fft'),
      audioSpeakingLabel: document.getElementById('audio-speaking-label'),
      audioSpeakingCallsign: document.getElementById('audio-speaking-callsign'),
    };
    this.state = {
      list: [],
      currentUid: 0,
    };
    this._setupText();
    this._bind();
    this._bindService();
    this._initAudioAndEvents();
  }

  /**
   * Setup Text Content
   * 设置文本内容
   */
  _setupText(){
    this.elements.title.innerHTML = t('remoteTitle');
    this.elements.hint.innerHTML = t('remoteSelectHint');
    this.elements.prevBtn.innerHTML = t('remotePrev');
    this.elements.nextBtn.innerHTML = t('remoteNext');
    this.elements.moreBtn.innerHTML = t('remoteLoadMore');
    // audio
    this.elements.audioTitle.innerHTML = t('audioTitle');
    this.elements.audioConnect.innerHTML = t('audioConnect');
    this.elements.audioDisconnect.innerHTML = t('audioDisconnect');
    this.elements.audioVolumeLabel.innerHTML = t('audioVolume');
    this.elements.audioStatus.innerHTML = t('audioNotConnected');
    if (this.elements.audioSpeakingLabel) this.elements.audioSpeakingLabel.innerHTML = t('audioSpeaking');
    if (this.elements.audioSpeakingCallsign && !this.elements.audioSpeakingCallsign.textContent) this.elements.audioSpeakingCallsign.textContent = '-';
  }

  /**
   * Bind UI Events
   * 绑定 UI 事件
   */
  _bind(){
    this.elements.prevBtn.addEventListener('click', ()=>{ this.service.prev(); });
    this.elements.nextBtn.addEventListener('click', ()=>{ this.service.next(); });
    this.elements.moreBtn.addEventListener('click', ()=>{ this._loadMore(); });
  }

  /**
   * Bind Service Events
   * 绑定服务事件
   */
  _bindService(){
    this.service.subscribe('onDeviceStatusChange', (d)=>{
      if (d.status === 'connected'){
        this.state.list = [];
        this._loadMore();
        this.service.getCurrent();
      }
    });
    this.service.subscribe('getList', (d)=>{
      if (d.status === 'success') { this.state.list = (this.state.list || []).concat(d.list || []); this._renderList(); }
    });
    this.service.subscribe('getCurrent', (d)=>{
      if (d.status === 'success') { this.state.currentUid = d.uid || 0; this._renderCurrent(d.name || ''); this._highlight(); }
    });
    this.service.subscribe('setCurrent', (res)=>{ this._pollCurrentAfterAction(); });
    this.service.subscribe('next', (res)=>{ this._pollCurrentAfterAction(); });
    this.service.subscribe('prev', (res)=>{ this._pollCurrentAfterAction(); });
  }

  /**
   * Initialize Audio and Event Services
   * 初始化音频和事件服务
   */
  _initAudioAndEvents(){
    eventsService.connect();

    const elConnect = this.elements.audioConnect;
    const elDisconnect = this.elements.audioDisconnect;
    const elVolume = this.elements.audioVolume;
    const elStatus = this.elements.audioStatus;
    const elFFT = this.elements.audioFFT;

    if (elConnect && elDisconnect && elVolume) {
      this._player = new AudioStreamPlayer();
      this._player.onStatus = (txt) => { if (elStatus) elStatus.textContent = txt; };
      if (elFFT) this._player.attachFFTCanvas?.(elFFT);

      elConnect.addEventListener('click', () => {
        this._player.connect();
        if (!this._callsignSubscribed) {
          eventsService.subscribe(this._onEventMsg);
          this._callsignSubscribed = true;
        }
      });
      elDisconnect.addEventListener('click', () => {
        this._player.disconnect();
        if (this._callsignSubscribed) {
          eventsService.unsubscribe(this._onEventMsg);
          this._callsignSubscribed = false;
        }
        setCallsign('-');
      });
      elVolume.addEventListener('input', (e) => {
        this._player.setVolume(e.target.value);
      });
    }

    const elCallsign = this.elements.audioSpeakingCallsign;
    const setCallsign = (v) => {
      if (!elCallsign) return;
      elCallsign.textContent = (v && String(v).trim()) ? String(v).trim() : '-';
    };
    setCallsign(elCallsign ? elCallsign.textContent : '-');

    this._onEventMsg = (msg) => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'qso' && msg.subType === 'callsign') {
        const isSpeaking = !!(msg?.data?.isSpeaking);
        const c = msg?.data?.callsign;
        if (isSpeaking && c) setCallsign(c);
        else setCallsign('-');
      }
    };
    this._callsignSubscribed = false;
  }

  /**
   * Load More Stations
   * 加载更多站点
   */
  _loadMore(){
    const start = this.state.list.length;
    const count = 8;
    this.service.getListRange(start, count);
  }

  /**
   * Render Current Station Info
   * 渲染当前站点信息
   * @param {string} name
   */
  _renderCurrent(name){
    this.elements.current.innerHTML = `${t('remoteCurrent')}: ${name || '-'}`;
  }

  _renderList(){
    this.elements.list.innerHTML = '';
    this.state.list.forEach(item => {
      const btn = document.createElement('button');
      btn.className = 'config-item-user-button';
      btn.setAttribute('data-uid', item.uid);
      btn.innerText = `${item.name}`;
      btn.addEventListener('click', ()=>{ this.service.setCurrent(item.uid); });
      this.elements.list.appendChild(btn);
    });
    this._highlight();
  }

  /**
   * Highlight Current Station
   * 高亮当前站点
   */
  _highlight(){
    const children = this.elements.list.querySelectorAll('button[data-uid]');
    children.forEach(b=>{
      const uid = parseInt(b.getAttribute('data-uid'),10);
      if (uid === this.state.currentUid) b.classList.add('remote-current');
      else b.classList.remove('remote-current');
    });
  }

  _pollCurrentAfterAction(maxAttempts=20, interval=300){
    const prev = this.state.currentUid || 0;
    let attempts = 0;
    const tick = () => {
      attempts++;
      if (!this.service.isBusy()) {
        this.service.getCurrent();
      }
      if (this.state.currentUid && this.state.currentUid !== prev) return;
      if (attempts < maxAttempts) {
        setTimeout(tick, interval);
      }
    };
    setTimeout(tick, interval);
  }
}

let instance = null;
export function getRemotePage(){ if(!instance){ instance = new RemotePage(getRemoteService()); } return instance; }
