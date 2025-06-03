# Examples

This directory contains practical examples demonstrating how to use the LLM Credit SDK in various scenarios.

## Available Examples

### 📚 [basic-usage.ts](./basic-usage.ts)
**What it demonstrates:**
- Core SDK functionality
- Credit estimation before API calls
- Usage reconciliation after API calls
- Wrapped LLM calls with automatic tracking
- Cost comparison across different models

**Run it:**
```bash
npm install -g ts-node
ts-node examples/basic-usage.ts
```

### 🏢 [real-world-integration.ts](./real-world-integration.ts)
**What it demonstrates:**
- Production-ready integration patterns
- User billing and credit management
- Batch processing with credit tracking
- Error handling for insufficient credits
- Custom configuration for business needs
- Pre-call cost estimation

**Run it:**
```bash
ts-node examples/real-world-integration.ts
```

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install @tokenix/llm-credit-sdk
   ```

2. **Basic usage:**
   ```typescript
   import { LLMCreditSDK } from '@tokenix/llm-credit-sdk';
   
   const sdk = new LLMCreditSDK();
   
   // Estimate credits before making a call
   const estimate = sdk.estimateCredits({
     model: 'openai:gpt-4',
     feature: 'chat',
     promptTokens: 100,
     completionTokens: 200
   });
   ```

3. **With real API integration:**
   ```typescript
   import { openAIChatExtractor } from '@tokenix/llm-credit-sdk';
   
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

## Integration Patterns

### 🔒 **Credit-First Pattern** (Recommended)
Always estimate credits and check user balance before making API calls:

```typescript
// 1. Estimate cost
const estimate = sdk.estimateCredits({...});

// 2. Check user balance
if (userCredits < estimate.estimatedCredits) {
  throw new Error('Insufficient credits');
}

// 3. Make the call
const result = await sdk.wrapCall({...});

// 4. Deduct actual usage
await deductCredits(userId, result.reconciliation.actualTokensUsed);
```

### 📊 **Analytics Pattern**
Track usage patterns and optimize costs:

```typescript
// Log detailed usage for analytics
await logUsage({
  userId,
  model,
  feature,
  estimatedCredits: result.reconciliation.estimatedCredits,
  actualCredits: result.reconciliation.actualTokensUsed,
  delta: result.reconciliation.estimatedVsActualCreditDelta,
  costDelta: result.reconciliation.costDelta,
  marginDelta: result.reconciliation.marginDelta,
  timestamp: new Date()
});
```

### 🎯 **Tiered Pricing Pattern**
Implement different pricing for different user tiers:

```typescript
const sdk = new LLMCreditSDK({
  models: {
    'openai:gpt-4': {
      features: {
        'basic_chat': { margin: 2.0 },    // 100% markup
        'premium_chat': { margin: 2.5 },  // 150% markup
        'enterprise_chat': { margin: 1.5 } // 50% markup
      }
    }
  }
});
```

## Common Use Cases

- **🤖 Chatbots & AI Assistants**: Track conversations and bill per message
- **📝 Content Generation**: Monitor costs for article/blog generation
- **🔍 AI-Powered Search**: Bill users based on search complexity
- **📊 Data Analysis**: Track costs for AI-driven insights
- **🎨 Creative Tools**: Monitor usage for AI art/music generation
- **📚 Education Platforms**: Bill for AI tutoring sessions

## Need Help?

- 📖 **Documentation**: [../docs/](../docs/)
- 🐛 **Issues**: [GitHub Issues](https://github.com/amunozsesma/tokenix/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/amunozsesma/tokenix/discussions)
- 📧 **Support**: [support@tokenix.dev](mailto:support@tokenix.dev)

## Contributing

Found a useful pattern? Submit a PR with a new example! We especially welcome:
- Integration examples with other LLM providers
- Advanced billing patterns
- Performance optimization techniques
- Real-world production setups 