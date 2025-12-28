// Test individual providers
// Run with: pnpm tsx test-individual-providers.ts

import { dispatchToCursor } from './src/cursorCLI.js';
import { dispatchToClaude } from './src/providers/claudeCLI.js';
import { dispatchToCodex } from './src/providers/codexCLI.js';
import { dispatchToGemini } from './src/providers/geminiCLI.js';

const testPrompt = 'Say "Hello from [PROVIDER]" and nothing else.';
const testCwd = process.cwd();

async function testProvider(
  name: string,
  dispatcher: (prompt: string, cwd: string, agentMode?: string) => Promise<any>
): Promise<void> {
  console.log(`\n=== Testing ${name} ===`);
  const prompt = testPrompt.replace('[PROVIDER]', name);
  
  try {
    const startTime = Date.now();
    const result = await dispatcher(prompt, testCwd, 'auto');
    const duration = Date.now() - startTime;
    
    console.log(`✅ ${name} succeeded in ${duration}ms`);
    console.log(`Exit code: ${result.exitCode}`);
    console.log(`Stdout: ${result.stdout.substring(0, 200)}`);
    if (result.stderr) {
      console.log(`Stderr: ${result.stderr.substring(0, 200)}`);
    }
    
    // Verify contract
    const hasContract = 
      typeof result.stdout === 'string' &&
      typeof result.stderr === 'string' &&
      typeof result.exitCode === 'number' &&
      typeof result.rawOutput === 'string';
    console.log(`Contract verified: ${hasContract}`);
  } catch (error) {
    console.log(`❌ ${name} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main() {
  console.log('Testing Individual CLI Providers');
  console.log(`Working directory: ${testCwd}\n`);
  
  await testProvider('Cursor', dispatchToCursor);
  await testProvider('Claude', dispatchToClaude);
  await testProvider('Codex', dispatchToCodex);
  await testProvider('Gemini', dispatchToGemini);
  
  console.log('\n=== All Tests Complete ===');
}

main().catch(console.error);

