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
    TokenUsage,
    DashboardSyncConfig,
    ReconciliationLog
} from './types';
import { DEFAULT_CONFIG } from './config';
import { DashboardClient } from './dashboardClient';

/**
 * Simple event emitter for internal SDK events
 */
class EventEmitter {
    private events: { [key: string]: Function[] } = {};

    on(event: string, callback: Function): void {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }

    off(event: string, callback: Function): void {
        if (!this.events[event]) return;
        this.events[event] = this.events[event].filter(cb => cb !== callback);
    }

    emit(event: string, ...args: any[]): void {
        if (!this.events[event]) return;
        this.events[event].forEach(callback => {
            try {
                callback(...args);
            } catch (error) {
                console.error(`Event callback error for '${event}':`, error);
            }
        });
    }
}

/**
 * LLM Credit SDK - Main class for token usage tracking and credit estimation
 */
export class LLMCreditSDK {
    private config: SDKConfig;
    private eventEmitter: EventEmitter;
    private dashboardClient: DashboardClient | null = null;
    private dashboardSyncEnabled = false;

    /**
     * Initialize the SDK with optional custom configuration
     * @param customConfig - Optional custom configuration to override defaults
     */
    constructor(customConfig?: Partial<SDKConfig>) {
        // Deep merge custom config with defaults
        this.config = this.mergeConfigs(DEFAULT_CONFIG, customConfig || {});
        this.eventEmitter = new EventEmitter();

        // Listen for config updates
        this.eventEmitter.on('configUpdated', (newConfig: SDKConfig) => {
            console.log('[LLMCreditSDK] Config updated', newConfig);
            this.config = newConfig;
        });
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

        // Calculate cost with margin in dollars
        const costWithMargin = baseCost * margin;

        // Convert dollars to credits using credit_per_dollar rate
        const estimatedCredits = costWithMargin * this.config.credit_per_dollar;

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
        const actualCostWithMargin = actualCost * margin;
        const actualCredits = actualCostWithMargin * this.config.credit_per_dollar;

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

        // Post reconciliation data to dashboard (if enabled)
        // This is non-blocking and won't affect the response
        this.postReconciliationToDashboard({
            model,
            feature,
            promptTokens,
            completionTokens,
            actualPromptTokens,
            actualCompletionTokens,
            reconciliation
        }).catch(error => {
            // Error already logged in postReconciliationToDashboard
            // This catch prevents unhandled promise rejection
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
            credit_per_dollar: customConfig.credit_per_dollar ?? defaultConfig.credit_per_dollar,
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

    /**
     * Get the current credit per dollar conversion rate
     * @returns Credit per dollar rate
     */
    getCreditPerDollar(): number {
        return this.config.credit_per_dollar;
    }

    /**
     * Enable dashboard synchronization
     * @param config - Dashboard sync configuration
     */
    enableDashboardSync(config: DashboardSyncConfig): void {
        try {
            this.dashboardClient = new DashboardClient(config);
            this.dashboardSyncEnabled = true;

            // Subscribe to config updates from dashboard
            this.dashboardClient.subscribeToConfigUpdates((newConfig: SDKConfig) => {
                this.eventEmitter.emit('configUpdated', newConfig);
            });

            console.log('[LLMCreditSDK] Dashboard sync enabled');
        } catch (error) {
            console.error('[LLMCreditSDK] Failed to enable dashboard sync:', error);
            this.dashboardSyncEnabled = false;
        }
    }

    /**
     * Disable dashboard synchronization
     */
    disableDashboardSync(): void {
        if (this.dashboardClient) {
            this.dashboardClient.unsubscribe();
            this.dashboardClient = null;
        }
        this.dashboardSyncEnabled = false;
        console.log('[LLMCreditSDK] Dashboard sync disabled');
    }

    /**
     * Check if dashboard sync is enabled
     * @returns True if dashboard sync is enabled
     */
    isDashboardSyncEnabled(): boolean {
        return this.dashboardSyncEnabled;
    }

    /**
     * Get current dashboard configuration
     * @returns Dashboard config if enabled, null otherwise
     */
    getDashboardConfig(): DashboardSyncConfig | null {
        return this.dashboardClient?.['config'] || null;
    }

    /**
     * Post reconciliation data to dashboard (if sync is enabled)
     * This method is called internally but can also be used manually
     */
    private async postReconciliationToDashboard(reconciliationData: {
        model: string;
        feature: string;
        promptTokens: number;
        completionTokens: number;
        actualPromptTokens: number;
        actualCompletionTokens: number;
        reconciliation: ReconcileResult;
    }): Promise<void> {
        if (!this.dashboardSyncEnabled || !this.dashboardClient) {
            return; // Silently skip if sync is disabled
        }

        try {
            const log: ReconciliationLog = {
                model: reconciliationData.model,
                feature: reconciliationData.feature,
                promptTokens: reconciliationData.promptTokens,
                completionTokens: reconciliationData.completionTokens,
                actualPromptTokens: reconciliationData.actualPromptTokens,
                actualCompletionTokens: reconciliationData.actualCompletionTokens,
                estimatedCredits: reconciliationData.reconciliation.estimatedCredits,
                actualTokensUsed: reconciliationData.reconciliation.actualTokensUsed,
                actualCost: reconciliationData.reconciliation.actualCost,
                estimatedVsActualCreditDelta: reconciliationData.reconciliation.estimatedVsActualCreditDelta,
                costDelta: reconciliationData.reconciliation.costDelta,
                marginDelta: reconciliationData.reconciliation.marginDelta,
                creditPerDollar: this.getCreditPerDollar(),
                timestamp: new Date().toISOString()
            };

            // Non-blocking call - errors are handled internally by DashboardClient
            await this.dashboardClient.postReconciliation(log);
        } catch (error) {
            // Log error but don't throw - maintain non-blocking behavior
            console.error('[LLMCreditSDK] Failed to post reconciliation to dashboard:', error);
        }
    }
} 