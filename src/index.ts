// Export the main SDK class
export { LLMCreditSDK } from './sdk';

// Export all types
export type {
    SDKConfig,
    ModelConfig,
    FeatureConfig,
    EstimateCreditsInput,
    EstimateCreditsResult,
    ReconcileInput,
    ReconcileResult,
    WrapCallInput,
    WrapCallResult,
    TokenExtractor,
    TokenUsage
} from './types';

// Export default configuration
export { DEFAULT_CONFIG } from './config';

// Export extractors library
export {
    openAIChatExtractor,
    openAIGenericExtractor,
    OPENAI_EXTRACTORS,
    type OpenAIChatCompletionResponse
} from './extractors';

// Create a convenience function for quick initialization
import { LLMCreditSDK } from './sdk';
import { SDKConfig } from './types';

/**
 * Create a new SDK instance with optional configuration
 * @param config - Optional custom configuration
 * @returns New SDK instance
 */
export function createSDK(config?: Partial<SDKConfig>): LLMCreditSDK {
    return new LLMCreditSDK(config);
}

// Export a default instance for convenience
export const sdk = new LLMCreditSDK(); 