// Gemini CLI Dispatcher
// Based on https://github.com/google-gemini/gemini-cli
// Installation: npm install -g @google/gemini-cli
// Command: gemini --output-format json [prompt] for structured output

import { ProviderResult } from '../../../../domain/executors/haltDetection';
import { spawn, exec } from 'child_process';
import * as fs from 'fs/promises';
import { promisify } from 'util';
import { logVerbose } from '../../../adapters/logging/logger';

const execAsync = promisify(exec);

function log(message: string, ...args: unknown[]): void {
  const timestamp = new Date().toISOString();
  logVerbose('GeminiCLI', message, { args });
}

export class GeminiCLI {
  /**
   * List available sessions using `gemini --list-sessions`
   */
  async listSessions(): Promise<Array<{ snippet: string, timeRelative: string, sessionId: string }>> {
    const geminiCommand = process.env.GEMINI_CLI_PATH || 'gemini';
    const useNpx = !process.env.GEMINI_CLI_PATH;
    const cmd = useNpx ? `npx @google/gemini-cli --list-sessions` : `${geminiCommand} --list-sessions`;

    try {
      const { stdout } = await execAsync(cmd);
      // Parse output: "1. Message Snippet (2 days ago) [UUID]"
      const sessions: Array<{ snippet: string, timeRelative: string, sessionId: string }> = [];
      const lines = stdout.split('\n');
      
      const regex = /^\s*\d+\.\s+(.*)\s+\((.*)\)\s+\[(.*)\]$/;
      
      for (const line of lines) {
        const match = line.match(regex);
        if (match) {
          sessions.push({
            snippet: match[1].trim(),
            timeRelative: match[2].trim(),
            sessionId: match[3].trim()
          });
        }
      }
      return sessions;
    } catch (error) {
      log(`Error listing sessions: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
}

export const geminiCLI = new GeminiCLI();

function findJSONInString(stdout: string): string | null {
  const jsonMatch = stdout.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }
  return null;
}

export async function dispatchToGemini(
  prompt: string,
  cwd: string = './',
  agentMode?: string,
  sessionId?: string,
  featureId?: string
): Promise<ProviderResult> {
  log(`Executing Gemini CLI in directory: ${cwd}`);
  log(`Prompt length: ${prompt.length} characters`);
  
  // Enforce cwd strictly - must exist and be a directory
  try {
    const cwdStat = await fs.stat(cwd);
    if (!cwdStat.isDirectory()) {
      throw new Error(`cwd is not a directory: ${cwd}`);
    }
  } catch (error) {
    log(`ERROR: Invalid cwd: ${cwd} - ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Invalid cwd: ${cwd} - ${error instanceof Error ? error.message : String(error)}`);
  }

  // Gemini CLI: npm install -g @google/gemini-cli or use npx @google/gemini-cli
  const geminiCommand = process.env.GEMINI_CLI_PATH || 'npx';
  const useNpx = !process.env.GEMINI_CLI_PATH;
  const args: string[] = [];
  
  // If using npx, add package name first
  if (useNpx) {
    args.push('@google/gemini-cli');
  }
  
  // Yolo by default (if supported by CLI, otherwise ignore)
  args.push('--yolo');
  
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
  
  // Prepend feature tag to prompt if starting new session
  let finalPrompt = prompt;
  if (!sessionId && featureId) {
    finalPrompt = `[Feature: ${featureId}]\n\n${prompt}`;
  }

  // Add prompt as argument
  args.push(finalPrompt);
  
  log(`Spawning: ${geminiCommand} ${args.join(' ')}`);

  return new Promise<ProviderResult>((resolve, reject) => {
    const childProcess = spawn(geminiCommand, args, {
      cwd: cwd,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    log(`Gemini CLI process started, PID: ${childProcess.pid}`);

    childProcess.stdin?.end();

    let stdout = '';
    let stderr = '';

    const timeout = setTimeout(() => {
      childProcess.kill('SIGTERM');
      reject(new Error('Gemini CLI process timed out after 30 minutes'));
    }, 30 * 60 * 1000);

    childProcess.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString('utf8');
    });

    childProcess.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString('utf8');
      // exit process on error.
      if (data.toString('utf8').toLowerCase().includes('error')) {
        clearTimeout(timeout);
        childProcess.kill('SIGTERM');
        reject(new Error(`Gemini CLI process error: ${data.toString('utf8')}`));
    }
    });

    childProcess.on('close', async (code) => {
      clearTimeout(timeout);
      const exitCode = code ?? 1;
      /**
       * Even if there is no error, Gemini CLI writes to stderr. So we use stdout only, reference:
       * GeminiCLI Stderr {
       *   stderr: 'YOLO mode is enabled. All tool calls will be automatically approved.\n' +
       *   'Loaded cached credentials.\n' +
       *   "Server 'chrome-devtools' supports tool updates. Listening for changes...\n"
       * }
       */
      const rawOutput = stdout;

      log(`Gemini CLI process closed, exit code: ${exitCode}`);
      // Logging stdout and stderr
      logVerbose('GeminiCLI', 'Stdout', { stdout });
      logVerbose('GeminiCLI', 'Stderr', { stderr });
      logVerbose('GeminiCLI', 'Process closed', { exit_code: exitCode, raw_output: rawOutput });

      let status: string | undefined;
      let outputContent = rawOutput;
      let newSessionId: string | undefined = sessionId;
      let usage: { tokens?: number, durationSeconds?: number } = {};

      if (exitCode !== 0) {
        status = 'FAILED';
        log(`Gemini CLI execution FAILED (exit code: ${exitCode})`);
      } else {
        log(`Gemini CLI execution SUCCESS`);
        
        // Parse JSON output
        try {
          // Output might contain non-JSON preamble/postamble, try to find the JSON object
          // Gemini CLI output format: { "session_id": "...", "content": "...", "stats": ... }
          // const jsonMatch = findJSONInString(stdout);
          /**
           * @note The reason are now using stdout directly is previously we were doing a concat on stdout and stderr.
           * But now we are using stdout only, so we don't need to do that.
           */
          const jsonMatch = stdout;
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

    childProcess.on('error', async (error) => {
      clearTimeout(timeout);
      log(`ERROR: Gemini CLI process error: ${error.message}`);
      reject(new Error(`Gemini CLI process error: ${error.message}`));
    });
  });
}