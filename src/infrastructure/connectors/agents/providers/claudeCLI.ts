// Claude CLI Dispatcher
// TASK: Research Claude CLI command structure and implement

import { ProviderResult } from '../../../../domain/executors/haltDetection';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

function log(message: string, ...args: unknown[]): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [ClaudeCLI] ${message}`, ...args);
}

export async function dispatchToClaude(
  prompt: string,
  cwd: string,
  agentMode?: string
): Promise<ProviderResult> {
  log(`Executing Claude CLI in directory: ${cwd}`);
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

  // Claude Code CLI: Installed at ~/.local/bin/claude or via npm
  // Documentation: https://docs.claude.com/en/docs/claude-code/cli-reference
  // Command: claude -p/--print [prompt] for non-interactive output
  const useNpx = !process.env.CLAUDE_CLI_PATH;
  const claudeCommand = process.env.CLAUDE_CLI_PATH || 'npx';
  const args: string[] = [];
  
  if (useNpx) {
    args.push('@anthropic-ai/claude-code');
  }
  
  // Use --print for non-interactive mode (prints response and exits)
  args.push('--print');
  
  // Set output format to text (default, but explicit)
  args.push('--output-format', 'text');
  
  // Set model if provided (agentMode maps to Claude model)
  if (agentMode && agentMode !== 'auto') {
    args.push('--model', agentMode);
  }
  
  // Add prompt as argument
  args.push(prompt);
  
  log(`Spawning: ${claudeCommand} ${args.join(' ')}`);

  return new Promise<ProviderResult>((resolve, reject) => {
    const childProcess = spawn(claudeCommand, args, {
      cwd: cwd,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    log(`Claude CLI process started, PID: ${childProcess.pid}`);

    childProcess.stdin?.end();

    let stdout = '';
    let stderr = '';

    const timeout = setTimeout(() => {
      childProcess.kill('SIGTERM');
      reject(new Error('Claude CLI process timed out after 30 minutes'));
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

      log(`Claude CLI process closed, exit code: ${exitCode}`);

      let status: string | undefined;
      if (exitCode !== 0) {
        status = 'FAILED';
        log(`Claude CLI execution FAILED (exit code: ${exitCode})`);
      } else {
        log(`Claude CLI execution SUCCESS`);
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
      log(`ERROR: Claude CLI process error: ${error.message}`);
      reject(new Error(`Claude CLI process error: ${error.message}`));
    });
  });
}

