// Simple test script to verify each CLI provider works
// Run with: npx tsx test-providers.ts or: node --loader ts-node/esm test-providers.ts

import { dispatchToCursor } from './src/cursorCLI.js';
import { dispatchToClaude } from './src/providers/claudeCLI.js';
import { dispatchToCodex } from './src/providers/codexCLI.js';
import { dispatchToGemini } from './src/providers/geminiCLI.js';

const testPrompt = 'Say "Hello from [PROVIDER_NAME]" and nothing else.';
const testCwd = process.cwd();

async function testProvider(
  name: string,
  dispatcher: (prompt: string, cwd: string, agentMode?: string) => Promise<any>
): Promise<void> {
  console.log(`\n=== Testing ${name} ===`);
  const prompt = testPrompt.replace('[PROVIDER_NAME]', name);
  
  try {
    const startTime = Date.now();
    const result = await dispatcher(prompt, testCwd, 'auto');
    const duration = Date.now() - startTime;
    
    console.log(`✅ ${name} succeeded in ${duration}ms`);
    console.log(`Exit code: ${result.exitCode}`);
    console.log(`Stdout length: ${result.stdout.length}`);
    console.log(`Stderr length: ${result.stderr.length}`);
    console.log(`Stdout preview: ${result.stdout.substring(0, 200)}`);
    if (result.stderr) {
      console.log(`Stderr: ${result.stderr.substring(0, 200)}`);
    }
  } catch (error) {
    console.log(`❌ ${name} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main() {
  console.log('Testing CLI Providers');
  console.log(`Working directory: ${testCwd}`);
  console.log(`Test prompt: ${testPrompt}`);
  
  // Test each provider
  await testProvider('Cursor', dispatchToCursor);
  await testProvider('Claude', dispatchToClaude);
  await testProvider('Codex', dispatchToCodex);
  await testProvider('Gemini', dispatchToGemini);
  
  console.log('\n=== Tests Complete ===');
}

main().catch(console.error);

