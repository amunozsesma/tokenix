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
 */
export interface EstimateCreditsInput {
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
 */
export interface ReconcileInput {
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
 */
export interface WrapCallInput<T = any> {
    model: string;
    feature: string;
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