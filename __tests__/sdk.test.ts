import { LLMCreditSDK } from '../src/sdk';
import { SDKConfig, TokenExtractor } from '../src/types';
import { openAIChatExtractor, OpenAIChatCompletionResponse } from '../src/extractors';

describe('LLMCreditSDK', () => {
    let sdk: LLMCreditSDK;

    beforeEach(() => {
        sdk = new LLMCreditSDK();
    });

    describe('Constructor and Configuration', () => {
        it('should initialize with default configuration', () => {
            const config = sdk.getConfig();
            expect(config.default_margin).toBe(1.5);
            expect(config.models).toBeDefined();
            expect(config.models['openai:gpt-4']).toBeDefined();
        });

        it('should merge custom configuration with defaults', () => {
            const customConfig: Partial<SDKConfig> = {
                default_margin: 2.0,
                models: {
                    'custom:model': {
                        prompt_cost_per_1k: 0.01,
                        completion_cost_per_1k: 0.02,
                        features: {
                            'custom_feature': { margin: 3.0 }
                        }
                    }
                }
            };

            const customSDK = new LLMCreditSDK(customConfig);
            const config = customSDK.getConfig();

            expect(config.default_margin).toBe(2.0);
            expect(config.models['custom:model']).toBeDefined();
            expect(config.models['openai:gpt-4']).toBeDefined(); // Default models should still exist
        });

        it('should merge features for existing models', () => {
            const customConfig: Partial<SDKConfig> = {
                models: {
                    'openai:gpt-4': {
                        prompt_cost_per_1k: 0.035, // Override price
                        completion_cost_per_1k: 0.065,
                        features: {
                            'custom_feature': { margin: 3.0 }
                        }
                    }
                }
            };

            const customSDK = new LLMCreditSDK(customConfig);
            const config = customSDK.getConfig();
            const gpt4Config = config.models['openai:gpt-4'];

            expect(gpt4Config.prompt_cost_per_1k).toBe(0.035);
            expect(gpt4Config.features?.chat?.margin).toBe(2.0); // Original feature should remain
            expect(gpt4Config.features?.custom_feature?.margin).toBe(3.0); // New feature should be added
        });
    });

    describe('estimateCredits', () => {
        it('should calculate credits correctly for GPT-4 chat', () => {
            const result = sdk.estimateCredits({
                model: 'openai:gpt-4',
                feature: 'chat',
                promptTokens: 150,
                completionTokens: 350
            });

            // Expected calculation:
            // Prompt: (150/1000) * 0.03 = 0.0045
            // Completion: (350/1000) * 0.06 = 0.021
            // Base cost: 0.0255
            // With 2.0 margin: 0.051
            // With 1000 credit_per_dollar: 51
            expect(result.estimatedCredits).toBe(51);
        });

        it('should use feature-specific margin when available', () => {
            const chatResult = sdk.estimateCredits({
                model: 'openai:gpt-4',
                feature: 'chat',
                promptTokens: 100,
                completionTokens: 200
            });

            const summarizeResult = sdk.estimateCredits({
                model: 'openai:gpt-4',
                feature: 'summarize',
                promptTokens: 100,
                completionTokens: 200
            });

            // Chat has 2.0 margin, summarize has 1.8 margin
            expect(chatResult.estimatedCredits).toBeGreaterThan(summarizeResult.estimatedCredits);
        });

        it('should use default margin for unknown features', () => {
            const result = sdk.estimateCredits({
                model: 'openai:gpt-4',
                feature: 'unknown_feature',
                promptTokens: 100,
                completionTokens: 200
            });

            // Should use default margin of 1.5 and credit_per_dollar of 1000
            const baseCost = (100 / 1000) * 0.03 + (200 / 1000) * 0.06;
            const expectedCredits = baseCost * 1.5 * 1000; // Include credit_per_dollar conversion
            expect(result.estimatedCredits).toBe(Number(expectedCredits.toFixed(6)));
        });

        it('should handle different models correctly', () => {
            const gpt4Result = sdk.estimateCredits({
                model: 'openai:gpt-4',
                feature: 'chat',
                promptTokens: 100,
                completionTokens: 200
            });

            const gpt35Result = sdk.estimateCredits({
                model: 'openai:gpt-3.5-turbo',
                feature: 'chat',
                promptTokens: 100,
                completionTokens: 200
            });

            // GPT-4 is more expensive than GPT-3.5-turbo
            expect(gpt4Result.estimatedCredits).toBeGreaterThan(gpt35Result.estimatedCredits);
        });

        it('should throw error for unknown model', () => {
            expect(() => {
                sdk.estimateCredits({
                    model: 'unknown:model',
                    feature: 'chat',
                    promptTokens: 100,
                    completionTokens: 200
                });
            }).toThrow('Model \'unknown:model\' not found in configuration');
        });

        it('should handle zero tokens', () => {
            const result = sdk.estimateCredits({
                model: 'openai:gpt-4',
                feature: 'chat',
                promptTokens: 0,
                completionTokens: 0
            });

            expect(result.estimatedCredits).toBe(0);
        });
    });

    describe('reconcile', () => {
        it('should reconcile estimated vs actual usage correctly', () => {
            const result = sdk.reconcile({
                model: 'openai:gpt-4',
                feature: 'chat',
                promptTokens: 150,
                completionTokens: 350,
                actualPromptTokens: 160,
                actualCompletionTokens: 340
            });

            expect(result.estimatedCredits).toBe(51); // Same as estimate (with credit_per_dollar conversion)
            expect(result.actualTokensUsed).toBe(500); // 160 + 340
            expect(result.actualCost).toBe(0.0252); // (160/1000)*0.03 + (340/1000)*0.06
            expect(result.estimatedVsActualCreditDelta).toBe(-0.6); // Actual was slightly less (in credits)
        });

        it('should show positive delta when underestimated', () => {
            const result = sdk.reconcile({
                model: 'openai:gpt-4',
                feature: 'chat',
                promptTokens: 100,
                completionTokens: 200,
                actualPromptTokens: 120,
                actualCompletionTokens: 250
            });

            expect(result.estimatedVsActualCreditDelta).toBeGreaterThan(0);
        });

        it('should show negative delta when overestimated', () => {
            const result = sdk.reconcile({
                model: 'openai:gpt-4',
                feature: 'chat',
                promptTokens: 100,
                completionTokens: 200,
                actualPromptTokens: 80,
                actualCompletionTokens: 150
            });

            expect(result.estimatedVsActualCreditDelta).toBeLessThan(0);
        });

        it('should show zero delta when estimates are perfect', () => {
            const result = sdk.reconcile({
                model: 'openai:gpt-4',
                feature: 'chat',
                promptTokens: 100,
                completionTokens: 200,
                actualPromptTokens: 100,
                actualCompletionTokens: 200
            });

            expect(result.estimatedVsActualCreditDelta).toBe(0);
        });
    });

    describe('wrapCall', () => {
        it('should wrap a call and return response with reconciliation', async () => {
            interface MockResponse {
                text: string;
                usage: {
                    prompt_tokens: number;
                    completion_tokens: number;
                };
            }

            const mockResponse: MockResponse = { text: 'Hello, world!', usage: { prompt_tokens: 105, completion_tokens: 195 } };
            const mockCallFunction = jest.fn().mockResolvedValue(mockResponse);

            const mockTokenExtractor: TokenExtractor<MockResponse> = {
                providerName: 'openai',
                extract: (response: MockResponse) => ({
                    promptTokens: response.usage.prompt_tokens,
                    completionTokens: response.usage.completion_tokens
                })
            };

            const result = await sdk.wrapCall<MockResponse>({
                model: 'openai:gpt-4',
                feature: 'chat',
                promptTokens: 100,
                completionTokens: 200,
                callFunction: mockCallFunction,
                tokenExtractor: mockTokenExtractor
            });

            expect(mockCallFunction).toHaveBeenCalledTimes(1);
            expect(result.response).toBe(mockResponse);
            expect(result.reconciliation.actualTokensUsed).toBe(300); // 105 + 195
            expect(result.reconciliation.estimatedCredits).toBeDefined();
            expect(result.reconciliation.actualCost).toBeDefined();
            expect(result.reconciliation.estimatedVsActualCreditDelta).toBeDefined();
        });

        it('should work with TokenExtractor interface', async () => {
            interface MockResponse {
                text: string;
                usage: {
                    prompt_tokens: number;
                    completion_tokens: number;
                };
            }

            const mockResponse: MockResponse = {
                text: 'Hello from TokenExtractor!',
                usage: { prompt_tokens: 110, completion_tokens: 190 }
            };
            const mockCallFunction = jest.fn().mockResolvedValue(mockResponse);

            // Create a mock TokenExtractor
            const mockTokenExtractor: TokenExtractor<MockResponse> = {
                providerName: 'openai',
                description: 'OpenAI Chat Completions API extractor',
                apiVersion: 'v1',
                extract: (response: MockResponse) => ({
                    promptTokens: response.usage.prompt_tokens,
                    completionTokens: response.usage.completion_tokens
                })
            };

            const result = await sdk.wrapCall<MockResponse>({
                model: 'openai:gpt-4',
                feature: 'chat',
                promptTokens: 100,
                completionTokens: 200,
                callFunction: mockCallFunction,
                tokenExtractor: mockTokenExtractor
            });

            expect(mockCallFunction).toHaveBeenCalledTimes(1);
            expect(result.response).toBe(mockResponse);
            expect(result.reconciliation.actualTokensUsed).toBe(300); // 110 + 190
            expect(result.reconciliation.estimatedCredits).toBeDefined();
            expect(result.reconciliation.actualCost).toBeDefined();
            expect(result.reconciliation.estimatedVsActualCreditDelta).toBeDefined();
        });

        it('should use estimates when no token extractor is provided', async () => {
            const mockResponse = { text: 'Hello, world!' };
            const mockCallFunction = jest.fn().mockResolvedValue(mockResponse);

            const result = await sdk.wrapCall({
                model: 'openai:gpt-4',
                feature: 'chat',
                promptTokens: 100,
                completionTokens: 200,
                callFunction: mockCallFunction
            });

            expect(result.response).toBe(mockResponse);
            expect(result.reconciliation.actualTokensUsed).toBe(300); // 100 + 200 (estimates used)
            expect(result.reconciliation.estimatedVsActualCreditDelta).toBe(0); // Should be zero since estimates equal actuals
        });

        it('should handle async call functions', async () => {
            const mockCallFunction = jest.fn().mockImplementation(async () => {
                await new Promise(resolve => setTimeout(resolve, 10));
                return { text: 'Async response' };
            });

            const result = await sdk.wrapCall({
                model: 'openai:gpt-4',
                feature: 'chat',
                promptTokens: 100,
                completionTokens: 200,
                callFunction: mockCallFunction
            });

            expect((result.response as any).text).toBe('Async response');
        });

        it('should handle errors from call function', async () => {
            const mockCallFunction = jest.fn().mockRejectedValue(new Error('API Error'));

            await expect(sdk.wrapCall({
                model: 'openai:gpt-4',
                feature: 'chat',
                promptTokens: 100,
                completionTokens: 200,
                callFunction: mockCallFunction
            })).rejects.toThrow('API Error');
        });
    });

    describe('Utility Methods', () => {
        it('should return available models', () => {
            const models = sdk.getAvailableModels();
            expect(models).toContain('openai:gpt-4');
            expect(models).toContain('openai:gpt-3.5-turbo');
            expect(models).toContain('anthropic:claude-3-haiku');
            expect(Array.isArray(models)).toBe(true);
        });

        it('should return available features for a model', () => {
            const features = sdk.getAvailableFeatures('openai:gpt-4');
            expect(features).toContain('chat');
            expect(features).toContain('summarize');
            expect(features).toContain('generate_code');
            expect(Array.isArray(features)).toBe(true);
        });

        it('should throw error when getting features for unknown model', () => {
            expect(() => {
                sdk.getAvailableFeatures('unknown:model');
            }).toThrow('Model \'unknown:model\' not found in configuration');
        });

        it('should return empty array for model with no features', () => {
            const customSDK = new LLMCreditSDK({
                models: {
                    'test:model': {
                        prompt_cost_per_1k: 0.01,
                        completion_cost_per_1k: 0.02
                        // No features defined
                    }
                }
            });

            const features = customSDK.getAvailableFeatures('test:model');
            expect(features).toEqual([]);
        });

        it('should return config object', () => {
            const config = sdk.getConfig();
            expect(config).toHaveProperty('default_margin');
            expect(config).toHaveProperty('models');
            expect(typeof config.default_margin).toBe('number');
            expect(typeof config.models).toBe('object');
        });

        it('should return deep copy of config to prevent mutations', () => {
            const config1 = sdk.getConfig();
            const config2 = sdk.getConfig();

            config1.default_margin = 999;
            expect(config2.default_margin).not.toBe(999);
            expect(sdk.getConfig().default_margin).not.toBe(999);
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle very small token amounts', () => {
            const result = sdk.estimateCredits({
                model: 'openai:gpt-4',
                feature: 'chat',
                promptTokens: 1,
                completionTokens: 1
            });

            expect(result.estimatedCredits).toBeGreaterThan(0);
            expect(typeof result.estimatedCredits).toBe('number');
        });

        it('should handle very large token amounts', () => {
            const result = sdk.estimateCredits({
                model: 'openai:gpt-4',
                feature: 'chat',
                promptTokens: 100000,
                completionTokens: 100000
            });

            expect(result.estimatedCredits).toBeGreaterThan(0);
            expect(typeof result.estimatedCredits).toBe('number');
            expect(Number.isFinite(result.estimatedCredits)).toBe(true);
        });

        it('should format numbers to 6 decimal places', () => {
            const result = sdk.estimateCredits({
                model: 'together:llama3-8b', // Very cheap model
                feature: 'chat',
                promptTokens: 1,
                completionTokens: 1
            });

            const decimals = result.estimatedCredits.toString().split('.')[1]?.length || 0;
            expect(decimals).toBeLessThanOrEqual(6);
        });

        it('should handle reconciliation with zero actual tokens', () => {
            const result = sdk.reconcile({
                model: 'openai:gpt-4',
                feature: 'chat',
                promptTokens: 100,
                completionTokens: 200,
                actualPromptTokens: 0,
                actualCompletionTokens: 0
            });

            expect(result.actualTokensUsed).toBe(0);
            expect(result.actualCost).toBe(0);
            expect(result.estimatedVsActualCreditDelta).toBeLessThan(0); // Should be negative since we overestimated
        });
    });

    describe('Configuration Edge Cases', () => {
        it('should handle empty custom config', () => {
            const customSDK = new LLMCreditSDK({});
            const config = customSDK.getConfig();

            expect(config.default_margin).toBe(1.5); // Should use default
            expect(Object.keys(config.models).length).toBeGreaterThan(0); // Should have default models
        });

        it('should handle null custom config', () => {
            const customSDK = new LLMCreditSDK(undefined);
            const config = customSDK.getConfig();

            expect(config.default_margin).toBe(1.5);
            expect(Object.keys(config.models).length).toBeGreaterThan(0);
        });

        it('should override default margin to zero', () => {
            const customSDK = new LLMCreditSDK({
                default_margin: 0
            });

            const result = customSDK.estimateCredits({
                model: 'openai:gpt-4',
                feature: 'unknown_feature', // Will use default margin
                promptTokens: 100,
                completionTokens: 200
            });

            expect(result.estimatedCredits).toBe(0);
        });

        it('should handle model with only partial configuration', () => {
            const customSDK = new LLMCreditSDK({
                models: {
                    'openai:gpt-4': {
                        prompt_cost_per_1k: 0.035 // Only override price, keep existing features
                    } as any
                }
            });

            const config = customSDK.getConfig();
            const gpt4Config = config.models['openai:gpt-4'];

            expect(gpt4Config.prompt_cost_per_1k).toBe(0.035);
            expect(gpt4Config.completion_cost_per_1k).toBe(0.06); // Should keep original
            expect(gpt4Config.features?.chat?.margin).toBe(2.0); // Should keep original features
        });
    });

    describe('OpenAI Extractor Integration', () => {
        it('should work with built-in OpenAI extractor', async () => {
            const mockOpenAIResponse: OpenAIChatCompletionResponse = {
                id: 'chatcmpl-7QmVI15qgYVllxK0FtxVGG6ywfzaq',
                object: 'chat.completion',
                created: 1686617332,
                model: 'gpt-4',
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: 'This is a test response'
                    },
                    finish_reason: 'stop'
                }],
                usage: {
                    prompt_tokens: 120,
                    completion_tokens: 180,
                    total_tokens: 300
                }
            };

            const mockCallFunction = jest.fn().mockResolvedValue(mockOpenAIResponse);

            const result = await sdk.wrapCall({
                model: 'openai:gpt-4',
                feature: 'chat',
                promptTokens: 100,
                completionTokens: 200,
                callFunction: mockCallFunction,
                tokenExtractor: openAIChatExtractor
            });

            expect(mockCallFunction).toHaveBeenCalledTimes(1);
            expect(result.response).toBe(mockOpenAIResponse);
            expect(result.reconciliation.actualTokensUsed).toBe(300); // 120 + 180
            expect(result.reconciliation.estimatedCredits).toBeDefined();
            expect(result.reconciliation.actualCost).toBeDefined();
            expect(result.reconciliation.estimatedVsActualCreditDelta).toBeDefined();
        });

        it('should handle OpenAI response with completion_tokens_details', async () => {
            const mockOpenAIResponse: OpenAIChatCompletionResponse = {
                id: 'chatcmpl-test',
                object: 'chat.completion',
                created: 1686617332,
                model: 'gpt-4',
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: 'Test response with reasoning tokens'
                    },
                    finish_reason: 'stop'
                }],
                usage: {
                    prompt_tokens: 100,
                    completion_tokens: 200,
                    total_tokens: 300,
                    completion_tokens_details: {
                        reasoning_tokens: 50
                    },
                    prompt_tokens_details: {
                        cached_tokens: 20
                    }
                },
                system_fingerprint: 'fp_test'
            };

            const result = openAIChatExtractor.extract(mockOpenAIResponse);

            expect(result.promptTokens).toBe(100);
            expect(result.completionTokens).toBe(200);
        });

        it('should throw error when OpenAI response is missing usage', () => {
            const invalidResponse = {
                id: 'chatcmpl-test',
                object: 'chat.completion',
                created: 1686617332,
                model: 'gpt-4',
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: 'Test response'
                    },
                    finish_reason: 'stop'
                }]
                // Missing usage property
            } as any;

            expect(() => {
                openAIChatExtractor.extract(invalidResponse);
            }).toThrow('OpenAI response missing usage information');
        });

        it('should have correct metadata for OpenAI extractor', () => {
            expect(openAIChatExtractor.providerName).toBe('openai');
            expect(openAIChatExtractor.description).toBe('OpenAI Chat Completions API');
            expect(openAIChatExtractor.apiVersion).toBe('v1');
        });
    });

    describe('Dashboard Integration', () => {
        beforeEach(() => {
            // Mock fetch for dashboard client
            global.fetch = jest.fn();

            // Mock WebSocket and EventSource
            (global as any).WebSocket = jest.fn().mockImplementation(() => ({
                onopen: null,
                onmessage: null,
                onerror: null,
                onclose: null,
                readyState: 0,
                close: jest.fn()
            }));

            (global as any).EventSource = jest.fn().mockImplementation(() => ({
                onopen: null,
                onmessage: null,
                onerror: null,
                readyState: 0,
                close: jest.fn()
            }));

            // Mock console methods
            jest.spyOn(console, 'log').mockImplementation();
            jest.spyOn(console, 'error').mockImplementation();
        });

        afterEach(() => {
            sdk.disableDashboardSync();
            jest.restoreAllMocks();
        });

        it('should enable dashboard sync', () => {
            const config = {
                apiKey: 'test-api-key',
                endpoint: 'https://api.tokenix.com',
                projectId: 'test-project'
            };

            sdk.enableDashboardSync(config);

            expect(sdk.isDashboardSyncEnabled()).toBe(true);
            expect(console.log).toHaveBeenCalledWith('[LLMCreditSDK] Dashboard sync enabled with endpoint: https://api.tokenix.com');
        });

        it('should disable dashboard sync', () => {
            const config = {
                apiKey: 'test-api-key',
                endpoint: 'https://api.tokenix.com'
            };

            sdk.enableDashboardSync(config);
            expect(sdk.isDashboardSyncEnabled()).toBe(true);

            sdk.disableDashboardSync();
            expect(sdk.isDashboardSyncEnabled()).toBe(false);
            expect(console.log).toHaveBeenCalledWith('[LLMCreditSDK] Dashboard sync disabled');
        });

        it('should handle dashboard sync errors gracefully', () => {
            // Mock DashboardClient constructor to throw
            jest.spyOn(require('../src/dashboardClient'), 'DashboardClient').mockImplementationOnce(() => {
                throw new Error('Dashboard connection failed');
            });

            const config = {
                apiKey: 'test-api-key',
                endpoint: 'https://api.tokenix.com'
            };

            sdk.enableDashboardSync(config);

            expect(sdk.isDashboardSyncEnabled()).toBe(false);
            expect(console.error).toHaveBeenCalledWith(
                '[LLMCreditSDK] Failed to enable dashboard sync:',
                expect.any(Error)
            );
        });

        it('should post reconciliation data when sync is enabled', async () => {
            const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                statusText: 'OK'
            } as Response);

            const config = {
                apiKey: 'test-api-key',
                endpoint: 'https://api.tokenix.com',
                projectId: 'test-project'
            };

            sdk.enableDashboardSync(config);

            const mockResponse = { text: 'Hello, world!' };
            const mockCallFunction = jest.fn().mockResolvedValue(mockResponse);

            await sdk.wrapCall({
                model: 'openai:gpt-4',
                feature: 'chat',
                promptTokens: 100,
                completionTokens: 200,
                callFunction: mockCallFunction
            });

            // Wait for async postReconciliation call
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.tokenix.com/api/v1/reconciliation-log',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer test-api-key'
                    }),
                    body: expect.stringContaining('openai:gpt-4')
                })
            );
        });

        it('should not make request when sync is disabled', async () => {
            const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

            const mockResponse = { text: 'Hello, world!' };
            const mockCallFunction = jest.fn().mockResolvedValue(mockResponse);

            await sdk.wrapCall({
                model: 'openai:gpt-4',
                feature: 'chat',
                promptTokens: 100,
                completionTokens: 200,
                callFunction: mockCallFunction
            });

            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should handle config updates from dashboard', () => {
            const config = {
                apiKey: 'test-api-key',
                endpoint: 'https://api.tokenix.com'
            };

            const originalConfig = sdk.getConfig();
            sdk.enableDashboardSync(config);

            // Simulate config update
            const newConfig = {
                ...originalConfig,
                default_margin: 3.0,
                credit_per_dollar: 500
            };

            // Trigger config update event
            (sdk as any).eventEmitter.emit('configUpdated', newConfig);

            const updatedConfig = sdk.getConfig();
            expect(updatedConfig.default_margin).toBe(3.0);
            expect(updatedConfig.credit_per_dollar).toBe(500);
        });

        it('should handle dashboard client errors gracefully during reconciliation', async () => {
            const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const config = {
                apiKey: 'test-api-key',
                endpoint: 'https://api.tokenix.com'
            };

            sdk.enableDashboardSync(config);

            const mockResponse = { text: 'Hello, world!' };
            const mockCallFunction = jest.fn().mockResolvedValue(mockResponse);

            // This should not throw even though dashboard sync fails
            const result = await sdk.wrapCall({
                model: 'openai:gpt-4',
                feature: 'chat',
                promptTokens: 100,
                completionTokens: 200,
                callFunction: mockCallFunction
            });

            expect(result.response).toBe(mockResponse);
            expect(mockCallFunction).toHaveBeenCalledTimes(1);
        });
    });
}); 