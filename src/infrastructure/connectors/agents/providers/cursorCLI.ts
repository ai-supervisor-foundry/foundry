import { ProviderResult } from '../../../../domain/executors/haltDetection';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';

/**
 * Thin Cursor CLI dispatcher
 * Enforces cwd strictly, captures output verbatim
 */
function log(message: string, ...args: unknown[]): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [CursorCLI] ${message}`, ...args);
}

/**
 * Extracts JSON from mixed text output
 */
function extractJSON(text: string): any {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) {
      return null;
    }
    const jsonStr = text.substring(start, end + 1);
    return JSON.parse(jsonStr);
  } catch (error) {
    log(`Warning: Failed to parse JSON from output: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

export async function dispatchToCursor(
  prompt: string,
  cwd: string,
  agentMode?: string,
  sessionId?: string,
  featureId?: string,
  cursorExecutable?: string
): Promise<ProviderResult> {
  log(`Executing Cursor CLI in directory: ${cwd}${sessionId ? ` (Session: ${sessionId})` : ''}`);
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

  // Prepend feature tag to prompt if this is a new session or we want to tag it
  let finalPrompt = prompt;
  if (featureId && !sessionId) {
    finalPrompt = `[Feature: ${featureId}] ${prompt}`;
  }

  const cursorCommand = cursorExecutable || process.env.CURSOR_CLI_PATH || 'cursor';
  const modelToUse = agentMode || 'auto';

  const args: string[] = [
    'agent',
    '--print',
    '--force',
    '--output-format', 'json',
  ];
  if (sessionId) args.push('--resume', sessionId);
  args.push('--model', modelToUse);
  args.push(finalPrompt);

  log(`Spawning: ${cursorCommand} ${args.slice(0, -1).join(' ')} [prompt]`);

  return new Promise((resolve, reject) => {
    const childProcess = spawn(cursorCommand, args, {
      cwd: cwd,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    log(`Cursor CLI process started, PID: ${childProcess.pid}`);
    childProcess.stdin?.end();

    let stdout = '';
    let stderr = '';

    const timeout = setTimeout(() => {
      childProcess.kill('SIGTERM');
      reject(new Error('Cursor CLI process timed out after 30 minutes'));
    }, 30 * 60 * 1000);

    childProcess.stdout?.on('data', (data: Buffer) => { stdout += data.toString('utf8'); });
    childProcess.stderr?.on('data', (data: Buffer) => { stderr += data.toString('utf8'); });

    childProcess.on('close', (code) => {
      clearTimeout(timeout);
      const exitCode = code ?? 1;
      const rawOutput = stdout + stderr;
      log(`Cursor CLI process closed, exit code: ${exitCode}`);

      const jsonOutput = extractJSON(stdout);
      let status: string | undefined;
      if (exitCode !== 0) status = 'FAILED';
      else if (stderr.length > 0 && stderr.toLowerCase().includes('blocked')) status = 'BLOCKED';

      const newSessionId = jsonOutput?.session_id || jsonOutput?.sessionId || jsonOutput?.chatId || jsonOutput?.id || sessionId;
      const tokens = jsonOutput?.usage?.totalTokens || jsonOutput?.stats?.tokens?.total;

      resolve({
        stdout: jsonOutput?.result || jsonOutput?.response || stdout,
        stderr,
        exitCode,
        rawOutput,
        status,
        output: rawOutput,
        sessionId: newSessionId,
        usage: tokens ? { tokens } : undefined,
      });
    });

    childProcess.on('error', (error) => {
      clearTimeout(timeout);
      log(`ERROR: Cursor CLI process error: ${error.message}`);
      reject(new Error(`Cursor CLI process error: ${error.message}`));
    });
  });
}

// Legacy CursorCLI class for backward compatibility
export class CursorCLI {
  constructor(
    private cursorExecutable: string = 'cursor'
  ) {}

  async execute(
    prompt: string,
    workingDirectory: string,
    agentMode?: string,
    sessionId?: string,
    featureId?: string
  ):
 Promise<ProviderResult> {
    return dispatchToCursor(prompt, workingDirectory, agentMode, sessionId, featureId, this.cursorExecutable);
  }
}
