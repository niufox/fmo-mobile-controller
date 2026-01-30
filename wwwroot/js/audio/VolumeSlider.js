export class VolumeSlider {
    constructor(container, player) {
        this.container = container;
        this.player = player;
        this.trackWrapper = container.querySelector('#vol-track-wrapper');
        this.fill = container.querySelector('#vol-fill');
        this.text = container.querySelector('#vol-value-text');
        this.muteBtn = container.querySelector('#vol-mute-btn');
        this.localMuteBtn = container.querySelector('#local-mute-toggle');

        this.isDragging = false;
        this.value = 1.0;
        this.lastValue = 1.0;

        this.onMove = this.onMove.bind(this);
        this.onUp = this.onUp.bind(this);
        this.onTouchMove = this.onTouchMove.bind(this);
        this.onTouchEnd = this.onTouchEnd.bind(this);

        this.initEvents();
        this.updateUI(this.value);
        if (this.player.localMuteEnabled !== undefined) {
            this.updateLocalMuteUI(this.player.localMuteEnabled);
        }
    }

    updateFromEvent(e) {
        const rect = this.trackWrapper.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        let percent = (clientX - rect.left) / rect.width;
        percent = Math.max(0, Math.min(1, percent));

        const volumeValue = percent * 2.0;
        this.setVolume(volumeValue);
    }

    onMove(e) {
        if (this.isDragging) {
            this.updateFromEvent(e);
            e.preventDefault();
        }
    }

    onUp() {
        this.isDragging = false;
    }

    onTouchMove(e) {
        if (this.isDragging) {
            this.updateFromEvent(e);
            e.preventDefault();
        }
    }

    onTouchEnd() {
        this.isDragging = false;
    }

    initEvents() {
        this.trackWrapper.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.updateFromEvent(e);
            document.addEventListener('mousemove', this.onMove);
            document.addEventListener('mouseup', this.onUp);
        });

        this.trackWrapper.addEventListener('touchstart', (e) => {
            this.isDragging = true;
            this.updateFromEvent(e);
            document.addEventListener('touchmove', this.onTouchMove, { passive: false });
            document.addEventListener('touchend', this.onTouchEnd);
        });

        this.muteBtn.addEventListener('click', () => {
            if (this.value > 0) {
                this.lastValue = this.value;
                this.setVolume(0);
            } else {
                this.setVolume(this.lastValue || 1.0);
            }
            if (navigator.vibrate) navigator.vibrate(10);
        });

        if (this.localMuteBtn) {
            this.localMuteBtn.addEventListener('click', () => {
                const newState = !this.player.localMuteEnabled;
                this.player.setLocalMute(newState);
                this.updateLocalMuteUI(newState);
                if (navigator.vibrate) navigator.vibrate(10);
            });
        }
    }

    setVolume(val) {
        this.value = val;
        this.player.setVolume(val);
        this.updateUI(val);
    }

    updateUI(val) {
        const displayPercent = Math.round(val * 100);
        const fillWidth = Math.min(100, (val / 2.0) * 100);
        
        this.fill.style.width = `${fillWidth}%`;
        this.text.textContent = `${displayPercent}%`;
        
        if (val === 0) {
            this.muteBtn.style.opacity = '0.5';
            this.muteBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`;
        } else {
            this.muteBtn.style.opacity = '1';
            this.muteBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
        }
    }

    updateLocalMuteUI(enabled) {
        if (!this.localMuteBtn) return;
        if (enabled) {
            this.localMuteBtn.className = 'local-mute-toggle active';
            this.localMuteBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>';
        } else {
            this.localMuteBtn.className = 'local-mute-toggle inactive';
            this.localMuteBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
        }
    }

    destroy() {
        document.removeEventListener('mousemove', this.onMove);
        document.removeEventListener('mouseup', this.onUp);
        document.removeEventListener('touchmove', this.onTouchMove);
        document.removeEventListener('touchend', this.onTouchEnd);

        this.container = null;
        this.trackWrapper = null;
        this.fill = null;
        this.text = null;
        this.muteBtn = null;
        this.localMuteBtn = null;
    }
}
