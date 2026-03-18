// Claude CLI Dispatcher
// Spawns claude via node-pty so the child process sees a real PTY (isTTY=true),
// preventing daemon/non-interactive detection by Claude Code.

import { ProviderResult } from '../../../../domain/executors/haltDetection';
import * as pty from 'node-pty';
import * as fs from 'fs/promises';

function log(message: string, ...args: unknown[]): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [ClaudeCLI] ${message}`, ...args);
}

export async function dispatchToClaude(
  prompt: string,
  cwd: string,
  agentMode?: string,
  sessionId?: string
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

  // Build args
  const claudeCommand = process.env.CLAUDE_CLI_PATH || 'claude';
  const args: string[] = [];

  args.push('--print');
  args.push('--output-format', 'json');
  args.push('--dangerously-skip-permissions');

  if (agentMode && agentMode !== 'auto') {
    args.push('--model', agentMode);
  }

  if (sessionId) {
    args.push('--resume', sessionId);
  }

  args.push(prompt);

  log(`Spawning (pty): ${claudeCommand} ${args.join(' ')}`);

  return new Promise<ProviderResult>((resolve, reject) => {
    let ptyProcess: pty.IPty;

    try {
      // Strip Claude Code daemon-detection vars so the child process is not
      // identified as a nested Claude Code instance (which triggers API pricing).
      // Strip ANTHROPIC_API_KEY so claude uses subscription auth (OAuth stored
      // credentials) instead of API key billing. Without the key, claude falls
      // back to ~/.claude credentials same as a direct terminal invocation.
      const childEnv = { ...process.env } as { [key: string]: string };
      delete childEnv.CLAUDECODE;
      delete childEnv.CLAUDE_CODE_ENTRYPOINT;
      delete childEnv.CLAUDE_CODE_SSE_PORT;
      delete childEnv.ANTHROPIC_API_KEY;

      ptyProcess = pty.spawn(claudeCommand, args, {
        name: 'xterm-color',
        cols: 220,
        rows: 50,
        cwd: cwd,
        env: childEnv,
      });
    } catch (err) {
      return reject(new Error(`Claude CLI process error: ${err instanceof Error ? err.message : String(err)}`));
    }

    log(`Claude CLI process started, PID: ${ptyProcess.pid}`);

    let output = '';

    const timeout = setTimeout(() => {
      ptyProcess.kill();
      reject(new Error('Claude CLI process timed out after 30 minutes'));
    }, 30 * 60 * 1000);

    ptyProcess.onData((data) => {
      output += data;
    });

    ptyProcess.onExit(({ exitCode }) => {
      clearTimeout(timeout);
      log(`Claude CLI process closed, exit code: ${exitCode}`);

      // Strip ANSI escape codes that PTY may inject
      const clean = output.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '');

      // Extract JSON from output (PTY may include trailing control sequences)
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      const stdout = jsonMatch ? jsonMatch[0] : clean;

      let parsedJson: { is_error?: boolean; session_id?: string } = {};
      try { parsedJson = JSON.parse(stdout); } catch { /* non-JSON output */ }

      let status: string | undefined;
      if (exitCode !== 0 || parsedJson.is_error === true) {
        status = 'FAILED';
        log(`Claude CLI execution FAILED (exit code: ${exitCode}, is_error: ${parsedJson.is_error})`);
      } else {
        log(`Claude CLI execution SUCCESS`);
      }

      resolve({
        stdout,
        stderr: '',
        exitCode,
        rawOutput: output,
        status,
        output: stdout,
        sessionId: parsedJson.session_id,
      });
    });
  });
}
