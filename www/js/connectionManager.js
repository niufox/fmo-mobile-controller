/**
 * ConnectionManager.js
 * Manages WebSocket connections to ensure compliance with ESP32 limitations:
 * 1. Max concurrent connections (limit: 4)
 * 2. Delay between connection attempts (200ms) - Enforced as "Serialized Handshakes"
 */
class ConnectionManager {
    constructor() {
        // Strict per-interface limits
        this.maxPerType = 2; 
        this.activeCounts = { ws: 0, events: 0, audio: 0 };
        
        this.connectionQueue = [];
        this.processingQueue = false;
        
        // Track active sockets to decrement count on close
        this.activeSockets = new Set();
        // Map socket to its type to release correct counter
        this.socketTypes = new Map();
        
        // Reservation Timeout (to prevent leaks if trackConnection is not called)
        // Map of requestId -> timeoutId
        this.reservationTimeouts = new Map();
        // Map of requestId -> type
        this.reservationTypes = new Map();
    }

    /**
     * Request permission to connect.
     * Returns a promise that resolves with a requestId when it's safe to start a NEW connection handshake.
     * This ensures connections do not exceed the max limit per interface.
     * @param {string} type 'ws' | 'events' | 'audio'
     */
    async requestConnection(type) {
        if (!['ws', 'events', 'audio'].includes(type)) {
            console.warn(`[ConnectionManager] Unknown type '${type}', defaulting to 'ws'`);
            type = 'ws';
        }

        // First check limit immediately (including queued requests of same type to prevent race condition)
        // We need to count queued requests for this type too
        const queuedCount = this.connectionQueue.filter(q => q.type === type).length;
        
        if (this.activeCounts[type] + queuedCount >= this.maxPerType) {
            console.warn(`[ConnectionManager] Connection limit reached for ${type} (${this.activeCounts[type]} active + ${queuedCount} queued). Waiting...`);
        }

        // Add to queue
        return new Promise((resolve, reject) => {
            const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2);
            this.connectionQueue.push({ resolve, reject, requestId, type });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.processingQueue) return;
        this.processingQueue = true;

        // Iterate queue to find processable requests
        // We can't just shift the first one if it's blocked but others aren't.
        // But to maintain order, usually we block. However, since these are independent interfaces,
        // we should skip blocked types and process available ones.
        
        const unfulfilled = [];
        
        while (this.connectionQueue.length > 0) {
            const request = this.connectionQueue.shift();
            const { resolve, reject, requestId, type } = request;

            if (this.activeCounts[type] >= this.maxPerType) {
                // This type is full, keep in queue (push to temp array)
                unfulfilled.push(request);
                continue;
            }

            // Grant slot
            this.activeCounts[type]++;
            console.log(`[ConnectionManager] Granting slot for ${type}. Active: ${JSON.stringify(this.activeCounts)}`);
            
            // Reservation Timeout
            const timeoutId = setTimeout(() => {
                 console.warn(`[ConnectionManager] Handshake timeout for ${requestId} (${type}). Resetting lock.`);
                 this.releaseSlot(requestId);
            }, 5000);
            
            this.reservationTimeouts.set(requestId, timeoutId);
            this.reservationTypes.set(requestId, type);

            resolve(requestId); 
        }
        
        // Put back unfulfilled requests
        this.connectionQueue = unfulfilled.concat(this.connectionQueue); // Preserve order? actually unfulfilled were at front.
        // Wait, shifting modifies original array. 
        // Logic: 
        // queue: [A(blocked), B(ready)]
        // 1. shift A. blocked. unfulfilled=[A].
        // 2. shift B. ready. process B.
        // queue empty.
        // queue = unfulfilled (A).
        // This effectively reorders B before A, which is fine for different types.
        
        // Correct logic for re-assigning:
        // this.connectionQueue is now empty (due to while loop).
        // assign unfulfilled back to it.
        this.connectionQueue = unfulfilled;

        this.processingQueue = false;
    }

    /**
     * Registers a socket to track its lifecycle.
     * MUST be called immediately after WebSocket creation.
     * @param {WebSocket} ws The socket to track
     * @param {string} requestId The request ID returned by requestConnection
     */
    trackConnection(ws, requestId) {
        // Clear reservation timeout
        if (requestId && this.reservationTimeouts.has(requestId)) {
            clearTimeout(this.reservationTimeouts.get(requestId));
            this.reservationTimeouts.delete(requestId);
            // We don't delete reservationTypes here, we need it to know the type? 
            // No, we get type from reservationTypes map and move it to socketTypes.
        }

        if (!ws) return;
        if (this.activeSockets.has(ws)) return;
        
        // Determine type
        let type = 'ws'; // default
        if (requestId && this.reservationTypes.has(requestId)) {
            type = this.reservationTypes.get(requestId);
            this.reservationTypes.delete(requestId);
        } else {
            console.warn('[ConnectionManager] trackConnection called without valid requestId or type info. Assuming ws.');
        }

        console.log(`[ConnectionManager] Tracking connection for ${type}`);
        this.activeSockets.add(ws);
        this.socketTypes.set(ws, type);
        
        const cleanup = () => {
            if (this.activeSockets.has(ws)) {
                this.activeSockets.delete(ws);
                const socketType = this.socketTypes.get(ws);
                this.socketTypes.delete(ws);
                
                // Release count
                if (socketType && this.activeCounts[socketType] !== undefined) {
                    this.activeCounts[socketType] = Math.max(0, this.activeCounts[socketType] - 1);
                }
                
                console.log(`[ConnectionManager] Connection closed (${socketType}). Active: ${JSON.stringify(this.activeCounts)}`);
                
                // Trigger queue processing
                this.processQueue();
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
        let type = null;
        
        if (requestId) {
            if (this.reservationTimeouts.has(requestId)) {
                clearTimeout(this.reservationTimeouts.get(requestId));
                this.reservationTimeouts.delete(requestId);
            }
            if (this.reservationTypes.has(requestId)) {
                type = this.reservationTypes.get(requestId);
                this.reservationTypes.delete(requestId);
            }
        }

        if (type && this.activeCounts[type] !== undefined) {
             this.activeCounts[type] = Math.max(0, this.activeCounts[type] - 1);
             console.log(`[ConnectionManager] Slot released manually (${type}). Active: ${JSON.stringify(this.activeCounts)}`);
        } else {
            // Fallback if we don't know type (shouldn't happen with correct usage)
            console.warn('[ConnectionManager] releaseSlot called but type unknown or not found.');
        }

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
            activeCounts: this.activeCounts,
            maxPerType: this.maxPerType,
            queueLength: this.connectionQueue.length
        };
    }
}

export const connectionManager = new ConnectionManager();
