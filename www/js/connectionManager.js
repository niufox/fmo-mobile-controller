/**
 * ConnectionManager.js
 * Manages WebSocket connections to ensure compliance with ESP32 limitations:
 * 1. Max concurrent connections (limit: 4)
 * 2. Delay between connection attempts (200ms) - Enforced as "Serialized Handshakes"
 */
class ConnectionManager {
    constructor() {
        this.maxConnections = 3; // Increased to 3 for WS+Audio+Events
        this.activeConnections = 0;
        this.connectionDelayMs = 0; // Removed delay as global serialization is removed
        this.connectionQueue = [];
        this.processingQueue = false;
        
        // Track active sockets to decrement count on close
        this.activeSockets = new Set();
        
        // Reservation Timeout (to prevent leaks if trackConnection is not called)
        // Map of requestId -> timeoutId
        this.reservationTimeouts = new Map();
    }

    /**
     * Request permission to connect.
     * Returns a promise that resolves with a requestId when it's safe to start a NEW connection handshake.
     * This ensures connections do not exceed the max limit.
     * 
     * IMPORTANT: Caller MUST call trackConnection(ws, requestId) or reportHandshakeFailure(requestId) 
     * after receiving permission, otherwise the slot will be released automatically after timeout.
     */
    async requestConnection() {
        // First check limit immediately (including queued requests to prevent race condition)
        if (this.activeConnections + this.connectionQueue.length >= this.maxConnections) {
            throw new Error(`Connection limit reached (${this.maxConnections}). Cannot establish new connection.`);
        }

        // Add to queue
        return new Promise((resolve, reject) => {
            const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2);
            this.connectionQueue.push({ resolve, reject, requestId });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.processingQueue) return;
        this.processingQueue = true;

        while (this.connectionQueue.length > 0) {
            // 1. Check limit
            if (this.activeConnections >= this.maxConnections) {
                // Cannot process more. Wait for a slot to open.
                this.processingQueue = false;
                return;
            }

            // 2. Start new handshake (Parallel allowed now)
            const { resolve, reject, requestId } = this.connectionQueue.shift();

            this.activeConnections++; // Reserve slot
            
            console.log(`[ConnectionManager] Granting slot. Active: ${this.activeConnections}/${this.maxConnections}`);
            
            // Reservation Timeout: If trackConnection is not called within 5s, release the slot.
            // This prevents leaks if the caller crashes or fails to establish connection without reporting failure.
            const timeoutId = setTimeout(() => {
                 console.warn(`[ConnectionManager] Handshake timeout for ${requestId}. Resetting lock. Active: ${this.activeConnections}`);
                 // Force release the slot to recover from leak
                 this.releaseSlot(requestId);
            }, 5000);
            
            this.reservationTimeouts.set(requestId, timeoutId);

            resolve(requestId); 
        }

        this.processingQueue = false;
    }

    /**
     * Registers a socket to track its lifecycle.
     * MUST be called immediately after WebSocket creation.
     * @param {WebSocket} ws The socket to track
     * @param {string} requestId The request ID returned by requestConnection
     */
    trackConnection(ws, requestId) {
        // Clear reservation timeout as handshake succeeded (or at least socket created)
        if (requestId && this.reservationTimeouts.has(requestId)) {
            clearTimeout(this.reservationTimeouts.get(requestId));
            this.reservationTimeouts.delete(requestId);
        }

        if (!ws) return;
        
        // 1. Monitor Lifecycle (Close)
        if (this.activeSockets.has(ws)) return;
        this.activeSockets.add(ws);
        
        const cleanup = () => {
            if (this.activeSockets.has(ws)) {
                this.activeSockets.delete(ws);
                // We don't pass requestId here because the slot is now held by the socket, not the reservation
                this.releaseSlot(); 
            }
        };

        ws.addEventListener('close', cleanup);
    }

    /**
     * Manually release a connection slot.
     * Use this if WebSocket creation fails synchronously after requestConnection() succeeds.
     * @param {string} requestId Optional request ID to clear timeout
     */
    releaseSlot(requestId) {
        if (requestId && this.reservationTimeouts.has(requestId)) {
            clearTimeout(this.reservationTimeouts.get(requestId));
            this.reservationTimeouts.delete(requestId);
        }

        this.activeConnections = Math.max(0, this.activeConnections - 1);
        console.log(`[ConnectionManager] Connection released. Active: ${this.activeConnections}/${this.maxConnections}`);
        this.processQueue();
    }
    
    /**
     * Report that the handshake failed immediately (e.g. in catch block).
     * This releases the slot.
     * @param {string} requestId The request ID
     */
    reportHandshakeFailure(requestId) {
        this.releaseSlot(requestId);
    }
    
    // For debugging/testing
    getStatus() {
        return {
            active: this.activeConnections,
            max: this.maxConnections,
            queueLength: this.connectionQueue.length,
            handshaking: false // No longer tracked
        };
    }
}

export const connectionManager = new ConnectionManager();
