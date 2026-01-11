// Command Executor Service
// Executes supervisor CLI commands and shell commands with safety restrictions
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { config } from '../config.js';

const execAsync = promisify(exec);

// Supervisor CLI command allowlist
const SUPERVISOR_COMMANDS = [
  'init-state',
  'set-goal',
  'enqueue',
  'halt',
  'resume',
  'status',
  'start',
] as const;

type SupervisorCommand = typeof SUPERVISOR_COMMANDS[number];

// Dangerous shell commands to block
const DANGEROUS_COMMANDS = [
  'rm -rf /',
  'rm -rf ~',
  'sudo',
  'chmod 777',
  'dd if=',
  'mkfs',
  'fdisk',
  'format',
];

// Safe shell commands allowlist (if using allowlist approach)
// Empty array means allow all except dangerous ones
const SAFE_COMMANDS_ALLOWLIST: string[] = [];

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  success: boolean;
}

export interface CommandHistoryEntry {
  id: string;
  timestamp: string;
  type: 'supervisor' | 'shell';
  command: string;
  result: CommandResult;
}

// In-memory command history (could be persisted to file/DB in future)
const commandHistory: CommandHistoryEntry[] = [];
const MAX_HISTORY = 100;

/**
 * Generate command history ID
 */
function generateHistoryId(): string {
  return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Add entry to command history
 */
function addToHistory(entry: Omit<CommandHistoryEntry, 'id'>): string {
  const id = generateHistoryId();
  commandHistory.unshift({
    id,
    ...entry,
  });
  
  // Keep only last MAX_HISTORY entries
  if (commandHistory.length > MAX_HISTORY) {
    commandHistory.pop();
  }
  
  return id;
}

/**
 * Get command history
 */
export function getCommandHistory(limit?: number): CommandHistoryEntry[] {
  if (limit && limit > 0) {
    return commandHistory.slice(0, limit);
  }
  return [...commandHistory];
}

/**
 * Build supervisor CLI command with required options
 */
function buildSupervisorCommand(
  command: SupervisorCommand,
  options: Record<string, string | number> = {}
): string {
  // Resolve path from UI/backend/ to supervisor root (go up 2 levels)
  const supervisorRoot = path.resolve(process.cwd(), '../../'); 
  const cliPath = path.join(supervisorRoot, 'src', 'application', 'entrypoint', 'cli.ts');
  
  // Base command
  let cmd = `npx tsx ${cliPath} ${command}`;
  
  // Add required global options
  cmd += ` --redis-host ${config.redis.host}`;
  cmd += ` --redis-port ${config.redis.port}`;
  cmd += ` --state-key ${config.supervisor.stateKey}`;
  cmd += ` --queue-name ${config.supervisor.queueName}`;
  cmd += ` --queue-db ${config.supervisor.queueDb}`;
  cmd += ` --state-db ${config.supervisor.stateDb}`;
  cmd += ` --sandbox-root ${config.supervisor.sandboxRoot}`;
  
  // Add command-specific options
  for (const [key, value] of Object.entries(options)) {
    // Sanitize option values (prevent injection)
    const sanitized = String(value).replace(/[;&|`$(){}[\]<>]/g, '');
    cmd += ` --${key} "${sanitized}"`;
  }
  
  return cmd;
}

/**
 * Execute supervisor CLI command
 */
export async function executeSupervisorCommand(
  command: SupervisorCommand,
  options: Record<string, string | number> = {}
): Promise<CommandResult> {
  // Validate command
  if (!SUPERVISOR_COMMANDS.includes(command)) {
    throw new Error(`Invalid supervisor command: ${command}`);
  }
  
  // Build command
  const fullCommand = buildSupervisorCommand(command, options);
  console.log('Full supervisor command:', fullCommand);
  
  const startTime = Date.now();
  
  try {
    const { stdout, stderr } = await execAsync(fullCommand, {
      timeout: 60000, // 60 seconds
      maxBuffer: 10 * 1024 * 1024, // 10MB
      cwd: process.cwd(),
    });
    
    const duration = Date.now() - startTime;
    const result: CommandResult = {
      stdout,
      stderr,
      exitCode: 0,
      duration,
      success: true,
    };
    
    // Add to history
    addToHistory({
      timestamp: new Date().toISOString(),
      type: 'supervisor',
      command: fullCommand,
      result,
    });
    
    return result;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const result: CommandResult = {
      stdout: error.stdout || '',
      stderr: error.stderr || error.message || 'Unknown error',
      exitCode: error.code || 1,
      duration,
      success: false,
    };
    
    // Add to history
    addToHistory({
      timestamp: new Date().toISOString(),
      type: 'supervisor',
      command: fullCommand,
      result,
    });
    
    return result;
  }
}

/**
 * Check if shell command is dangerous
 */
function isDangerousCommand(command: string): boolean {
  const lowerCommand = command.toLowerCase();
  return DANGEROUS_COMMANDS.some(dangerous => lowerCommand.includes(dangerous.toLowerCase()));
}

/**
 * Check if shell command is allowed (if using allowlist)
 */
function isAllowedCommand(command: string): boolean {
  if (SAFE_COMMANDS_ALLOWLIST.length === 0) {
    // No allowlist, allow all except dangerous
    return true;
  }
  
  // Check if command starts with any allowed command
  return SAFE_COMMANDS_ALLOWLIST.some(allowed => command.trim().startsWith(allowed));
}

/**
 * Execute shell command with safety restrictions
 */
export async function executeShellCommand(
  command: string,
  options: {
    cwd?: string;
    timeout?: number;
  } = {}
): Promise<CommandResult> {
  // Check if dangerous
  if (isDangerousCommand(command)) {
    throw new Error(`Dangerous command blocked: ${command}`);
  }
  
  // Check allowlist if configured
  if (SAFE_COMMANDS_ALLOWLIST.length > 0 && !isAllowedCommand(command)) {
    throw new Error(`Command not in allowlist: ${command}`);
  }
  
  // Determine working directory
  let workingDir = options.cwd || process.cwd();
  
  // Restrict to sandbox or project root
  const sandboxRoot = path.resolve(config.supervisor.sandboxRoot);
  const projectRoot = process.cwd();
  
  const resolvedCwd = path.resolve(workingDir);
  
  // Allow only within sandbox or project root
  if (!resolvedCwd.startsWith(sandboxRoot) && !resolvedCwd.startsWith(projectRoot)) {
    throw new Error(`Working directory must be within sandbox or project root`);
  }
  
  const startTime = Date.now();
  const timeout = options.timeout || 30000; // 30 seconds default
  
  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout,
      maxBuffer: 1024 * 1024, // 1MB output limit
      cwd: workingDir,
    });
    
    const duration = Date.now() - startTime;
    const result: CommandResult = {
      stdout,
      stderr,
      exitCode: 0,
      duration,
      success: true,
    };
    
    // Add to history
    addToHistory({
      timestamp: new Date().toISOString(),
      type: 'shell',
      command,
      result,
    });
    
    return result;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const result: CommandResult = {
      stdout: error.stdout || '',
      stderr: error.stderr || error.message || 'Unknown error',
      exitCode: error.code || 1,
      duration,
      success: false,
    };
    
    // Add to history
    addToHistory({
      timestamp: new Date().toISOString(),
      type: 'shell',
      command,
      result,
    });
    
    return result;
  }
}

