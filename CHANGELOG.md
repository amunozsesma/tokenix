# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial production-ready release
- GitHub Actions CI/CD workflows
- Examples directory with comprehensive usage examples
- Proper npm package configuration

## [0.1.0] - 2024-01-XX

### Added
- Core SDK functionality with `estimateCredits()`, `reconcile()`, and `wrapCall()` methods
- TypeScript-first design with full type safety
- Default pricing configuration for major LLM providers:
  - OpenAI (GPT-4, GPT-4-turbo, GPT-3.5-turbo)
  - Anthropic (Claude-3-opus, sonnet, haiku)
  - Together AI (Llama3-8b, 70b)
  - Cohere (Command)
- Feature-specific margin configuration
- Token extractor library with OpenAI Chat Completions support
- Comprehensive test suite with 100% coverage
- Documentation and usage examples
- MIT license

### Features
- **Credit Estimation**: Calculate costs before API calls using token counts and pricing
- **Usage Reconciliation**: Compare estimated vs actual usage with delta tracking
- **Wrapped Calls**: Automatic credit tracking with LLM API integration
- **Configuration System**: Deep merging of custom pricing with defaults
- **Token Extractors**: Standardized interface for extracting actual usage from responses
- **Multi-Provider Support**: Pricing for OpenAI, Anthropic, Together AI, and Cohere
- **TypeScript Support**: Full type definitions and IntelliSense support

### Technical Details
- Stateless design with no persistence requirements
- Numeric precision to 6 decimal places for accurate calculations
- Error handling with descriptive messages
- Generic typing for flexible response formats
- Extensible architecture for adding new providers

## Release Guidelines

### Version Bumping
- **MAJOR** (x.0.0): Breaking changes to public API
- **MINOR** (0.x.0): New features, backward compatible
- **PATCH** (0.0.x): Bug fixes, backward compatible

### Release Process
1. Update version in `package.json`
2. Update `CHANGELOG.md` with release notes
3. Create and push git tag: `git tag v0.1.0 && git push origin v0.1.0`
4. GitHub Actions will automatically publish to npm and create GitHub release 