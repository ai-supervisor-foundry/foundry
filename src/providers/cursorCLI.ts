// Cursor CLI - Thin dispatcher
// No interpretation, no retries, no validation, no logging

import { CursorResult } from '../haltDetection';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Thin Cursor CLI dispatcher
 * Enforces cwd strictly, captures output verbatim
 */
function log(message: string, ...args: unknown[]): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [CursorCLI] ${message}`, ...args);
}

export async function dispatchToCursor(
  prompt: string,
  cwd: string,
  agentMode?: string,
  cursorExecutable?: string
): Promise<CursorResult> {
  log(`Executing Cursor CLI in directory: ${cwd}`);
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

  // Note: Based on Cursor CLI documentation, prompts can be passed directly
  // No need for temp file, but keeping cleanup logic in case we need it later

  // Spawn Cursor CLI process
  // Based on https://cursor.com/cli - Cursor CLI command is 'cursor agent'
  // Supports headless mode with --print flag for scripts and automation
  // Flags: --print, --force, --output-format, --model (for agent mode)
  // Use provided cursorExecutable, then env var, then default
  const cursorCommand = cursorExecutable || process.env.CURSOR_CLI_PATH || 'cursor';
  const args = [
    'agent', // Subcommand
    '--print', // Print responses to console (required for non-interactive use)
    '--force', // Force allow commands unless explicitly denied
    '--output-format', 'text', // Output format (text or json)
  ];
  
  // Always pass --model flag, defaulting to 'auto' if not specified
  const modelToUse = agentMode || 'auto';
  args.push('--model', modelToUse);
  log(`Using agent mode: ${modelToUse}`);
  
  args.push(prompt); // Prompt as argument

  log(`Spawning: ${cursorCommand} ${args.slice(0, -1).join(' ')} [prompt]`);

  return new Promise<CursorResult>((resolve, reject) => {
    const childProcess = spawn(cursorCommand, args, {
      cwd: cwd, // Enforce cwd strictly
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    log(`Cursor CLI process started, PID: ${childProcess.pid}`);

    // Close stdin immediately - cursor agent doesn't need input with --print
    childProcess.stdin?.end();

    let stdout = '';
    let stderr = '';

    // Set a timeout (30 minutes max for a task)
    const timeout = setTimeout(() => {
      childProcess.kill('SIGTERM');
      reject(new Error('Cursor CLI process timed out after 30 minutes'));
    }, 30 * 60 * 1000);

    // Capture stdout
    childProcess.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString('utf8');
    });

    // Capture stderr
    childProcess.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString('utf8');
    });

    // Handle process completion
    childProcess.on('close', async (code) => {
      clearTimeout(timeout);
      const exitCode = code ?? 1; // Default to 1 if code is null
      const rawOutput = stdout + stderr;

      log(`Cursor CLI process closed, exit code: ${exitCode}`);
      log(`stdout length: ${stdout.length} bytes, stderr length: ${stderr.length} bytes`);

      // Determine status from exit code and output
      let status: string | undefined;
      if (exitCode !== 0) {
        status = 'FAILED';
        log(`Cursor CLI execution FAILED (exit code: ${exitCode})`);
        if (stderr) {
          log(`stderr: ${stderr.substring(0, 500)}${stderr.length > 500 ? '...' : ''}`);
        }
      } else if (stderr.length > 0 && stderr.toLowerCase().includes('blocked')) {
        status = 'BLOCKED';
        log(`Cursor CLI execution BLOCKED`);
      } else {
        log(`Cursor CLI execution SUCCESS`);
      }

      resolve({
        stdout: stdout,
        stderr: stderr,
        exitCode: exitCode,
        rawOutput: rawOutput,
        status: status,
        // Legacy fields for backward compatibility
        output: rawOutput,
      });
    });

    // Handle process errors
    childProcess.on('error', async (error) => {
      clearTimeout(timeout);
      log(`ERROR: Cursor CLI process error: ${error.message}`);
      reject(new Error(`Cursor CLI process error: ${error.message}`));
    });
  });
}

// Legacy CursorCLI class for backward compatibility
export class CursorCLI {
  constructor(
    private cursorExecutable: string = 'cursor' // Cursor CLI command (uses 'cursor agent' subcommand)
  ) {}

  async execute(
    prompt: string,
    workingDirectory: string,
    agentMode?: string
  ): Promise<CursorResult> {
    return dispatchToCursor(prompt, workingDirectory, agentMode, this.cursorExecutable);
  }
}
