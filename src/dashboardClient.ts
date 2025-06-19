import { DashboardSyncConfig, ReconciliationLog, SDKConfig } from './types';

// Type declarations for browser APIs
declare global {
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
    private configSubscription: EventSource | null = null;
    private pollingInterval: NodeJS.Timeout | null = null;
    private isSubscribed = false;

    constructor(config: DashboardSyncConfig) {
        this.config = this.validateAndNormalizeConfig(config);
    }

    /**
     * Validate and normalize the dashboard configuration
     */
    private validateAndNormalizeConfig(config: DashboardSyncConfig): DashboardSyncConfig {
        if (!config.endpoint) {
            throw new Error('Dashboard endpoint is required');
        }

        // Ensure endpoint doesn't end with slash
        const normalizedEndpoint = config.endpoint.replace(/\/$/, '');

        // Log the endpoint being used for debugging
        this.logInfo(`Initializing with endpoint: ${normalizedEndpoint}`);

        return {
            ...config,
            endpoint: normalizedEndpoint
        };
    }

    /**
     * Post reconciliation log to dashboard
     * Includes retry logic and graceful error handling
     */
    async postReconciliation(log: ReconciliationLog): Promise<void> {
        if (!this.config.endpoint) {
            throw new Error('Dashboard endpoint not configured');
        }

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
                        'Authorization': `Bearer ${this.config.apiKey}`,
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal,
                    mode: 'cors' // Explicitly enable CORS
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorText = await response.text().catch(() => 'Unknown error');
                    throw new Error(`Dashboard API error: ${response.status} ${response.statusText} - ${errorText}`);
                }
            } catch (error) {
                clearTimeout(timeoutId);
                if (error instanceof Error && error.name === 'AbortError') {
                    throw new Error('Request timeout - check if dashboard endpoint is reachable');
                }
                throw error;
            }
        });
    }

    /**
     * Subscribe to real-time config updates via SSE
     * Falls back to polling if subscription fails
     */
    subscribeToConfigUpdates(onUpdate: (config: SDKConfig) => void): void {
        if (this.isSubscribed) {
            return; // Already subscribed
        }

        this.isSubscribed = true;

        // Try Server-Sent Events first
        this.trySSESubscription(onUpdate)
            .catch(() => {
                // Fallback to polling
                this.startPolling(onUpdate);
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
        if (!this.config.endpoint) {
            throw new Error('Dashboard endpoint not configured');
        }

        const url = `${this.config.endpoint}/api/v1/config`;

        return await this.retryRequest(async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            try {
                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`,
                        'Accept': 'application/json'
                    },
                    signal: controller.signal,
                    mode: 'cors' // Explicitly enable CORS
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorText = await response.text().catch(() => 'Unknown error');
                    throw new Error(`Dashboard API error: ${response.status} ${response.statusText} - ${errorText}. Check endpoint: ${url}`);
                }

                const config = await response.json() as SDKConfig;
                return config;
            } catch (error) {
                clearTimeout(timeoutId);
                if (error instanceof Error && error.name === 'AbortError') {
                    throw new Error('Request timeout - check if dashboard endpoint is reachable');
                }
                throw error;
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
                        this.logInfo(`SSE config update received`);
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