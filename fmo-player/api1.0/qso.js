import { t } from './i18n.js';
import { getQsoService } from './qsoService.js';

function pad2(n) { return String(n).padStart(2, '0'); }
function formatLocal(tsSeconds) {
  if (!tsSeconds) return '-';
  const d = new Date(tsSeconds * 1000);
  const yy = pad2(d.getFullYear() % 100);
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  return `${yy}/${mm}/${dd} ${hh}:${mi}`;
}

class QsoPage {
  constructor(service) {
    if (QsoPage.instance) return QsoPage.instance;
    this.service = service;
    this.elements = {
      title: document.getElementById('qso-title'),
      hint: document.getElementById('qso-hint'),
      subhint: document.getElementById('qso-subhint'),
      list: document.getElementById('qso-list'),
      prevBtn: document.getElementById('qso-prev'),
      nextBtn: document.getElementById('qso-next'),
      page: document.getElementById('qso-page'),
      backup: document.getElementById('qso-backup'),
      backupRestoreTitle: document.getElementById('qso-backup-restore-title'),
      backupRestoreHelp: document.getElementById('qso-backup-restore-help'),
      restoreFile: document.getElementById('qso-restore-file'),
      restoreBtn: document.getElementById('qso-restore-btn'),
      restoreHint: document.getElementById('qso-restore-hint'),
    };

    this.state = {
      list: [],
      page: 0,
      pageSize: 20,
      selectedLogId: 0,
      pendingLogId: 0,
    };

    this.inlineDetailEl = null;
    this.inlineDetailTextarea = null;

    this._setupText();
    this._bind();
    this._bindService();
  }

  _setupText() {
    this.elements.title.innerHTML = t('qsoLogTitle');
    this.elements.hint.innerHTML = t('qsoLogHint');
    this.elements.subhint.innerHTML = t('qsoLogSubHint');
    this.elements.prevBtn.innerHTML = t('qsoLogPrev');
    this.elements.nextBtn.innerHTML = t('qsoLogNext');
    this.elements.backupRestoreTitle.innerHTML = t('qsoLogBackupRestoreTitle');
    this.elements.backupRestoreHelp.innerHTML = t('qsoLogBackupRestoreHelp');
    this.elements.backup.innerHTML = t('qsoLogBackup');
    this.elements.restoreBtn.innerHTML = t('qsoLogRestore');
    this.elements.restoreHint.innerHTML = t('qsoLogRestoreHint');
    this._renderPage();
  }

  _bind() {
    this.elements.prevBtn.addEventListener('click', () => this._goPrev());
    this.elements.nextBtn.addEventListener('click', () => this._goNext());

    const doUpload = async (file) => {
      if (!file) return;
      this.elements.restoreBtn.disabled = true;
      this.elements.restoreHint.innerText = t('qsoLogRestoreUploading');
      try {
        const fd = new FormData();
        fd.append('file', file);
        const resp = await fetch('/api/qso/restore', { method: 'POST', body: fd });
        const text = await resp.text();
        if (!resp.ok) {
          this.elements.restoreHint.innerText = `${t('qsoLogRestoreFail')}: ${text || resp.status}`;
          this.elements.restoreBtn.disabled = false;
          return;
        }
        this.elements.restoreHint.innerText = t('qsoLogRestoreOkReboot');
      } catch (e) {
        this.elements.restoreHint.innerText = `${t('qsoLogRestoreFail')}: ${String(e)}`;
        this.elements.restoreBtn.disabled = false;
      } finally {
        // allow selecting same file again
        if (this.elements.restoreFile) this.elements.restoreFile.value = '';
      }
    };

    this.elements.restoreBtn.addEventListener('click', () => {
      // click restore -> open file picker; cancel selection -> no upload
      this.elements.restoreHint.innerText = t('qsoLogRestoreHint');
      if (this.elements.restoreFile) this.elements.restoreFile.click();
    });

    this.elements.restoreFile.addEventListener('change', () => {
      const file = this.elements.restoreFile?.files?.[0];
      if (!file) return;
      doUpload(file);
    });
  }

  _bindService() {
    this.service.subscribe('onDeviceStatusChange', (d) => {
      if (d.status === 'connected') {
        this.state.list = [];
        this.state.page = 0;
        this.state.selectedLogId = 0;
        this.state.pendingLogId = 0;
        this._collapseInlineDetail();
        this._renderList();
        this._loadPage(0);
      }
    });

    this.service.subscribe('getList', (d) => {
      if (d.status === 'success') {
        this.state.list = d.list || [];
        this._renderList();
        this.state.page = d.page ?? this.state.page;
        this._renderPage();

        // 若翻到空页（比如最后一页之后），自动回退一页
        if ((this.state.list.length === 0) && this.state.page > 0) {
          this._loadPage(this.state.page - 1);
        }
      }
    });

    this.service.subscribe('getDetail', (d) => {
      if (d.status === 'success') {
        const logId = d.log?.logId ?? 0;
        if (this.state.pendingLogId && logId && logId !== this.state.pendingLogId) return;
        this._renderInlineDetail(d.log);
      }
    });
  }

