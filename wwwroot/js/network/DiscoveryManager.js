import { EventEmitter } from '../core/EventEmitter.js';

export class DiscoveryManager extends EventEmitter {
    constructor() {
        super();
        this.services = new Map();
        this.isScanning = false;
        this.serviceType = '_http._tcp.local.'; 
        this.listEl = document.getElementById('discovered-list');
        
        document.addEventListener('deviceready', () => this.startScan(), false);
    }

    startScan() {
        if (this.isScanning) return;
        
        const performScan = () => {
            if (this.isScanning) return; 
            
            if (window.cordova && cordova.plugins && cordova.plugins.zeroconf) {
                console.log('Starting mDNS scan...');
                this.isScanning = true;
                this.services.clear();
                this.updateUI();
                
                cordova.plugins.zeroconf.watch(this.serviceType, 'local.', 
                    (result) => {
                        const { action, service } = result;
                        if (action === 'resolved') {
                            if (service.ipv4Addresses && service.ipv4Addresses.length > 0) {
                                service.ip = service.ipv4Addresses[0];
                                this.services.set(service.name, service);
                                this.updateUI();
                            }
                        } else if (action === 'removed') {
                            this.services.delete(service.name);
                            this.updateUI();
                        }
                    },
                    (err) => {
                        console.error('ZeroConf Watch Error:', err);
                        this.isScanning = false;
                    }
                );
            } else {
                console.warn('ZeroConf plugin not available');
            }
        };

        if (window.cordova && cordova.plugins && cordova.plugins.permissions) {
            const permissions = cordova.plugins.permissions;
            const nearbyPerm = 'android.permission.NEARBY_WIFI_DEVICES'; 

            permissions.checkPermission(nearbyPerm, (status) => {
                if (status.hasPermission) {
                    performScan();
                } else {
                    permissions.requestPermission(nearbyPerm, 
                        (s) => {
                            performScan();
                        },
                        (err) => {
                            console.warn('Permission request failed:', err);
                            performScan();
                        }
                    );
                }
            }, (err) => {
                console.warn('Permission check failed:', err);
                performScan();
            });
        } else {
            performScan();
        }
    }

    stopScan() {
        if (this.isScanning && window.cordova && cordova.plugins && cordova.plugins.zeroconf) {
            cordova.plugins.zeroconf.unwatch(this.serviceType, 'local.');
        }
        this.isScanning = false;
    }

    updateUI() {
        if (!this.listEl) return;
        
        if (this.services.size === 0) {
            this.listEl.style.display = 'none';
            return;
        }
        
        this.listEl.style.display = 'flex';
        this.listEl.innerHTML = '';
        
        const header = document.createElement('div');
        header.style.width = '100%';
        header.style.fontSize = '0.8rem';
        header.style.color = '#888';
        header.style.marginBottom = '5px';
        header.textContent = '发现设备 (Nearby)';
        this.listEl.appendChild(header);

        this.services.forEach(service => {
            const tag = document.createElement('div');
            tag.className = 'device-tag';
            tag.style.borderColor = 'var(--accent-magenta)';
            
            const name = service.name || service.ip;
            const ip = service.ip;
            
            tag.innerHTML = `
                <span style="color:var(--accent-magenta)">●</span> ${name} <small style="color:#666">(${ip})</small>
            `;
            
            tag.onclick = () => {
                document.getElementById('inp-host').value = ip;
                document.getElementById('btn-connect').click();
            };
            
            this.listEl.appendChild(tag);
        });
    }
}
