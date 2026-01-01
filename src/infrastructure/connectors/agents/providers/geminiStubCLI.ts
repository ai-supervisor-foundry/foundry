// Gemini CLI Dispatcher
// Based on https://github.com/google-gemini/gemini-cli
// Installation: npm install -g @google/gemini-cli
// Command: gemini --output-format json [prompt] for structured output

import { ProviderResult } from '../../../../domain/executors/haltDetection';
import { logVerbose } from '../../../adapters/logging/logger';
import { GEMINI_API_USAGE_EXHAUSTED } from '../../constants/stubs/responses/geminiStub/geminiAPIUsageExhausted';

function log(message: string, ...args: unknown[]): void {
  const timestamp = new Date().toISOString();
  logVerbose('GeminiCLI', message, { args });
}

export class GeminiStubCLI {
  /**
   * List available sessions using `gemini --list-sessions`
   */
  async listSessions(): Promise<Array<{ snippet: string, timeRelative: string, sessionId: string }>> {
    return [];
  }
}

export const geminiStubCLI = new GeminiStubCLI();

function findJSONInString(stdout: string): string | null {
  const jsonMatch = stdout.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }
  return null;
}

export async function dispatchToGeminiStub(
  prompt: string,
  cwd: string = './',
  agentMode?: string,
  sessionId?: string,
  featureId?: string
): Promise<ProviderResult> {
  log(`Executing Gemini CLI in directory: ${cwd}`);
  log(`Prompt length: ${prompt.length} characters`);
  
  // Gemini CLI: npm install -g @google/gemini-cli or use npx @google/gemini-cli
  const geminiCommand = process.env.GEMINI_CLI_PATH || 'npx';
  const useNpx = true
  const args: string[] = [];
  
  // If using npx, add package name first
  if (useNpx) {
    args.push('@google/gemini-cli');
  }
  
  // Set output format to json to get session ID and stats
  args.push('--output-format', 'json');

  // Resume session if provided
  if (sessionId) {
    args.push('-r', sessionId);
  }

  // eg: gemini --include-directories ../lib,../docs
  args.push('--include-directories', cwd);
  
  // Set model if provided (agentMode maps to Gemini model)
  if (agentMode && agentMode !== 'auto') {
    args.push('--model', agentMode);
  }

  // Yolo by default (if supported by CLI, otherwise ignore)
  // args.push('--yolo'); // Gemini CLI might not support this flag, keeping strict
  
  // Prepend feature tag to prompt if starting new session
  let finalPrompt = prompt;
  if (!sessionId && featureId) {
    finalPrompt = `[Feature: ${featureId}]\n\n${prompt}`;
  }

  // Add prompt as argument
  args.push(finalPrompt);
  
  log(`Spawning: ${geminiCommand} ${args.join(' ')}`);

  return new Promise<ProviderResult>((resolve, reject) => {

    log(`Gemini CLI process started, PID: ${0}`);

    let stdout = GEMINI_API_USAGE_EXHAUSTED.response;
    let stderr = '';

    const exitCode = GEMINI_API_USAGE_EXHAUSTED.exitCode;
    const rawOutput = stdout + stderr;

    log(`Gemini CLI process closed, exit code: ${exitCode}`);
    logVerbose('GeminiCLI', 'Process closed', { exit_code: exitCode, raw_output: rawOutput });

    let status: string | undefined;
    let outputContent = rawOutput;
    let newSessionId: string | undefined = sessionId;
    let usage: { tokens?: number, durationSeconds?: number } = {};

    // @ts-ignore
    if (exitCode !== 0) {
      status = 'FAILED';
      log(`Gemini CLI execution FAILED (exit code: ${exitCode})`);
    } else {
      log(`Gemini CLI execution SUCCESS`);
      
      // Parse JSON output
      try {
        // Output might contain non-JSON preamble/postamble, try to find the JSON object
        // Gemini CLI output format: { "session_id": "...", "content": "...", "stats": ... }
        const jsonMatch = findJSONInString(stdout);
        if (jsonMatch) {
          logVerbose('GeminiCLI', 'Found JSON match', { json_match: jsonMatch });
          const parsed = JSON.parse(jsonMatch);
          logVerbose('GeminiCLI', 'Parsed JSON', { parsed });
          outputContent = parsed.content || parsed.response || stdout; // Fallback
          newSessionId = parsed.session_id || parsed.sessionId;
          
          if (parsed.stats && parsed.stats.models) {
            const modelKeys = Object.keys(parsed.stats.models);
            let totalTokens = 0;
            for (const key of modelKeys) {
              const modelStats = parsed.stats.models[key];
              if (modelStats && modelStats.tokens && typeof modelStats.tokens.total === 'number') {
                totalTokens += modelStats.tokens.total;
              }
            }
            if (totalTokens > 0) {
              usage.tokens = totalTokens;
            }
          }
        }
      } catch (e) {
        log(`Failed to parse JSON output: ${e}`);
        // Fallback to raw output if parse fails
      }
    }

    resolve({
      stdout: stdout, // Keep original stdout for debug
      stderr: stderr,
      exitCode,
      rawOutput, // Full raw output
      status: status,
      output: outputContent, // Cleaned content
      sessionId: newSessionId,
      usage
    });
  });
}