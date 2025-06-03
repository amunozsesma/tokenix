/**
 * Configuration structure for model pricing and features
 */
export interface SDKConfig {
    default_margin: number;
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
    estimatedVsActualDelta: number;
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
    extractActualTokens?: (response: T) => { promptTokens: number; completionTokens: number };
}

/**
 * Result of a wrapped LLM call with reconciliation data
 */
export interface WrapCallResult<T = any> {
    response: T;
    reconciliation: ReconcileResult;
} 