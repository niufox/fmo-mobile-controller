import { t } from './i18n.js';
import { getRemoteService } from './remoteService.js';

class RemotePage {
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
    };
    this.state = {
      list: [],
      currentUid: 0,
    };
    this._setupText();
    this._bind();
    this._bindService();
  }

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
  }

  _bind(){
    this.elements.prevBtn.addEventListener('click', ()=>{ this.service.prev(); });
    this.elements.nextBtn.addEventListener('click', ()=>{ this.service.next(); });
    this.elements.moreBtn.addEventListener('click', ()=>{ this._loadMore(); });
  }

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

  _loadMore(){
    const start = this.state.list.length;
    const count = 8;
    this.service.getListRange(start, count);
  }

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
      // 避免与正在进行的请求冲突
      if (!this.service.isBusy()) {
        this.service.getCurrent();
      }
      // 如果已经变化，则停止
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
