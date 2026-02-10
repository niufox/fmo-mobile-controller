/**
 * QSO Map Logic
 */

let map = null;
let currentQsos = [];
let currentGridLayer = null;
let qsoMarkersLayer = null;
let qsoRectanglesLayer = null;
let highlightedMarker = null;
let gridLocationCache = new Map();

// 网格解码算法 (6字符标准)
function maidenheadDecode(grid) {
    if (!grid || grid.length < 4 || grid.length > 6) return null;

    grid = grid.toUpperCase();

    // 第一级: 场 (Field) - 20°×10°
    const lonIdx = grid.charCodeAt(0) - 'A'.charCodeAt(0);
    const latIdx = grid.charCodeAt(1) - 'A'.charCodeAt(0);

    if (lonIdx < 0 || lonIdx > 17 || latIdx < 0 || latIdx > 17) return null;

    let lon = -180 + lonIdx * 20;
    let lat = -90 + latIdx * 10;
    let lonSize = 20;
    let latSize = 10;

    // 第二级: 方 (Square) - 2°×1°
    if (grid.length >= 4) {
        const lonNum = parseInt(grid[2]);
        const latNum = parseInt(grid[3]);

        if (isNaN(lonNum) || isNaN(latNum)) return null;

        lon += lonNum * 2;
        lat += latNum * 1;
        lonSize = 2;
        latSize = 1;
    }

    // 第三级: 块 (Subsquare) - 5'×2.5'
    if (grid.length >= 6) {
        const lonSub = grid.charCodeAt(4) - 'A'.charCodeAt(0);
        const latSub = grid.charCodeAt(5) - 'A'.charCodeAt(0);

        if (lonSub < 0 || lonSub > 23 || latSub < 0 || latSub > 23) return null;

        lon += lonSub * (2/24);
        lat += latSub * (1/24);
        lonSize = 2/24;
        latSize = 1/24;
    }

    return {
        grid: grid,
        bounds: [[lat, lon], [lat + latSize, lon + lonSize]],
        center: [lat + latSize/2, lon + lonSize/2],
        precision: grid.length === 6 ? 'high' : (grid.length === 4 ? 'medium' : 'low')
    };
}

async function resolveLocationName(lat, lon) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=12&addressdetails=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.address) return data?.display_name || null;
    const addr = data.address;
    const parts = [
        addr.state || addr.region,
        addr.city || addr.county || addr.state_district,
        addr.town || addr.village || addr.suburb,
        addr.road || addr.neighbourhood || addr.hamlet
    ].filter(Boolean);
    return parts.length > 0 ? parts.join('') : (data.display_name || null);
}

// 初始化地图
function initMap() {
    try {
        console.log('Initializing Leaflet map...');

        map = L.map('map', {
            center: [36.08, 103.67],
            zoom: 4,
            zoomControl: false
        });

        L.control.zoom({ position: 'bottomright' }).addTo(map);

        const baseLayers = {
            "高德地图 (暗黑)": L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
                subdomains: ["1", "2", "3", "4"],
                attribution: '© 高德地图'
            }),
            "GeoQ 灰色": L.tileLayer('https://map.geoq.cn/ArcGIS/rest/services/ChinaOnlineCommunity/MapServer/tile/{z}/{y}/{x}', {
                attribution: '© GeoQ 智图'
            }),
            "GeoQ 深蓝": L.tileLayer('https://map.geoq.cn/ArcGIS/rest/services/ChinaOnlineStreetPurplishBlue/MapServer/tile/{z}/{y}/{x}', {
                attribution: '© GeoQ 智图'
            })
        };

        const defaultLayer = baseLayers["高德地图 (暗黑)"];
        defaultLayer.addTo(map);

        // 应用深色滤镜
        document.getElementById('map').classList.add('map-dark-mode');

        L.control.layers(baseLayers).addTo(map);

        qsoMarkersLayer = L.layerGroup().addTo(map);
        qsoRectanglesLayer = L.layerGroup().addTo(map);

        const loadingEl = document.getElementById('loading');
        if (loadingEl) loadingEl.style.display = 'none';

        console.log('Leaflet map initialized');

        window.addEventListener('message', function(event) {
            const msg = event.data;
            // console.log('Received message:', msg);
            if (msg && msg.type === 'LOCATE_GRID' && msg.grid) {
                // console.log('Received LOCATE_GRID:', msg.grid);
                locateGrid(msg.grid);
            } else if (msg && msg.type === 'DISPLAY_ALL_QSOS' && msg.grids) {
                // console.log('Received DISPLAY_ALL_QSOS:', msg.grids);
                displayAllQsos(msg.grids);
            } else if (msg && msg.type === 'HIGHLIGHT_QSO' && msg.grid) {
                // console.log('Received HIGHLIGHT_QSO:', msg.grid, msg.callsign);
                highlightQso(msg.grid, msg.callsign);
            }
        });

    } catch (error) {
        console.error('Failed to initialize Leaflet:', error);
        console.error('Error stack:', error.stack);
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.textContent = '初始化失败: ' + error.message;
            loadingEl.style.color = '#ff6b6b';
        }
    }
}

