/**
 * @fileoverview Model Download Manager
 * Manages optimized model downloading with multi-threading, progress tracking, and caching
 */

export class ModelDownloadManager {
    constructor() {
        this.cache = new Map();
        this.activeDownloads = new Map();
        this.downloadWorkers = new Map();
        this.maxWorkers = navigator.hardwareConcurrency || 4;
        this.retryAttempts = 3;
        this.retryDelay = 1000;
    }

    /**
     * Download model with optimized strategy
     * @param {string} url Model URL
     * @param {Object} options Download options
     * @returns {Promise<ArrayBuffer>}
     */
    async downloadModel(url, options = {}) {
        const {
            useChunking = true,
            maxRetries = this.retryAttempts,
            onProgress = null,
            onSpeedUpdate = null,
            enableCache = true
        } = options;

        // Check cache first
        if (enableCache && this.cache.has(url)) {
            console.log('[ModelDownload] Loading from cache:', url);
            return this.cache.get(url);
        }

        // Check if already downloading
        if (this.activeDownloads.has(url)) {
            console.log('[ModelDownload] Returning existing download:', url);
            return this.activeDownloads.get(url);
        }

        console.log('[ModelDownload] Starting download:', url);

        // Create download promise
        const downloadPromise = this._downloadWithRetry(url, {
            useChunking,
            maxRetries,
            onProgress,
            onSpeedUpdate
        });

        // Store active download
        this.activeDownloads.set(url, downloadPromise);

        try {
            const data = await downloadPromise;

            // Cache the result
            if (enableCache) {
                this.cache.set(url, data);
                // Limit cache size
                this._trimCache();
            }

            return data;
        } catch (error) {
            console.error('[ModelDownload] Download failed:', url, error);
            throw error;
        } finally {
            // Clean up active download
            this.activeDownloads.delete(url);
        }
    }

    /**
     * Download with retry logic
     */
    async _downloadWithRetry(url, options, attempt = 1) {
        const { useChunking, maxRetries, onProgress, onSpeedUpdate } = options;

        try {
            if (useChunking && await this._supportsChunkedDownload(url)) {
                return await this._downloadWithChunks(url, onProgress, onSpeedUpdate);
            } else {
                return await this._downloadSimple(url, onProgress, onSpeedUpdate);
            }
        } catch (error) {
            if (attempt < maxRetries) {
                console.log(`[ModelDownload] Retry ${attempt}/${maxRetries} for ${url}`);
                await this._sleep(this.retryDelay * attempt);
                return await this._downloadWithRetry(url, options, attempt + 1);
            }
            throw error;
        }
    }

    /**
     * Simple download method
     */
    async _downloadSimple(url, onProgress, onSpeedUpdate) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const startTime = Date.now();

            xhr.open('GET', url, true);
            xhr.responseType = 'arraybuffer';

            let lastLoaded = 0;
            let lastTime = startTime;

            xhr.onprogress = (event) => {
                if (event.lengthComputable && onProgress) {
                    const percent = (event.loaded / event.total) * 100;
                    const currentTime = Date.now();
                    const timeDiff = (currentTime - lastTime) / 1000;
                    const loadedDiff = event.loaded - lastLoaded;

                    // Calculate download speed (bytes per second)
                    const speed = timeDiff > 0 ? loadedDiff / timeDiff : 0;

                    // Update progress
                    onProgress({
                        loaded: event.loaded,
                        total: event.total,
                        percent,
                        speed,
                        remaining: speed > 0 ? (event.total - event.loaded) / speed : null
                    });

                    lastLoaded = event.loaded;
                    lastTime = currentTime;
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200) {
                    resolve(xhr.response);
                } else {
                    reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
                }
            };

            xhr.onerror = () => reject(new Error('Network error'));
            xhr.ontimeout = () => reject(new Error('Download timeout'));

