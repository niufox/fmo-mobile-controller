export class QsoManager {
    constructor(client) {
        this.client = client;
        this.modal = document.getElementById('qso-modal');
        this.listEl = document.getElementById('qso-list');
        this.mapFrame = document.getElementById('qso-map-frame');
        this.btn = document.getElementById('btn-qso');
        this.btnClose = document.getElementById('btn-qso-close');
        this.countEl = document.getElementById('qso-count-value');
        this.badge = document.getElementById('qso-badge');
        
        this.page = 0;
        this.pageSize = 20;
        this.isLoading = false;
        this.refreshTimer = null;
        this.qsos = new Set(); 

        if (this.modal) {
            this.initEvents();
        }
    }

    initEvents() {
        const openModal = () => this.show();
        if (this.btn) this.btn.addEventListener('click', openModal);
        if (this.badge) this.badge.addEventListener('click', openModal);

        this.btnClose.addEventListener('click', () => {
            this.hide();
        });
        
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.hide();
        });
        
        if (this.listEl) {
            this.listEl.addEventListener('click', (e) => {
                const item = e.target.closest('.qso-item');
                if (item) {
                    this.shrinkBadge();
 
                    const grid = item.dataset.grid;
                    if (grid && grid !== '-') {
                        this.locateGrid(grid);
                        
                        const prev = this.listEl.querySelector('.qso-item.active');
                        if (prev) prev.classList.remove('active');
                        item.classList.add('active');
                    }
                }
            });

            this.listEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    const item = e.target.closest('.qso-item');
                    if (item) item.click();
                    e.preventDefault();
                }
            });
        }

        this.client.on('qsoMessage', (msg) => {
            if (msg.subType === 'getListResponse') {
                if (msg.data.total !== undefined) {
                    this.updateCount(msg.data.total);
                } else if (msg.data.list) {
                    this.updateCount(msg.data.list.length);
                }
                this.renderList(msg.data.list || []);
            }
        });

        this.client.on('status', (connected) => {
            if (connected) {
                this.fetchData();
                this.startAutoRefresh();
            } else {
                this.stopAutoRefresh();
            }
        });
    }

    startAutoRefresh() {
        this.stopAutoRefresh();
        this.refreshTimer = setInterval(() => {
            this.fetchData();
        }, 15000);
    }

    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    updateCount(count) {
        if (this.countEl) {
            this.countEl.textContent = count;
        }
    }

    show() {
        this.modal.classList.add('show');
        this.fetchData(true);
    }

    hide() {
        this.modal.classList.remove('show');
        this.restoreBadge();
    }

    fetchData(showLoading = false) {
        if (showLoading) {
            this.listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">Loading...</div>';
        }
        this.client.getQsoList(this.page, this.pageSize);
    }

    locateGrid(grid) {
        if (this.mapFrame && this.mapFrame.contentWindow) {
            console.log('Locating grid:', grid);
            this.mapFrame.contentWindow.postMessage({
                type: 'LOCATE_GRID',
                grid: grid
            }, '*');
        }
    }

    shrinkBadge() {
        if (this.badge) {
            this.badge.style.transition = 'all 300ms ease';
            this.badge.style.transform = 'scale(0.6)';
        }
    }

    restoreBadge() {
        if (this.badge) {
            this.badge.style.transform = 'scale(1)';
        }
    }

    formatDate(ts) {
        if (!ts) return '-';
        const isSeconds = ts < 10000000000;
        const d = new Date(isSeconds ? ts * 1000 : ts);
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    hasCallsign(callsign) {
        return this.qsos.has(callsign);
    }

    renderList(list) {
        if (!list || list.length === 0) {
            this.listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #666; font-size: 0.8rem;">No logs</div>';
            return;
        }

        this.qsos = new Set(list.map(item => item.toCallsign));

        this.listEl.innerHTML = list.map((item, index) => {
            const call = item.toCallsign || 'UNKNOWN';
            const grid = item.grid || '-';
            const ts = this.formatDate(item.ts || Date.now()/1000);
            
            return `
                <div class="qso-item" data-grid="${grid}" tabindex="0" role="button" aria-label="QSO Record: ${call}, Grid: ${grid}">
                    <div class="qso-main">
                        <div class="qso-call" title="${call}">${call}</div>
                        <div class="qso-time">${ts}</div>
                    </div>
                    <div class="qso-sub">
                        <div class="qso-grid">${grid}</div>
                    </div>
                </div>
            `;
        }).join('');
    }
}