  _loadPage(page) {
    this.service.getList(page, this.state.pageSize);
  }

  _goPrev() {
    const p = this.state.page || 0;
    if (p <= 0) return;
    this._loadPage(p - 1);
  }

  _goNext() {
    const p = this.state.page || 0;
    this._loadPage(p + 1);
  }

  _renderPage() {
    const p = (this.state.page || 0) + 1;
    this.elements.page.innerText = `${t('qsoLogPage')}: ${p}`;
  }

  _renderList() {
    this.elements.list.innerHTML = '';
    this.state.list.forEach(item => {
      const btn = document.createElement('button');
      btn.className = 'config-item-user-button';
      const logId = item.logId ?? item.logID ?? 0;
      btn.setAttribute('data-logid', String(logId));
      const callsign = item.toCallsign || '-';
      const grid = item.grid || '-';
      const time = formatLocal(item.timestamp);
      btn.innerText = `${callsign} ${grid} ${time}`;
      btn.addEventListener('click', () => {
        // 再次点击同一条：收起
        if (logId && logId === this.state.selectedLogId && this.inlineDetailEl) {
          this.state.selectedLogId = 0;
          this.state.pendingLogId = 0;
          this._collapseInlineDetail();
          this._highlight();
          return;
        }

        this.state.selectedLogId = logId;
        this.state.pendingLogId = logId;
        this._highlight();
        this._expandInlineDetailUnder(btn);
        this._renderInlineDetail(null);
        if (logId) this.service.getDetail(logId);
      });
      this.elements.list.appendChild(btn);

      // 若当前页切换后仍命中选中项，则把详情插回正确位置
      if (logId && logId === this.state.selectedLogId && this.inlineDetailEl) {
        this._expandInlineDetailUnder(btn);
      }
    });
    this._highlight();
  }

  _highlight() {
    const children = this.elements.list.querySelectorAll('button[data-logid]');
    children.forEach(b => {
      const id = parseInt(b.getAttribute('data-logid'), 10);
      if (id === this.state.selectedLogId) b.classList.add('remote-current');
      else b.classList.remove('remote-current');
    });
  }

  _ensureInlineDetail() {
    if (this.inlineDetailEl && this.inlineDetailTextarea) return;
    const wrap = document.createElement('div');
    wrap.className = 'qso-inline-detail';

    const ta = document.createElement('textarea');
    ta.className = 'config-item-user-textarea';
    ta.rows = 10;
    ta.readOnly = true;

    wrap.appendChild(ta);
    this.inlineDetailEl = wrap;
    this.inlineDetailTextarea = ta;
  }

  _collapseInlineDetail() {
    if (this.inlineDetailEl && this.inlineDetailEl.parentNode) {
      this.inlineDetailEl.parentNode.removeChild(this.inlineDetailEl);
    }
  }

  _expandInlineDetailUnder(btnEl) {
    this._ensureInlineDetail();
    this._collapseInlineDetail();
    // 插在按钮正下方
    if (btnEl && btnEl.parentNode) {
      btnEl.parentNode.insertBefore(this.inlineDetailEl, btnEl.nextSibling);
    }
  }

  _renderInlineDetail(log) {
    this._ensureInlineDetail();
    if (!this.inlineDetailTextarea) return;

    if (!log) {
      this.inlineDetailTextarea.value = t('qsoLogDetailLoading');
      return;
    }

    const relay = (log.relayName || '-') + (log.relayAdmin ? ` (${log.relayAdmin})` : '');
    const lines = [
      `${t('qsoLogFieldTo')}: ${log.toCallsign || '-'}`,
      `${t('qsoLogFieldTime')}: ${formatLocal(log.timestamp)}`,
      `${t('qsoLogFieldGrid')}: ${(log.fromGrid || '-') + ' <> ' + (log.toGrid || '-')}`,
      `${t('qsoLogFieldFreq')}: ${log.freqHz ? ((log.freqHz / 10000).toFixed(4) + ' MHz') : '-'}`,
      `${t('qsoLogFieldRelay')}: ${relay || '-'}`,
      '',
      `${t('qsoLogFieldComment')}:
${log.toComment || '-'}`,
    ];
    this.inlineDetailTextarea.value = lines.join('\n');
  }
}

let instance = null;
export function getQsoPage() {
  if (!instance) instance = new QsoPage(getQsoService());
  return instance;
}
