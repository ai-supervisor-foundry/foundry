// Cursor Output Parser
// Strict parsing - no coercion, no auto-fix
// Output is untrusted

import { logVerbose as logVerboseShared, logPerformance as logPerformanceShared } from '../../infrastructure/adapters/logging/logger';

function logVerbose(component: string, message: string, data?: Record<string, unknown>): void {
  logVerboseShared(`OutputParser:${component}`, message, data);
}

function logPerformance(operation: string, duration: number, metadata?: Record<string, unknown>): void {
  logPerformanceShared(`[OutputParser] ${operation}`, duration, metadata);
}

export interface ParsedOutput {
  [key: string]: unknown;
}

export interface ParseOptions {
  requiredKeys?: string[];
}

/**
 * Extracts JSON block from raw output
 * Looks for JSON code blocks (```json ... ```) or plain JSON
 */
function extractJSONBlock(raw: string): string {
  // Try to find JSON code block first
  const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/;
  const jsonBlockMatch = raw.match(jsonBlockRegex);
  
  if (jsonBlockMatch) {
    const jsonContent = jsonBlockMatch[1].trim();
    // Check if there's any trailing text after the closing ```
    const afterBlock = raw.substring(jsonBlockMatch.index! + jsonBlockMatch[0].length).trim();
    if (afterBlock.length > 0) {
      throw new Error('Trailing text after JSON block is not allowed');
    }
    return jsonContent;
  }

  // Try to find plain JSON object (starts with { and ends with })
  const jsonObjectRegex = /(\{[\s\S]*\})/;
  const jsonObjectMatch = raw.match(jsonObjectRegex);
  
  if (jsonObjectMatch) {
    const jsonContent = jsonObjectMatch[1].trim();
    // Check if there's any text before or after the JSON object
    const beforeMatch = raw.substring(0, jsonObjectMatch.index!).trim();
    const afterMatch = raw.substring(jsonObjectMatch.index! + jsonObjectMatch[0].length).trim();
    
    if (beforeMatch.length > 0 || afterMatch.length > 0) {
      throw new Error('Trailing text around JSON object is not allowed');
    }
    return jsonContent;
  }

  // If no JSON block found, try parsing the entire string as JSON
  // This will fail if it's not valid JSON, which is what we want
  return raw.trim();
}

/**
 * Validates that parsed object contains all required keys
 */
function validateRequiredKeys(parsed: ParsedOutput, requiredKeys: string[]): void {
  if (requiredKeys.length === 0) {
    return; // No requirements
  }

  const missingKeys: string[] = [];
  for (const key of requiredKeys) {
    if (!(key in parsed)) {
      missingKeys.push(key);
    }
  }

  if (missingKeys.length > 0) {
    throw new Error(`Missing required keys: ${missingKeys.join(', ')}`);
  }
}

/**
 * Strict Cursor output parsing
 * Extracts JSON block only
 * Rejects malformed JSON, trailing text, missing required keys
 * Does not coerce types or auto-fix
 */
export function parseCursorOutput(
  raw: string,
  options: ParseOptions = {}
): ParsedOutput {
  const startTime = Date.now();
  const { requiredKeys = [] } = options;
  
  logVerbose('ParseCursorOutput', 'Parsing cursor output', {
    raw_length: raw?.length || 0,
    required_keys_count: requiredKeys.length,
    required_keys: requiredKeys,
  });

  if (!raw || typeof raw !== 'string') {
    logVerbose('ParseCursorOutput', 'Invalid input', {
      raw_type: typeof raw,
      raw_length: raw?.length || 0,
    });
    throw new Error('Input must be a non-empty string');
  }

  // Extract JSON block
  const extractStartTime = Date.now();
  let jsonString: string;
  try {
    jsonString = extractJSONBlock(raw);
    const extractDuration = Date.now() - extractStartTime;
    logPerformance('ExtractJSONBlock', extractDuration, {
      raw_length: raw.length,
      json_string_length: jsonString.length,
    });
    logVerbose('ParseCursorOutput', 'JSON block extracted', {
      raw_length: raw.length,
      json_string_length: jsonString.length,
    });
  } catch (error) {
    const extractDuration = Date.now() - extractStartTime;
    logPerformance('ExtractJSONBlock', extractDuration, { failed: true });
    logVerbose('ParseCursorOutput', 'JSON block extraction failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error(`Failed to extract JSON block: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Parse JSON - this will throw on malformed JSON
  const parseStartTime = Date.now();
  let parsed: ParsedOutput;
  try {
    const parsedValue = JSON.parse(jsonString);
    
    // Ensure it's an object (not array, string, number, etc.)
    if (typeof parsedValue !== 'object' || parsedValue === null || Array.isArray(parsedValue)) {
      const parseDuration = Date.now() - parseStartTime;
      logPerformance('JSONParse', parseDuration, { failed: true, reason: 'not_object' });
      logVerbose('ParseCursorOutput', 'Parsed value is not an object', {
        type: typeof parsedValue,
        is_array: Array.isArray(parsedValue),
      });
      throw new Error('Parsed JSON must be an object, not array or primitive');
    }
    
    parsed = parsedValue as ParsedOutput;
    const parseDuration = Date.now() - parseStartTime;
    logPerformance('JSONParse', parseDuration, {
      json_string_length: jsonString.length,
      parsed_keys_count: Object.keys(parsed).length,
    });
    logVerbose('ParseCursorOutput', 'JSON parsed successfully', {
      parsed_keys: Object.keys(parsed),
      parsed_keys_count: Object.keys(parsed).length,
    });
  } catch (error) {
    const parseDuration = Date.now() - parseStartTime;
    logPerformance('JSONParse', parseDuration, { failed: true });
    logVerbose('ParseCursorOutput', 'JSON parsing failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    if (error instanceof SyntaxError) {
      throw new Error(`Malformed JSON: ${error.message}`);
    }
    throw new Error(`JSON parsing failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Validate required keys
  const validationStartTime = Date.now();
  try {
    validateRequiredKeys(parsed, requiredKeys);
    const validationDuration = Date.now() - validationStartTime;
    logPerformance('ValidateRequiredKeys', validationDuration, {
      required_keys_count: requiredKeys.length,
    });
    logVerbose('ParseCursorOutput', 'Required keys validated', {
      required_keys: requiredKeys,
      all_present: true,
    });
  } catch (error) {
    const validationDuration = Date.now() - validationStartTime;
    logPerformance('ValidateRequiredKeys', validationDuration, { failed: true });
    logVerbose('ParseCursorOutput', 'Required keys validation failed', {
      error: error instanceof Error ? error.message : String(error),
      required_keys: requiredKeys,
      parsed_keys: Object.keys(parsed),
    });
    throw error; // Re-throw validation errors as-is
  }

  const totalDuration = Date.now() - startTime;
  logPerformance('ParseCursorOutput', totalDuration, {
    raw_length: raw.length,
    parsed_keys_count: Object.keys(parsed).length,
  });
  logVerbose('ParseCursorOutput', 'Output parsing completed successfully', {
    parsed_keys_count: Object.keys(parsed).length,
  });
  
  return parsed;
}

