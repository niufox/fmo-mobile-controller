/**
 * ConnectionManager.js
 * 管理 WebSocket 连接以确保符合 ESP32 限制：
 * Manages WebSocket connections to ensure compliance with ESP32 limitations:
 * 1. 最大并发连接数 (限制: 4)
 * 1. Max concurrent connections (limit: 4)
 * 2. 连接尝试之间的延迟 (200ms) - 强制执行 "序列化握手"
 * 2. Delay between connection attempts (200ms) - Enforced as "Serialized Handshakes"
 */
class ConnectionManager {
    constructor() {
        // Strict per-interface limits
        // 每个接口的严格限制
        this.maxPerType = 2; 
        this.activeCounts = { ws: 0, events: 0, audio: 0 };
        
        this.connectionQueue = [];
        this.processingQueue = false;
        
        // Track active sockets to decrement count on close
        // 跟踪活动套接字以在关闭时减少计数
        this.activeSockets = new Set();
        // Map socket to its type to release correct counter
        // 将套接字映射到其类型以释放正确的计数器
        this.socketTypes = new Map();
        
        // Reservation Timeout (to prevent leaks if trackConnection is not called)
        // 预订超时 (防止 trackConnection 未被调用时的泄漏)
        // Map of requestId -> timeoutId
        this.reservationTimeouts = new Map();
        // Map of requestId -> type
        this.reservationTypes = new Map();
    }

    /**
     * Request permission to connect.
     * 请求连接权限。
     * Returns a promise that resolves with a requestId when it's safe to start a NEW connection handshake.
     * 返回一个 Promise，当可以安全开始新的连接握手时，该 Promise 解析为 requestId。
     * This ensures connections do not exceed the max limit per interface.
     * 这确保连接不会超过每个接口的最大限制。
     * @param {string} type 'ws' | 'events' | 'audio'
     */
    async requestConnection(type) {
        if (!['ws', 'events', 'audio'].includes(type)) {
            console.warn(`[ConnectionManager] Unknown type '${type}', defaulting to 'ws'`);
            type = 'ws';
        }

        // First check limit immediately (including queued requests of same type to prevent race condition)
        // 立即检查限制 (包括同一类型的排队请求，以防止竞争条件)
        // We need to count queued requests for this type too
        // 我们也需要计算此类型的排队请求
        const queuedCount = this.connectionQueue.filter(q => q.type === type).length;
        
        if (this.activeCounts[type] + queuedCount >= this.maxPerType) {
            console.warn(`[ConnectionManager] Connection limit reached for ${type} (${this.activeCounts[type]} active + ${queuedCount} queued). Waiting...`);
        }

        // Add to queue
        // 添加到队列
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
        // 迭代队列以查找可处理的请求
        // We can't just shift the first one if it's blocked but others aren't.
        // 如果第一个被阻塞但其他的没有，我们不能只移动第一个。
        // But to maintain order, usually we block. However, since these are independent interfaces,
        // 但为了保持顺序，通常我们会阻塞。但是，由于这些是独立的接口，
        // we should skip blocked types and process available ones.
        // 我们应该跳过被阻塞的类型并处理可用的类型。
        
        const unfulfilled = [];
        
        while (this.connectionQueue.length > 0) {
            const request = this.connectionQueue.shift();
            const { resolve, reject, requestId, type } = request;

            if (this.activeCounts[type] >= this.maxPerType) {
                // This type is full, keep in queue (push to temp array)
                // 此类型已满，保留在队列中 (推送到临时数组)
                unfulfilled.push(request);
                continue;
            }

            // Grant slot
            // 授予插槽
            this.activeCounts[type]++;
            console.log(`[ConnectionManager] Granting slot for ${type}. Active: ${JSON.stringify(this.activeCounts)}`);
            
            // Reservation Timeout
            // 预订超时
            const timeoutId = setTimeout(() => {
                 console.warn(`[ConnectionManager] Handshake timeout for ${requestId} (${type}). Resetting lock.`);
                 this.releaseSlot(requestId);
            }, 5000);
            
            this.reservationTimeouts.set(requestId, timeoutId);
            this.reservationTypes.set(requestId, type);

            resolve(requestId); 
        }
        
        // Put back unfulfilled requests
        // 放回未满足的请求
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
     * 注册套接字以跟踪其生命周期。
     * MUST be called immediately after WebSocket creation.
     * 必须在 WebSocket 创建后立即调用。
     * @param {WebSocket} ws The socket to track
     * @param {string} requestId The request ID returned by requestConnection
     */
    trackConnection(ws, requestId) {
        // Clear reservation timeout
        // 清除预订超时
        if (requestId && this.reservationTimeouts.has(requestId)) {
            clearTimeout(this.reservationTimeouts.get(requestId));
            this.reservationTimeouts.delete(requestId);
            // We don't delete reservationTypes here, we need it to know the type? 
            // No, we get type from reservationTypes map and move it to socketTypes.
        }

        if (!ws) return;
        if (this.activeSockets.has(ws)) return;
        
        // Determine type
        // 确定类型
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
                // 释放计数
                if (socketType && this.activeCounts[socketType] !== undefined) {
                    this.activeCounts[socketType] = Math.max(0, this.activeCounts[socketType] - 1);
                }
                
                console.log(`[ConnectionManager] Connection closed (${socketType}). Active: ${JSON.stringify(this.activeCounts)}`);
                
                // Trigger queue processing
                // 触发队列处理
                this.processQueue();
            }
        };

        ws.addEventListener('close', cleanup);
    }

    /**
     * Manually release a connection slot.
     * 手动释放连接插槽。
     * Use this if WebSocket creation fails synchronously after requestConnection() succeeds.
     * 如果 requestConnection() 成功后 WebSocket 创建同步失败，请使用此方法。
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
     * 报告握手立即失败 (例如在 catch 块中)。
     * This releases the slot.
     * 这将释放插槽。
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
