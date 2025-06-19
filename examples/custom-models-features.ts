import { LLMCreditSDK, WrapCallInputCustom, openAIChatExtractor } from '../src';
// Note: We use openAIChatExtractor which is the main OpenAI extractor

/**
 * Example demonstrating type-safe usage with supported models/features
 * and how to extend with custom models/features
 */

// 1. Using supported models and features (type-safe)
const sdk = new LLMCreditSDK();

async function usingSupportedTypes() {
    console.log('=== Using Supported Models/Features (Type-Safe) ===');

    // This will have full TypeScript autocomplete and type checking
    const estimate = sdk.estimateCredits({
        model: 'openai:gpt-4', // TypeScript will suggest valid options
        feature: 'chat',       // TypeScript will validate this
        promptTokens: 100,
        completionTokens: 50
    });

    console.log('Estimated credits:', estimate.estimatedCredits);

    // Using wrapCall with supported types
    const result = await sdk.wrapCall({
        model: 'openai:gpt-4',
        feature: 'summarize',
        promptTokens: 200,
        completionTokens: 100,
        callFunction: async () => {
            // Simulate OpenAI API call
            return {
                choices: [{ message: { content: 'Summary of the content...' } }],
                usage: { prompt_tokens: 205, completion_tokens: 95, total_tokens: 300 }
            };
        },
        tokenExtractor: openAIChatExtractor
    });

    console.log('Response:', result.response);
    console.log('Reconciliation:', result.reconciliation);
}

// 2. Using custom models and features
const customSDK = new LLMCreditSDK({
    models: {
        // Add a custom model
        'custom:my-ai-model': {
            prompt_cost_per_1k: 0.0015,
            completion_cost_per_1k: 0.003,
            features: {
                'document_analysis': { margin: 2.5 },
                'custom_chat': { margin: 1.8 }
            }
        },
        // Extend existing model with new features
        'openai:gpt-4': {
            prompt_cost_per_1k: 0.03,
            completion_cost_per_1k: 0.06,
            features: {
                chat: { margin: 2.0 },
                summarize: { margin: 1.8 },
                generate_code: { margin: 2.2 },
                translate: { margin: 1.6 },
                // Add custom feature to existing model
                'legal_analysis': { margin: 3.0 }
            }
        }
    }
});

async function usingCustomTypes() {
    console.log('\n=== Using Custom Models/Features ===');

    // For custom models/features, you need to use explicit typing
    const customEstimate = customSDK.estimateCredits({
        model: 'custom:my-ai-model',
        feature: 'document_analysis',
        promptTokens: 500,
        completionTokens: 200
    } as any); // Type assertion needed for custom types

    console.log('Custom model estimate:', customEstimate.estimatedCredits);

    // Using wrapCall with custom model
    const customResult = await customSDK.wrapCall({
        model: 'custom:my-ai-model',
        feature: 'document_analysis',
        promptTokens: 500,
        completionTokens: 200,
        callFunction: async () => {
            // Simulate custom AI service call
            return {
                analysis: 'Document analysis results...',
                confidence: 0.95,
                // Custom response format
                token_usage: {
                    input_tokens: 510,
                    output_tokens: 195
                }
            };
        },
        // Custom token extractor for your AI service
        tokenExtractor: {
            providerName: 'custom-ai',
            description: 'Extracts tokens from custom AI service response',
            extract: (response: any) => ({
                promptTokens: response.token_usage.input_tokens,
                completionTokens: response.token_usage.output_tokens
            })
        }
    } as WrapCallInputCustom);

    console.log('Custom model response:', customResult.response);
    console.log('Custom reconciliation:', customResult.reconciliation);

    // Using existing model with custom feature
    const extendedEstimate = customSDK.estimateCredits({
        model: 'openai:gpt-4',
        feature: 'legal_analysis', // Custom feature added to existing model
        promptTokens: 300,
        completionTokens: 150
    } as any);

    console.log('Extended model estimate:', extendedEstimate.estimatedCredits);
}

// 3. Best practices for type safety with custom extensions
function bestPractices() {
    console.log('\n=== Best Practices ===');

    // Create type-safe wrappers for your custom models
    type MyCustomModel = 'custom:my-ai-model';
    type MyCustomFeatures = 'document_analysis' | 'custom_chat';

    async function callCustomModel(
        model: MyCustomModel,
        feature: MyCustomFeatures,
        promptTokens: number,
        completionTokens: number,
        callFunction: () => Promise<any>
    ) {
        return customSDK.wrapCall({
            model,
            feature,
            promptTokens,
            completionTokens,
            callFunction
        } as WrapCallInputCustom);
    }

    // Now you have type safety for your custom models
    // TypeScript will validate the model and feature combinations
    console.log('Type-safe custom model wrapper created');
}

// Run the examples
async function runExamples() {
    try {
        await usingSupportedTypes();
        await usingCustomTypes();
        bestPractices();
    } catch (error) {
        console.error('Example error:', error);
    }
}

// Export for use in other files
export {
    usingSupportedTypes,
    usingCustomTypes,
    bestPractices,
    runExamples
};

// Run if called directly
if (require.main === module) {
    runExamples();
} 