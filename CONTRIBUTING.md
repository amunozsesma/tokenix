# Contributing to LLM Credit SDK

Thank you for your interest in contributing! This guide will help you get started.

## 🚀 Quick Start

1. **Fork the repository**
2. **Clone your fork**:
   ```bash
   git clone https://github.com/[YOUR-USERNAME]/tokenix.git
   cd tokenix
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Run tests to ensure everything works**:
   ```bash
   npm test
   ```

## 🎯 Ways to Contribute

### 🐛 Bug Reports
- Use the [Issue Templates](https://github.com/[USERNAME]/tokenix/issues/new/choose)
- Include minimal reproduction case
- Specify SDK version, Node.js version, and OS

### ✨ Feature Requests
- Check [existing issues](https://github.com/[USERNAME]/tokenix/issues) first
- Describe the use case and expected behavior
- Consider submitting a [Discussion](https://github.com/[USERNAME]/tokenix/discussions) first

### 🔧 Code Contributions
- Bug fixes (no issue required for small fixes)
- New LLM provider support
- Token extractor implementations
- Documentation improvements
- Example applications

## 📋 Development Process

### 1. Setup Development Environment
```bash
# Install dependencies
npm install

# Start development mode
npm run dev

# Run tests in watch mode
npm run test:watch
```

### 2. Making Changes

**Code Style:**
- Follow existing TypeScript patterns
- Use descriptive variable and function names
- Add JSDoc comments for public APIs

**Testing:**
- Add tests for new functionality
- Ensure 100% code coverage for new code
- Run `npm test` before submitting

**Documentation:**
- Update README.md for API changes
- Add examples in `/examples/` for new features
- Update `/docs/` for comprehensive guides

### 3. Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Features
git commit -m "feat: add Anthropic Claude extractor"

# Bug fixes
git commit -m "fix: handle missing usage field in OpenAI response"

# Documentation
git commit -m "docs: add integration example for Next.js"

# Tests
git commit -m "test: add edge cases for credit estimation"

# Breaking changes
git commit -m "feat!: change TokenExtractor interface signature"
```

### 4. Pull Request Process

1. **Create a branch**:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes** following the guidelines above

3. **Test thoroughly**:
   ```bash
   npm run lint
   npm test
   npm run build
   ```

4. **Submit PR** with:
   - Clear title and description
   - Link to related issues
   - Screenshots/examples if applicable
   - Test coverage report

## 🏗️ Project Structure

```
tokenix/
├── src/
│   ├── extractors/          # Token extractor library
│   │   ├── openai.ts       # OpenAI-specific extractors
│   │   └── index.ts        # Library exports
│   ├── types.ts            # TypeScript interfaces
│   ├── config.ts           # Default pricing configuration
│   ├── sdk.ts              # Main SDK class
│   └── index.ts            # Public API exports
├── __tests__/              # Test files
├── examples/               # Usage examples
├── docs/                   # Documentation
├── .github/workflows/      # CI/CD pipelines
└── package.json           # Package configuration
```

## 🎨 Adding New LLM Providers

### 1. Create Provider-Specific Extractor

```typescript
// src/extractors/your-provider.ts
import { TokenExtractor, TokenUsage } from '../types';

export interface YourProviderResponse {
    // Define the response structure
}

export const yourProviderExtractor: TokenExtractor<YourProviderResponse> = {
    providerName: 'your-provider',
    description: 'Your Provider API',
    apiVersion: 'v1',
    extract: (response) => ({
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens
    })
};
```

### 2. Add Default Pricing Configuration

```typescript
// src/config.ts - Add to DEFAULT_CONFIG.models
'your-provider:model-name': {
    prompt_cost_per_1k: 0.01,
    completion_cost_per_1k: 0.02,
    features: {
        'chat': { margin: 2.0 },
        'summarize': { margin: 1.8 }
    }
}
```

### 3. Export from Extractors Library

```typescript
// src/extractors/index.ts
export {
    yourProviderExtractor,
    type YourProviderResponse
} from './your-provider';
```

### 4. Add Tests

```typescript
// __tests__/extractors.test.ts
describe('Your Provider Extractor', () => {
    it('should extract tokens correctly', () => {
        const mockResponse: YourProviderResponse = {
            usage: { input_tokens: 100, output_tokens: 200 }
        };
        
        const result = yourProviderExtractor.extract(mockResponse);
        expect(result.promptTokens).toBe(100);
        expect(result.completionTokens).toBe(200);
    });
});
```

### 5. Create Example

```typescript
// examples/your-provider.ts
import { LLMCreditSDK, yourProviderExtractor } from '@tokenix/llm-credit-sdk';

// Show integration example
```

## 📚 Documentation Standards

### API Documentation
- Use TSDoc format for all public APIs
- Include examples in code comments
- Document edge cases and error conditions

### README Updates
- Update installation instructions if needed
- Add new provider to supported list
- Update quick start examples

### Examples
- Create realistic, runnable examples
- Include error handling
- Add comments explaining key concepts

## 🧪 Testing Standards

### Test Coverage
- Maintain 100% code coverage
- Test both happy path and edge cases
- Mock external dependencies

### Test Organization
```typescript
describe('Feature Name', () => {
    describe('specific functionality', () => {
        it('should handle normal case', () => {
            // Test implementation
        });

        it('should handle edge case', () => {
            // Test edge cases
        });

        it('should throw error for invalid input', () => {
            // Test error conditions
        });
    });
});
```

## 🏷️ Release Process

**For Maintainers:**

1. **Update version** in `package.json`
2. **Update CHANGELOG.md** with new features/fixes
3. **Create and push tag**:
   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```
4. **GitHub Actions** automatically publishes to npm

## 💬 Getting Help

- 🐛 **Bugs**: [GitHub Issues](https://github.com/[USERNAME]/tokenix/issues)
- 💡 **Ideas**: [GitHub Discussions](https://github.com/[USERNAME]/tokenix/discussions)
- 📧 **Direct Contact**: [support@tokenix.dev](mailto:support@tokenix.dev)

## 📜 Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). Please be respectful and inclusive in all interactions.

## 🎉 Recognition

Contributors will be:
- Added to the README contributors section
- Mentioned in release notes for significant contributions
- Invited to join the maintainers team for sustained contributions

Thank you for helping make the LLM Credit SDK better! 🚀 