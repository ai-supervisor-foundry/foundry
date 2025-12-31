// Gemini CLI Dispatcher
// Based on https://github.com/google-gemini/gemini-cli
// Installation: npm install -g @google/gemini-cli
// Command: gemini --output-format text [prompt] for non-interactive mode

import { CursorResult } from '../../../../domain/executors/haltDetection';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';

function log(message: string, ...args: unknown[]): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [GeminiCLI] ${message}`, ...args);
}

export async function dispatchToGemini(
  prompt: string,
  cwd: string,
  agentMode?: string
): Promise<CursorResult> {
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
  // Documentation: https://github.com/google-gemini/gemini-cli
  // Command: gemini --output-format text [prompt] for non-interactive mode
  // Try npx first if gemini not in PATH
  const geminiCommand = process.env.GEMINI_CLI_PATH || 'npx';
  const useNpx = !process.env.GEMINI_CLI_PATH;
  const args: string[] = [];
  
  // If using npx, add package name first
  if (useNpx) {
    args.push('@google/gemini-cli');
  }
  
  // Set output format to text (for non-interactive mode)
  args.push('--output-format', 'text');

  // eg: gemini --include-directories ../lib,../docs
  args.push('--include-directories', './');
  
  // Set model if provided (agentMode maps to Gemini model)
  if (agentMode && agentMode !== 'auto') {
    args.push('--model', agentMode);
  }

  // Yolo by default
  args.push('--yolo');
  
  // Add prompt as argument
  args.push(prompt);
  
  log(`Spawning: ${geminiCommand} ${args.join(' ')}`);

  return new Promise<CursorResult>((resolve, reject) => {
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
    });

    childProcess.on('close', async (code) => {
      clearTimeout(timeout);
      const exitCode = code ?? 1;
      const rawOutput = stdout + stderr;

      log(`Gemini CLI process closed, exit code: ${exitCode}`);

      let status: string | undefined;
      if (exitCode !== 0) {
        status = 'FAILED';
        log(`Gemini CLI execution FAILED (exit code: ${exitCode})`);
      } else {
        log(`Gemini CLI execution SUCCESS`);
      }

      resolve({
        stdout: stdout,
        stderr: stderr,
        exitCode,
        rawOutput,
        status: status,
        output: rawOutput,
      });
    });

    childProcess.on('error', async (error) => {
      clearTimeout(timeout);
      log(`ERROR: Gemini CLI process error: ${error.message}`);
      reject(new Error(`Gemini CLI process error: ${error.message}`));
    });
  });
}

