export class DeviceManager {
    constructor() {
        this.devices = [];
        this.storageKey = 'fmo_saved_devices';
        this.load();
    }

    load() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            this.devices = saved ? JSON.parse(saved) : [];
        } catch (e) {
            this.devices = [];
        }
    }

    save() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.devices));
        this.render();
    }

    add(ip) {
        if (!ip) return;
        this.devices = this.devices.filter(d => d !== ip);
        this.devices.unshift(ip);
        if (this.devices.length > 5) this.devices.pop();
        this.save();
    }

    remove(ip, e) {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        this.devices = this.devices.filter(d => d !== ip);
        this.save();
    }

    render() {
        const container = document.getElementById('device-history');
        if (!container) return;
        container.innerHTML = '';
        
        const currentIp = document.getElementById('inp-host').value;

        this.devices.forEach(ip => {
            const tag = document.createElement('div');
            tag.className = 'device-tag';
            if (currentIp === ip) tag.classList.add('active');
            
            tag.innerHTML = `
                ${ip}
                <span class="device-del" title="删除">✕</span>
            `;
            
            tag.onclick = () => {
                document.getElementById('inp-host').value = ip;
                this.render();
                document.getElementById('btn-connect').click();
            };
            
            const delBtn = tag.querySelector('.device-del');
            delBtn.onclick = (e) => this.remove(ip, e);
            
            container.appendChild(tag);
        });
    }
}
