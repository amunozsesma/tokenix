/**
 * Supported model names in the default configuration
 */
export type SupportedModel =
    | "openai:gpt-4"
    | "openai:gpt-4-turbo"
    | "openai:gpt-4o"
    | "openai:gpt-3.5-turbo"
    | "openai:gpt-3.5-turbo-16k"
    | "anthropic:claude-3.5-sonnet"
    | "anthropic:claude-3-opus"
    | "anthropic:claude-3-sonnet"
    | "anthropic:claude-3-haiku"
    | "google:gemini-pro"
    | "google:gemini-ultra"
    | "google:palm-2"
    | "azure:gpt-4"
    | "azure:gpt-35-turbo"
    | "bedrock:claude-v2"
    | "bedrock:titan-text"
    | "cohere:command"
    | "cohere:command-light"
    | "ai21:jurassic-2-ultra"
    | "ai21:jurassic-2-mid"
    | "mistral:mistral-large"
    | "mistral:mistral-medium"
    | "mistral:mistral-small"
    | "opensource:llama-2-70b"
    | "opensource:llama-2-13b"
    | "opensource:code-llama-34b"
    | "opensource:mistral-7b"
    | "opensource:vicuna-33b"

/**
 * Supported feature names in the default configuration
 */
export type SupportedFeature =
    | 'chat'
    | 'completion'
    | 'code'

/**
 * Configuration structure for model pricing and features
 */
export interface SDKConfig {
    default_margin: number;
    credit_per_dollar: number;
    models: {
        [modelName: string]: ModelConfig;
    };
}

/**
 * Configuration for a specific model
 */
export interface ModelConfig {
    prompt_cost_per_1k: number;
    completion_cost_per_1k: number;
    features?: {
        [featureName: string]: FeatureConfig;
    };
}

/**
 * Configuration for a specific feature within a model
 */
export interface FeatureConfig {
    margin: number;
}

/**
 * Input parameters for estimating credits
 * 
 * Uses constrained types for better type safety. For custom models/features,
 * use EstimateCreditsInputCustom instead.
 */
export interface EstimateCreditsInput {
    model: SupportedModel;
    feature: SupportedFeature;
    promptTokens: number;
    completionTokens: number;
}

/**
 * Input parameters for estimating credits with custom models or features
 */
export interface EstimateCreditsInputCustom {
    model: string;
    feature: string;
    promptTokens: number;
    completionTokens: number;
}

/**
 * Result of credit estimation
 */
export interface EstimateCreditsResult {
    estimatedCredits: number;
}

/**
 * Input parameters for reconciling actual vs estimated usage
 * 
 * Uses constrained types for better type safety. For custom models/features,
 * use ReconcileInputCustom instead.
 */
export interface ReconcileInput {
    model: SupportedModel;
    feature: SupportedFeature;
    promptTokens: number;
    completionTokens: number;
    actualPromptTokens: number;
    actualCompletionTokens: number;
}

/**
 * Input parameters for reconciling actual vs estimated usage with custom models or features
 */
export interface ReconcileInputCustom {
    model: string;
    feature: string;
    promptTokens: number;
    completionTokens: number;
    actualPromptTokens: number;
    actualCompletionTokens: number;
}

/**
 * Result of reconciliation between estimated and actual usage
 */
export interface ReconcileResult {
    estimatedCredits: number;
    actualTokensUsed: number;
    actualCost: number;
    estimatedVsActualCreditDelta: number;
    costDelta: number;
    marginDelta: number;
}

/**
 * Standard token usage information extracted from LLM responses
 */
export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
}

/**
 * Interface for token extractors that can parse different LLM provider responses
 * to extract actual token usage information.
 * 
 * This interface allows for building a library of standardized extractors
 * for different LLM providers (OpenAI, Anthropic, Together AI, etc.)
 */
export interface TokenExtractor<TResponse = any> {
    /**
     * Extract token usage from the LLM response
     * @param response - The response object from the LLM provider
     * @returns Token usage information
     */
    extract(response: TResponse): TokenUsage;

    /**
     * Name of the LLM provider this extractor is designed for
     * (e.g., 'openai', 'anthropic', 'together', 'cohere')
     */
    readonly providerName: string;

    /**
     * Optional description of what response format this extractor expects
     */
    readonly description?: string;

    /**
     * Optional version or API version this extractor is compatible with
     */
    readonly apiVersion?: string;
}

/**
 * Input parameters for wrapping an LLM call
 * 
 * By default, only supported models and features are allowed for type safety.
 * To use custom models or features, you must:
 * 1. Add them to your SDK configuration when initializing
 * 2. Use the `WrapCallInputCustom` type instead
 * 
 * @example
 * ```typescript
 * // Using supported models/features (type-safe)
 * sdk.wrapCall({
 *   model: 'openai:gpt-4',
 *   feature: 'chat',
 *   // ... other parameters
 * });
 * 
 * // Using custom models/features (requires explicit typing)
 * sdk.wrapCall<MyResponse>({
 *   model: 'my-custom:model',
 *   feature: 'custom-feature',
 *   // ... other parameters
 * } as WrapCallInputCustom<MyResponse>);
 * ```
 */
export interface WrapCallInput<T = any> {
    model: SupportedModel;
    feature: SupportedFeature;
    promptTokens: number;
    completionTokens: number;
    callFunction: () => Promise<T>;
    /**
     * Token extractor instance that implements the TokenExtractor interface.
     * Extracts actual token usage from the LLM response for accurate reconciliation.
     */
    tokenExtractor?: TokenExtractor<T>;
}

/**
 * Input parameters for wrapping an LLM call with custom models or features
 * 
 * Use this type when you need to use models or features not in the default
 * supported list. You must ensure these models/features are properly configured
 * in your SDK configuration.
 * 
 * @example
 * ```typescript
 * // Initialize SDK with custom model
 * const sdk = new LLMCreditSDK({
 *   models: {
 *     'custom:my-model': {
 *       prompt_cost_per_1k: 0.001,
 *       completion_cost_per_1k: 0.002,
 *       features: {
 *         'my-feature': { margin: 1.5 }
 *       }
 *     }
 *   }
 * });
 * 
 * // Use custom model with explicit typing
 * const result = await sdk.wrapCall({
 *   model: 'custom:my-model',
 *   feature: 'my-feature',
 *   // ... other parameters
 * } as WrapCallInputCustom);
 * ```
 */
export interface WrapCallInputCustom<T = any> {
    model: string;
    feature: string;
    promptTokens: number;
    completionTokens: number;
    callFunction: () => Promise<T>;
    tokenExtractor?: TokenExtractor<T>;
}

/**
 * Result of a wrapped LLM call with reconciliation data
 */
export interface WrapCallResult<T = any> {
    response: T;
    reconciliation: ReconcileResult;
}

/**
 * Configuration for dashboard synchronization
 */
export interface DashboardSyncConfig {
    apiKey?: string;
    endpoint?: string;
    projectId?: string;
}

/**
 * Payload for posting reconciliation logs to dashboard
 */
export interface ReconciliationLog {
    projectId?: string;
    model: string;
    feature: string;
    promptTokens: number;
    completionTokens: number;
    actualPromptTokens: number;
    actualCompletionTokens: number;
    estimatedCredits: number;
    actualTokensUsed: number;
    actualCost: number;
    estimatedVsActualCreditDelta: number;
    costDelta: number;
    marginDelta: number;
    creditPerDollar: number;
    timestamp: string;
} 