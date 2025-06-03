import { TokenExtractor, TokenUsage } from '../types';

/**
 * OpenAI Chat Completion response structure based on official API documentation
 */
export interface OpenAIChatCompletionResponse {
    id: string;
    object: 'chat.completion';
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: {
            role: 'assistant';
            content: string;
            refusal?: string | null;
        };
        logprobs?: any;
        finish_reason: 'stop' | 'length' | 'function_call' | 'content_filter' | null;
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
        completion_tokens_details?: {
            reasoning_tokens?: number;
        };
        prompt_tokens_details?: {
            cached_tokens?: number;
        };
    };
    system_fingerprint?: string;
}

/**
 * Token extractor for OpenAI Chat Completions API
 * 
 * This extractor handles the standard OpenAI Chat Completions response format
 * as documented at https://platform.openai.com/docs/guides/text-generation
 */
export const openAIChatExtractor: TokenExtractor<OpenAIChatCompletionResponse> = {
    providerName: 'openai',
    description: 'OpenAI Chat Completions API',
    apiVersion: 'v1',
    extract: (response: OpenAIChatCompletionResponse): TokenUsage => {
        if (!response.usage) {
            throw new Error('OpenAI response missing usage information');
        }

        return {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens
        };
    }
};

/**
 * Generic OpenAI extractor that works with various response formats
 * that follow the standard OpenAI usage pattern
 */
export const openAIGenericExtractor: TokenExtractor<any> = {
    providerName: 'openai',
    description: 'Generic OpenAI API extractor for various endpoints',
    extract: (response: any): TokenUsage => {
        if (!response?.usage) {
            throw new Error('OpenAI response missing usage information');
        }

        const usage = response.usage;

        return {
            promptTokens: usage.prompt_tokens || 0,
            completionTokens: usage.completion_tokens || 0
        };
    }
};

/**
 * Collection of OpenAI extractors for different use cases
 */
export const OPENAI_EXTRACTORS = {
    chat: openAIChatExtractor,
    generic: openAIGenericExtractor
} as const; 