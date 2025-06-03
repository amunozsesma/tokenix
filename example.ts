import { LLMCreditSDK, createSDK, DEFAULT_CONFIG } from './src/index';

/**
 * Example usage of the LLM Credit SDK
 */
async function main() {
    console.log('LLM Credit SDK Example\n');

    // Initialize SDK with default configuration
    const sdk = new LLMCreditSDK();

    console.log('Available models:');
    console.log(sdk.getAvailableModels().join(', '), '\n');

    // Example 1: Basic credit estimation
    console.log('Example 1: Basic Credit Estimation');
    const estimate = sdk.estimateCredits({
        model: 'openai:gpt-4',
        feature: 'chat',
        promptTokens: 150,
        completionTokens: 350
    });
    console.log(`Estimated credits: ${estimate.estimatedCredits}\n`);

    // Example 2: Reconciliation with actual usage
    console.log('Example 2: Usage Reconciliation');
    const reconciliation = sdk.reconcile({
        model: 'openai:gpt-4',
        feature: 'chat',
        promptTokens: 150,
        completionTokens: 350,
        actualPromptTokens: 160, // Slightly more than estimated
        actualCompletionTokens: 340 // Slightly less than estimated
    });
    console.log('Reconciliation result:', {
        estimatedCredits: reconciliation.estimatedCredits,
        actualTokensUsed: reconciliation.actualTokensUsed,
        actualCost: reconciliation.actualCost,
        estimatedVsActualDelta: reconciliation.estimatedVsActualDelta
    });
    console.log();

    // Example 3: Different models and features
    console.log('Example 3: Different Models and Features');

    const models = [
        { model: 'openai:gpt-3.5-turbo', feature: 'chat' },
        { model: 'anthropic:claude-3-haiku', feature: 'summarize' },
        { model: 'together:llama3-8b', feature: 'chat' }
    ];

    for (const { model, feature } of models) {
        const est = sdk.estimateCredits({
            model,
            feature,
            promptTokens: 100,
            completionTokens: 200
        });
        console.log(`${model} (${feature}): ${est.estimatedCredits} credits`);
    }
    console.log();

    // Example 4: Custom configuration
    console.log('Example 4: Custom Configuration');
    const customSDK = createSDK({
        default_margin: 2.0, // Higher default margin
        models: {
            'custom:my-model': {
                prompt_cost_per_1k: 0.005,
                completion_cost_per_1k: 0.01,
                features: {
                    'custom_feature': { margin: 3.0 }
                }
            }
        }
    });

    const customEstimate = customSDK.estimateCredits({
        model: 'custom:my-model',
        feature: 'custom_feature',
        promptTokens: 100,
        completionTokens: 200
    });
    console.log(`Custom model estimate: ${customEstimate.estimatedCredits} credits\n`);

    // Example 5: Wrapped LLM call simulation
    console.log('🌯 Example 5: Wrapped LLM Call');

    // Mock LLM response
    interface MockLLMResponse {
        text: string;
        usage: {
            prompt_tokens: number;
            completion_tokens: number;
        };
    }

    // Simulate an LLM API call
    const mockLLMCall = async (): Promise<MockLLMResponse> => {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 100));

        return {
            text: "This is a mock response from the LLM.",
            usage: {
                prompt_tokens: 155, // Slightly different from estimate
                completion_tokens: 345
            }
        };
    };

    const wrappedResult = await sdk.wrapCall({
        model: 'openai:gpt-4',
        feature: 'chat',
        promptTokens: 150, // Our estimate
        completionTokens: 350, // Our estimate
        callFunction: mockLLMCall,
        extractActualTokens: (response) => ({
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens
        })
    });

    console.log('LLM Response:', wrappedResult.response.text);
    console.log('Usage reconciliation:', {
        estimatedCredits: wrappedResult.reconciliation.estimatedCredits,
        actualTokensUsed: wrappedResult.reconciliation.actualTokensUsed,
        actualCost: wrappedResult.reconciliation.actualCost,
        delta: wrappedResult.reconciliation.estimatedVsActualDelta
    });
    console.log();

    // Example 6: Error handling
    console.log('❌ Example 6: Error Handling');
    try {
        sdk.estimateCredits({
            model: 'nonexistent:model',
            feature: 'chat',
            promptTokens: 100,
            completionTokens: 200
        });
    } catch (error) {
        console.log('Expected error:', (error as Error).message);
    }
    console.log();

    // Example 7: Feature availability check
    console.log('Example 7: Feature Availability');
    const gpt4Features = sdk.getAvailableFeatures('openai:gpt-4');
    console.log('GPT-4 available features:', gpt4Features.join(', '));

    // Show pricing for different features
    console.log('\nFeature pricing comparison for GPT-4:');
    for (const feature of gpt4Features) {
        const est = sdk.estimateCredits({
            model: 'openai:gpt-4',
            feature,
            promptTokens: 100,
            completionTokens: 200
        });
        console.log(`  ${feature}: ${est.estimatedCredits} credits`);
    }
    console.log();

    // Example 8: Cost breakdown analysis
    console.log('Example 8: Cost Breakdown Analysis');
    const modelConfig = sdk.getConfig().models['openai:gpt-4'];
    const promptTokens = 150;
    const completionTokens = 350;

    const promptCost = (promptTokens / 1000) * modelConfig.prompt_cost_per_1k;
    const completionCost = (completionTokens / 1000) * modelConfig.completion_cost_per_1k;
    const baseCost = promptCost + completionCost;
    const margin = modelConfig.features?.chat?.margin || sdk.getConfig().default_margin;
    const finalCredits = baseCost * margin;

    console.log('Cost breakdown for GPT-4 chat:');
    console.log(`  Prompt tokens: ${promptTokens} × $${modelConfig.prompt_cost_per_1k}/1k = $${promptCost.toFixed(6)}`);
    console.log(`  Completion tokens: ${completionTokens} × $${modelConfig.completion_cost_per_1k}/1k = $${completionCost.toFixed(6)}`);
    console.log(`  Base cost: $${baseCost.toFixed(6)}`);
    console.log(`  Margin: ${margin}x`);
    console.log(`  Final credits: ${finalCredits.toFixed(6)}`);

    console.log('\n✅ Example completed successfully!');
}

// Run the example
if (require.main === module) {
    main().catch(console.error);
} 