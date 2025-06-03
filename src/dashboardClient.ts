import { DashboardSyncConfig, ReconciliationLog, SDKConfig } from './types';

// Type declarations for browser APIs
declare global {
    interface CloseEvent extends Event {
        readonly code: number;
        readonly reason: string;
        readonly wasClean: boolean;
    }

    const WebSocket: {
        new(url: string, protocols?: string[], options?: any): WebSocket;
        readonly CONNECTING: number;
        readonly OPEN: number;
        readonly CLOSING: number;
        readonly CLOSED: number;
    };

    interface WebSocket extends EventTarget {
        readonly readyState: number;
        onopen: ((event: Event) => void) | null;
        onmessage: ((event: MessageEvent) => void) | null;
        onerror: ((event: Event) => void) | null;
        onclose: ((event: CloseEvent) => void) | null;
        close(): void;
    }

    const EventSource: {
        new(url: string, eventSourceInitDict?: any): EventSource;
        readonly CONNECTING: number;
        readonly OPEN: number;
        readonly CLOSED: number;
    };

    interface EventSource extends EventTarget {
        readonly readyState: number;
        onopen: ((event: Event) => void) | null;
        onmessage: ((event: MessageEvent) => void) | null;
        onerror: ((event: Event) => void) | null;
        close(): void;
    }
}

/**
 * Dashboard client for communicating with the Tokenix Dashboard API
 * Handles reconciliation log posting and real-time config subscriptions
 */
export class DashboardClient {
    private config: DashboardSyncConfig;
    private configSubscription: WebSocket | EventSource | null = null;
    private pollingInterval: NodeJS.Timeout | null = null;
    private isSubscribed = false;

    constructor(config: DashboardSyncConfig) {
        this.config = config;
    }

