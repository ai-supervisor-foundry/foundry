// Hard Halt Detection Logic
// Pure functions only - no side effects, no logging

import { logVerbose as logVerboseShared, logPerformance as logPerformanceShared } from '../../infrastructure/adapters/logging/logger';

function logVerbose(component: string, message: string, data?: Record<string, unknown>): void {
  logVerboseShared(`HaltDetection:${component}`, message, data);
}

function logPerformance(operation: string, duration: number, metadata?: Record<string, unknown>): void {
  logPerformanceShared(`[HaltDetection] ${operation}`, duration, metadata);
}

export type HaltReason =
  | 'ASKED_QUESTION'
  | 'AMBIGUITY'
  | 'BLOCKED'
  | 'OUTPUT_FORMAT_INVALID'
  | 'CURSOR_EXEC_FAILURE'
  | 'RESOURCE_EXHAUSTED'
  | 'PROVIDER_CIRCUIT_BROKEN';
export interface ProviderResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  rawOutput: string; // Combined stdout + stderr
  // Legacy fields for backward compatibility
  output?: string;
  status?: string;
  requiredKeys?: string[];
  // Provider-specific metadata
  sessionId?: string;
  usage?: {
    tokens?: number;
    durationSeconds?: number;
  };
}

const AMBIGUITY_WORDS = [
  'maybe',
  'could',
  'suggest',
  'recommend',
  'alternative',
  'option',
] as const;

/**
 * Checks if text contains ambiguity indicators
 */
export function containsAmbiguity(text: string): boolean {
  const startTime = Date.now();
  const lowerText = text.toLowerCase();
  const textLength = text.length;

  // Check for ambiguity words
  for (const word of AMBIGUITY_WORDS) {
    // Word boundary matching to avoid false positives
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(lowerText)) {
      const duration = Date.now() - startTime;
      logPerformance('ContainsAmbiguity', duration, { text_length: textLength, found_word: word });
      logVerbose('ContainsAmbiguity', 'Ambiguity detected', {
        text_length: textLength,
        ambiguity_word: word,
      });
      return true;
    }
  }

  const duration = Date.now() - startTime;
  logPerformance('ContainsAmbiguity', duration, { text_length: textLength, found: false });
  return false;
}

/**
 * Checks if text contains a question mark
 */
function containsQuestion(text: string): boolean {
  return text.includes('?');
}

/**
 * Checks if text is valid JSON
 */
function isValidJSON(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if JSON object contains all required keys
 */
function hasRequiredKeys(jsonText: string, requiredKeys: string[]): boolean {
  if (requiredKeys.length === 0) {
    return true; // No requirements
  }

  try {
    const parsed = JSON.parse(jsonText);
    if (typeof parsed !== 'object' || parsed === null) {
      return false;
    }

    for (const key of requiredKeys) {
      if (!(key in parsed)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Main halt detection function
 * Checks all halt conditions and returns first matching reason, or null
 */
export function checkHardHalts(result: ProviderResult): HaltReason | null {
  const startTime = Date.now();
  const { rawOutput, stdout, stderr, status, exitCode, requiredKeys = [] } = result;
  // Use rawOutput (stdout + stderr combined) for detection
  const output = rawOutput || stdout || stderr || '';
  
  logVerbose('CheckHardHalts', 'Checking for hard halt conditions', {
    exit_code: exitCode,
    status: status,
    output_length: output.length,
    required_keys_count: requiredKeys.length,
    has_stdout: !!stdout,
    has_stderr: !!stderr,
    has_raw_output: !!rawOutput,
  });

  // Check 0: Resource exhaustion (before general exec failure to allow retry)
  const outputLower = output.toLowerCase();
  if (outputLower.includes('resource_exhausted') || outputLower.includes('connecterror') || 
      (outputLower.includes('connect') && outputLower.includes('exhausted'))) {
    const duration = Date.now() - startTime;
    logPerformance('CheckHardHalts', duration, { halt_reason: 'RESOURCE_EXHAUSTED' });
    logVerbose('CheckHardHalts', 'Halt detected: RESOURCE_EXHAUSTED', {
      exit_code: exitCode,
      output_preview: output.substring(0, 200),
    });
    return 'RESOURCE_EXHAUSTED';
  }

  // Check 1: Cursor process non-zero exit code
  if (exitCode !== undefined && exitCode !== 0) {
    logVerbose('ExecutionFailure', 'Execution failure detected', {
      exit_code: exitCode,
      output_preview: output.substring(0, 200),
    });
    const duration = Date.now() - startTime;
    logPerformance('CheckHardHalts', duration, { halt_reason: 'CURSOR_EXEC_FAILURE' });
    logVerbose('CheckHardHalts', 'Halt detected: CURSOR_EXEC_FAILURE', {
      exit_code: exitCode,
    });
    return 'CURSOR_EXEC_FAILURE';
  }

  // Check 2: status === "BLOCKED"
  if (status === 'BLOCKED') {
    const duration = Date.now() - startTime;
    logPerformance('CheckHardHalts', duration, { halt_reason: 'BLOCKED' });
    logVerbose('CheckHardHalts', 'Halt detected: BLOCKED', { status });
    return 'BLOCKED';
  }

  // Check 3: Any question mark '?'
  if (containsQuestion(output)) {
    const duration = Date.now() - startTime;
    logPerformance('CheckHardHalts', duration, { halt_reason: 'ASKED_QUESTION' });
    logVerbose('CheckHardHalts', 'Halt detected: ASKED_QUESTION', {
      output_length: output.length,
    });
    return 'ASKED_QUESTION';
  }

  // Check 4: Ambiguity words
  if (containsAmbiguity(output)) {
    const duration = Date.now() - startTime;
    logPerformance('CheckHardHalts', duration, { halt_reason: 'AMBIGUITY' });
    logVerbose('CheckHardHalts', 'Halt detected: AMBIGUITY', {
      output_length: output.length,
    });
    return 'AMBIGUITY';
  }

  // Check 5: Output not valid JSON (if JSON is expected)
  // Only check if requiredKeys are specified (indicates JSON expected)
  if (requiredKeys.length > 0) {
    if (!isValidJSON(output)) {
      const duration = Date.now() - startTime;
      logPerformance('CheckHardHalts', duration, { halt_reason: 'OUTPUT_FORMAT_INVALID', reason: 'invalid_json' });
      logVerbose('CheckHardHalts', 'Halt detected: OUTPUT_FORMAT_INVALID (invalid JSON)', {
        output_length: output.length,
        required_keys: requiredKeys,
      });
      return 'OUTPUT_FORMAT_INVALID';
    }

    // Check 6: Required output keys missing
    if (!hasRequiredKeys(output, requiredKeys)) {
      const duration = Date.now() - startTime;
      logPerformance('CheckHardHalts', duration, { halt_reason: 'OUTPUT_FORMAT_INVALID', reason: 'missing_keys' });
      logVerbose('CheckHardHalts', 'Halt detected: OUTPUT_FORMAT_INVALID (missing keys)', {
        output_length: output.length,
        required_keys: requiredKeys,
      });
      return 'OUTPUT_FORMAT_INVALID';
    }
  }

  // No halt conditions met
  const duration = Date.now() - startTime;
  logPerformance('CheckHardHalts', duration, { halt_reason: 'none' });
  logVerbose('CheckHardHalts', 'No halt conditions detected', {});
  return null;
}

