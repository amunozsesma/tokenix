/**
 * Real-World Integration Example
 * 
 * This example shows how to integrate the LLM Credit SDK with actual LLM APIs
 * in a production application with user billing and usage tracking.
 */

import { LLMCreditSDK } from '../src/sdk';
import { openAIChatExtractor } from '../src/extractors/index';

// Simulated OpenAI client (replace with actual openai import in real usage)
interface OpenAIClient {
    chat: {
        completions: {
            create: (params: any) => Promise<any>;
        };
    };
}

// Simulated user management and billing system
interface UserBillingSystem {
    getUserCredits(userId: string): Promise<number>;
    deductCredits(userId: string, credits: number): Promise<void>;
    logUsage(userId: string, usage: any): Promise<void>;
}

class AIAppService {
    private sdk: LLMCreditSDK;
    private openai: OpenAIClient;
    private billing: UserBillingSystem;

    constructor(openaiClient: OpenAIClient, billingSystem: UserBillingSystem) {
        // Initialize SDK with custom configuration for your business
        this.sdk = new LLMCreditSDK({
            default_margin: 2.5, // 150% markup for sustainability
            models: {
                'openai:gpt-4': {
                    prompt_cost_per_1k: 0.03,
                    completion_cost_per_1k: 0.06,
                    features: {
                        'premium_chat': { margin: 3.0 }, // Premium features cost more
                        'basic_chat': { margin: 2.0 }
                    }
                }
            }
        });
        this.openai = openaiClient;
        this.billing = billingSystem;
    }

    /**
     * Chat with GPT-4 with automatic credit tracking and billing
     */
    async chatWithGPT(userId: string, message: string, tier: 'basic' | 'premium' = 'basic'): Promise<{
        response: string;
        creditsUsed: number;
        remainingCredits: number;
    }> {
        const feature = tier === 'premium' ? 'premium_chat' : 'basic_chat';

        // Estimate token usage (you could use a tokenizer library for better estimates)
        const estimatedPromptTokens = Math.ceil(message.length / 4); // Rough estimate
        const estimatedCompletionTokens = Math.min(estimatedPromptTokens * 2, 500); // Conservative estimate

        // Check if user has enough credits before making the call
        const estimate = this.sdk.estimateCredits({
            model: 'openai:gpt-4',
            feature,
            promptTokens: estimatedPromptTokens,
            completionTokens: estimatedCompletionTokens
        });

        const userCredits = await this.billing.getUserCredits(userId);
        if (userCredits < estimate.estimatedCredits) {
            throw new Error(`Insufficient credits. Need ${estimate.estimatedCredits}, have ${userCredits}`);
        }

        // Make the wrapped API call with automatic tracking
        const result = await this.sdk.wrapCall({
            model: 'openai:gpt-4',
            feature,
            promptTokens: estimatedPromptTokens,
            completionTokens: estimatedCompletionTokens,
            callFunction: async () => {
                return await this.openai.chat.completions.create({
                    model: 'gpt-4',
                    messages: [
                        { role: 'system', content: tier === 'premium' ? 'You are a premium AI assistant with advanced capabilities.' : 'You are a helpful AI assistant.' },
                        { role: 'user', content: message }
                    ],
                    max_tokens: tier === 'premium' ? 1000 : 500,
                    temperature: tier === 'premium' ? 0.7 : 0.5
                });
            },
            tokenExtractor: openAIChatExtractor
        });

        // Deduct credits and log usage
        const creditsUsed = result.reconciliation.actualTokensUsed;
        await this.billing.deductCredits(userId, creditsUsed);
        await this.billing.logUsage(userId, {
            model: 'openai:gpt-4',
            feature,
            timestamp: new Date().toISOString(),
            estimatedCredits: result.reconciliation.estimatedCredits,
            actualCredits: creditsUsed,
            actualCost: result.reconciliation.actualCost,
            delta: result.reconciliation.estimatedVsActualCreditDelta,
            costDelta: result.reconciliation.costDelta,
            marginDelta: result.reconciliation.marginDelta,
            promptTokens: result.reconciliation.actualTokensUsed - (result.response.usage?.completion_tokens || 0),
            completionTokens: result.response.usage?.completion_tokens || 0
        });

        const remainingCredits = await this.billing.getUserCredits(userId);

        return {
            response: result.response.choices[0].message.content,
            creditsUsed,
            remainingCredits
        };
    }

