/**
 * Dashboard Integration Example
 * 
 * This example demonstrates how to integrate the LLM Credit SDK with the Tokenix Dashboard
 * for real-time config synchronization and reconciliation logging.
 */

import { LLMCreditSDK } from '../src/sdk';
import { openAIChatExtractor, OpenAIChatCompletionResponse } from '../src/extractors';

async function dashboardIntegrationExample() {
    console.log('🔗 LLM Credit SDK - Dashboard Integration Example\n');

    // Initialize the SDK (works offline by default)
    const sdk = new LLMCreditSDK();
    console.log('✅ SDK initialized in offline mode');
    console.log(`Initial config - Default margin: ${sdk.getConfig().default_margin}, Credit rate: ${sdk.getCreditPerDollar()}\n`);

    // Example 1: Offline Mode - SDK works normally without dashboard
    console.log('📴 Example 1: Offline Mode Operation');

    const offlineEstimate = sdk.estimateCredits({
        model: 'openai:gpt-4',
        feature: 'chat',
        promptTokens: 100,
        completionTokens: 200
    });

    console.log(`Offline estimate: ${offlineEstimate.estimatedCredits} credits`);
    console.log(`Dashboard sync enabled: ${sdk.isDashboardSyncEnabled()}\n`);

    // Example 2: Enable Dashboard Sync
    console.log('🔌 Example 2: Enabling Dashboard Sync');

    try {
        sdk.enableDashboardSync({
            apiKey: 'your-api-key-here', // Replace with actual API key
            endpoint: 'https://api.tokenix.com', // Replace with actual endpoint
            projectId: 'my-project-123'
        });

        console.log(`Dashboard sync enabled: ${sdk.isDashboardSyncEnabled()}`);
        console.log('🔄 Subscribing to real-time config updates...\n');

        // Simulate receiving a config update from dashboard
        setTimeout(() => {
            console.log('📥 Simulating config update from dashboard...');
            // In real usage, this would come from WebSocket/SSE
            const updatedConfig = {
                ...sdk.getConfig(),
                default_margin: 2.5,
                credit_per_dollar: 800 // Different credit rate
            };

            // Trigger internal config update (normally done by dashboard client)
            (sdk as any).eventEmitter.emit('configUpdated', updatedConfig);

            console.log(`Updated config - Default margin: ${sdk.getConfig().default_margin}, Credit rate: ${sdk.getCreditPerDollar()}`);

            // Show how estimates change with new config
            const updatedEstimate = sdk.estimateCredits({
                model: 'openai:gpt-4',
                feature: 'chat',
                promptTokens: 100,
                completionTokens: 200
            });

            console.log(`Updated estimate: ${updatedEstimate.estimatedCredits} credits (was ${offlineEstimate.estimatedCredits})\n`);
        }, 1000);

    } catch (error) {
        console.log('⚠️  Dashboard connection failed (this is expected in demo)');
        console.log('SDK continues to work in offline mode\n');
    }

    // Example 3: Wrapped Call with Dashboard Logging
    console.log('📊 Example 3: LLM Call with Automatic Dashboard Logging');

    // Mock OpenAI response
    const mockOpenAIResponse: OpenAIChatCompletionResponse = {
        id: 'chatcmpl-dashboard-demo',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [{
            index: 0,
            message: {
                role: 'assistant',
                content: 'This is a demo response showing dashboard integration capabilities.'
            },
            finish_reason: 'stop'
        }],
        usage: {
            prompt_tokens: 95,  // Slightly different from estimate
            completion_tokens: 205, // Slightly different from estimate
            total_tokens: 300
        }
    };

    // Simulate LLM API call
    const mockOpenAICall = async (): Promise<OpenAIChatCompletionResponse> => {
        console.log('  🤖 Making LLM API call...');
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay
        return mockOpenAIResponse;
    };

    try {
        const result = await sdk.wrapCall({
            model: 'openai:gpt-4',
            feature: 'chat',
            promptTokens: 100, // Our estimate
            completionTokens: 200, // Our estimate
            callFunction: mockOpenAICall,
            tokenExtractor: openAIChatExtractor
        });

        console.log('  ✅ LLM call completed');
        console.log('  📝 Response:', result.response.choices[0].message.content.substring(0, 50) + '...');
        console.log('  📊 Reconciliation:');
        console.log(`    - Estimated credits: ${result.reconciliation.estimatedCredits}`);
        console.log(`    - Actual tokens used: ${result.reconciliation.actualTokensUsed}`);
        console.log(`    - Credit delta: ${result.reconciliation.estimatedVsActualCreditDelta}`);
        console.log(`    - Cost delta: ${result.reconciliation.costDelta}`);
        console.log(`    - Margin delta: ${result.reconciliation.marginDelta}`);

        if (sdk.isDashboardSyncEnabled()) {
            console.log('  📤 Reconciliation data automatically sent to dashboard');
        } else {
            console.log('  📴 Dashboard sync disabled - data stored locally only');
        }

    } catch (error) {
        console.error('  ❌ LLM call failed:', error);
    }

    console.log();

    // Example 4: Manual Dashboard Operations
    console.log('🔧 Example 4: Manual Dashboard Operations');

    if (sdk.isDashboardSyncEnabled()) {
        console.log('Dashboard sync is enabled');
        console.log('Real-time config updates: Active');
        console.log('Automatic reconciliation logging: Active');
    } else {
        console.log('Dashboard sync is disabled');
        console.log('SDK operating in offline-first mode');
    }

    // Example 5: Error Handling and Resilience
    console.log('\n🛡️  Example 5: Error Handling and Resilience');

    console.log('Testing offline resilience...');

    // Even if dashboard is unavailable, SDK continues to work
    const resilientEstimate = sdk.estimateCredits({
        model: 'anthropic:claude-3-haiku',
        feature: 'summarize',
        promptTokens: 500,
        completionTokens: 100
    });

    console.log(`Estimate (resilient): ${resilientEstimate.estimatedCredits} credits`);
    console.log('✅ SDK remains fully functional even with network issues');

    // Example 6: Cleanup
    console.log('\n🧹 Example 6: Cleanup');

    console.log('Disabling dashboard sync...');
    sdk.disableDashboardSync();
    console.log(`Dashboard sync enabled: ${sdk.isDashboardSyncEnabled()}`);
    console.log('Resources cleaned up successfully');

    // Example 7: Production Usage Pattern
    console.log('\n🏭 Example 7: Production Usage Pattern');

    const productionSDK = new LLMCreditSDK({
        default_margin: 2.0,
        credit_per_dollar: 1000
    });

    // In production, you'd enable dashboard sync conditionally
    const dashboardConfig = process.env.TOKENIX_API_KEY ? {
        apiKey: process.env.TOKENIX_API_KEY,
        endpoint: process.env.TOKENIX_ENDPOINT || 'https://api.tokenix.com',
        projectId: process.env.TOKENIX_PROJECT_ID
    } : null;

    if (dashboardConfig) {
        console.log('📊 Production: Enabling dashboard sync with environment config');
        productionSDK.enableDashboardSync(dashboardConfig);
    } else {
        console.log('📴 Production: Running in offline mode (no API key configured)');
    }

    console.log(`Production SDK ready - Dashboard sync: ${productionSDK.isDashboardSyncEnabled()}`);

    // Cleanup production SDK
    productionSDK.disableDashboardSync();

    console.log('\n✅ Dashboard integration example completed!');
    console.log('\n🔗 Key Features Demonstrated:');
    console.log('   • Offline-first operation');
    console.log('   • Real-time config synchronization');
    console.log('   • Automatic reconciliation logging');
    console.log('   • Graceful error handling');
    console.log('   • Non-blocking network operations');
    console.log('   • Production-ready patterns');
}

// Run the example
if (require.main === module) {
    dashboardIntegrationExample().catch(console.error);
}

export { dashboardIntegrationExample }; 