// 定位到网格
function locateGrid(grid) {
    const data = maidenheadDecode(grid);
    if (!data) {
        console.warn('Failed to decode grid:', grid);
        return;
    }

    console.log('Locating grid:', data);

    // 清除之前的标记
    if (currentGridLayer) map.removeLayer(currentGridLayer);
    qsoMarkersLayer.clearLayers();
    qsoRectanglesLayer.clearLayers();
    highlightedMarker = null;

    const popupContent = `
        <div style="min-width:120px">
            <div style="font-size:16px; font-weight:bold; color:#4dabf7; margin-bottom:5px; border-bottom:1px solid rgba(255,255,255,0.2); padding-bottom:3px;">
                ${data.grid}
            </div>
        </div>
    `;

    // 绘制网格边界
    currentGridLayer = L.rectangle(data.bounds, {
        color: '#d32f2f',
        weight: 3,
        fillColor: '#d32f2f',
        fillOpacity: 0.15,
        dashArray: '5, 5'
    }).addTo(map);

    // 标记中心点
    const marker = L.circleMarker(data.center, {
        radius: 10,
        fillColor: '#d32f2f',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 1
    }).addTo(map);

    marker.bindPopup(popupContent);

    // 设置视图中心并缩放
    map.fitBounds(data.bounds, { padding: [50, 50], maxZoom: 12 });

    // 自动打开弹出窗口
    setTimeout(() => {
        marker.openPopup();
    }, 500);
    resolveLocationText(grid, data.center);
}

async function resolveLocationText(grid, center) {
    if (!grid || !center) return;
    if (gridLocationCache.has(grid)) {
        window.parent.postMessage({
            type: 'LOCATION_TEXT',
            grid: grid,
            text: gridLocationCache.get(grid)
        }, '*');
        return;
    }
    try {
        const text = await resolveLocationName(center[0], center[1]);
        const finalText = text || `网格 ${grid}`;
        gridLocationCache.set(grid, finalText);
        window.parent.postMessage({
            type: 'LOCATION_TEXT',
            grid: grid,
            text: finalText
        }, '*');
    } catch (e) {
        window.parent.postMessage({
            type: 'LOCATION_TEXT',
            grid: grid,
            text: `网格 ${grid}`
        }, '*');
    }
}