    /**
     * Batch process multiple requests with credit management
     */
    async batchProcess(userId: string, messages: string[]): Promise<{
        responses: string[];
        totalCreditsUsed: number;
        remainingCredits: number;
    }> {
        const responses: string[] = [];
        let totalCreditsUsed = 0;

        for (const message of messages) {
            try {
                const result = await this.chatWithGPT(userId, message, 'basic');
                responses.push(result.response);
                totalCreditsUsed += result.creditsUsed;
            } catch (error) {
                responses.push(`Error: ${(error as Error).message}`);
                break; // Stop processing if credits run out
            }
        }

        const remainingCredits = await this.billing.getUserCredits(userId);

        return {
            responses,
            totalCreditsUsed,
            remainingCredits
        };
    }

    /**
     * Get cost estimation for a potential request
     */
    async getCostEstimate(message: string, tier: 'basic' | 'premium' = 'basic'): Promise<{
        estimatedCredits: number;
        estimatedTokens: number;
    }> {
        const feature = tier === 'premium' ? 'premium_chat' : 'basic_chat';
        const estimatedPromptTokens = Math.ceil(message.length / 4);
        const estimatedCompletionTokens = Math.min(estimatedPromptTokens * 2, tier === 'premium' ? 1000 : 500);

        const estimate = this.sdk.estimateCredits({
            model: 'openai:gpt-4',
            feature,
            promptTokens: estimatedPromptTokens,
            completionTokens: estimatedCompletionTokens
        });

        return {
            estimatedCredits: estimate.estimatedCredits,
            estimatedTokens: estimatedPromptTokens + estimatedCompletionTokens
        };
    }
}

// Example usage
async function realWorldExample() {
    console.log('🏢 Real-World Integration Example\n');

    // Mock clients (replace with real implementations)
    const mockOpenAI: OpenAIClient = {
        chat: {
            completions: {
                create: async (params) => ({
                    id: 'chatcmpl-example',
                    object: 'chat.completion',
                    created: Date.now(),
                    model: 'gpt-4',
                    choices: [{
                        index: 0,
                        message: {
                            role: 'assistant',
                            content: `I received your message: "${params.messages[1].content}". This is a simulated response.`
                        },
                        finish_reason: 'stop'
                    }],
                    usage: {
                        prompt_tokens: Math.ceil(params.messages[1].content.length / 4) + 20, // +20 for system message
                        completion_tokens: 50,
                        total_tokens: Math.ceil(params.messages[1].content.length / 4) + 70
                    }
                })
            }
        }
    };

    const mockBilling: UserBillingSystem = {
        getUserCredits: async (userId) => 100, // Mock user has 100 credits
        deductCredits: async (userId, credits) => {
            console.log(`🔻 Deducted ${credits} credits from user ${userId}`);
        },
        logUsage: async (userId, usage) => {
            console.log(`📊 Logged usage for user ${userId}:`, {
                model: usage.model,
                feature: usage.feature,
                actualCredits: usage.actualCredits,
                delta: usage.delta,
                costDelta: usage.costDelta,
                marginDelta: usage.marginDelta
            });
        }
    };

    // Initialize the service
    const aiService = new AIAppService(mockOpenAI, mockBilling);

    try {
        // Example 1: Single chat request
        console.log('💬 Example 1: Single Chat Request');
        const chatResult = await aiService.chatWithGPT('user123', 'What is the meaning of life?', 'basic');
        console.log('Response:', chatResult.response);
        console.log(`Credits used: ${chatResult.creditsUsed}, Remaining: ${chatResult.remainingCredits}\n`);

        // Example 2: Premium chat request
        console.log('⭐ Example 2: Premium Chat Request');
        const premiumResult = await aiService.chatWithGPT('user123', 'Analyze the market trends for AI companies', 'premium');
        console.log('Premium response:', premiumResult.response);
        console.log(`Credits used: ${premiumResult.creditsUsed}, Remaining: ${premiumResult.remainingCredits}\n`);

        // Example 3: Cost estimation
        console.log('📊 Example 3: Cost Estimation');
        const estimate = await aiService.getCostEstimate('Write a detailed analysis of machine learning trends', 'premium');
        console.log(`Estimated cost: ${estimate.estimatedCredits} credits for ~${estimate.estimatedTokens} tokens\n`);

        // Example 4: Batch processing
        console.log('🔄 Example 4: Batch Processing');
        const batchResult = await aiService.batchProcess('user456', [
            'Hello!',
            'What is AI?',
            'Explain machine learning'
        ]);
        console.log('Batch responses:', batchResult.responses);
        console.log(`Total credits used: ${batchResult.totalCreditsUsed}, Remaining: ${batchResult.remainingCredits}\n`);

    } catch (error) {
        console.error('❌ Error:', (error as Error).message);
    }

    console.log('✅ Real-world integration example completed!');
}

// Run the example
if (require.main === module) {
    realWorldExample().catch(console.error);
}

export { AIAppService, realWorldExample }; 