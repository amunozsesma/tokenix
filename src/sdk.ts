import {
    SDKConfig,
    ModelConfig,
    EstimateCreditsInput,
    EstimateCreditsResult,
    ReconcileInput,
    ReconcileResult,
    WrapCallInput,
    WrapCallResult,
    TokenExtractor,
    TokenUsage
} from './types';
import { DEFAULT_CONFIG } from './config';

/**
 * LLM Credit SDK - Main class for token usage tracking and credit estimation
 */
export class LLMCreditSDK {
    private config: SDKConfig;

    /**
     * Initialize the SDK with optional custom configuration
     * @param customConfig - Optional custom configuration to override defaults
     */
    constructor(customConfig?: Partial<SDKConfig>) {
        // Deep merge custom config with defaults
        this.config = this.mergeConfigs(DEFAULT_CONFIG, customConfig || {});
    }

    /**
     * Estimate credits for an LLM call before making it
     * @param input - Parameters for credit estimation
     * @returns Estimated number of credits
     */
    estimateCredits(input: EstimateCreditsInput): EstimateCreditsResult {
        const { model, feature, promptTokens, completionTokens } = input;

        // Get model configuration
        const modelConfig = this.getModelConfig(model);

        // Calculate base cost in dollars
        const promptCost = (promptTokens / 1000) * modelConfig.prompt_cost_per_1k;
        const completionCost = (completionTokens / 1000) * modelConfig.completion_cost_per_1k;
        const baseCost = promptCost + completionCost;

        // Get margin for this feature or use default
        const margin = this.getMarginForFeature(modelConfig, feature);

        // Calculate estimated credits
        const estimatedCredits = baseCost * margin;

        return {
            estimatedCredits: Number(estimatedCredits.toFixed(6))
        };
    }

    /**
     * Reconcile estimated vs actual usage after an LLM call
     * @param input - Parameters for reconciliation
     * @returns Reconciliation results with actual usage and delta
     */
    reconcile(input: ReconcileInput): ReconcileResult {
        const {
            model,
            feature,
            promptTokens,
            completionTokens,
            actualPromptTokens,
            actualCompletionTokens
        } = input;

        // Get estimated credits
        const estimated = this.estimateCredits({
            model,
            feature,
            promptTokens,
            completionTokens
        });

        // Calculate estimated cost (without margin)
        const modelConfig = this.getModelConfig(model);
        const estimatedPromptCost = (promptTokens / 1000) * modelConfig.prompt_cost_per_1k;
        const estimatedCompletionCost = (completionTokens / 1000) * modelConfig.completion_cost_per_1k;
        const estimatedCost = estimatedPromptCost + estimatedCompletionCost;

        // Calculate actual usage
        const actualPromptCost = (actualPromptTokens / 1000) * modelConfig.prompt_cost_per_1k;
        const actualCompletionCost = (actualCompletionTokens / 1000) * modelConfig.completion_cost_per_1k;
        const actualCost = actualPromptCost + actualCompletionCost;
        const actualTokensUsed = actualPromptTokens + actualCompletionTokens;

        // Get margin and calculate actual credits
        const margin = this.getMarginForFeature(modelConfig, feature);
        const actualCredits = actualCost * margin;

        // Calculate deltas
        const estimatedVsActualCreditDelta = actualCredits - estimated.estimatedCredits;
        const costDelta = actualCost - estimatedCost;
        const marginDelta = (actualCredits / actualCost) - (estimated.estimatedCredits / estimatedCost);

        return {
            estimatedCredits: estimated.estimatedCredits,
            actualTokensUsed,
            actualCost: Number(actualCost.toFixed(6)),
            estimatedVsActualCreditDelta: Number(estimatedVsActualCreditDelta.toFixed(6)),
            costDelta: Number(costDelta.toFixed(6)),
            marginDelta: Number(marginDelta.toFixed(6))
        };
    }

    /**
     * Wrap an LLM call with automatic credit estimation and reconciliation
     * @param input - Parameters for the wrapped call
     * @returns Response from the LLM call plus reconciliation data
     */
    async wrapCall<T>(input: WrapCallInput<T>): Promise<WrapCallResult<T>> {
        const { model, feature, promptTokens, completionTokens, callFunction, tokenExtractor } = input;

        // Get initial estimate
        const estimate = this.estimateCredits({
            model,
            feature,
            promptTokens,
            completionTokens
        });

        // Make the actual LLM call
        const response = await callFunction();

        // Extract actual token usage using the provided extractor
        let actualPromptTokens = promptTokens;
        let actualCompletionTokens = completionTokens;

        if (tokenExtractor) {
            const tokenUsage = tokenExtractor.extract(response);
            actualPromptTokens = tokenUsage.promptTokens;
            actualCompletionTokens = tokenUsage.completionTokens;
        }
        // If no extractor is provided, use the original estimates

        // Reconcile actual vs estimated
        const reconciliation = this.reconcile({
            model,
            feature,
            promptTokens,
            completionTokens,
            actualPromptTokens,
            actualCompletionTokens
        });

        return {
            response,
            reconciliation
        };
    }

    /**
     * Get configuration for a specific model
     * @param model - Model name (e.g., 'openai:gpt-4')
     * @returns Model configuration
     * @throws Error if model is not found
     */
    private getModelConfig(model: string): ModelConfig {
        const modelConfig = this.config.models[model];
        if (!modelConfig) {
            throw new Error(`Model '${model}' not found in configuration. Available models: ${Object.keys(this.config.models).join(', ')}`);
        }
        return modelConfig;
    }

    /**
     * Get margin for a specific feature within a model
     * @param modelConfig - Model configuration
     * @param feature - Feature name
     * @returns Margin multiplier
     */
    private getMarginForFeature(modelConfig: ModelConfig, feature: string): number {
        const featureConfig = modelConfig.features?.[feature];
        return featureConfig?.margin || this.config.default_margin;
    }

    /**
     * Deep merge two configuration objects
     * @param defaultConfig - Default configuration
     * @param customConfig - Custom configuration to merge
     * @returns Merged configuration
     */
    private mergeConfigs(defaultConfig: SDKConfig, customConfig: Partial<SDKConfig>): SDKConfig {
        const result: SDKConfig = {
            default_margin: customConfig.default_margin ?? defaultConfig.default_margin,
            models: { ...defaultConfig.models }
        };

        // Merge custom models
        if (customConfig.models) {
            for (const [modelName, modelConfig] of Object.entries(customConfig.models)) {
                if (result.models[modelName]) {
                    // Merge with existing model config
                    result.models[modelName] = {
                        ...result.models[modelName],
                        ...modelConfig,
                        features: {
                            ...result.models[modelName].features,
                            ...modelConfig.features
                        }
                    };
                } else {
                    // Add new model config
                    result.models[modelName] = modelConfig;
                }
            }
        }

        return result;
    }

    /**
     * Get the current configuration (for debugging/inspection)
     * @returns Current SDK configuration
     */
    getConfig(): SDKConfig {
        return { ...this.config };
    }

    /**
     * Get list of available models
     * @returns Array of model names
     */
    getAvailableModels(): string[] {
        return Object.keys(this.config.models);
    }

    /**
     * Get list of available features for a specific model
     * @param model - Model name
     * @returns Array of feature names
     */
    getAvailableFeatures(model: string): string[] {
        const modelConfig = this.getModelConfig(model);
        return Object.keys(modelConfig.features || {});
    }
} 