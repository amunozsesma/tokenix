# LLM Credit SDK

A TypeScript SDK for tracking AI token usage and credit estimation, designed for solo developers and startups monetizing their apps via usage-based billing.

## Features

✅ **Stateless & Lightweight** - No local storage or persistence  
✅ **Credit Estimation** - Estimate costs before making LLM calls  
✅ **Usage Reconciliation** - Track actual vs estimated usage  
✅ **Multi-Provider Support** - OpenAI, Anthropic, Together AI, Cohere  
✅ **Custom Pricing** - Override default pricing with your own margins  
✅ **TypeScript First** - Full type safety and IntelliSense support  
✅ **Framework Agnostic** - Works with any Node.js/TypeScript project  

## Installation

```bash
npm install llm-credit-sdk
```

## Quick Start

```typescript
import { LLMCreditSDK } from 'llm-credit-sdk';

// Initialize SDK
const sdk = new LLMCreditSDK();

// Estimate credits before making a call
const estimate = sdk.estimateCredits({
  model: 'openai:gpt-4',
  feature: 'chat',
  promptTokens: 150,
  completionTokens: 350
});
console.log(`Estimated credits: ${estimate.estimatedCredits}`);

// Reconcile actual usage after the call
const reconciliation = sdk.reconcile({
  model: 'openai:gpt-4',
  feature: 'chat',
  promptTokens: 150,
  completionTokens: 350,
  actualPromptTokens: 160,
  actualCompletionTokens: 340
});
console.log('Usage delta:', reconciliation.estimatedVsActualDelta);
```

## Core Concepts

### Token
Unit of measurement used by LLM providers to charge for usage.

### Credit
Unit of usage abstraction exposed to your app users. Credits = Token Cost × Margin.

### Margin
Multiplier added on top of token cost to form credit cost. Used to control profitability.

### Feature
A use case or endpoint in your app (e.g., `chat`, `summarize`, `generate_code`).

## API Reference

### `estimateCredits(input)`

Estimate credits for an LLM call before making it.

```typescript
interface EstimateCreditsInput {
  model: string;          // e.g., 'openai:gpt-4'
  feature: string;        // e.g., 'chat'
  promptTokens: number;   // Estimated prompt tokens
  completionTokens: number; // Estimated completion tokens
}

interface EstimateCreditsResult {
  estimatedCredits: number;
}
```

### `reconcile(input)`

Reconcile estimated vs actual usage after an LLM call.

```typescript
interface ReconcileInput {
  model: string;
  feature: string;
  promptTokens: number;      // Original estimate
  completionTokens: number;  // Original estimate
  actualPromptTokens: number;    // Actual usage
  actualCompletionTokens: number; // Actual usage
}

interface ReconcileResult {
  estimatedCredits: number;     // Original estimate
  actualTokensUsed: number;     // Total actual tokens
  actualCost: number;           // Actual cost in dollars
  estimatedVsActualDelta: number; // Difference (+ = underestimated)
}
```

### `wrapCall(input)`

Wrap an LLM call with automatic estimation and reconciliation.

```typescript
interface WrapCallInput<T> {
  model: string;
  feature: string;
  promptTokens: number;
  completionTokens: number;
  callFunction: () => Promise<T>;
  extractActualTokens?: (response: T) => {
    promptTokens: number;
    completionTokens: number;
  };
}

interface WrapCallResult<T> {
  response: T;
  reconciliation: ReconcileResult;
}
```

**Example:**
```typescript
const result = await sdk.wrapCall({
  model: 'openai:gpt-4',
  feature: 'chat',
  promptTokens: 150,
  completionTokens: 350,
  callFunction: async () => {
    // Your LLM API call here
    return await openai.chat.completions.create({...});
  },
  extractActualTokens: (response) => ({
    promptTokens: response.usage.prompt_tokens,
    completionTokens: response.usage.completion_tokens
  })
});

console.log('Response:', result.response);
console.log('Credits used:', result.reconciliation.actualTokensUsed);
```

