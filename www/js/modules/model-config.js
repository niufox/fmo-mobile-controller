/**
 * @fileoverview Model Configuration
 * Configuration for 3D model loading with compression and CDN support
 */

export const ModelConfig = {
    fighter: {
        // Base URL for model files
        baseUrl: 'modles/fighter/',

        // Model file paths with different quality levels
        variants: {
            high: {
                path: 'northstar_fighter_ship.glb',
                size: 1.0 * 1024 * 1024, // ~1.0MB (Draco + WebP compressed)
                quality: 'high',
                recommended: true,
                compression: 'draco',
                textureFormat: 'webp',
                textureSize: 1024
            },
            low: {
                path: 'northstar_fighter_ship_low.glb',
                size: 460 * 1024, // ~460KB (heavily compressed)
                quality: 'low',
                fallback: true,
                compression: 'draco',
                textureFormat: 'webp',
                textureSize: 512
            }
        },

        // Compression settings
        compression: {
            enabled: true,
            format: 'draco',
            quality: 0.7, // Compression quality (0.0 - 1.0)
            targetSize: 3 * 1024 * 1024 // Target size in bytes (3MB)
        },

        // CDN configuration
        cdn: {
            enabled: false, // Set to true if using CDN
            providers: [
                {
                    name: 'primary',
                    url: 'https://cdn.yourdomain.com/models/',
                    priority: 1
                },
                {
                    name: 'fallback',
                    url: 'https://backup-cdn.yourdomain.com/models/',
                    priority: 2
                }
            ]
        },

        // Cache settings
        cache: {
            enabled: true,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
            maxSize: 50 * 1024 * 1024, // 50MB
            strategy: 'lru' // Least Recently Used
        },

        // Progressive loading settings
        progressive: {
            enabled: true,
            stages: [
                {
                    name: 'skeleton',
                    loadTime: 100, // ms
                    priority: 1
                },
                {
                    name: 'geometry-low',
                    loadTime: 500, // ms
                    priority: 2
                },
                {
                    name: 'materials',
                    loadTime: 1000, // ms
                    priority: 3
                },
                {
                    name: 'geometry-high',
                    loadTime: 2000, // ms
                    priority: 4
                }
            ]
        },

        // Network optimization
        network: {
            timeout: 30000, // 30 seconds
            retryAttempts: 3,
            retryDelay: 1000, // ms
            connectionType: 'auto', // 'auto', 'slow', 'fast'
            adaptiveQuality: true
        },

        // Performance optimization
        performance: {
            preload: false, // Disable preloading for on-demand behavior
            backgroundLoad: true, // Allow background loading
            prioritize: 'interaction' // Prioritize user interaction over loading
        },

        // Quality selection strategy
        qualityStrategy: {
            adaptive: true,
            thresholds: {
                high: { minSpeed: 1024 * 1024, minLatency: 100 }, // 1MB/s, 100ms
                medium: { minSpeed: 512 * 1024, minLatency: 200 }, // 512KB/s, 200ms
                low: { minSpeed: 256 * 1024, minLatency: 500 } // 256KB/s, 500ms
            }
        }
    },

    /**
     * Get optimal model variant based on network conditions
     */
    getOptimalVariant(networkSpeed, latency) {
        const config = ModelConfig.fighter;
        const thresholds = config.qualityStrategy.thresholds;

        // Check network speed and latency
        if (networkSpeed >= thresholds.high.minSpeed && latency <= thresholds.high.minLatency) {
            return config.variants.high;
        } else if (networkSpeed >= thresholds.medium.minSpeed && latency <= thresholds.medium.minLatency) {
            return config.variants.medium;
        } else {
            return config.variants.low;
        }
    },

    /**
     * Get full model URL with CDN fallback
     */
    getModelURL(variant = 'high') {
        const config = ModelConfig.fighter;
        const modelVariant = config.variants[variant] || config.variants.high;

        if (config.cdn.enabled && config.cdn.providers.length > 0) {
            // Try CDN first
            const primaryCDN = config.cdn.providers.find(p => p.priority === 1);
            if (primaryCDN) {
                return primaryCDN.url + modelVariant.path;
            }
        }

        // Fallback to local path
        return config.baseUrl + modelVariant.path;
    },

    /**
     * Get cache settings
     */
    getCacheSettings() {
        return ModelConfig.fighter.cache;
    },

    /**
     * Check if model should be preloaded
     */
    shouldPreload(userPreference) {
        const config = ModelConfig.fighter;
        return config.performance.preload || userPreference === 'always';
    },

    /**
     * Get progressive loading stages
     */
    getProgressiveStages() {
        return ModelConfig.fighter.progressive.stages;
    },

    /**
     * Validate model configuration
     */
    validate() {
        const config = ModelConfig.fighter;
        const errors = [];

        if (!config.baseUrl) {
            errors.push('Missing baseUrl in fighter config');
        }

        if (!config.variants || Object.keys(config.variants).length === 0) {
            errors.push('No model variants defined');
        }

        if (config.compression.enabled && !config.compression.format) {
            errors.push('Compression enabled but format not specified');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
};

// Validate configuration on load
const validation = ModelConfig.validate();
if (!validation.valid) {
    console.warn('[ModelConfig] Configuration errors:', validation.errors);
}

export default ModelConfig;
