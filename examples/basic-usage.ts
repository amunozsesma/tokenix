/**
 * Basic Usage Example for LLM Credit SDK
 * 
 * This example demonstrates the core functionality of the SDK:
 * - Credit estimation before LLM calls
 * - Usage reconciliation after LLM calls
 * - Wrapped LLM calls with automatic tracking
 */

import { LLMCreditSDK } from '../src/sdk';
import { openAIChatExtractor, OpenAIChatCompletionResponse } from '../src/extractors/index';

async function basicUsageExample() {
    console.log('🚀 LLM Credit SDK - Basic Usage Example\n');

    // Initialize the SDK
    const sdk = new LLMCreditSDK();

    // Example 1: Credit Estimation
    console.log('📊 Example 1: Credit Estimation');
    const estimate = sdk.estimateCredits({
        model: 'openai:gpt-4',
        feature: 'chat',
        promptTokens: 150,
        completionTokens: 350
    });
    console.log(`Estimated credits: ${estimate.estimatedCredits}`);
    console.log(`Credit per dollar rate: ${sdk.getCreditPerDollar()}`);
    console.log();

    // Example 2: Usage Reconciliation
    console.log('🔄 Example 2: Usage Reconciliation');
    const reconciliation = sdk.reconcile({
        model: 'openai:gpt-4',
        feature: 'chat',
        promptTokens: 150,
        completionTokens: 350,
        actualPromptTokens: 160, // Actual usage was different
        actualCompletionTokens: 340
    });

    console.log('Reconciliation result:', {
        estimatedCredits: reconciliation.estimatedCredits,
        actualTokensUsed: reconciliation.actualTokensUsed,
        actualCost: reconciliation.actualCost,
        delta: reconciliation.estimatedVsActualCreditDelta,
        costDelta: reconciliation.costDelta,
        marginDelta: reconciliation.marginDelta
    });
    console.log();

    // Example 3: Wrapped LLM Call (Simulated)
    console.log('🌯 Example 3: Wrapped LLM Call');

    // Mock OpenAI response for demonstration
    const mockResponse: OpenAIChatCompletionResponse = {
        id: "chatcmpl-example",
        object: "chat.completion",
        created: Date.now(),
        model: "gpt-4",
        choices: [{
            index: 0,
            message: {
                role: "assistant",
                content: "This is a simulated response from OpenAI's Chat Completions API."
            },
            finish_reason: "stop"
        }],
        usage: {
            prompt_tokens: 155,
            completion_tokens: 345,
            total_tokens: 500
        }
    };

    // Simulate an API call with automatic token tracking
    const result = await sdk.wrapCall({
        model: 'openai:gpt-4',
        feature: 'chat',
        promptTokens: 150, // Our estimate
        completionTokens: 350, // Our estimate
        callFunction: async () => {
            // In real usage, this would be your actual OpenAI API call:
            // return await openai.chat.completions.create({...});
            await new Promise(resolve => setTimeout(resolve, 100)); // Simulate API delay
            return mockResponse;
        },
        tokenExtractor: openAIChatExtractor
    });

    console.log('Response:', result.response.choices[0].message.content);
    console.log('Token usage:', {
        estimatedCredits: result.reconciliation.estimatedCredits,
        actualTokensUsed: result.reconciliation.actualTokensUsed,
        actualCost: result.reconciliation.actualCost,
        delta: result.reconciliation.estimatedVsActualCreditDelta,
        costDelta: result.reconciliation.costDelta,
        marginDelta: result.reconciliation.marginDelta
    });
    console.log();

    // Example 4: Multiple Models Comparison
    console.log('⚖️ Example 4: Cost Comparison Across Models');
    const models = [
        { model: 'openai:gpt-3.5-turbo', feature: 'chat' },
        { model: 'anthropic:claude-3-haiku', feature: 'summarize' },
        { model: 'together:llama3-8b', feature: 'chat' }
    ];

    for (const { model, feature } of models) {
        const estimate = sdk.estimateCredits({
            model,
            feature,
            promptTokens: 100,
            completionTokens: 200
        });
        console.log(`${model} (${feature}): ${estimate.estimatedCredits} credits`);
    }

    console.log('\n✅ Basic usage example completed!');
    console.log('📖 For more examples, see: https://github.com/amunozsesma/tokenix/tree/main/examples');

    // Example 5: Credit Per Dollar Comparison
    console.log('\n💰 Example 5: Credit Per Dollar Rate Comparison');

    // Default SDK (1000 credits per dollar)
    const defaultSDK = new LLMCreditSDK();
    const defaultEstimate = defaultSDK.estimateCredits({
        model: 'openai:gpt-4',
        feature: 'chat',
        promptTokens: 100,
        completionTokens: 200
    });

    // Custom SDK with different credit rate (500 credits per dollar)
    const customSDK = new LLMCreditSDK({
        credit_per_dollar: 500
    });
    const customEstimate = customSDK.estimateCredits({
        model: 'openai:gpt-4',
        feature: 'chat',
        promptTokens: 100,
        completionTokens: 200
    });

    console.log(`Default rate (${defaultSDK.getCreditPerDollar()} credits/$): ${defaultEstimate.estimatedCredits} credits`);
    console.log(`Custom rate (${customSDK.getCreditPerDollar()} credits/$): ${customEstimate.estimatedCredits} credits`);
    console.log(`Ratio: ${(defaultEstimate.estimatedCredits / customEstimate.estimatedCredits).toFixed(2)}x`);

    console.log('\n✅ Basic usage example completed!');
}

// Run the example
if (require.main === module) {
    basicUsageExample().catch(console.error);
}

export { basicUsageExample }; 