// 显示所有QSO
function displayAllQsos(qsos) {
    // console.log('Displaying QSOs on map:', qsos);
    currentQsos = qsos;

    // 清除之前的标记
    if (currentGridLayer) map.removeLayer(currentGridLayer);
    qsoMarkersLayer.clearLayers();
    qsoRectanglesLayer.clearLayers();
    highlightedMarker = null;

    if (!qsos || qsos.length === 0) {
        const gridEl = document.getElementById('currentGrid');
        if (gridEl) gridEl.textContent = '0';
        return;
    }

    console.log('Processing QSOs:', qsos.length);

    // 计算当日通联统计
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayQsos = qsos.filter(qso => {
        const ts = qso.timestamp;
        if (!ts) return false;
        const isSeconds = ts < 10000000000;
        const qsoDate = new Date(isSeconds ? ts * 1000 : ts);
        return qsoDate >= today;
    });

    const todayCallsigns = new Set(todayQsos.map(qso => qso.callsign));
    const todayCount = todayCallsigns.size;
    const todayQsoCount = todayQsos.length;

    const gridEl = document.getElementById('currentGrid');
    if (gridEl) gridEl.textContent = `${todayCount}人 (${todayQsoCount}次)`;

    const bounds = [];

    qsos.forEach(qso => {
        const data = maidenheadDecode(qso.grid);
        if (!data) {
            // console.warn('Failed to decode grid:', qso.grid);
            return;
        }

        const popupContent = `
            <div style="min-width:120px">
                <div style="font-size:16px; font-weight:bold; color:#4dabf7; margin-bottom:5px; border-bottom:1px solid rgba(255,255,255,0.2); padding-bottom:3px;">
                    ${qso.callsign}
                </div>
                <div style="font-size:12px; color:#e0e0e0; margin-bottom:3px;">
                    <strong>Grid:</strong> ${qso.grid}
                </div>
            </div>
        `;

        const marker = L.circleMarker(data.center, {
            radius: 6,
            fillColor: '#4dabf7',
            color: '#fff',
            weight: 2,
            opacity: 0.9,
            fillOpacity: 0.8
        });

        marker.bindPopup(popupContent);

        // 创建网格矩形
        const rectangle = L.rectangle(data.bounds, {
            color: '#4dabf7',
            weight: 1,
            fillColor: '#4dabf7',
            fillOpacity: 0.05
        });

        rectangle.qsoData = { grid: qso.grid, callsign: qso.callsign };
        marker.qsoData = { grid: qso.grid, callsign: qso.callsign };

        qsoRectanglesLayer.addLayer(rectangle);
        qsoMarkersLayer.addLayer(marker);
        bounds.push(data.center);
    });

    // console.log(`Total markers: ${bounds.length}`);

    if (bounds.length > 0) {
        map.fitBounds(L.latLngBounds(bounds), {
            padding: [50, 50],
            maxZoom: 8
        });
    }
}

// 高亮特定QSO
function highlightQso(grid, callsign) {
    console.log('Highlighting QSO:', grid, callsign);

    qsoMarkersLayer.eachLayer(layer => {
        if (layer.qsoData && layer.qsoData.grid === grid && layer.qsoData.callsign === callsign) {
            layer.setStyle({
                radius: 10,
                fillColor: '#ff6b6b',
                color: '#fff',
                weight: 3,
                opacity: 1,
                fillOpacity: 1
            });

            layer.openPopup();

            const center = layer.getLatLng();
            map.setView(center, 10);
            highlightedMarker = layer;
        } else {
            layer.setStyle({
                radius: 6,
                fillColor: '#4dabf7',
                color: '#fff',
                weight: 2,
                opacity: 0.9,
                fillOpacity: 0.8
            });
        }
    });

    qsoRectanglesLayer.eachLayer(rectangle => {
        if (rectangle.qsoData && rectangle.qsoData.grid === grid && rectangle.qsoData.callsign === callsign) {
            rectangle.setStyle({
                color: '#ff6b6b',
                weight: 2,
                fillColor: '#ff6b6b',
                fillOpacity: 0.15
            });
        } else {
            rectangle.setStyle({
                color: '#4dabf7',
                weight: 1,
                fillColor: '#4dabf7',
                fillOpacity: 0.05
            });
        }
    });
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing map...');
    initMap();
});
