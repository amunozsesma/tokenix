# Token Extractors

The `TokenExtractor` interface provides a standardized way to extract actual token usage from different LLM provider responses. This allows for building a library of reusable extractors that can be shared across projects.

## Interface Definition

```typescript
interface TokenExtractor<TResponse = any> {
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

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}
```

## Usage

### Using a TokenExtractor with wrapCall

```typescript
import { LLMCreditSDK, openAIChatExtractor } from 'llm-credit-sdk';

const sdk = new LLMCreditSDK();

// Use the built-in OpenAI extractor (recommended)
const result = await sdk.wrapCall({
  model: 'openai:gpt-4',
  feature: 'chat',
  promptTokens: 100,
  completionTokens: 200,
  callFunction: async () => {
    return await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello!' }]
    });
  },
  tokenExtractor: openAIChatExtractor
});
```

## Standard Extractor Patterns

### OpenAI Chat Completions (Built-in)

The SDK includes a built-in extractor for OpenAI that follows the official API specification:

```typescript
import { openAIChatExtractor, OPENAI_EXTRACTORS } from 'llm-credit-sdk';

// Use the built-in extractor directly
const result = await sdk.wrapCall({
  // ... other parameters
  tokenExtractor: openAIChatExtractor
});

// Or access via the extractors collection
const result2 = await sdk.wrapCall({
  // ... other parameters  
  tokenExtractor: OPENAI_EXTRACTORS.chat
});
```

### OpenAI Chat Completions (Custom)

If you need to customize the extraction logic, you can create your own:

```typescript
import { TokenExtractor, OpenAIChatCompletionResponse } from 'llm-credit-sdk';

const customOpenAIExtractor: TokenExtractor<OpenAIChatCompletionResponse> = {
  providerName: 'openai',
  description: 'Custom OpenAI Chat Completions API extractor',
  apiVersion: 'v1',
  extract: (response) => ({
    promptTokens: response.usage?.prompt_tokens || 0,
    completionTokens: response.usage?.completion_tokens || 0
  })
};
```

### Anthropic Claude

```typescript
interface AnthropicResponse {
  content: Array<{ text: string }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

const anthropicExtractor: TokenExtractor<AnthropicResponse> = {
  providerName: 'anthropic',
  description: 'Anthropic Claude API',
  apiVersion: 'v1',
  extract: (response) => ({
    promptTokens: response.usage.input_tokens,
    completionTokens: response.usage.output_tokens
  })
};
```

### Together AI

```typescript
interface TogetherResponse {
  choices: Array<{ text: string }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

const togetherExtractor: TokenExtractor<TogetherResponse> = {
  providerName: 'together',
  description: 'Together AI API',
  extract: (response) => ({
    promptTokens: response.usage.prompt_tokens,
    completionTokens: response.usage.completion_tokens
  })
};
```

### Cohere

```typescript
interface CohereResponse {
  text: string;
  meta?: {
    tokens?: {
      input_tokens?: number;
      output_tokens?: number;
    };
  };
}

const cohereExtractor: TokenExtractor<CohereResponse> = {
  providerName: 'cohere',
  description: 'Cohere API',
  extract: (response) => ({
    promptTokens: response.meta?.tokens?.input_tokens || 0,
    completionTokens: response.meta?.tokens?.output_tokens || 0
  })
};
```

## Creating Custom Extractors

### Step 1: Define Response Type

First, define the TypeScript interface for your LLM provider's response:

```typescript
interface MyProviderResponse {
  result: string;
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
  };
}
```

### Step 2: Implement TokenExtractor

```typescript
const myProviderExtractor: TokenExtractor<MyProviderResponse> = {
  providerName: 'myprovider',
  description: 'My Custom LLM Provider API',
  apiVersion: 'v2',
  extract: (response) => ({
    promptTokens: response.tokenUsage.inputTokens,
    completionTokens: response.tokenUsage.outputTokens
  })
};
```

### Step 3: Use with SDK

```typescript
const result = await sdk.wrapCall({
  model: 'myprovider:custom-model',
  feature: 'chat',
  promptTokens: 100,
  completionTokens: 200,
  callFunction: async () => {
    return await myProvider.generateText({
      prompt: 'Hello world',
      model: 'custom-model'
    });
  },
  tokenExtractor: myProviderExtractor
});
```

## Error Handling

Always include proper error handling in your extractors:

```typescript
const robustExtractor: TokenExtractor<any> = {
  providerName: 'provider',
  extract: (response) => {
    try {
      return {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0
      };
    } catch (error) {
      console.warn('Failed to extract tokens from response:', error);
      return {
        promptTokens: 0,
        completionTokens: 0
      };
    }
  }
};
```

## Building an Extractor Library

### Organizing Extractors

```typescript
// extractors/index.ts
export const EXTRACTORS = {
  openai: {
    chat: openAIChatExtractor,
    completions: openAICompletionsExtractor,
  },
  anthropic: {
    messages: anthropicExtractor,
  },
  together: {
    completions: togetherExtractor,
  },
  cohere: {
    generate: cohereExtractor,
  }
} as const;

// Helper function to get extractor
export function getExtractor(provider: string, endpoint: string) {
  return EXTRACTORS[provider]?.[endpoint];
}
```

### Usage with Library

```typescript
import { getExtractor } from './extractors';

const extractor = getExtractor('openai', 'chat');
if (extractor) {
  const result = await sdk.wrapCall({
    // ... other params
    tokenExtractor: extractor
  });
}
```

## Benefits

1. **Standardization**: Consistent interface across all providers
2. **Reusability**: Extractors can be shared and reused across projects
3. **Type Safety**: Full TypeScript support with proper generic typing
4. **Metadata**: Providers and versions are documented within the extractor
5. **Library Building**: Enables creation of community-maintained extractor libraries
6. **Future-Proof**: Extensible design for new providers and response formats 