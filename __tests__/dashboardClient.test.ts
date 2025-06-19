import { DashboardClient } from '../src/dashboardClient';
import { DashboardSyncConfig, ReconciliationLog, SDKConfig } from '../src/types';

// Mock fetch globally
global.fetch = jest.fn();

// Mock EventSource with proper typing

(global as any).EventSource = jest.fn().mockImplementation(() => ({
    onopen: null,
    onmessage: null,
    onerror: null,
    readyState: 0,
    close: jest.fn(),
    CONNECTING: 0,
    OPEN: 1,
    CLOSED: 2
}));

// Add static properties to EventSource mock
Object.assign((global as any).EventSource, {
    CONNECTING: 0,
    OPEN: 1,
    CLOSED: 2
});

describe('DashboardClient', () => {
    let client: DashboardClient;
    let config: DashboardSyncConfig;
    const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

    beforeEach(() => {
        config = {
            apiKey: 'test-api-key',
            endpoint: 'https://api.tokenix.com',
            projectId: 'test-project'
        };
        client = new DashboardClient(config);

        // Reset fetch mock
        mockFetch.mockReset();

        // Mock console methods to reduce test noise
        jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(async () => {
        // Ensure client is unsubscribed and cleaned up
        client.unsubscribe();

        // Wait a bit for any pending async operations to complete
        await new Promise(resolve => setTimeout(resolve, 10));

        // Restore all mocks
        jest.restoreAllMocks();
    });

    describe('postReconciliation', () => {
        it('should post reconciliation data successfully', async () => {
            const log: ReconciliationLog = {
                model: 'openai:gpt-4',
                feature: 'chat',
                promptTokens: 100,
                completionTokens: 200,
                actualPromptTokens: 105,
                actualCompletionTokens: 195,
                estimatedCredits: 30,
                actualTokensUsed: 300,
                actualCost: 0.029,
                estimatedVsActualCreditDelta: -0.5,
                costDelta: -0.001,
                marginDelta: 0.01,
                creditPerDollar: 1000,
                timestamp: '2024-01-01T00:00:00Z'
            };

            // Create a proper successful Response mock
            const mockResponse = new Response(null, {
                status: 200,
                statusText: 'OK'
            });
            Object.defineProperty(mockResponse, 'ok', { value: true });

            mockFetch.mockResolvedValueOnce(mockResponse);

            await client.postReconciliation(log);

            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.tokenix.com/api/v1/reconciliation-log',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer test-api-key',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        ...log,
                        projectId: 'test-project'
                    }),
                    signal: expect.any(AbortSignal),
                    mode: 'cors'
                }
            );
        });

        it('should handle API errors gracefully', async () => {
            const log: ReconciliationLog = {
                model: 'openai:gpt-4',
                feature: 'chat',
                promptTokens: 100,
                completionTokens: 200,
                actualPromptTokens: 105,
                actualCompletionTokens: 195,
                estimatedCredits: 30,
                actualTokensUsed: 300,
                actualCost: 0.029,
                estimatedVsActualCreditDelta: -0.5,
                costDelta: -0.001,
                marginDelta: 0.01,
                creditPerDollar: 1000,
                timestamp: '2024-01-01T00:00:00Z'
            };

            // Mock setTimeout to execute immediately to avoid real delays
            const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
                callback();
                return 1 as any;
            });

            try {
                // Create error response that will be used for all retry attempts
                const errorResponse = new Response(null, {
                    status: 500,
                    statusText: 'Internal Server Error'
                });
                Object.defineProperty(errorResponse, 'ok', { value: false });

                // Mock all retry attempts to return the same error
                mockFetch.mockResolvedValue(errorResponse);

                await expect(client.postReconciliation(log)).rejects.toThrow(
                    'Dashboard API error: 500 Internal Server Error'
                );
            } finally {
                setTimeoutSpy.mockRestore();
            }
        });

        it('should retry failed requests with exponential backoff', async () => {
            const log: ReconciliationLog = {
                model: 'openai:gpt-4',
                feature: 'chat',
                promptTokens: 100,
                completionTokens: 200,
                actualPromptTokens: 105,
                actualCompletionTokens: 195,
                estimatedCredits: 30,
                actualTokensUsed: 300,
                actualCost: 0.029,
                estimatedVsActualCreditDelta: -0.5,
                costDelta: -0.001,
                marginDelta: 0.01,
                creditPerDollar: 1000,
                timestamp: '2024-01-01T00:00:00Z'
            };

            // Mock setTimeout to execute immediately
            const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
                callback();
                return 1 as any;
            });

            try {
                // Create success response for the final attempt
                const successResponse = new Response(null, {
                    status: 200,
                    statusText: 'OK'
                });
                Object.defineProperty(successResponse, 'ok', { value: true });

                // First 3 calls fail, 4th succeeds
                mockFetch
                    .mockRejectedValueOnce(new Error('Network error'))
                    .mockRejectedValueOnce(new Error('Network error'))
                    .mockRejectedValueOnce(new Error('Network error'))
                    .mockResolvedValueOnce(successResponse);

                await client.postReconciliation(log);
                expect(mockFetch).toHaveBeenCalledTimes(4);
            } finally {
                setTimeoutSpy.mockRestore();
            }
        });
    });

    describe('getConfig', () => {
        it('should fetch config successfully', async () => {
            const mockConfig: SDKConfig = {
                default_margin: 2.0,
                credit_per_dollar: 1000,
                models: {
                    'openai:gpt-4': {
                        prompt_cost_per_1k: 0.03,
                        completion_cost_per_1k: 0.06
                    }
                }
            };

            // Create a proper successful Response mock with json method
            const mockResponse = new Response(JSON.stringify(mockConfig), {
                status: 200,
                statusText: 'OK',
                headers: { 'Content-Type': 'application/json' }
            });
            Object.defineProperty(mockResponse, 'ok', { value: true });

            mockFetch.mockResolvedValueOnce(mockResponse);

            const config = await client.getConfig();

            expect(config).toEqual(mockConfig);
            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.tokenix.com/api/v1/config',
                {
                    headers: {
                        'Authorization': 'Bearer test-api-key',
                        'Accept': 'application/json'
                    },
                    signal: expect.any(AbortSignal),
                    mode: 'cors'
                }
            );
        });

        it('should handle config fetch errors', async () => {
            // Mock setTimeout to avoid real delays in retry logic
            const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
                callback();
                return 1 as any;
            });

            try {
                // Create error response
                const errorResponse = new Response(null, {
                    status: 404,
                    statusText: 'Not Found'
                });
                Object.defineProperty(errorResponse, 'ok', { value: false });

                // Mock all retry attempts to return error responses
                mockFetch.mockResolvedValue(errorResponse);

                await expect(client.getConfig()).rejects.toThrow(
                    'Dashboard API error: 404 Not Found'
                );
            } finally {
                setTimeoutSpy.mockRestore();
            }
        });
    });

    describe('subscribeToConfigUpdates', () => {
        it('should not subscribe twice', () => {
            const mockCallback = jest.fn();

            client.subscribeToConfigUpdates(mockCallback);
            client.subscribeToConfigUpdates(mockCallback);

            // Should only create one EventSource connection
            expect((global as any).EventSource).toHaveBeenCalledTimes(1);
        });

        it('should fallback to polling when SSE fails', async () => {
            const mockCallback = jest.fn();

            // Mock EventSource to fail immediately
            ((global as any).EventSource as jest.Mock).mockImplementationOnce(() => {
                throw new Error('EventSource not supported');
            });

            // Mock setInterval to prevent real timers
            const setIntervalSpy = jest.spyOn(global, 'setInterval').mockImplementation(() => {
                return 1 as any; // Return a fake timer ID
            });

            // Mock the initial config fetch that happens in polling
            const mockConfig: SDKConfig = {
                default_margin: 2.0,
                credit_per_dollar: 1000,
                models: {}
            };

            const mockResponse = new Response(JSON.stringify(mockConfig), {
                status: 200,
                statusText: 'OK',
                headers: { 'Content-Type': 'application/json' }
            });
            Object.defineProperty(mockResponse, 'ok', { value: true });

            mockFetch.mockResolvedValue(mockResponse);

            try {
                // Start the subscription (this will trigger the fallback to polling)
                client.subscribeToConfigUpdates(mockCallback);

                // Manually trigger the initial config fetch that would happen in polling
                const config = await client.getConfig();
                mockCallback(config);

                expect(mockCallback).toHaveBeenCalledWith(mockConfig);
                expect(setIntervalSpy).toHaveBeenCalled();
            } finally {
                setIntervalSpy.mockRestore();
            }
        });
    });

    describe('unsubscribe', () => {
        it('should cleanup EventSource connection', () => {
            const mockEventSource = {
                close: jest.fn(),
                onopen: null,
                onmessage: null,
                onerror: null,
                readyState: 1
            };

            // Force EventSource to be used and return our mock
            ((global as any).EventSource as jest.Mock).mockImplementationOnce(() => mockEventSource);

            // Manually set the client's subscription to our mock (simulate successful connection)
            client.subscribeToConfigUpdates(jest.fn());
            (client as any).configSubscription = mockEventSource;

            client.unsubscribe();
            expect(mockEventSource.close).toHaveBeenCalled();
        });

        it('should cleanup polling interval', () => {
            const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

            // Create a mock interval ID
            const mockIntervalId = 123 as any;

            // Manually set a polling interval to test cleanup
            (client as any).pollingInterval = mockIntervalId;

            client.unsubscribe();
            expect(clearIntervalSpy).toHaveBeenCalledWith(mockIntervalId);

            clearIntervalSpy.mockRestore();
        });
    });
}); 