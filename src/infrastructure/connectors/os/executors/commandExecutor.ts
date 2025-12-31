// Command Executor - Safely execute read-only validation commands
// Whitelist validation before execution, parse output, return structured results

import { CommandResult, CommandExecutionResult } from '../../../../domain/types/types';
import { exec } from 'child_process';
import { promisify } from 'util';
import { log as logShared, logVerbose } from '../../../adapters/logging/logger';

const execAsync = promisify(exec);

function log(message: string, ...args: unknown[]): void {
  logShared('CommandExecutor', message, ...args);
}

// Whitelist of allowed read-only commands
const ALLOWED_COMMANDS = [
  'ls',
  'find',
  'grep',
  'cat',
  'head',
  'tail',
  'wc',
  'file',
  'stat',
  'test',
  '[', // test command alias
  'readlink',
  'pwd',
  'basename',
  'dirname',
] as const;

// Blocked commands/patterns (write operations, dangerous commands)
const BLOCKED_PATTERNS = [
  /rm\s+/,
  /mv\s+/,
  /cp\s+/,
  /mkdir\s+/,
  /touch\s+/,
  /chmod\s+/,
  /chown\s+/,
  /npm\s+/,
  /pnpm\s+/,
  /yarn\s+/,
  /git\s+(?!ls-files|diff|log|show|status|branch|tag|remote|config|rev-parse)/, // Allow read-only git commands
  />\s*/, // Output redirection (write)
  />>\s*/, // Append redirection (write)
  /curl\s+.*-o\s+/, // curl with output file
  /wget\s+.*-O\s+/, // wget with output file
  /echo\s+.*>/,
  /printf\s+.*>/,
] as const;

/**
 * Validate command against whitelist and blocked patterns
 */
function isCommandAllowed(command: string): { allowed: boolean; reason?: string } {
  log(`Validating command: ${command}`);

  // Check for blocked patterns first
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      log(`Command blocked by pattern: ${pattern}`);
      return {
        allowed: false,
        reason: `Command contains blocked pattern: ${pattern}`,
      };
    }
  }

  // Extract base command (first word, before any pipes or redirects)
  const baseCommand = command.trim().split(/\s+/)[0]?.toLowerCase();
  if (!baseCommand) {
    return {
      allowed: false,
      reason: 'Empty command',
    };
  }

  // Check if base command is in whitelist
  const isAllowed = ALLOWED_COMMANDS.some(cmd => baseCommand === cmd || baseCommand.startsWith(`${cmd} `));

  if (!isAllowed) {
    log(`Command not in whitelist: ${baseCommand}`);
    return {
      allowed: false,
      reason: `Command '${baseCommand}' is not in the read-only whitelist`,
    };
  }

  log(`Command allowed: ${baseCommand}`);
  return { allowed: true };
}

/**
 * Execute read-only verification commands safely
 * Validates commands against whitelist before execution
 * Returns structured results for each command
 */
export async function executeVerificationCommands(
  commands: string[],
  cwd: string
): Promise<CommandExecutionResult> {
  log(`Executing ${commands.length} verification commands in: ${cwd}`);
  logVerbose('CommandExecutor', 'Starting command execution', {
    commands_count: commands.length,
    cwd: cwd,
  });

  const results: CommandResult[] = [];
  let allPassed = true;

  for (let i = 0; i < commands.length; i++) {
    const command = commands[i];
    log(`Executing command ${i + 1}/${commands.length}: ${command}`);

    // Validate command
    const validation = isCommandAllowed(command);
    if (!validation.allowed) {
      log(`Command ${i + 1} blocked: ${validation.reason}`);
      results.push({
        command,
        exitCode: 1,
        stdout: '',
        stderr: `Command blocked: ${validation.reason}`,
        passed: false,
      });
      allPassed = false;
      continue;
    }

    // Execute command in sandbox directory
    try {
      const executionStartTime = Date.now();
      const { stdout, stderr } = await execAsync(command, {
        cwd: cwd,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: 30000, // 30 second timeout
      });
      const executionDuration = Date.now() - executionStartTime;

      const exitCode = 0; // execAsync doesn't provide exit code, assume 0 if no error
      const passed = exitCode === 0 && stderr.length === 0;

      log(`Command ${i + 1} executed: exitCode=${exitCode}, passed=${passed}, duration=${executionDuration}ms`);
      logVerbose('CommandExecutor', 'Command execution completed', {
        command_index: i + 1,
        command,
        exit_code: exitCode,
        passed,
        stdout_length: stdout.length,
        stderr_length: stderr.length,
        duration_ms: executionDuration,
      });

      results.push({
        command,
        exitCode,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        passed,
      });

      if (!passed) {
        allPassed = false;
      }
    } catch (error) {
      // execAsync throws on non-zero exit code or timeout
      const exitCode = (error as { code?: number })?.code || 1;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      log(`Command ${i + 1} failed: ${errorMessage}`);
      logVerbose('CommandExecutor', 'Command execution failed', {
        command_index: i + 1,
        command,
        exit_code: exitCode,
        error: errorMessage,
      });

      results.push({
        command,
        exitCode,
        stdout: '',
        stderr: errorMessage,
        passed: false,
      });
      allPassed = false;
    }
  }

  log(`Command execution completed: ${allPassed ? 'ALL PASSED' : 'SOME FAILED'}`);
  logVerbose('CommandExecutor', 'All commands executed', {
    total_commands: commands.length,
    passed_commands: results.filter(r => r.passed).length,
    failed_commands: results.filter(r => !r.passed).length,
    all_passed: allPassed,
  });

  return {
    passed: allPassed,
    results,
  };
}

