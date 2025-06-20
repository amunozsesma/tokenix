// Export the main SDK class
export { LLMCreditSDK } from './sdk';

// Export all types
export type {
    SDKConfig,
    ModelConfig,
    FeatureConfig,
    SupportedModel,
    SupportedFeature,
    EstimateCreditsInput,
    EstimateCreditsInputCustom,
    EstimateCreditsResult,
    ReconcileInput,
    ReconcileInputCustom,
    ReconcileResult,
    WrapCallInput,
    WrapCallInputCustom,
    WrapCallResult,
    TokenExtractor,
    TokenUsage,
    DashboardSyncConfig,
    ReconciliationLog
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

// Export dashboard client for advanced usage
export { DashboardClient } from './dashboardClient';

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