    /**
     * Post reconciliation log to dashboard
     * Includes retry logic and graceful error handling
     */
    async postReconciliation(log: ReconciliationLog): Promise<void> {
        const url = `${this.config.endpoint}/api/v1/reconciliation-log`;
        const payload = {
            ...log,
            projectId: log.projectId || this.config.projectId
        };

        await this.retryRequest(async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.config.apiKey}`
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`Dashboard API error: ${response.status} ${response.statusText}`);
                }
            } catch (error) {
                clearTimeout(timeoutId);
                throw error;
            }
        });
    }

    /**
     * Subscribe to real-time config updates via WebSocket/SSE
     * Falls back to polling if subscription fails
     */
    subscribeToConfigUpdates(onUpdate: (config: SDKConfig) => void): void {
        if (this.isSubscribed) {
            return; // Already subscribed
        }

        this.isSubscribed = true;

        // Try WebSocket first
        this.tryWebSocketSubscription(onUpdate)
            .catch(() => {
                // Fallback to Server-Sent Events
                this.trySSESubscription(onUpdate)
                    .catch(() => {
                        // Final fallback to polling
                        this.startPolling(onUpdate);
                    });
            });
    }

    /**
     * Unsubscribe from config updates and cleanup resources
     */
    unsubscribe(): void {
        this.isSubscribed = false;

        if (this.configSubscription) {
            if ('close' in this.configSubscription) {
                this.configSubscription.close();
            }
            this.configSubscription = null;
        }

        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    /**
     * Get current config from dashboard (used for polling fallback)
     */
    async getConfig(): Promise<SDKConfig> {
        const url = `${this.config.endpoint}/api/v1/config`;

        return await this.retryRequest(async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            try {
                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`
                    },
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`Dashboard API error: ${response.status} ${response.statusText}`);
                }

                const config = await response.json() as SDKConfig;
                return config;
            } catch (error) {
                clearTimeout(timeoutId);
                throw error;
            }
        });
    }

    /**
     * Try WebSocket subscription for real-time updates
     */
    private async tryWebSocketSubscription(onUpdate: (config: SDKConfig) => void): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                if (typeof WebSocket === 'undefined') {
                    reject(new Error('WebSocket not available'));
                    return;
                }

                const wsUrl = this.config.endpoint.replace(/^https?/, 'wss') + '/api/v1/config/subscribe';
                const ws = new WebSocket(wsUrl, [], {
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`
                    }
                });

                ws.onopen = () => {
                    this.configSubscription = ws;
                    this.logInfo('WebSocket subscription established');
                    resolve();
                };

                ws.onmessage = (event: MessageEvent) => {
                    try {
                        const config = JSON.parse(event.data) as SDKConfig;
                        onUpdate(config);
                    } catch (error) {
                        this.logError('Failed to parse WebSocket config update', error);
                    }
                };

                ws.onerror = (error: Event) => {
                    this.logError('WebSocket error', error);
                    reject(new Error('WebSocket connection failed'));
                };

                ws.onclose = () => {
                    if (this.isSubscribed) {
                        this.logInfo('WebSocket connection closed, attempting to reconnect...');
                        // Attempt to reconnect after a delay
                        setTimeout(() => {
                            if (this.isSubscribed) {
                                this.tryWebSocketSubscription(onUpdate).catch(() => {
                                    this.startPolling(onUpdate);
                                });
                            }
                        }, 5000);
                    }
                };

                // Timeout for connection
                setTimeout(() => {
                    if (ws.readyState === WebSocket.CONNECTING) {
                        ws.close();
                        reject(new Error('WebSocket connection timeout'));
                    }
                }, 10000);

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Try Server-Sent Events subscription for real-time updates
     */
    private async trySSESubscription(onUpdate: (config: SDKConfig) => void): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                if (typeof EventSource === 'undefined') {
                    reject(new Error('EventSource not available'));
                    return;
                }

                const sseUrl = `${this.config.endpoint}/api/v1/config/subscribe`;
                const eventSource = new EventSource(sseUrl, {
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`
                    }
                });

                eventSource.onopen = () => {
                    this.configSubscription = eventSource;
                    this.logInfo('SSE subscription established');
                    resolve();
                };

                eventSource.onmessage = (event: MessageEvent) => {
                    try {
                        const config = JSON.parse(event.data) as SDKConfig;
                        onUpdate(config);
                    } catch (error) {
                        this.logError('Failed to parse SSE config update', error);
                    }
                };

                eventSource.onerror = (error: Event) => {
                    this.logError('SSE error', error);
                    reject(new Error('SSE connection failed'));
                };

                // Timeout for connection
                setTimeout(() => {
                    if (eventSource.readyState === EventSource.CONNECTING) {
                        eventSource.close();
                        reject(new Error('SSE connection timeout'));
                    }
                }, 10000);

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Start polling for config updates as fallback
     */
    private startPolling(onUpdate: (config: SDKConfig) => void): void {
        this.logInfo('Starting config polling fallback');

        // Poll every 30 seconds
        this.pollingInterval = setInterval(async () => {
            try {
                const config = await this.getConfig();
                onUpdate(config);
            } catch (error) {
                this.logError('Config polling failed', error);
            }
        }, 30000);

        // Initial fetch
        this.getConfig()
            .then(onUpdate)
            .catch((error) => this.logError('Initial config fetch failed', error));
    }

    /**
     * Retry logic with exponential backoff
     */
    private async retryRequest<T>(
        operation: () => Promise<T>,
        maxRetries = 3,
        baseDelay = 500
    ): Promise<T> {
        let lastError: Error;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error as Error;

                if (attempt === maxRetries) {
                    this.logError(`Request failed after ${maxRetries + 1} attempts`, lastError);
                    throw lastError;
                }

                // Exponential backoff: 500ms, 1s, 2s
                const delay = baseDelay * Math.pow(2, attempt);
                this.logInfo(`Request failed (attempt ${attempt + 1}), retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw lastError!;
    }

    /**
     * Log info messages (can be enhanced with proper logger)
     */
    private logInfo(message: string): void {
        console.log(`[DashboardClient] ${message}`);
    }

    /**
     * Log error messages without throwing
     */
    private logError(message: string, error?: any): void {
        console.error(`[DashboardClient] ${message}`, error);
    }
} 