            xhr.timeout = 30000; // 30 second timeout
            xhr.send();
        });
    }

    /**
     * Chunked download for large files
     */
    async _downloadWithChunks(url, onProgress, onSpeedUpdate) {
        // First, get file size using HEAD request
        const fileSize = await this._getFileSize(url);
        const chunkSize = 1024 * 1024; // 1MB chunks
        const chunks = Math.ceil(fileSize / chunkSize);
        const chunksData = new Array(chunks);

        let totalLoaded = 0;
        const startTime = Date.now();

        // Download chunks in parallel using workers
        const chunkPromises = [];
        for (let i = 0; i < chunks; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize - 1, fileSize - 1);

            chunkPromises.push(this._downloadChunk(url, start, end, i, chunksData));
        }

        // Wait for all chunks to complete
        await Promise.all(chunkPromises);

        // Combine chunks
        const combinedArray = new Uint8Array(fileSize);
        let offset = 0;
        for (const chunk of chunksData) {
            combinedArray.set(chunk, offset);
            offset += chunk.length;
            totalLoaded += chunk.length;

            // Report progress
            if (onProgress) {
                const percent = (totalLoaded / fileSize) * 100;
                const currentTime = Date.now();
                const elapsed = (currentTime - startTime) / 1000;
                const speed = elapsed > 0 ? totalLoaded / elapsed : 0;

                onProgress({
                    loaded: totalLoaded,
                    total: fileSize,
                    percent,
                    speed,
                    remaining: speed > 0 ? (fileSize - totalLoaded) / speed : null
                });
            }
        }

        return combinedArray.buffer;
    }

    /**
     * Download a single chunk
     */
    async _downloadChunk(url, start, end, index, chunksData) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.open('GET', url, true);
            xhr.responseType = 'arraybuffer';
            xhr.setRequestHeader('Range', `bytes=${start}-${end}`);

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    chunksData[index] = new Uint8Array(xhr.response);
                    resolve();
                } else {
                    reject(new Error(`Chunk download failed: HTTP ${xhr.status}`));
                }
            };

            xhr.onerror = () => reject(new Error('Chunk download error'));
            xhr.send();
        });
    }

    /**
     * Get file size using HEAD request
     */
    async _getFileSize(url) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('HEAD', url, true);

            xhr.onload = () => {
                const contentLength = xhr.getResponseHeader('Content-Length');
                if (contentLength) {
                    resolve(parseInt(contentLength, 10));
                } else {
                    reject(new Error('Content-Length header not found'));
                }
            };

            xhr.onerror = () => reject(new Error('Failed to get file size'));
            xhr.send();
        });
    }

    /**
     * Check if server supports range requests
     */
    async _supportsChunkedDownload(url) {
        try {
            const xhr = new XMLHttpRequest();
            xhr.open('HEAD', url, true);

            return new Promise((resolve) => {
                xhr.onload = () => {
                    const acceptRanges = xhr.getResponseHeader('Accept-Ranges');
                    resolve(acceptRanges === 'bytes');
                };

                xhr.onerror = () => resolve(false);
                xhr.send();
            });
        } catch (error) {
            return false;
        }
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Remove old cache entries
     */
    _trimCache() {
        const maxCacheSize = 50 * 1024 * 1024; // 50MB limit
        let totalSize = 0;

        // Calculate total cache size
        for (const [key, data] of this.cache) {
            totalSize += data.byteLength;
        }

        // Remove oldest entries if needed
        if (totalSize > maxCacheSize) {
            const entries = Array.from(this.cache.entries());
            entries.sort((a, b) => a.timestamp - b.timestamp);

            while (totalSize > maxCacheSize * 0.8 && entries.length > 0) {
                const [key, data] = entries.shift();
                this.cache.delete(key);
                totalSize -= data.byteLength;
            }
        }
    }

    /**
     * Sleep utility
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Format bytes to human readable string
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Format seconds to human readable time
     */
    formatTime(seconds) {
        if (!seconds || seconds === Infinity) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}
