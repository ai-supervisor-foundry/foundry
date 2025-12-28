// Test CLI Adapter with simple prompts
// Run with: pnpm tsx test-cli-adapter.ts

import { CLIAdapter } from './src/cliAdapter.js';
import Redis from 'ioredis';
import * as path from 'path';

const testPrompt = 'Say "Hello from CLI Adapter" and nothing else.';
const testCwd = process.cwd();

async function testCLIAdapter() {
  console.log('=== Testing CLI Adapter ===');
  console.log(`Working directory: ${testCwd}`);
  console.log(`Test prompt: ${testPrompt}\n`);

  // Create Redis client for circuit breaker (using same config as supervisor)
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = parseInt(process.env.REDIS_PORT || '6499', 10);
  const redisClient = new Redis({
    host: redisHost,
    port: redisPort,
    db: 0,
  });

  try {
    // Initialize CLI Adapter
    const adapter = new CLIAdapter(redisClient);
    console.log('CLI Adapter initialized\n');

    // Test execution
    console.log('Executing test prompt...');
    const startTime = Date.now();
    const result = await adapter.execute(testPrompt, testCwd, 'auto');
    const duration = Date.now() - startTime;

    console.log(`\n✅ Test completed in ${duration}ms`);
    console.log(`Exit code: ${result.exitCode}`);
    console.log(`Status: ${result.status || 'undefined'}`);
    console.log(`Stdout length: ${result.stdout.length}`);
    console.log(`Stderr length: ${result.stderr.length}`);
    console.log(`\nStdout:\n${result.stdout.substring(0, 500)}`);
    if (result.stderr) {
      console.log(`\nStderr:\n${result.stderr.substring(0, 500)}`);
    }

    // Verify contract: CursorResult interface
    const hasRequiredFields = 
      typeof result.stdout === 'string' &&
      typeof result.stderr === 'string' &&
      typeof result.exitCode === 'number' &&
      typeof result.rawOutput === 'string';
    
    console.log(`\n✅ Adapter contract verified: ${hasRequiredFields}`);
    
  } catch (error) {
    console.error(`\n❌ Test failed: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
  } finally {
    await redisClient.quit();
  }
}

testCLIAdapter().catch(console.error);