## Supported Models

### OpenAI
- `openai:gpt-4`
- `openai:gpt-4-turbo`
- `openai:gpt-3.5-turbo`

### Anthropic
- `anthropic:claude-3-opus`
- `anthropic:claude-3-sonnet`
- `anthropic:claude-3-haiku`

### Together AI
- `together:llama3-8b`
- `together:llama3-70b`

### Cohere
- `cohere:command`

## Custom Configuration

Override default pricing and add your own models:

```typescript
import { LLMCreditSDK } from 'llm-credit-sdk';

const sdk = new LLMCreditSDK({
  default_margin: 2.0, // Higher default margin
  models: {
    'custom:my-model': {
      prompt_cost_per_1k: 0.005,
      completion_cost_per_1k: 0.01,
      features: {
        'my_feature': { margin: 3.0 }
      }
    },
    // Override existing model pricing
    'openai:gpt-4': {
      prompt_cost_per_1k: 0.035, // Custom pricing
      completion_cost_per_1k: 0.065,
      features: {
        'chat': { margin: 2.5 } // Higher margin for chat
      }
    }
  }
});
```

## Utility Methods

```typescript
// Get available models
const models = sdk.getAvailableModels();
console.log('Available models:', models);

// Get available features for a model
const features = sdk.getAvailableFeatures('openai:gpt-4');
console.log('GPT-4 features:', features);

// Get current configuration
const config = sdk.getConfig();
console.log('Current config:', config);
```

## Error Handling

The SDK throws descriptive errors for invalid configurations:

```typescript
try {
  sdk.estimateCredits({
    model: 'nonexistent:model',
    feature: 'chat',
    promptTokens: 100,
    completionTokens: 200
  });
} catch (error) {
  console.error(error.message);
  // "Model 'nonexistent:model' not found in configuration. Available models: ..."
}
```

## Real-World Integration Examples

### With OpenAI SDK

```typescript
import OpenAI from 'openai';
import { LLMCreditSDK } from 'llm-credit-sdk';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const sdk = new LLMCreditSDK();

async function chatWithGPT(message: string, userId: string) {
  const result = await sdk.wrapCall({
    model: 'openai:gpt-4',
    feature: 'chat',
    promptTokens: 100, // Estimate based on message length
    completionTokens: 200, // Conservative estimate
    callFunction: async () => {
      return await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: message }]
      });
    },
    extractActualTokens: (response) => ({
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0
    })
  });

  // Log usage for billing
  console.log(`User ${userId} used ${result.reconciliation.actualTokensUsed} credits`);
  
  return result.response.choices[0].message.content;
}
```

### With Express.js API

```typescript
import express from 'express';
import { LLMCreditSDK } from 'llm-credit-sdk';

const app = express();
const sdk = new LLMCreditSDK();

app.post('/api/summarize', async (req, res) => {
  const { text, userId } = req.body;
  
  try {
    // Estimate tokens (you might use a tokenizer library)
    const estimatedTokens = Math.ceil(text.length / 4);
    
    const result = await sdk.wrapCall({
      model: 'openai:gpt-3.5-turbo',
      feature: 'summarize',
      promptTokens: estimatedTokens,
      completionTokens: estimatedTokens * 0.3, // Summaries are typically shorter
      callFunction: async () => {
        // Your LLM call here
        return await summarizeText(text);
      }
    });

    // Send usage data to your billing system
    await logUsage(userId, result.reconciliation);
    
    res.json({
      summary: result.response,
      creditsUsed: result.reconciliation.actualTokensUsed
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Performance Considerations

- ✅ **Synchronous operations** - All calculations are done in-memory
- ✅ **No I/O operations** - No file system or network calls
- ✅ **Lightweight** - Minimal memory footprint
- ✅ **Serverless friendly** - Works in edge environments
- ✅ **No side effects** - Pure functions, predictable behavior

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run the example
npm run example

# Watch mode for development
npm run dev
```

## License

MIT License - see LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 