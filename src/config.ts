import { SDKConfig } from './types';

/**
 * Default configuration with pricing for common LLM models
 * Prices are based on typical provider pricing as of 2024
 */
export const DEFAULT_CONFIG: SDKConfig = {
    default_margin: 1.5,
    models: {
        // OpenAI Models
        'openai:gpt-4': {
            prompt_cost_per_1k: 0.03,
            completion_cost_per_1k: 0.06,
            features: {
                chat: { margin: 2.0 },
                summarize: { margin: 1.8 },
                generate_code: { margin: 2.2 },
                translate: { margin: 1.6 }
            }
        },
        'openai:gpt-4-turbo': {
            prompt_cost_per_1k: 0.01,
            completion_cost_per_1k: 0.03,
            features: {
                chat: { margin: 1.8 },
                summarize: { margin: 1.6 },
                generate_code: { margin: 2.0 }
            }
        },
        'openai:gpt-3.5-turbo': {
            prompt_cost_per_1k: 0.001,
            completion_cost_per_1k: 0.002,
            features: {
                chat: { margin: 1.5 },
                summarize: { margin: 1.4 },
                generate_code: { margin: 1.6 }
            }
        },

        // Anthropic Models
        'anthropic:claude-3-opus': {
            prompt_cost_per_1k: 0.015,
            completion_cost_per_1k: 0.075,
            features: {
                chat: { margin: 2.0 },
                summarize: { margin: 1.8 },
                generate_code: { margin: 2.2 }
            }
        },
        'anthropic:claude-3-sonnet': {
            prompt_cost_per_1k: 0.003,
            completion_cost_per_1k: 0.015,
            features: {
                chat: { margin: 1.8 },
                summarize: { margin: 1.6 }
            }
        },
        'anthropic:claude-3-haiku': {
            prompt_cost_per_1k: 0.00025,
            completion_cost_per_1k: 0.00125,
            features: {
                chat: { margin: 1.4 },
                summarize: { margin: 1.3 }
            }
        },

        // Together AI Models
        'together:llama3-8b': {
            prompt_cost_per_1k: 0.0002,
            completion_cost_per_1k: 0.0002,
            features: {
                chat: { margin: 1.5 },
                summarize: { margin: 1.4 }
            }
        },
        'together:llama3-70b': {
            prompt_cost_per_1k: 0.0009,
            completion_cost_per_1k: 0.0009,
            features: {
                chat: { margin: 1.6 },
                summarize: { margin: 1.5 },
                generate_code: { margin: 1.8 }
            }
        },

        // Cohere Models
        'cohere:command': {
            prompt_cost_per_1k: 0.001,
            completion_cost_per_1k: 0.002,
            features: {
                chat: { margin: 1.5 },
                summarize: { margin: 1.4 }
            }
        }
    }
}; 