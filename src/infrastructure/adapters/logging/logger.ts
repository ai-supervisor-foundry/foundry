// Shared logging utilities for supervisor
// All modules should import from this file instead of defining their own

// Force stdout flush for non-TTY environments (PM2)
function flushStdout(): void {
  if (typeof process !== 'undefined' && process.stdout && process.stdout.isTTY === false) {
    process.stdout.write('', () => {});
  }
}

function writeLine(line: string): void {
  if (typeof process !== 'undefined' && process.stdout) {
    process.stdout.write(line + '\n', () => {
      flushStdout();
    });
  } else {
    console.log(line);
  }
}

function writeErrorLine(line: string): void {
  if (typeof process !== 'undefined' && process.stderr) {
    process.stderr.write(line + '\n', () => {
      flushStdout();
    });
  } else {
    console.error(line);
  }
}

export function log(module: string, message: string, ...args: unknown[]): void {
  const timestamp = new Date().toISOString();
  const argsStr = args.length > 0 ? ' ' + JSON.stringify(args) : '';
  writeLine(`[${timestamp}] [${module}] ${message}${argsStr}`);
}

export function logVerbose(component: string, message: string, data?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const dataStr = data ? ` | Data: ${JSON.stringify(data)}` : '';
  writeLine(`[${timestamp}] [VERBOSE] [${component}] ${message}${dataStr}`);
}

export function logPerformance(operation: string, duration: number, metadata?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const metadataStr = metadata ? ` | Metadata: ${JSON.stringify(metadata)}` : '';
  writeLine(`[${timestamp}] [PERFORMANCE] ${operation} took ${duration}ms${metadataStr}`);
}

export function logStateTransition(from: string, to: string, context?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : '';
  writeLine(`[${timestamp}] [STATE_TRANSITION] ${from} → ${to}${contextStr}`);
}

export function logError(module: string, message: string, error?: unknown): void {
  const timestamp = new Date().toISOString();
  const errorStr = error instanceof Error ? ` | Error: ${error.message}` : error ? ` | Error: ${JSON.stringify(error)}` : '';
  writeErrorLine(`[${timestamp}] [ERROR] [${module}] ${message}${errorStr}`);
}

