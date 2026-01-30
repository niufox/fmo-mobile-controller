export class CallsignTicker {
    constructor(containerId, visualizer, qsoManager) {
        this.container = document.getElementById(containerId);
        this.visualizer = visualizer;
        this.qsoManager = qsoManager;
        this.maxItems = 8;
        this.items = [];
        
        this.animateLoop();
        
        this.updateCapacity();
        window.addEventListener('resize', () => this.updateCapacity());
    }

    updateCapacity() {
        if (!this.container) return;
        const containerHeight = this.container.clientHeight;
        const itemHeight = 50;
        const capacity = Math.floor(containerHeight / itemHeight);
        this.maxItems = Math.max(8, Math.min(30, capacity));
    }

    addCallsign(callsign) {
        if (!this.container) return; 

        const el = document.createElement('div');
        el.className = 'callsign-item breathing';
        
        const timeEl = document.createElement('div');
        timeEl.className = 'callsign-time';
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-GB', { hour12: false });
        timeEl.textContent = timeStr;

        const isLogged = this.qsoManager && this.qsoManager.hasCallsign(callsign);
        
        const starEl = document.createElement('div');
        starEl.className = isLogged ? 'star-icon solid' : 'star-icon hollow';
        starEl.innerHTML = isLogged ? '★' : '☆';

        const rowEl = document.createElement('div');
        rowEl.className = 'callsign-row';
        rowEl.style.display = 'flex';
        rowEl.style.alignItems = 'center';
        rowEl.style.justifyContent = 'center';

        const textEl = document.createElement('div');
        textEl.className = 'callsign-text';
        textEl.textContent = callsign;

        rowEl.appendChild(starEl);
        rowEl.appendChild(textEl);

        el.appendChild(timeEl);
        el.appendChild(rowEl);
        
        if (this.container.firstChild) {
            this.container.insertBefore(el, this.container.firstChild);
        } else {
            this.container.appendChild(el);
        }
        this.items.unshift(el);
        
        el.offsetHeight; 
        
        el.classList.add('active');

        if (this.items.length > this.maxItems) {
            const removed = this.items.pop();
            removed.style.maxHeight = '0';
            removed.style.padding = '0';
            removed.style.marginBottom = '0';
            removed.style.opacity = '0';
            removed.style.border = 'none';
            
            setTimeout(() => {
                if (removed.parentNode === this.container) {
                    this.container.removeChild(removed);
                }
            }, 400);
        }
    }

    animateLoop() {
        requestAnimationFrame(() => this.animateLoop());
        
        if (this.visualizer && this.items.length > 0) {
            let energy = 0;
            if (this.visualizer.getAudioEnergy) {
                energy = this.visualizer.getAudioEnergy();
            }
            
            if (this.lastEnergy === undefined) this.lastEnergy = 0;
            this.lastEnergy += (energy - this.lastEnergy) * 0.2;
            
            const level = this.lastEnergy.toFixed(3);
            
            this.items.forEach(el => {
                el.style.setProperty('--level', level);
            });
        }
    }
}
