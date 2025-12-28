// Codex CLI Dispatcher
// Based on https://developers.openai.com/codex
// TODO: Research Codex CLI command structure and implement

import { CursorResult } from '../haltDetection';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';

function log(message: string, ...args: unknown[]): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [CodexCLI] ${message}`, ...args);
}

export async function dispatchToCodex(
  prompt: string,
  cwd: string,
  agentMode?: string
): Promise<CursorResult> {
  log(`Executing Codex CLI in directory: ${cwd}`);
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

  // Codex CLI: npm install -g @openai/codex or use npx @openai/codex
  // Documentation: https://developers.openai.com/codex/cli
  // Command: codex exec [PROMPT] for non-interactive mode
  // Try npx first if codex not in PATH
  const codexCommand = process.env.CODEX_CLI_PATH || 'npx';
  const useNpx = !process.env.CODEX_CLI_PATH;
  const args: string[] = [];
  
  // If using npx, add package name first
  if (useNpx) {
    args.push('@openai/codex');
  }
  
  args.push('exec');
  
  // Set working directory
  args.push('--cd', cwd);
  
  // Set model if provided (agentMode maps to Codex model)
  if (agentMode && agentMode !== 'auto') {
    args.push('--model', agentMode);
  }
  
  // Bypass approvals and sandbox for non-interactive use
  args.push('--dangerously-bypass-approvals-and-sandbox');
  
  // Add prompt as argument
  args.push(prompt);
  
  log(`Spawning: ${codexCommand} ${args.join(' ')}`);

  return new Promise<CursorResult>((resolve, reject) => {
    const childProcess = spawn(codexCommand, args, {
      cwd: cwd,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    log(`Codex CLI process started, PID: ${childProcess.pid}`);

    childProcess.stdin?.end();

    let stdout = '';
    let stderr = '';

    const timeout = setTimeout(() => {
      childProcess.kill('SIGTERM');
      reject(new Error('Codex CLI process timed out after 30 minutes'));
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

      log(`Codex CLI process closed, exit code: ${exitCode}`);

      let status: string | undefined;
      if (exitCode !== 0) {
        status = 'FAILED';
        log(`Codex CLI execution FAILED (exit code: ${exitCode})`);
      } else {
        log(`Codex CLI execution SUCCESS`);
      }

      resolve({
        stdout: stdout,
        stderr: stderr,
        exitCode: exitCode,
        rawOutput: rawOutput,
        status: status,
        output: rawOutput,
      });
    });

    childProcess.on('error', async (error) => {
      clearTimeout(timeout);
      log(`ERROR: Codex CLI process error: ${error.message}`);
      reject(new Error(`Codex CLI process error: ${error.message}`));
    });
  });
}

